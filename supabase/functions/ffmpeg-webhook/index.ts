import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Handle GET requests (browser visits)
    if (req.method === 'GET') {
        return new Response(JSON.stringify({
            message: "FFmpeg Webhook Endpoint",
            status: "active",
            method: "POST only",
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log('🎬 FFmpeg webhook received!');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Parse webhook payload from FFmpeg microservice
        const requestBody = await req.text();
        console.log('Raw request body:', requestBody);

        // Better JSON parsing with error handling
        let webhookData;
        try {
            webhookData = JSON.parse(requestBody);
        } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            console.error('Body that failed to parse:', requestBody);

            return new Response(JSON.stringify({
                success: false,
                error: "Invalid JSON",
                bodyReceived: requestBody,
                parseError: parseError.message
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log('Parsed webhook data:', JSON.stringify(webhookData, null, 2));

        // Extract data - handle both old and new structures
        const {
            generation_id,
            processing_id,
            status,
            timestamp,
            result_url,
            thumbnail_url,
            watermarked_url,
            resized_url,
            result,
            error: error_message,
            processing_time,
            metadata
        } = webhookData;

        // FIXED: Infer processing type from available URLs instead of requiring it
        let processing_type = 'unknown';
        if (thumbnail_url) {
            processing_type = 'thumbnail';
        } else if (watermarked_url) {
            processing_type = 'watermark';
        } else if (resized_url) {
            processing_type = 'resize';
        }

        console.log('FFmpeg webhook received:', {
            generation_id,
            processing_id,
            processing_type,
            status,
            has_result_url: !!result_url,
            has_thumbnail_url: !!thumbnail_url,
            has_watermarked_url: !!watermarked_url,
            has_resized_url: !!resized_url
        });

        if (!generation_id) {
            throw new Error('Generation ID is required');
        }

        // Get the generation record
        const { data: generation, error: fetchError } = await supabase
            .from('ai_generations')
            .select('user_id, metadata, tool_type, output_file_url')
            .eq('id', generation_id)
            .single();

        if (fetchError || !generation) {
            console.error('❌ Error fetching generation:', fetchError);
            throw new Error('Generation not found');
        }

        console.log('📋 Generation details:', {
            user_id: generation.user_id,
            tool_type: generation.tool_type,
            has_output: !!generation.output_file_url
        });

        // Prepare update data
        const updateData: any = {
            updated_at: new Date().toISOString()
        };

        // Handle different processing types and statuses
        if (status === 'completed') {
            // Handle thumbnail completion
            if (processing_type === 'thumbnail' && thumbnail_url) {
                updateData.thumbnail_url = thumbnail_url;

                updateData.metadata = {
                    ...generation.metadata,
                    thumbnail_processing: {
                        status: 'completed',
                        thumbnail_url: thumbnail_url,
                        completed_at: new Date().toISOString(),
                        processing_time: processing_time,
                        processing_id: processing_id
                    }
                };

                console.log('✅ Thumbnail processing completed:', thumbnail_url);
            }

            // Handle watermark completion
            else if (processing_type === 'watermark' && watermarked_url) {
                // Replace output_file_url with watermarked version for free users
                updateData.output_file_url = watermarked_url;

                updateData.metadata = {
                    ...generation.metadata,
                    watermark_processing: {
                        status: 'completed',
                        watermarked_url: watermarked_url,
                        original_url: result?.original_url || generation.output_file_url,
                        completed_at: new Date().toISOString(),
                        processing_time: processing_time,
                        processing_id: processing_id,
                        watermarked: true
                    }
                };

                console.log('✅ Watermark processing completed:', watermarked_url);
            }

            // Handle resize completion
            else if (processing_type === 'resize' && resized_url) {
                updateData.output_file_url = resized_url;

                updateData.metadata = {
                    ...generation.metadata,
                    resize_processing: {
                        status: 'completed',
                        resized_url: resized_url,
                        original_url: result?.original_url || generation.output_file_url,
                        completed_at: new Date().toISOString(),
                        processing_time: processing_time,
                        processing_id: processing_id,
                        new_size: result?.new_size,
                        dimensions: result?.dimensions
                    }
                };

                console.log('✅ Resize processing completed:', resized_url);
            }

            // Handle generic completion with result_url
            else if (result_url) {
                updateData.metadata = {
                    ...generation.metadata,
                    ffmpeg_processing: {
                        status: 'completed',
                        result_url: result_url,
                        completed_at: new Date().toISOString(),
                        processing_time: processing_time,
                        processing_id: processing_id,
                        processing_type: processing_type
                    }
                };

                console.log('✅ Generic FFmpeg processing completed:', result_url);
            }
        }
        else if (status === 'failed') {
            // Handle processing failures
            updateData.metadata = {
                ...generation.metadata,
                [`${processing_type}_processing`]: {
                    status: 'failed',
                    error_message: error_message,
                    failed_at: new Date().toISOString(),
                    processing_id: processing_id
                }
            };

            console.log(`❌ ${processing_type} processing failed:`, error_message);
        }
        else if (status === 'processing') {
            // Handle processing updates
            updateData.metadata = {
                ...generation.metadata,
                [`${processing_type}_processing`]: {
                    status: 'processing',
                    started_at: new Date().toISOString(),
                    processing_id: processing_id,
                    message: webhookData.message || 'Processing in progress...'
                }
            };

            console.log(`📊 ${processing_type} processing in progress`);
        }

        // Update the generation record
        const { error: updateError } = await supabase
            .from('ai_generations')
            .update(updateData)
            .eq('id', generation_id);

        if (updateError) {
            console.error('❌ Error updating generation:', updateError);
            throw new Error(`Database update failed: ${updateError.message}`);
        }

        console.log('✅ Successfully updated generation:', {
            generation_id,
            processing_id,
            processing_type,
            status,
            thumbnail_updated: !!updateData.thumbnail_url,
            output_updated: !!updateData.output_file_url,
            metadata_updated: !!updateData.metadata
        });

        return new Response(JSON.stringify({
            success: true,
            generation_id,
            processing_id,
            processing_type,
            status,
            message: `${processing_type} processing ${status}`,
            urls_received: {
                result_url: !!result_url,
                thumbnail_url: !!thumbnail_url,
                watermarked_url: !!watermarked_url,
                resized_url: !!resized_url
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('❌ Error in ffmpeg-webhook:', error);
        console.error('Error stack:', error.stack);

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        );
    }
});
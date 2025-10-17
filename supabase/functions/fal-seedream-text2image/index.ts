import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const FAL_KEY = Deno.env.get('FAL_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Get request body
        const {
            generationId,
            prompt,
            imageSize,
            numImages,
            maxImages,
            enableSafetyChecker,
            seed
        } = await req.json();

        console.log('🎨 SeeDream v4 Text-to-Image generation started:', {
            generationId,
            promptLength: prompt?.length,
            imageSize,
            numImages,
            maxImages,
            enableSafetyChecker,
            seed
        });

        // Validate inputs
        if (!generationId || !prompt) {
            throw new Error('Missing required fields: generationId and prompt are required');
        }

        // Prepare FAL.ai request payload
        const falPayload = {
            prompt: prompt,
            image_size: imageSize || { width: 1024, height: 1024 },
            num_images: numImages || 3,
            max_images: maxImages || 3,
            enable_safety_checker: enableSafetyChecker !== false,
            seed: seed || Math.floor(Math.random() * 100000000)
        };

        console.log('📤 Sending to FAL.ai:', falPayload);

        // Call FAL.ai API
        const falResponse = await fetch('https://queue.fal.run/fal-ai/bytedance/seedream/v4/text-to-image', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${FAL_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...falPayload,
                webhooks: [
                    {
                        url: `${SUPABASE_URL}/functions/v1/fal-webhook`,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                ]
            }),
        });

        if (!falResponse.ok) {
            const errorText = await falResponse.text();
            console.error('❌ FAL.ai API error:', {
                status: falResponse.status,
                statusText: falResponse.statusText,
                error: errorText
            });
            throw new Error(`FAL.ai API error: ${falResponse.status} - ${errorText}`);
        }

        const falResult = await falResponse.json();
        console.log('✅ FAL.ai response received:', {
            request_id: falResult.request_id,
            status: falResult.status
        });

        // Update generation with FAL request ID
        const { error: updateError } = await supabase
            .from('ai_generations')
            .update({
                metadata: {
                    fal_request_id: falResult.request_id,
                    model: 'fal-ai/bytedance/seedream/v4/text-to-image',
                    prompt: prompt,
                    image_size: imageSize,
                    num_images: numImages,
                    max_images: maxImages,
                    enable_safety_checker: enableSafetyChecker,
                    seed: seed,
                    initiated_at: new Date().toISOString()
                }
            })
            .eq('id', generationId);

        if (updateError) {
            console.error('❌ Error updating generation:', updateError);
            throw updateError;
        }

        console.log('✅ Generation record updated with FAL request ID');

        return new Response(
            JSON.stringify({
                success: true,
                request_id: falResult.request_id,
                generation_id: generationId,
                message: 'Generation started successfully'
            }),
            {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                },
            }
        );

    } catch (error) {
        console.error('💥 Error in fal-seedream-text2image:', error);

        return new Response(
            JSON.stringify({
                error: error.message || 'Internal server error',
                details: error.toString()
            }),
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                },
            }
        );
    }
});
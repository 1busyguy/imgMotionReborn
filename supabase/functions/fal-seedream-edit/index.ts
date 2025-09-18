import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Enhanced logging function for FAL.ai requests
function logFALRequest(url: string, params: any, generationId: string) {
    console.log('📡 === FAL.AI REQUEST DETAILS ===');
    console.log('🔗 URL:', url);
    console.log('🆔 Generation ID:', generationId);
    console.log('📋 Request Parameters:', JSON.stringify(params, null, 2));
    console.log('⏰ Request Timestamp:', new Date().toISOString());
    console.log('📡 === END REQUEST DETAILS ===');
}

// Enhanced logging function for FAL.ai responses
function logFALResponse(response: Response, responseBody: string, generationId: string) {
    console.log('📨 === FAL.AI RESPONSE DETAILS ===');
    console.log('🆔 Generation ID:', generationId);
    console.log('📢 Status Code:', response.status);
    console.log('📝 Status Text:', response.statusText);
    console.log('📋 Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('📄 Response Body Length:', responseBody.length);
    console.log('📄 Full Response Body:', responseBody);
    console.log('⏰ Response Timestamp:', new Date().toISOString());

    // Special handling for error status codes
    if (response.status === 422) {
        console.log('🚫 === CONTENT VIOLATION DETECTED (422) ===');
        console.log('🚫 This indicates content policy violation');
        console.log('🚫 Response Body:', responseBody);

        try {
            const errorData = JSON.parse(responseBody);
            console.log('🚫 Parsed Error Data:', JSON.stringify(errorData, null, 2));

            if (errorData.detail) {
                console.log('🚫 Error Details:', JSON.stringify(errorData.detail, null, 2));
            }
        } catch (e) {
            console.log('🚫 Could not parse error JSON, raw body:', responseBody);
        }
        console.log('🚫 === END CONTENT VIOLATION ANALYSIS ===');
    } else if (response.status === 500) {
        console.log('🔥 === SERVER ERROR DETECTED (500) ===');
        console.log('🔥 This indicates FAL.ai server issues');
        console.log('🔥 Response Body:', responseBody);
        console.log('🔥 === END SERVER ERROR ANALYSIS ===');
    } else if (response.status >= 400) {
        console.log('❌ === CLIENT/SERVER ERROR ===');
        console.log('❌ Status:', response.status);
        console.log('❌ Response Body:', responseBody);
        console.log('❌ === END ERROR ANALYSIS ===');
    }

    console.log('📨 === END RESPONSE DETAILS ===');
}

// Helper function to get the correct webhook URL
function getWebhookUrl(): string {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const projectRef = supabaseUrl.split('.')[0].replace('https://', '');
    return `https://${projectRef}.supabase.co/functions/v1/fal-webhook`;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let generationId: string | undefined;

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Authenticate user
        const authHeader = req.headers.get('Authorization')!;
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);

        if (!user) {
            throw new Error('Unauthorized');
        }

        // Parse request body with ALL parameters including max_images
        const {
            generationId: reqGenerationId,
            prompt,
            imageUrls = [],
            imageSize, // Can be object {width, height} or string
            numImages = 3, // 1-6 range
            maxImages = 3, // 1-6 range (updated from 1-4)
            enableSafetyChecker = true,
            seed
        } = await req.json();

        generationId = reqGenerationId;

        console.log('✨ SeeDream v4 Edit generation request:', {
            generationId,
            prompt: prompt?.substring(0, 50) + '...',
            numSourceImages: imageUrls.length,
            numImages,
            maxImages,
            imageSize,
            seed,
            enableSafetyChecker
        });

        // Validate required parameters
        if (!generationId || !prompt?.trim() || !imageUrls.length) {
            throw new Error('Missing required parameters: generationId, prompt, and imageUrls are required');
        }

        // SeeDream accepts 1-10 images (updated from 2-10)
        if (imageUrls.length < 1) {
            throw new Error('SeeDream v4 Edit requires at least 1 image');
        }

        if (imageUrls.length > 10) {
            throw new Error('Maximum 10 images allowed for SeeDream v4 Edit');
        }

        // Validate numImages range (1-6)
        if (numImages < 1 || numImages > 6) {
            throw new Error('Number of images must be between 1 and 6');
        }

        // Validate maxImages range (1-6, updated from 1-4)
        if (maxImages < 1 || maxImages > 6) {
            throw new Error('Max images (variation diversity) must be between 1 and 6');
        }

        // Handle image_size - can be object or string
        let finalImageSize: any;

        if (typeof imageSize === 'object' && imageSize.width && imageSize.height) {
            // Object format with width/height
            finalImageSize = {
                width: imageSize.width,
                height: imageSize.height
            };
            console.log(`Using custom image size: ${imageSize.width}x${imageSize.height}`);
        } else if (typeof imageSize === 'string') {
            // String format (legacy support)
            const validSizes = ['square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9'];
            if (validSizes.includes(imageSize)) {
                finalImageSize = imageSize;
                console.log(`Using preset image size: ${imageSize}`);
            } else {
                // Default to square_hd if invalid string
                console.warn(`Invalid image size string: ${imageSize}, defaulting to square_hd`);
                finalImageSize = 'square_hd';
            }
        } else {
            // Default to 1024x1024 if no valid size provided
            finalImageSize = {
                width: 1024,
                height: 1024
            };
            console.log('No valid image size provided, defaulting to 1024x1024');
        }

        // Update generation status to processing
        await supabase
            .from('ai_generations')
            .update({
                status: 'processing',
                updated_at: new Date().toISOString()
            })
            .eq('id', generationId)
            .eq('user_id', user.id);

        // Get FAL API key from environment
        const falApiKey = Deno.env.get('FAL_API_KEY');
        if (!falApiKey) {
            throw new Error('FAL_API_KEY not configured');
        }

        // Prepare FAL.ai API request for SeeDream v4 Edit
        // All parameters matching the FAL.ai specification
        const falParams = {
            prompt: prompt.trim(),
            image_urls: imageUrls,
            image_size: finalImageSize, // Can be object or string
            num_images: Math.max(1, Math.min(6, numImages)), // 1-6 range
            max_images: Math.max(1, Math.min(6, maxImages)), // 1-6 range (updated)
            enable_safety_checker: enableSafetyChecker,
            seed: seed || Math.floor(Math.random() * 100000000)
        };

        console.log('📡 Submitting to FAL.ai queue with webhook:', JSON.stringify(falParams, null, 2));

        // Use FAL.ai queue system with webhook
        const webhookUrl = getWebhookUrl();

        // SeeDream v4 Edit endpoint
        const queueUrl = `https://queue.fal.run/fal-ai/bytedance/seedream/v4/edit?fal_webhook=${encodeURIComponent(webhookUrl)}`;

        // Enhanced logging BEFORE request
        logFALRequest(queueUrl, falParams, generationId);

        // Submit to FAL.ai queue
        const falResponse = await fetch(queueUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${falApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(falParams),
        });

        // Enhanced response logging - ALWAYS read the response body
        const responseBody = await falResponse.text();
        logFALResponse(falResponse, responseBody, generationId);

        if (!falResponse.ok) {
            // Store detailed error information in database for analysis
            await supabase
                .from('ai_generations')
                .update({
                    status: 'failed',
                    completed_at: new Date().toISOString(),
                    error_message: `FAL.ai API error (${falResponse.status}): ${responseBody}`,
                    updated_at: new Date().toISOString(), // Ensure updated_at is set to trigger real-time
                    metadata: {
                        fal_error_details: {
                            status_code: falResponse.status,
                            status_text: falResponse.statusText,
                            response_body: responseBody,
                            response_headers: Object.fromEntries(falResponse.headers.entries()),
                            error_timestamp: new Date().toISOString(),
                            request_params: falParams,
                            queue_url: queueUrl
                        },
                        error_type: falResponse.status === 422 ? 'content_violation' :
                            falResponse.status === 500 ? 'server_error' : 'api_error'
                    }
                })
                .eq('id', generationId);

            throw new Error(`FAL.ai API error (${falResponse.status}): ${responseBody}`);
        }

        // Parse the successful response
        let queueResult;
        try {
            queueResult = JSON.parse(responseBody);
        } catch (parseError) {
            console.error('❌ Error parsing FAL.ai response JSON:', parseError);
            throw new Error(`Invalid JSON response from FAL.ai: ${responseBody}`);
        }

        console.log('✅ FAL.ai queue submission successful:', {
            request_id: queueResult.request_id,
            gateway_request_id: queueResult.gateway_request_id
        });

        const requestId = queueResult.request_id;
        if (!requestId) {
            throw new Error('No request_id received from FAL.ai queue');
        }

        // Update generation with queue request ID for webhook tracking
        await supabase
            .from('ai_generations')
            .update({
                metadata: {
                    fal_request_id: requestId,
                    gateway_request_id: queueResult.gateway_request_id,
                    processing_started: new Date().toISOString(),
                    status: 'queued_at_fal',
                    model: 'seedream-v4-edit',
                    tool_type: 'seedream-edit',
                    webhook_url: webhookUrl,
                    webhook_enabled: true,
                    queue_submission_time: new Date().toISOString(),
                    // Store all generation parameters
                    prompt: prompt,
                    num_source_images: imageUrls.length,
                    num_images: numImages,
                    max_images: maxImages,
                    image_size: finalImageSize,
                    seed: falParams.seed,
                    enable_safety_checker: enableSafetyChecker
                }
            })
            .eq('id', generationId);

        console.log('✅ SeeDream v4 Edit request queued successfully, webhook will handle completion');

        // Return immediately - webhook will handle completion
        return new Response(JSON.stringify({
            success: true,
            status: 'queued',
            generation_id: generationId,
            message: 'SeeDream v4 Edit queued successfully. Webhook will update when complete.',
            fal_request_id: requestId,
            estimated_time: '15-30 seconds'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('❌ Error in fal-seedream-edit:', error);

        // Update generation as failed if we have the ID
        if (generationId) {
            try {
                const supabase = createClient(
                    Deno.env.get('SUPABASE_URL') ?? '',
                    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
                );

                await supabase
                    .from('ai_generations')
                    .update({
                        status: 'failed',
                        completed_at: new Date().toISOString(),
                        error_message: error.message
                    })
                    .eq('id', generationId);
            } catch (updateError) {
                console.error('❌ Error updating failed generation:', updateError);
            }
        }

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                generation_id: generationId
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        );
    }
});
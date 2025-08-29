import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';'
import { parseFalError, updateGenerationWithError } from '../_shared/fal-error-handler.ts';

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
    console.log('🔢 Status Code:', response.status);
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

        // Parse request body
        const {
            generationId: reqGenerationId,
            prompt,
            imageUrls = [],
            numImages = 1
        } = await req.json();

        generationId = reqGenerationId;

        console.log('✨ Gemini 2.5 Flash Image Edit generation request:', {
            generationId,
            prompt: prompt?.substring(0, 50) + '...',
            numSourceImages: imageUrls.length,
            numImages
        });

        // Validate required parameters
        if (!generationId || !prompt?.trim() || !imageUrls.length) {
            throw new Error('Missing required parameters: generationId, prompt, and imageUrls are required');
        }

        if (imageUrls.length > 10) {
            throw new Error('Maximum 10 images allowed');
        }

        if (numImages < 1 || numImages > 4) {
            throw new Error('Number of images must be between 1 and 4');
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

        // Prepare FAL.ai API request for Gemini 2.5 Flash Image Edit
        const falParams = {
            prompt: prompt.trim(),
            image_urls: imageUrls,
            num_images: Math.max(1, Math.min(4, numImages))
        };

        console.log('📡 Submitting to FAL.ai queue with webhook:', JSON.stringify(falParams, null, 2));

        // Use FAL.ai queue system with webhook
        const webhookUrl = getWebhookUrl();

        const queueUrl = `https://queue.fal.run/fal-ai/gemini-25-flash-image/edit?fal_webhook=${encodeURIComponent(webhookUrl)}`;

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
          const errorInfo = parseFalError(falResponse, responseBody);
  
          await updateGenerationWithError(
            supabase,
            generationId,
            errorInfo,
            falParams  // You already have this variable! ✅
          );
  
          throw new Error(errorInfo.errorMessage);
        }}

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
                    model: 'gemini-25-flash-image-edit',
                    tool_type: 'gemini-flash-edit',
                    webhook_url: webhookUrl,
                    webhook_enabled: true,
                    queue_submission_time: new Date().toISOString(),
                    // Store generation parameters
                    prompt: prompt,
                    num_source_images: imageUrls.length,
                    num_images: numImages
                }
            })
            .eq('id', generationId);

        console.log('✅ Gemini Flash Image Edit request queued successfully, webhook will handle completion');

        // Return immediately - webhook will handle completion
        return new Response(JSON.stringify({
            success: true,
            status: 'queued',
            generation_id: generationId,
            message: 'Gemini 2.5 Flash Image Edit queued successfully. Webhook will update when complete.',
            fal_request_id: requestId,
            estimated_time: '30-60 seconds'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('❌ Error in fal-gemini-flash-image-edit:', error);

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
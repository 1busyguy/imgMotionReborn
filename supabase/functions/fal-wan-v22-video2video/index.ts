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

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Helper function to get the correct webhook URL
function getWebhookUrl(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const projectRef = supabaseUrl.split('.')[0].replace('https://', '');
  return `https://${projectRef}.supabase.co/functions/v1/fal-webhook`;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let generationId;

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Authenticate user
        const authHeader = req.headers.get('Authorization');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);

        if (!user) {
            throw new Error('Unauthorized');
        }

        // Parse request body
        const {
            generationId: reqGenerationId,
            videoUrl,
            prompt,
            negativePrompt,
            strength = 1,
            numFrames = 121,
            framesPerSecond = 60,
            resolution = '720p',
            aspectRatio = 'auto',
            numInferenceSteps = 40,
            enableSafetyChecker = true,
            enablePromptExpansion = true,
            acceleration = 'none',
            guidanceScale = 10,
            guidanceScale2 = 10,
            shift = 10,
            interpolatorModel = 'film',
            numInterpolatedFrames = 4,
            adjustFpsForInterpolation = true,
            resampleFps = true,
            seed = -1
        } = await req.json();

        generationId = reqGenerationId;

        console.log('🎬 WAN v2.2 Video2Video generation request:', {
            generationId,
            hasVideoUrl: !!videoUrl,
            prompt: prompt?.substring(0, 50) + '...',
            resolution,
            strength,
            aspectRatio
        });

        // Validate required parameters
        if (!generationId || !videoUrl || !prompt?.trim()) {
            throw new Error('Missing required parameters: generationId, videoUrl, and prompt are required');
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

        // Get FAL API key
        const falApiKey = Deno.env.get('FAL_API_KEY');
        if (!falApiKey) {
            throw new Error('FAL_API_KEY not configured');
        }

        // Prepare FAL.ai parameters for WAN v2.2-a14b Video-to-Video
        const falParams = {
            video_url: videoUrl,
            prompt: prompt.trim(),
            strength: Math.max(0, Math.min(1, strength)),
            num_frames: Math.max(81, Math.min(121, numFrames)),
            frames_per_second: Math.max(4, Math.min(60, framesPerSecond)),
            resolution: resolution,
            aspect_ratio: aspectRatio,
            num_inference_steps: Math.max(2, Math.min(40, numInferenceSteps)),
            enable_safety_checker: enableSafetyChecker,
            enable_prompt_expansion: enablePromptExpansion,
            acceleration: acceleration,
            guidance_scale: Math.max(1, Math.min(10, guidanceScale)),
            guidance_scale_2: Math.max(1, Math.min(10, guidanceScale2)),
            shift: Math.max(1, Math.min(10, shift)),
            interpolator_model: interpolatorModel,
            num_interpolated_frames: numInterpolatedFrames,
            adjust_fps_for_interpolation: adjustFpsForInterpolation,
            resample_fps: resampleFps
        };

        // Add optional parameters
        if (negativePrompt && negativePrompt.trim()) {
            falParams.negative_prompt = negativePrompt.trim();
        }
        if (seed && seed > 0) {
            falParams.seed = seed;
        }

        // CORRECT WEBHOOK URL CONSTRUCTION
        const webhookUrl = getWebhookUrl();

        // Use FAL.ai queue system with webhook
        const queueUrl = `https://queue.fal.run/fal-ai/wan/v2.2-a14b/video-to-video?fal_webhook=${encodeURIComponent(webhookUrl)}`;
        
        // Enhanced logging BEFORE request
        logFALRequest(queueUrl, falParams, generationId);

        // Submit to FAL.ai queue
        const falResponse = await fetch(queueUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${falApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(falParams)
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
        
        console.log('✅ FAL.ai queue response:', JSON.stringify(queueResult, null, 2));

        const requestId = queueResult.request_id;
        if (!requestId) {
            throw new Error('No request_id received from FAL.ai');
        }

        // Update generation with request ID
        const { error: updateError } = await supabase
            .from('ai_generations')
            .update({
                metadata: {
                    fal_request_id: requestId,
                    gateway_request_id: queueResult.gateway_request_id,
                    webhook_url: webhookUrl,
                    processing_started: new Date().toISOString(),
                    status: 'queued_at_fal',
                    model: 'wan-v2.2-a14b-video2video',
                    tool_type: 'wan-v22-video2video',
                    webhook_enabled: true,
                    queue_submission_time: new Date().toISOString(),
                    // Store successful request details for debugging
                    fal_request_details: {
                        queue_url: queueUrl,
                        request_params: falParams,
                        response_status: falResponse.status,
                        response_headers: Object.fromEntries(falResponse.headers.entries()),
                        submitted_at: new Date().toISOString()
                    }
                }
            })
            .eq('id', generationId);

        if (updateError) {
            console.error('❌ Error updating generation metadata:', updateError);
        }

        console.log('✅ Request queued, webhook URL:', webhookUrl);

        return new Response(JSON.stringify({
            success: true,
            status: 'queued',
            generation_id: generationId,
            message: 'WAN v2.2 Video2Video generation queued successfully',
            fal_request_id: requestId,
            webhook_url: webhookUrl,
            estimated_time: '2-5 minutes'
        }), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('❌ Error:', error);

        // Update generation as failed
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

        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            generation_id: generationId
        }), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            status: 500
        });
    }
});
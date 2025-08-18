import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Helper function to get the correct webhook URL (copied from working fal-wan-v22-a14b)
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
            imageUrl,
            prompt,
            numFrames = 81,
            framesPerSecond = 16,
            aspectRatio = '16:9',
            numInferenceSteps = 27,
            enableSafetyChecker = true,
            enablePromptExpansion = false,
            acceleration = 'none',
            guidanceScale = 3.5,
            guidanceScale2 = 4,
            shift = 5,
            interpolatorModel = 'film',
            numInterpolatedFrames = 1,
            adjustFpsForInterpolation = true,
            resolution = '1080P',
            promptExtend = true,
            seed = -1,
            loraUrl,
            loraScale = 1.0,
            loras = []
        } = await req.json();

        generationId = reqGenerationId;

        console.log('🎬 WAN v2.2 Img2Video LoRA generation request:', {
            generationId,
            hasImageUrl: !!imageUrl,
            prompt: prompt?.substring(0, 50) + '...',
            resolution,
            hasLoRA: !!loraUrl
        });

        // Validate required parameters
        if (!generationId || !imageUrl || !prompt?.trim()) {
            throw new Error('Missing required parameters: generationId, imageUrl, and prompt are required');
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

        // Prepare FAL.ai parameters for WAN v2.2-a14b Image-to-Video LoRA
        const falParams = {
            image_url: imageUrl,
            prompt: prompt.trim(),
            num_frames: numFrames,
            frames_per_second: framesPerSecond,
            resolution: resolution,
            aspect_ratio: aspectRatio,
            num_inference_steps: numInferenceSteps,
            enable_safety_checker: enableSafetyChecker,
            enable_prompt_expansion: enablePromptExpansion,
            acceleration: acceleration,
            guidance_scale: guidanceScale,
            guidance_scale_2: guidanceScale2,
            shift: shift,
            interpolator_model: interpolatorModel,
            num_interpolated_frames: numInterpolatedFrames,
            adjust_fps_for_interpolation: adjustFpsForInterpolation,
            prompt_extend: promptExtend,
            loras: loras
        };

        // Add seed if provided
        if (seed && seed > 0) {
            falParams.seed = seed;
        }

        console.log('📡 Submitting to FAL.ai with params:', JSON.stringify(falParams, null, 2));

        // CORRECT WEBHOOK URL CONSTRUCTION (copied from working fal-wan-v22-a14b)
        const webhookUrl = getWebhookUrl();
        console.log('🔗 Webhook URL:', webhookUrl);

        // Use FAL.ai queue system with webhook
        const queueUrl = `https://queue.fal.run/fal-ai/wan/v2.2-a14b/image-to-video/lora?fal_webhook=${encodeURIComponent(webhookUrl)}`;

        // Submit to FAL.ai queue
        const falResponse = await fetch(queueUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${falApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(falParams)
        });

        if (!falResponse.ok) {
            const errorText = await falResponse.text();
            console.error('❌ FAL.ai error:', falResponse.status, errorText);
            throw new Error(`FAL.ai error: ${falResponse.status} - ${errorText}`);
        }

        const queueResult = await falResponse.json();
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
                    model: 'wan-v2.2-a14b-img2video-lora',
                    tool_type: 'wan-v22-img2video-lora',
                    webhook_enabled: true,
                    queue_submission_time: new Date().toISOString()
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
            message: 'WAN v2.2 Img2Video LoRA generation queued successfully',
            fal_request_id: requestId,
            webhook_url: webhookUrl,
            estimated_time: '1-3 minutes'
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
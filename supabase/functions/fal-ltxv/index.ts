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

Deno.serve(async (req) => {
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
      imageUrl,
      prompt,
      negativePrompt,
      loras = [],
      resolution = "720p",
      aspectRatio = "auto",
      numFrames = 121,
      firstPassNumInferenceSteps = 8,
      secondPassNumInferenceSteps = 8,
      secondPassSkipInitialSteps = 5,
      frameRate = 24,
      expandPrompt = false,
      reverseVideo = false,
      enableSafetyChecker = true,
      enableDetailPass = false,
      temporalAdainFactor = 0.5,
      toneMapCompressionRatio = 0,
      constantRateFactor = 29,
    } = await req.json();

    generationId = reqGenerationId;

    console.log('🎬 LTXV generation request:', {
      generationId,
      hasImageUrl: !!imageUrl,
      prompt: prompt?.substring(0, 50) + '...',
      resolution,
      aspectRatio,
      numFrames
    });

    // Validate required parameters
    if (!generationId || !imageUrl || !prompt?.trim()) {
      throw new Error('Missing required parameters');
    }

    // Update generation status to processing
    await supabase
      .from('ai_generations')
      .update({ status: 'processing' })
      .eq('id', generationId)
      .eq('user_id', user.id);

    // Get FAL API key from environment
    const falApiKey = Deno.env.get('FAL_API_KEY');
    if (!falApiKey) {
      throw new Error('FAL_API_KEY not configured');
    }

    // Prepare FAL.ai API request for LTXV
    const falParams = {
      prompt: prompt.trim(),
      image_url: imageUrl,
      prompt_extend: false,
      resolution: resolution,
      aspect_ratio: aspectRatio,
      num_frames: numFrames,
      first_pass_num_inference_steps: firstPassNumInferenceSteps,
      second_pass_num_inference_steps: secondPassNumInferenceSteps,
      second_pass_skip_initial_steps: secondPassSkipInitialSteps,
      frame_rate: frameRate,
      expand_prompt: expandPrompt,
      reverse_video: reverseVideo,
      enable_safety_checker: enableSafetyChecker !== false,
      enable_detail_pass: enableDetailPass,
      temporal_adain_factor: temporalAdainFactor,
      tone_map_compression_ratio: toneMapCompressionRatio,
      constant_rate_factor: constantRateFactor
    };

    // Add optional parameters
    if (negativePrompt && negativePrompt.trim()) {
      falParams.negative_prompt = negativePrompt.trim();
    }

    if (loras && Array.isArray(loras) && loras.length > 0) {
      falParams.loras = loras;
    }

    console.log('📡 Submitting to FAL.ai queue with webhook:', JSON.stringify(falParams, null, 2));

    // Use FAL.ai queue system with webhook
    const webhookUrl = getWebhookUrl();
    
    const queueUrl = `https://queue.fal.run/fal-ai/ltxv-13b-098-distilled/image-to-video?fal_webhook=${encodeURIComponent(webhookUrl)}`;
    
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
          model: 'ltxv-13b-098-distilled',
          tool_type: 'ltxv-13b',
          webhook_url: webhookUrl,
          webhook_enabled: true,
          queue_submission_time: new Date().toISOString()
        }
      })
      .eq('id', generationId);

    console.log('✅ LTXV request queued successfully, webhook will handle completion');

    // Return immediately - webhook will handle completion
    return new Response(JSON.stringify({
      success: true,
      status: 'queued',
      generation_id: generationId,
      message: 'LTXV video generation queued successfully. Webhook will update when complete.',
      fal_request_id: requestId,
      estimated_time: '3-8 minutes'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in fal-ltxv:', error);
    
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
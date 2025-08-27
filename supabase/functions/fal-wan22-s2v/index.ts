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
      negative_prompt,
      image_url,
      audio_url,
      num_frames = 92,
      frames_per_second = 22,
      resolution = '480p',
      num_inference_steps = 30,
      enable_safety_checker = true,
      guidance_scale = 4.4,
      shift = 6,
      seed = -1
    } = await req.json();

    generationId = reqGenerationId;

    console.log('🎬 WAN 22 S2V generation request:', {
      generationId,
      hasImageUrl: !!image_url,
      hasAudioUrl: !!audio_url,
      prompt: prompt?.substring(0, 50) + '...',
      resolution,
      num_frames,
      frames_per_second
    });

    // Validate required parameters
    if (!generationId || !prompt?.trim() || !image_url || !audio_url) {
      throw new Error('Missing required parameters: generationId, prompt, image_url, and audio_url are required');
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

    // Prepare FAL.ai API request for WAN 22 S2V
    const falParams = {
      prompt: prompt.trim(),
      image_url: image_url,
      audio_url: audio_url,
      num_frames: Math.max(60, Math.min(120, num_frames)),
      frames_per_second: Math.max(16, Math.min(30, frames_per_second)),
      resolution: resolution,
      num_inference_steps: Math.max(20, Math.min(50, num_inference_steps)),
      enable_safety_checker: enable_safety_checker !== false,
      guidance_scale: Math.max(1.0, Math.min(10.0, guidance_scale)),
      shift: Math.max(1, Math.min(10, shift))
    };

    // Add optional parameters
    if (negative_prompt && negative_prompt.trim()) {
      falParams.negative_prompt = negative_prompt.trim();
    }

    // Only add seed if it's a positive number
    if (seed && seed > 0) {
      falParams.seed = seed;
    }

    console.log('📡 Submitting to FAL.ai queue with webhook:', JSON.stringify(falParams, null, 2));

    // Use FAL.ai queue system with webhook
    const webhookUrl = getWebhookUrl();
    
    const queueUrl = `https://queue.fal.run/fal-ai/wan-22-s2v?fal_webhook=${encodeURIComponent(webhookUrl)}`;
    
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
          model: 'wan-22-s2v',
          tool_type: 'wan22-s2v',
          webhook_url: webhookUrl,
          webhook_enabled: true,
          queue_submission_time: new Date().toISOString()
        }
      })
      .eq('id', generationId);

    console.log('✅ WAN 22 S2V request queued successfully, webhook will handle completion');

    // Return immediately - webhook will handle completion
    return new Response(JSON.stringify({
      success: true,
      status: 'queued',
      generation_id: generationId,
      message: 'WAN 22 S2V video generation queued successfully. Webhook will update when complete.',
      fal_request_id: requestId,
      estimated_time: '3-8 minutes'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in fal-wan22-s2v:', error);
    
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
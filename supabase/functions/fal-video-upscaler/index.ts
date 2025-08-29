import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseFalError, updateGenerationWithError } from '../_shared/fal-error-handler.ts';

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
      videoUrl,
      scale = 2,
      videoAnalysis
    } = await req.json();

    generationId = reqGenerationId;

    console.log('🎬 FAL Video Upscaler generation request:', {
      generationId,
      hasVideoUrl: !!videoUrl,
      scale,
      videoAnalysis: videoAnalysis ? `${videoAnalysis.megapixels}MP` : 'not provided'
    });

    // Validate required parameters
    if (!generationId || !videoUrl) {
      throw new Error('Missing required parameters');
    }

    // Validate scale factor
    if (![2, 4].includes(scale)) {
      throw new Error('Scale must be 2 or 4');
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

    // Prepare FAL.ai API request for video upscaler
    const falParams = {
      video_url: videoUrl,
      prompt_extend: false,
      scale: scale
    };

    console.log('📡 Submitting to FAL.ai queue with webhook:', JSON.stringify(falParams, null, 2));

    // Use FAL.ai queue system with webhook
    const webhookUrl = getWebhookUrl();
    
    console.log('🔗 Webhook URL being used:', webhookUrl);
    console.log('🔗 Encoded webhook URL:', encodeURIComponent(webhookUrl));
    
    const queueUrl = `https://queue.fal.run/fal-ai/video-upscaler?fal_webhook=${encodeURIComponent(webhookUrl)}`;
    
    console.log('📡 Full queue URL:', queueUrl);

    // Submit to FAL.ai queue
    const falResponse = await fetch(queueUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(falParams),
    });

    // Read body ONCE as text first
        const responseBody = await falResponse.text();

        // Handle errors with the new handler
        if (!falResponse.ok) {
          const errorInfo = parseFalError(falResponse, responseBody);
  
          await updateGenerationWithError(
            supabase,
            generationId,
            errorInfo,
            falParams  // or whatever your params are called
          );
  
          throw new Error(errorInfo.errorMessage);
        }

        // Parse successful response from the same responseBody
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
          model: 'fal-ai/video-upscaler',
          tool_type: 'fal-upscaler',
          webhook_url: webhookUrl,
          webhook_enabled: true,
          queue_submission_time: new Date().toISOString(),
          video_analysis: videoAnalysis || null
        }
      })
      .eq('id', generationId);

    console.log('✅ Video Upscaler request queued successfully, webhook will handle completion');

    // Return immediately - webhook will handle completion
    return new Response(JSON.stringify({
      success: true,
      status: 'queued',
      generation_id: generationId,
      message: 'Video upscaling queued successfully. Webhook will update when complete.',
      fal_request_id: requestId,
      estimated_time: '10-20 minutes'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in fal-video-upscaler:', error);
    
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
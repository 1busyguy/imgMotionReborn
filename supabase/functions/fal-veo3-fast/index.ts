import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper function to get the correct webhook URL
function getWebhookUrl(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const projectRef = supabaseUrl.split('.')[0].replace('https://', '');
  return `https://${projectRef}.supabase.co/functions/v1/fal-webhook`;
}

serve(async (req) => {
  // Handle CORS preflight requests
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
      aspectRatio = "16:9",
      duration = "8s",
      enhancePrompt = true,
      resolution = "720p",
      generateAudio = true,
      negativePrompt,
      enableSafetyChecker = true
    } = await req.json();

    generationId = reqGenerationId;

    console.log('🎬 VEO3 Fast generation request:', {
      generationId,
      prompt: prompt?.substring(0, 50) + '...',
      aspectRatio,
      duration,
      resolution,
      enhancePrompt,
      generateAudio
    });

    // Validate required parameters
    if (!generationId) {
      throw new Error('Generation ID is required');
    }

    if (!prompt?.trim()) {
      throw new Error('Prompt is required');
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

    // Prepare FAL.ai API request for VEO3 Fast
    const falParams = {
      prompt: prompt.trim(),
      aspect_ratio: aspectRatio,
      duration: duration,
      enhance_prompt: enhancePrompt,
      resolution: resolution,
      generate_audio: generateAudio,
      enable_safety_checker: enableSafetyChecker !== false
    };

    // Add negative prompt if provided
    if (negativePrompt && negativePrompt.trim()) {
      falParams.negative_prompt = negativePrompt.trim();
    }

    console.log('📡 Submitting to FAL.ai with params:', JSON.stringify(falParams, null, 2));

    // Get the correct webhook URL
    const webhookUrl = getWebhookUrl();
    console.log('🔗 Webhook URL:', webhookUrl);

    // Use FAL.ai queue system with webhook
    const queueUrl = `https://queue.fal.run/fal-ai/veo3/fast?fal_webhook=${encodeURIComponent(webhookUrl)}`;
    console.log('📡 Queue URL:', queueUrl);

    // Submit to FAL.ai queue
    const falResponse = await fetch(queueUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(falParams),
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

    // Update generation with queue request ID for webhook tracking
    const { error: updateError } = await supabase
      .from('ai_generations')
      .update({
        metadata: {
          fal_request_id: requestId,
          gateway_request_id: queueResult.gateway_request_id,
          webhook_url: webhookUrl,
          processing_started: new Date().toISOString(),
          status: 'queued_at_fal',
          model: 'fal-ai/veo3/fast',
          tool_type: 'veo3-fast-video',  // This will be the folder name in storage
          webhook_enabled: true,
          queue_submission_time: new Date().toISOString(),
          // Store generation parameters
          aspect_ratio: aspectRatio,
          duration: duration,
          resolution: resolution,
          enhance_prompt: enhancePrompt,
          generate_audio: generateAudio
        }
      })
      .eq('id', generationId);

    if (updateError) {
      console.error('❌ Error updating generation metadata:', updateError);
    }

    console.log('✅ VEO3 Fast request queued successfully, webhook will handle completion');

    // Return immediately - webhook will handle completion
    return new Response(JSON.stringify({
      success: true,
      status: 'queued',
      generation_id: generationId,
      message: 'VEO3 Fast video generation queued successfully. Webhook will update when complete.',
      fal_request_id: requestId,
      webhook_url: webhookUrl,
      estimated_time: '30 seconds to 2 minutes'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in fal-veo3-fast:', error);
    
    // Try to update generation status to failed if we have the ID
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
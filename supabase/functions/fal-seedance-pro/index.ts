import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      imageUrl,
      prompt,
      resolution = "1080p",
      duration = "5",
      cameraFixed = false,
      seed = -1
    } = await req.json();

    generationId = reqGenerationId;

    console.log('🎬 Seedance Pro generation request:', {
      generationId,
      hasImageUrl: !!imageUrl,
      prompt: prompt?.substring(0, 50) + '...',
      resolution,
      duration,
      cameraFixed
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

    // Prepare FAL.ai API request for Seedance Pro
    const falParams = {
      image_url: imageUrl,
      prompt: prompt.trim(),
      prompt_extend: false,
      resolution: resolution,
      duration: String(duration),
      camera_fixed: cameraFixed
    };

    // Only add seed if it's a positive number
    if (seed && seed > 0) {
      falParams.seed = seed;
    }

    console.log('📡 Submitting to FAL.ai queue with webhook:', JSON.stringify(falParams, null, 2));

    // Use FAL.ai queue system with webhook
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fal-webhook`;
    
    console.log('🔗 Webhook URL being used:', webhookUrl);
    console.log('🔗 Encoded webhook URL:', encodeURIComponent(webhookUrl));
    
    const queueUrl = `https://queue.fal.run/fal-ai/bytedance/seedance/v1/pro/image-to-video?fal_webhook=${encodeURIComponent(webhookUrl)}`;
    
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

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error('❌ FAL.ai queue submission error:', falResponse.status, errorText);
      throw new Error(`FAL.ai queue submission error: ${falResponse.status} - ${errorText}`);
    }

    const queueResult = await falResponse.json();
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
          model: 'seedance-pro-v1',
          webhook_enabled: true,
          queue_submission_time: new Date().toISOString()
        }
      })
      .eq('id', generationId);

    console.log('✅ Seedance Pro request queued successfully, webhook will handle completion');

    // Return immediately - webhook will handle completion
    return new Response(JSON.stringify({
      success: true,
      status: 'queued',
      generation_id: generationId,
      message: 'Seedance Pro video generation queued successfully. Webhook will update when complete.',
      fal_request_id: requestId,
      estimated_time: '3-8 minutes'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in fal-seedance-pro:', error);
    
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
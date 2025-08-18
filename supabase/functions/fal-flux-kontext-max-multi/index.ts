import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      imageUrls = [],
      guidanceScale = 10.5,
      numImages = 1,
      outputFormat = "png",
      safetyTolerance = "2",
      seed = -1,
      aspectRatio = "1:1"
    } = await req.json();

    generationId = reqGenerationId;

    console.log('🎨 FLUX Kontext Max Multi generation request:', {
      generationId,
      prompt: prompt?.substring(0, 50) + '...',
      numSourceImages: imageUrls.length,
      numImages,
      aspectRatio,
      outputFormat
    });

    // Validate required parameters
    if (!generationId) {
      throw new Error('Generation ID is required');
    }

    if (!prompt?.trim()) {
      throw new Error('Prompt is required');
    }

    if (!imageUrls || imageUrls.length === 0) {
      throw new Error('At least one image URL is required');
    }

    if (imageUrls.length > 10) {
      throw new Error('Maximum 10 images allowed');
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

    // Prepare FAL.ai API request for FLUX Pro Kontext Max Multi
    const falParams = {
      prompt: prompt.trim(),
      image_urls: imageUrls,
      guidance_scale: Math.max(1.0, Math.min(20.0, guidanceScale)),
      num_images: Math.max(1, Math.min(4, numImages)),
      output_format: outputFormat,
      safety_tolerance: safetyTolerance,
      aspect_ratio: aspectRatio
    };

    // Only add seed if it's a positive number
    if (seed && seed > 0) {
      falParams.seed = seed;
    }

    console.log('📡 Submitting to FAL.ai with params:', JSON.stringify(falParams, null, 2));

    // Get the correct webhook URL
    const webhookUrl = getWebhookUrl();
    console.log('🔗 Webhook URL:', webhookUrl);

    // Use FAL.ai queue system with webhook
    const queueUrl = `https://queue.fal.run/fal-ai/flux-pro/kontext/max/multi?fal_webhook=${encodeURIComponent(webhookUrl)}`;
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
          model: 'fal-ai/flux-pro/kontext/max/multi',
          tool_type: 'flux-kontext-max-multi',
          webhook_enabled: true,
          queue_submission_time: new Date().toISOString(),
          // Store generation parameters
          guidance_scale: guidanceScale,
          num_images: numImages,
          output_format: outputFormat,
          safety_tolerance: safetyTolerance,
          aspect_ratio: aspectRatio,
          seed: seed > 0 ? seed : 'random',
          num_source_images: imageUrls.length,
          prompt: prompt
        }
      })
      .eq('id', generationId);

    if (updateError) {
      console.error('❌ Error updating generation metadata:', updateError);
    }

    console.log('✅ FLUX Kontext Max Multi request queued successfully, webhook will handle completion');

    // Return immediately - webhook will handle completion
    return new Response(JSON.stringify({
      success: true,
      status: 'queued',
      generation_id: generationId,
      message: 'FLUX Kontext Max Multi generation queued successfully. Webhook will update when complete.',
      fal_request_id: requestId,
      webhook_url: webhookUrl,
      estimated_time: '30-60 seconds',
      num_images_requested: numImages,
      num_source_images: imageUrls.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in fal-flux-kontext-max-multi:', error);
    
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
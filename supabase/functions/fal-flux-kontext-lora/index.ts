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
      negativePrompt,
      numImages = 1,
      guidanceScale = 7.5,
      steps = 30,
      seed = -1,
      enableSafetyChecker = true,
      outputFormat = "jpeg",
      outputQuality = 95,
      imageSize = "square_hd",
      loraScale = 1.0,
      loraUrl,
      expandPrompt = true,
      format = "jpeg"
    } = await req.json();

    generationId = reqGenerationId;

    console.log('🎨 FLUX Kontext LoRA generation request:', {
      generationId,
      prompt: prompt?.substring(0, 50) + '...',
      numImages,
      imageSize,
      hasLoRA: !!loraUrl
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

    // Prepare FAL.ai API request for flux-kontext-lora/text-to-image
    const falParams = {
      prompt: prompt.trim(),
      guidance_scale: Math.max(1.0, Math.min(20.0, guidanceScale)),
      num_images: Math.max(1, Math.min(4, numImages)),
      num_inference_steps: Math.max(10, Math.min(50, steps)),
      enable_safety_checker: enableSafetyChecker !== false,
      output_format: outputFormat,
      image_size: imageSize,
      expand_prompt: expandPrompt,
      format: format
    };

    // Add optional parameters
    if (negativePrompt && negativePrompt.trim()) {
      falParams.negative_prompt = negativePrompt.trim();
    }

    // Add LoRA parameters if LoRA URL is provided
    if (loraUrl && loraUrl.trim()) {
      falParams.lora_url = loraUrl.trim();
      falParams.lora_scale = Math.max(0.0, Math.min(2.0, loraScale));
    }

    // Add output quality for JPEG
    if (outputFormat === 'jpeg' && outputQuality) {
      falParams.output_quality = Math.max(60, Math.min(100, outputQuality));
    }

    // Only add seed if it's a positive number
    if (seed && seed > 0) {
      falParams.seed = seed;
    }

    console.log('📡 Submitting to FAL.ai with params:', JSON.stringify(falParams, null, 2));

    // Get the correct webhook URL
    const webhookUrl = getWebhookUrl();
    console.log('🔗 Webhook URL:', webhookUrl);

    // Use FAL.ai queue system with webhook
    const queueUrl = `https://queue.fal.run/fal-ai/flux-kontext-lora/text-to-image?fal_webhook=${encodeURIComponent(webhookUrl)}`;
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
          model: 'fal-ai/flux-kontext-lora/text-to-image',
          tool_type: 'flux-kontext-lora',  // This will be the folder name in storage
          webhook_enabled: true,
          queue_submission_time: new Date().toISOString(),
          // Store generation parameters
          guidance_scale: guidanceScale,
          steps: steps,
          seed: seed > 0 ? seed : 'random',
          output_format: outputFormat,
          output_quality: outputQuality,
          image_size: imageSize,
          num_images: numImages,
          lora_used: !!(loraUrl && loraUrl.trim()),
          lora_url: loraUrl,
          lora_scale: loraUrl ? loraScale : null,
          expand_prompt: expandPrompt,
          prompt: prompt,
          negative_prompt: negativePrompt || null
        }
      })
      .eq('id', generationId);

    if (updateError) {
      console.error('❌ Error updating generation metadata:', updateError);
    }

    console.log('✅ FLUX Kontext LoRA request queued successfully, webhook will handle completion');

    // Return immediately - webhook will handle completion
    return new Response(JSON.stringify({
      success: true,
      status: 'queued',
      generation_id: generationId,
      message: 'FLUX Kontext LoRA image generation queued successfully. Webhook will update when complete.',
      fal_request_id: requestId,
      webhook_url: webhookUrl,
      estimated_time: '30-60 seconds',
      num_images_requested: numImages,
      lora_enabled: !!(loraUrl && loraUrl.trim())
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in fal-flux-kontext-lora:', error);
    
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
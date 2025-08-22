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

Deno.serve(async (req) => {
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
      negative_prompt,
      duration = 8,
      cfg_strength = 4.5,
      num_steps = 25,
      seed = 34710
    } = await req.json();

    generationId = reqGenerationId;

    console.log('🎵 MMAudio v2 generation request:', {
      generationId,
      prompt: prompt?.substring(0, 50) + '...',
      duration,
      cfg_strength,
      num_steps
    });

    // Validate required parameters
    if (!generationId) {
      throw new Error('Generation ID is required');
    }

    if (!prompt?.trim()) {
      throw new Error('Audio prompt is required');
    }

    // Validate duration range
    if (duration < 1 || duration > 30) {
      throw new Error('Duration must be between 1 and 30 seconds');
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

    // Prepare FAL.ai API request for MMAudio v2
    const falParams = {
      prompt: prompt.trim(),
      duration: Math.max(1, Math.min(30, duration)),
      cfg_strength: Math.max(1.0, Math.min(10.0, cfg_strength)),
      num_steps: Math.max(10, Math.min(100, num_steps)),
      seed: seed
    };

    // Add negative prompt if provided
    if (negative_prompt && negative_prompt.trim()) {
      falParams.negative_prompt = negative_prompt.trim();
    }

    console.log('📡 Submitting to FAL.ai with params:', JSON.stringify(falParams, null, 2));

    // Get the correct webhook URL
    const webhookUrl = getWebhookUrl();
    console.log('🔗 Webhook URL:', webhookUrl);

    // Use FAL.ai queue system with webhook
    const queueUrl = `https://queue.fal.run/fal-ai/mmaudio-v2/text-to-audio?fal_webhook=${encodeURIComponent(webhookUrl)}`;
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
          model: 'fal-ai/mmaudio-v2/text-to-audio',
          tool_type: 'mmaudio-v2',  // This will be the folder name in storage
          webhook_enabled: true,
          queue_submission_time: new Date().toISOString(),
          // Store generation parameters
          duration: duration,
          cfg_strength: cfg_strength,
          num_steps: num_steps,
          seed: seed,
          prompt: prompt,
          negative_prompt: negative_prompt || null
        }
      })
      .eq('id', generationId);

    if (updateError) {
      console.error('❌ Error updating generation metadata:', updateError);
    }

    console.log('✅ MMAudio v2 request queued successfully, webhook will handle completion');

    // Return immediately - webhook will handle completion
    return new Response(JSON.stringify({
      success: true,
      status: 'queued',
      generation_id: generationId,
      message: 'MMAudio v2 audio generation queued successfully. Webhook will update when complete.',
      fal_request_id: requestId,
      webhook_url: webhookUrl,
      estimated_time: '30-60 seconds'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in fal-mmaudio-v2:', error);
    
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
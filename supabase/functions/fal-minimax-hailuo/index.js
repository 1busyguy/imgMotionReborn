// supabase/functions/fal-minimax-hailuo/index.js
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { 
      generationId,
      imageUrl,
      prompt,
      duration,
      promptOptimizer
    } = await req.json();

    // Validate required parameters
    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Motion prompt is required');
    }

    // Submit to FAL.ai
    const falApiKey = Deno.env.get('FAL_API_KEY');
    if (!falApiKey) {
      throw new Error('FAL_API_KEY not configured');
    }

    // Prepare request parameters for Minimax Hailuo Standard
    const falParams = {
      prompt: prompt.trim(),
      image_url: imageUrl,
      duration: String(duration || 6), // API expects string
      prompt_optimizer: promptOptimizer !== false // Default to true
    };

    console.log('Submitting to FAL.ai with params:', JSON.stringify(falParams));

    const falResponse = await fetch('https://fal.run/fal-ai/minimax/hailuo-02/standard/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(falParams),
    });

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error('FAL.ai error:', errorText);
      
      // Try to parse error for better message
      let errorMessage = `FAL.ai API error: ${falResponse.status}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // Use default error message
      }
      
      throw new Error(errorMessage);
    }

    const result = await falResponse.json();
    console.log('FAL.ai response:', JSON.stringify(result));

    // Extract video URL - Minimax returns video directly
    let videoUrl = null;
    
    // Check different possible response structures
    if (result.video) {
      videoUrl = result.video.url || result.video;
    } else if (result.url) {
      videoUrl = result.url;
    } else if (result.output) {
      videoUrl = result.output.url || result.output;
    } else if (typeof result === 'string') {
      videoUrl = result;
    }

    if (!videoUrl) {
      console.error('Unexpected response structure:', result);
      throw new Error('No video URL in response');
    }

    // Update generation record with success
    const { error: updateError } = await supabaseClient
      .from('ai_generations')
      .update({
        output_file_url: videoUrl,
        status: 'completed',
        completed_at: new Date().toISOString(),
        metadata: {
          fal_request_id: result.request_id || null,
          processing_time: result.processing_time || null,
          video_duration: duration,
          prompt_optimized: promptOptimizer !== false,
          original_prompt: prompt,
          optimized_prompt: result.optimized_prompt || null
        }
      })
      .eq('id', generationId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating generation:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        video_url: videoUrl,
        generation_id: generationId,
        metadata: {
          duration: duration,
          prompt_optimized: promptOptimizer !== false
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in fal-minimax-hailuo function:', error);

    // Update generation as failed
    if (generationId) {
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseClient
          .from('ai_generations')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', generationId);
      } catch (updateError) {
        console.error('Error updating failed generation:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check the Edge Function logs for more information'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
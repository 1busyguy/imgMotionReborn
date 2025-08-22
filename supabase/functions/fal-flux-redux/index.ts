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
      generationId,
      guideImageUrl,
      prompt = "",
      guidanceScale = 7.5,
      numImages = 1,
      width = 1024,
      height = 1024,
      outputFormat = "png",
      safetyTolerance = "2",
      ipAdapterWeight = 0.5,
      steps = 30,
      seed = -1,
      enableSafetyChecker = true
    } = await req.json();

    console.log('FLUX Redux generation request:', {
      generationId,
      hasGuideImage: !!guideImageUrl,
      prompt: prompt.substring(0, 50) + '...',
      guidanceScale,
      numImages,
      dimensions: `${width}x${height}`
    });

    // Validate required parameters
    if (!generationId) {
      throw new Error('Generation ID is required');
    }

    if (!guideImageUrl) {
      throw new Error('Guide image URL is required');
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

    // Prepare FAL.ai API request
    const falParams = {
      image_url: guideImageUrl,
      prompt: prompt || "",
      guidance_scale: Math.max(1.0, Math.min(20.0, guidanceScale)),
      num_images: Math.max(1, Math.min(4, numImages)),
      image_size: {
        width: Math.max(256, Math.min(2048, width)),
        height: Math.max(256, Math.min(2048, height))
      },
      ip_adapter_weight: Math.max(0.0, Math.min(1.0, ipAdapterWeight)),
      num_inference_steps: Math.max(10, Math.min(50, steps)),
      enable_safety_checker: enableSafetyChecker !== false,
      safety_tolerance: safetyTolerance,
      output_format: outputFormat
    };

    // Only add seed if it's a positive number
    if (seed && seed > 0) {
      falParams.seed = seed;
    }

    console.log('Calling FAL.ai API with params:', JSON.stringify(falParams, null, 2));

    // Call FAL.ai API directly
    const falResponse = await fetch('https://fal.run/fal-ai/flux-pro/v1.1/redux', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(falParams),
    });

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error('FAL.ai API error:', falResponse.status, errorText);
      throw new Error(`FAL.ai API error: ${falResponse.status} - ${errorText}`);
    }

    const submitResult = await falResponse.json();
    console.log('FAL.ai submission result:', JSON.stringify(submitResult, null, 2));

    // Check if we got immediate result or need to poll
    let finalResult = submitResult;
    let requestId = submitResult.request_id;

    // If we have a request_id, we need to poll for completion
    if (requestId && !submitResult.images) {
      console.log('🔄 Polling for completion with request_id:', requestId);
      
      // Update generation with request ID for tracking
      await supabase
        .from('ai_generations')
        .update({
          metadata: {
            fal_request_id: requestId,
            processing_started: new Date().toISOString(),
            status: 'submitted_to_fal'
          }
        })
        .eq('id', generationId);

      // Poll for completion (max 5 minutes)
      const maxAttempts = 30; // 30 attempts × 10 seconds = 5 minutes
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts++;
        
        console.log(`🔍 Polling attempt ${attempts}/${maxAttempts} for request ${requestId}`);
        
        try {
          const statusResponse = await fetch(`https://fal.run/fal-ai/flux-pro/v1.1/redux/requests/${requestId}/status`, {
            headers: {
              'Authorization': `Key ${falApiKey}`,
            },
          });

          if (statusResponse.ok) {
            const statusResult = await statusResponse.json();
            console.log(`📊 Status check ${attempts}:`, statusResult.status);
            
            if (statusResult.status === 'COMPLETED') {
              // Get the final result
              const resultResponse = await fetch(`https://fal.run/fal-ai/flux-pro/v1.1/redux/requests/${requestId}`, {
                headers: {
                  'Authorization': `Key ${falApiKey}`,
                },
              });
              
              if (resultResponse.ok) {
                finalResult = await resultResponse.json();
                console.log('🎉 Got final result from FAL.ai');
                break;
              }
            } else if (statusResult.status === 'FAILED') {
              throw new Error('FAL.ai generation failed');
            }
            // Continue polling if status is IN_PROGRESS or IN_QUEUE
          }
        } catch (pollError) {
          console.warn(`⚠️ Polling attempt ${attempts} failed:`, pollError.message);
          // Continue polling unless it's the last attempt
          if (attempts === maxAttempts) {
            throw new Error('Polling failed after maximum attempts');
          }
        }
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Generation timed out after 5 minutes');
      }
    }

    // Extract image URLs from FAL.ai response
    let outputUrls = [];
    let primaryUrl = null;
    
    if (finalResult.images && Array.isArray(finalResult.images)) {
      for (const img of finalResult.images) {
        if (img && typeof img === 'object' && img.url) {
          outputUrls.push(img.url);
        }
      }
      primaryUrl = outputUrls[0];
    } else if (finalResult.image_url) {
      // Handle single image response format
      primaryUrl = finalResult.image_url;
      outputUrls = [primaryUrl];
    }

    if (!primaryUrl) {
      throw new Error('No images generated by FAL.ai API');
    }

    console.log('Generated image URLs:', outputUrls);
    console.log('Primary URL:', primaryUrl);

    // Update generation with result - this triggers real-time updates
    const { error: updateError } = await supabase
      .from('ai_generations')
      .update({
        output_file_url: outputUrls.length === 1 ? primaryUrl : JSON.stringify(outputUrls),
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          fal_request_id: requestId || finalResult.request_id,
          processing_time: finalResult.processing_time || 'unknown',
          num_images_generated: outputUrls.length,
          primary_url: primaryUrl,
          all_urls: outputUrls,
          model: 'flux-redux-v1.1',
          guidance_scale: guidanceScale,
          ip_adapter_weight: ipAdapterWeight,
          steps: steps,
          seed: finalResult.seed || 'random',
          width: finalResult.images?.[0]?.width || width,
          height: finalResult.images?.[0]?.height || height,
          output_format: outputFormat,
          safety_tolerance: safetyTolerance,
          has_nsfw_concepts: finalResult.has_nsfw_concepts || [],
          polling_attempts: requestId ? attempts : 0
        }
      })
      .eq('id', generationId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating generation record:', updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log('Generation completed successfully');

    return new Response(JSON.stringify({
      success: true,
      primary_url: primaryUrl,
      all_urls: outputUrls,
      num_images: outputUrls.length,
      generation_id: generationId,
      metadata: {
        fal_request_id: requestId || finalResult.request_id,
        processing_time: finalResult.processing_time,
        num_images_generated: outputUrls.length,
        model: 'flux-redux-v1.1',
        polling_attempts: requestId ? attempts : 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in fal-flux-redux:', error);
    
    // Try to update generation status to failed if we have the ID
    try {
      const { generationId } = await req.json().catch(() => ({}));
      if (generationId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabase
          .from('ai_generations')
          .update({ 
            status: 'failed',
            completed_at: new Date().toISOString()
          })
          .eq('id', generationId);
      }
    } catch (updateError) {
      console.error('Error updating failed generation:', updateError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
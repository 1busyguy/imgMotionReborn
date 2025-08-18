import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { shouldWatermark, addWatermarkMetadata } from '../_shared/watermark-utils.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let generationId;
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      throw new Error('Unauthorized');
    }
    // Get user profile to check subscription status
    const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
    const needsWatermark = shouldWatermark(profile);
    console.log('🎨 Watermark needed for user:', needsWatermark);
    // Parse request body
    const { generationId: reqGenerationId, imageUrl, prompt, numImages = 1, guidanceScale = 7.5, steps = 30, seed = -1, enableSafetyChecker = true, outputFormat = "jpeg", resolutionMode = "1:1", imageAnalysis } = await req.json();
    generationId = reqGenerationId;
    console.log('🎨 FLUX Kontext generation request:', {
      generationId,
      hasImageUrl: !!imageUrl,
      prompt: prompt?.substring(0, 50) + '...',
      numImages,
      resolutionMode
    });
    // Validate required parameters
    if (!generationId) {
      throw new Error('Generation ID is required');
    }
    if (!imageUrl) {
      throw new Error('Image URL is required');
    }
    if (!prompt?.trim()) {
      throw new Error('Prompt is required');
    }
    // Update generation status to processing
    await supabase.from('ai_generations').update({
      status: 'processing',
      updated_at: new Date().toISOString()
    }).eq('id', generationId).eq('user_id', user.id);
    // Get FAL API key from environment
    const falApiKey = Deno.env.get('FAL_API_KEY');
    if (!falApiKey) {
      throw new Error('FAL_API_KEY not configured');
    }
    // Prepare FAL.ai API request for flux-kontext/dev
    const falParams = {
      image_url: imageUrl,
      prompt: prompt,
      guidance_scale: Math.max(1.0, Math.min(20.0, guidanceScale)),
      num_images: Math.max(1, Math.min(4, numImages)),
      num_inference_steps: Math.max(10, Math.min(50, steps)),
      enable_safety_checker: enableSafetyChecker,
      output_format: outputFormat,
      resolution_mode: resolutionMode
    };
    // Only add seed if it's a positive number
    if (seed && seed > 0) {
      falParams.seed = seed;
    }
    console.log('📡 Calling FAL.ai API directly with params:', JSON.stringify(falParams, null, 2));
    // Call FAL.ai API directly
    const falResponse = await fetch('https://fal.run/fal-ai/flux-kontext/dev', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(falParams)
    });
    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error('❌ FAL.ai API error:', falResponse.status, errorText);
      throw new Error(`FAL.ai API error: ${falResponse.status} - ${errorText}`);
    }
    const submitResult = await falResponse.json();
    console.log('📋 FAL.ai submission result:', JSON.stringify(submitResult, null, 2));
    // Check if we got immediate result or need to poll
    let finalResult = submitResult;
    let requestId = submitResult.request_id;
    // If we have a request_id, we need to poll for completion
    if (requestId && !submitResult.images) {
      console.log('🔄 Polling for completion with request_id:', requestId);
      // Update generation with request ID for tracking
      await supabase.from('ai_generations').update({
        metadata: {
          fal_request_id: requestId,
          processing_started: new Date().toISOString(),
          status: 'submitted_to_fal',
          tool_type: 'flux-kontext',
          needs_watermark: needsWatermark,
          ...addWatermarkMetadata({}, needsWatermark)
        }
      }).eq('id', generationId);
      // Poll for completion (max 5 minutes)
      const maxAttempts = 30; // 30 attempts × 10 seconds = 5 minutes
      let attempts1 = 0;
      while(attempts1 < maxAttempts){
        await new Promise((resolve)=>setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts1++;
        console.log(`🔍 Polling attempt ${attempts1}/${maxAttempts} for request ${requestId}`);
        try {
          const statusResponse = await fetch(`https://fal.run/fal-ai/flux-kontext/dev/requests/${requestId}/status`, {
            headers: {
              'Authorization': `Key ${falApiKey}`
            }
          });
          if (statusResponse.ok) {
            const statusResult = await statusResponse.json();
            console.log(`📊 Status check ${attempts1}:`, statusResult.status);
            if (statusResult.status === 'COMPLETED') {
              // Get the final result
              const resultResponse = await fetch(`https://fal.run/fal-ai/flux-kontext/dev/requests/${requestId}`, {
                headers: {
                  'Authorization': `Key ${falApiKey}`
                }
              });
              if (resultResponse.ok) {
                finalResult = await resultResponse.json();
                console.log('🎉 Got final result from FAL.ai');
                break;
              }
            } else if (statusResult.status === 'FAILED') {
              throw new Error('FAL.ai generation failed');
            }
          }
        } catch (pollError) {
          console.warn(`⚠️ Polling attempt ${attempts1} failed:`, pollError.message);
          if (attempts1 === maxAttempts) {
            throw new Error('Polling failed after maximum attempts');
          }
        }
      }
      if (attempts1 >= maxAttempts) {
        throw new Error('Generation timed out after 5 minutes');
      }
    }
    // Extract image URLs from FAL.ai response
    let outputUrls = [];
    let primaryUrl = null;
    if (finalResult.images && Array.isArray(finalResult.images)) {
      for (const img of finalResult.images){
        if (img && typeof img === 'object' && img.url) {
          outputUrls.push(img.url);
        }
      }
      primaryUrl = outputUrls[0];
    } else if (finalResult.image && finalResult.image.url) {
      // Handle single image response format
      primaryUrl = finalResult.image.url;
      outputUrls = [
        primaryUrl
      ];
    }
    if (!primaryUrl) {
      console.error('❌ No images found in response:', JSON.stringify(finalResult, null, 2));
      throw new Error('No images generated by FAL.ai API');
    }
    console.log('📸 Generated image URLs:', outputUrls);
    console.log('📸 Primary URL:', primaryUrl);
    // Store images permanently in Supabase Storage
    let finalUrls = [];
    let finalPrimaryUrl = primaryUrl;
    try {
      console.log('📥 Storing images permanently...');
      for(let i = 0; i < outputUrls.length; i++){
        const imageUrl = outputUrls[i];
        const response = await fetch(imageUrl);
        if (response.ok) {
          const imageData = await response.arrayBuffer();
          const timestamp = Date.now();
          const fileExtension = outputFormat === 'jpeg' ? 'jpg' : 'png';
          const filePath = `${user.id}/flux-kontext/${timestamp}_${i}.${fileExtension}`;
          const { error: uploadError } = await supabase.storage.from('user-files').upload(filePath, imageData, {
            contentType: `image/${outputFormat}`,
            upsert: true
          });
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('user-files').getPublicUrl(filePath);
            finalUrls.push(publicUrl);
            if (i === 0) {
              finalPrimaryUrl = publicUrl;
            }
            console.log(`✅ Image ${i + 1} stored permanently:`, publicUrl);
          } else {
            console.error(`❌ Failed to upload image ${i + 1}:`, uploadError);
            finalUrls.push(imageUrl); // Keep original URL if upload fails
          }
        }
      }
    } catch (storageError) {
      console.warn('⚠️ Storage failed, using original URLs:', storageError);
      finalUrls = outputUrls;
    }
    // Update generation with result
    const { error: updateError } = await supabase.from('ai_generations').update({
      output_file_url: finalUrls.length === 1 ? finalPrimaryUrl : JSON.stringify(finalUrls),
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        fal_request_id: requestId || finalResult.request_id,
        processing_time: finalResult.processing_time || 'unknown',
        num_images_generated: finalUrls.length,
        primary_url: finalPrimaryUrl,
        all_urls: finalUrls,
        original_urls: outputUrls,
        model: 'flux-kontext-dev',
        tool_type: 'flux-kontext',
        guidance_scale: guidanceScale,
        steps: steps,
        seed: finalResult.seed || 'random',
        resolution_mode: resolutionMode,
        output_format: outputFormat,
        input_image_analysis: imageAnalysis || null,
        has_nsfw_concepts: finalResult.has_nsfw_concepts || [],
        polling_attempts: requestId ? attempts : 0,
        needs_watermark: needsWatermark,
        ...addWatermarkMetadata({}, needsWatermark)
      }
    }).eq('id', generationId).eq('user_id', user.id);
    if (updateError) {
      console.error('❌ Error updating generation record:', updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }
    console.log('✅ Generation completed successfully');
    return new Response(JSON.stringify({
      success: true,
      primary_url: finalPrimaryUrl,
      all_urls: finalUrls,
      num_images: finalUrls.length,
      generation_id: generationId,
      metadata: {
        fal_request_id: requestId || finalResult.request_id,
        processing_time: finalResult.processing_time,
        num_images_generated: finalUrls.length,
        model: 'flux-kontext-dev',
        polling_attempts: requestId ? attempts : 0
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error in fal-flux-kontext:', error);
    // Try to update generation status to failed if we have the ID
    if (generationId) {
      try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        await supabase.from('ai_generations').update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message
        }).eq('id', generationId);
      } catch (updateError) {
        console.error('❌ Error updating failed generation:', updateError);
      }
    }
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      generation_id: generationId
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});

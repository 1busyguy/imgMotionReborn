import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400', // 24 hours
};

// Helper function to ensure CORS headers are always included
function createResponse(body: any, options: ResponseInit = {}) {
  return new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    {
      ...options,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }
  );
}

// Timeout wrapper for fetch requests
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 60000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return createResponse('ok', { status: 200 });
  }

  let generationId: string | null = null;
  let supabase: any = null;

  try {
    // Initialize Supabase client
    supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized: Invalid token');
    }

    // Parse request body with timeout
    const requestData = await Promise.race([
      req.json(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request body parsing timeout')), 5000)
      )
    ]);

    const {
      generationId: reqGenerationId,
      imageUrl
    } = requestData as any;

    generationId = reqGenerationId;

    console.log('BRIA Background Remover generation request:', {
      generationId,
      userId: user.id,
      hasImageUrl: !!imageUrl,
      timestamp: new Date().toISOString()
    });

    // Validate required parameters
    if (!generationId) {
      throw new Error('Generation ID is required');
    }

    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    // Update generation status to processing
    const { error: statusUpdateError } = await supabase
      .from('ai_generations')
      .update({ 
        status: 'processing'
      })
      .eq('id', generationId)
      .eq('user_id', user.id);

    if (statusUpdateError) {
      console.error('Error updating generation status:', statusUpdateError);
      throw new Error(`Failed to update generation status: ${statusUpdateError.message}`);
    }

    // Get FAL API key from environment
    const falApiKey = Deno.env.get('FAL_API_KEY');
    if (!falApiKey) {
      throw new Error('FAL_API_KEY not configured in environment variables');
    }

    // Prepare FAL.ai API request for background removal
    const falParams = {
      image_url: imageUrl
    };

    console.log('Calling FAL.ai API with params:', JSON.stringify(falParams, null, 2));

    // Call FAL.ai API for background removal
    const falResponse = await fetchWithTimeout(
      'https://fal.run/fal-ai/bria/background/remove',
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(falParams),
      },
      60000 // 1 minute timeout for submission
    );

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error('FAL.ai API error:', {
        status: falResponse.status,
        statusText: falResponse.statusText,
        error: errorText
      });
      throw new Error(`FAL.ai API error: ${falResponse.status} - ${errorText}`);
    }

    const submitResult = await falResponse.json();
    console.log('FAL.ai submission result:', JSON.stringify(submitResult, null, 2));

    // Check if we got immediate result or need to poll
    let finalResult = submitResult;
    let requestId = submitResult.request_id;

    // If we have a request_id, we need to poll for completion
    if (requestId && !submitResult.image) {
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

      // Poll for completion (max 5 minutes for image processing)
      const maxAttempts = 30; // 30 attempts × 10 seconds = 5 minutes
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts++;
        
        console.log(`🔍 Polling attempt ${attempts}/${maxAttempts} for request ${requestId}`);
        
        try {
          const statusResponse = await fetch(`https://fal.run/fal-ai/bria/background/remove/requests/${requestId}/status`, {
            headers: {
              'Authorization': `Key ${falApiKey}`,
            },
          });

          if (statusResponse.ok) {
            const statusResult = await statusResponse.json();
            console.log(`📊 Status check ${attempts}:`, statusResult.status);
            
            if (statusResult.status === 'COMPLETED') {
              // Get the final result
              const resultResponse = await fetch(`https://fal.run/fal-ai/bria/background/remove/requests/${requestId}`, {
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
          }
        } catch (pollError) {
          console.warn(`⚠️ Polling attempt ${attempts} failed:`, pollError.message);
          if (attempts === maxAttempts) {
            throw new Error('Polling failed after maximum attempts');
          }
        }
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Generation timed out after 5 minutes');
      }
    }

    const result = finalResult;
    console.log('FAL.ai response received:', {
      hasImage: !!result.image,
      requestId: result.request_id,
      timestamp: new Date().toISOString()
    });

    // Extract image URL from FAL.ai response
    let outputImageUrl = null;
    
    if (result.image && typeof result.image === 'object' && result.image.url) {
      outputImageUrl = result.image.url;
    } else if (typeof result.image === 'string') {
      outputImageUrl = result.image;
    } else if (result.url) {
      outputImageUrl = result.url;
    }

    if (!outputImageUrl) {
      console.error('No output image URL in response:', result);
      throw new Error('No output image URL generated by FAL.ai API');
    }

    console.log('Generated background-removed image URL:', outputImageUrl);

    // Update generation with result
    const { error: updateError } = await supabase
      .from('ai_generations')
      .update({
        output_file_url: outputImageUrl,
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          fal_request_id: result.request_id,
          processing_time: result.processing_time || 'unknown',
          model: 'bria-background-remover',
          input_image_url: imageUrl,
          output_format: 'png',
          polling_attempts: requestId ? attempts : 0
        }
      })
      .eq('id', generationId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating generation record:', updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log('Background removal completed successfully for generation:', generationId);

    return createResponse({
      success: true,
      image_url: outputImageUrl,
      generation_id: generationId,
      metadata: {
        fal_request_id: result.request_id,
        processing_time: result.processing_time,
        model: 'bria-background-remover',
        polling_attempts: requestId ? attempts : 0
      }
    });

  } catch (error) {
    console.error('Error in fal-bria-bg-remove:', {
      error: error.message,
      generationId,
      timestamp: new Date().toISOString()
    });
    
    // Try to update generation status to failed if we have the ID and supabase client
    if (generationId && supabase) {
      try {
        await supabase
          .from('ai_generations')
          .update({ 
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error.message
          })
          .eq('id', generationId);
        console.log('Updated background removal status to failed for:', generationId);
      } catch (updateError) {
        console.error('Error updating failed generation:', updateError);
      }
    }
    
    // Always return a response with CORS headers
    return createResponse(
      { 
        success: false, 
        error: error.message,
        generation_id: generationId
      },
      { status: 500 }
    );
  }
});
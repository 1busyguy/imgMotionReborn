// supabase/functions/ai-scene-gen/index.ts
// AI Scene Generator Edge Function
// 
// This function handles scene generation requests by routing them to different AI models
// based on the modelType parameter. It uses an ASYNC PATTERN where:
// 1. Request is submitted to the model API
// 2. Function returns immediately with "processing" status
// 3. Model API calls back via webhook when complete
// 4. Webhook updates the database with results
//
// SUPPORTED MODELS:
// - WAN (Default): Basic image-to-video via Railway API
// - WAN Pro: Professional quality via FAL.ai direct
// - Pixverse v3.5: Fast generation via FAL.ai direct  
// - LUMA Ray2: High quality via FAL.ai direct
//
// TO ADD NEW MODELS:
// 1. Add model to modelOptions array in frontend
// 2. Add case in getModelEndpoint() function
// 3. Add parameter mapping in prepareModelParams() function
// 4. Test with async pattern (submit → return → webhook)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RequestBody {
  generationId: string;
  imageUrl: string;
  theme?: string;
  background?: string;
  mainSubject?: string;
  toneAndColor?: string;
  actionDirection: string;
  sceneVision?: string;
  resolution: string;
  inferenceSteps: number;
  safetyChecker: boolean;
  promptExpansion: boolean;
  numChains: number;
  seed: number;
  modelType: string;
  modelParams?: any;
}

interface ModelConfig {
  endpoint: string;
  useRailway: boolean;
  useFAL: boolean;
  timeout: number; // Timeout for submission only
  estimatedProcessingTime: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Helper function to ensure CORS headers are always included
function createResponse(body: any, status: number = 200) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// Model configuration mapping
// TO ADD NEW MODEL: Add entry here with appropriate config
function getModelConfig(modelType: string): ModelConfig {
  const normalizedType = modelType.toLowerCase().replace(/[^a-z]/g, '');
  
  switch (normalizedType) {
    case 'wan':
    case 'wandefault':
      return {
        endpoint: 'railway',
        useRailway: true,
        useFAL: false,
        timeout: 15000, // 15 seconds for submission
        estimatedProcessingTime: '3-8 minutes'
      };
      
    case 'wanpro':
      return {
        endpoint: 'https://fal.run/fal-ai/wan-pro/image-to-video',
        useRailway: false,
        useFAL: true,
        timeout: 10000, // 10 seconds for submission
        estimatedProcessingTime: '3-7 minutes'
      };
      
    case 'pixversev35':
    case 'pixverse':
      return {
        endpoint: 'https://fal.run/fal-ai/pixverse/v4.5/fast/image-to-video',
        useRailway: false,
        useFAL: true,
        timeout: 10000,
        estimatedProcessingTime: '2-5 minutes'
      };
      
    case 'lumaray2':
    case 'luma':
      return {
        endpoint: 'https://fal.run/fal-ai/luma-ray2/image-to-video',
        useRailway: false,
        useFAL: true,
        timeout: 12000,
        estimatedProcessingTime: '4-10 minutes'
      };
      
    // TO ADD NEW MODEL: Add case here
    // case 'newmodel':
    //   return {
    //     endpoint: 'https://fal.run/fal-ai/new-model/endpoint',
    //     useRailway: false,
    //     useFAL: true,
    //     timeout: 10000,
    //     estimatedProcessingTime: 'X-Y minutes'
    //   };
      
    default:
      console.log(`⚠️ Unknown model type: ${modelType}, using WAN default`);
      return {
        endpoint: 'railway',
        useRailway: true,
        useFAL: false,
        timeout: 15000,
        estimatedProcessingTime: '3-8 minutes'
      };
  }
}

// Prepare model-specific parameters
// TO ADD NEW MODEL: Add parameter mapping here
function prepareModelParams(modelType: string, params: RequestBody): any {
  const normalizedType = modelType.toLowerCase().replace(/[^a-z]/g, '');
  
  switch (normalizedType) {
    case 'wanpro':
      return {
        image_url: params.imageUrl,
        prompt: params.actionDirection,
        enable_safety_checker: params.safetyChecker !== false,
        seed: params.seed !== -1 ? params.seed : undefined
      };
      
    case 'pixversev35':
    case 'pixverse':
      return {
        image_url: params.imageUrl,
        prompt: params.actionDirection,
        style: params.modelParams?.style || null,
        negative_prompt: params.modelParams?.negative_prompt || "",
        aspect_ratio: params.modelParams?.aspect_ratio || "16:9",
        seed: params.seed !== -1 ? params.seed : undefined
      };
      
    case 'lumaray2':
    case 'luma':
      return {
        image_url: params.imageUrl,
        prompt: params.actionDirection,
        aspect_ratio: params.modelParams?.aspect_ratio || "16:9",
        loop: params.modelParams?.loop || false,
        seed: params.seed !== -1 ? params.seed : undefined
      };
      
    // TO ADD NEW MODEL: Add parameter mapping here
    // case 'newmodel':
    //   return {
    //     image_url: params.imageUrl,
    //     prompt: params.actionDirection,
    //     // Add model-specific parameters
    //     custom_param: params.modelParams?.custom_param || 'default'
    //   };
      
    default:
      // Railway API parameters (WAN default)
      return {
        generation_id: params.generationId,
        image_url: params.imageUrl,
        theme: String(params.theme || ""),
        background: String(params.background || ""),
        main_subject: String(params.mainSubject || ""),
        tone_and_color: String(params.toneAndColor || ""),
        action_direction: params.actionDirection,
        scene_vision: String(params.sceneVision || ""),
        resolution: params.resolution,
        inference_steps: Number(params.inferenceSteps),
        safety_checker: Boolean(params.safetyChecker),
        prompt_expansion: Boolean(params.promptExpansion),
        num_chains: Number(params.numChains),
        seed: params.seed !== -1 ? params.seed : null,
        model_type: 'wan',
        model_params: params.modelParams || {},
        webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/railway-webhook`
      };
  }
}

// Handle FAL.ai direct calls with async pattern
async function handleFALDirect(
  supabaseClient: any, 
  user: any, 
  generationId: string, 
  modelConfig: ModelConfig,
  falParams: any
): Promise<Response> {
  const falApiKey = Deno.env.get('FAL_API_KEY');
  if (!falApiKey) {
    throw new Error('FAL_API_KEY not configured');
  }

  console.log(`📡 Calling FAL.ai directly: ${modelConfig.endpoint}`);
  console.log('📡 FAL params:', JSON.stringify(falParams, null, 2));

  // Submit to FAL.ai with timeout for submission only
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), modelConfig.timeout);
  
  try {
    const falResponse = await fetch(modelConfig.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(falParams),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error('❌ FAL.ai API error:', falResponse.status, errorText);
      throw new Error(`FAL.ai API error: ${falResponse.status} - ${errorText}`);
    }

    const result = await falResponse.json();
    console.log('✅ FAL.ai submission successful:', {
      hasRequestId: !!result.request_id,
      status: result.status || 'submitted'
    });

    // Update generation with FAL request ID for tracking
    await supabaseClient
      .from('ai_generations')
      .update({
        status: 'processing',
        metadata: {
          fal_request_id: result.request_id,
          model_endpoint: modelConfig.endpoint,
          processing_started: new Date().toISOString(),
          estimated_completion: modelConfig.estimatedProcessingTime,
          submitted_to_fal: true
        }
      })
      .eq('id', generationId)
      .eq('user_id', user.id);

    // Return immediately - FAL.ai will process asynchronously
    return createResponse({
      success: true,
      status: 'processing',
      generation_id: generationId,
      message: `Scene generation started successfully. Processing will take ${modelConfig.estimatedProcessingTime}.`,
      fal_request_id: result.request_id,
      estimated_completion: modelConfig.estimatedProcessingTime
    });

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.log('⏰ FAL.ai submission timeout, but request may still be processing');
      
      // Mark as processing since FAL might still be working
      await supabaseClient
        .from('ai_generations')
        .update({
          status: 'processing',
          metadata: {
            submission_timeout: true,
            processing_started: new Date().toISOString(),
            note: 'Submission timed out but FAL.ai may still be processing'
          }
        })
        .eq('id', generationId);
      
      return createResponse({
        success: true,
        status: 'processing',
        generation_id: generationId,
        message: `Scene generation submitted. Processing will take ${modelConfig.estimatedProcessingTime}.`,
        timeout_handled: true
      });
    }
    
    throw error;
  }
}

// Handle Railway API calls with async pattern
async function handleRailwayCall(
  supabaseClient: any,
  user: any,
  generationId: string,
  modelConfig: ModelConfig,
  railwayParams: any
): Promise<Response> {
  const railwayApiUrl = 'https://ai-scene-maker-production.up.railway.app';
  
  console.log('🚂 Calling Railway API:', `${railwayApiUrl}/api/v1/generate-scene`);
  console.log('🚂 Railway params:', JSON.stringify(railwayParams, null, 2));

  // Submit to Railway with timeout for submission only
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), modelConfig.timeout);
  
  try {
    const railwayResponse = await fetch(`${railwayApiUrl}/api/v1/generate-scene`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RAILWAY_API_KEY') || 'railway-api-key'}`
      },
      body: JSON.stringify(railwayParams),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!railwayResponse.ok) {
      const errorText = await railwayResponse.text();
      console.error('❌ Railway API error:', railwayResponse.status, errorText);
      
      let errorMessage = `Railway API error: ${railwayResponse.status}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        errorMessage = `Railway API error: ${railwayResponse.status} - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    const result = await railwayResponse.json();
    console.log('✅ Railway submission successful:', JSON.stringify(result));

    // Update generation status to processing
    await supabaseClient
      .from('ai_generations')
      .update({
        status: 'processing',
        metadata: {
          railway_generation_id: result.generation_id || 'unknown',
          processing_started: new Date().toISOString(),
          estimated_completion: modelConfig.estimatedProcessingTime,
          submitted_to_railway: true,
          model_type: railwayParams.model_type
        }
      })
      .eq('id', generationId)
      .eq('user_id', user.id);

    // Return immediately - Railway will webhook when complete
    return createResponse({
      success: true,
      status: 'processing',
      generation_id: generationId,
      message: `Scene generation started successfully. Processing will take ${modelConfig.estimatedProcessingTime}.`,
      railway_generation_id: result.generation_id || 'unknown',
      estimated_completion: modelConfig.estimatedProcessingTime
    });

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.log('⏰ Railway submission timeout, but request may still be processing');
      
      // Mark as processing since Railway might still be working
      await supabaseClient
        .from('ai_generations')
        .update({
          status: 'processing',
          metadata: {
            submission_timeout: true,
            processing_started: new Date().toISOString(),
            note: 'Submission timed out but Railway may still be processing'
          }
        })
        .eq('id', generationId);
      
      return createResponse({
        success: true,
        status: 'processing',
        generation_id: generationId,
        message: `Scene generation submitted. Processing will take ${modelConfig.estimatedProcessingTime}.`,
        timeout_handled: true
      });
    }
    
    throw error;
  }
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return createResponse('ok');
  }

  let generationId: string | undefined;

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse and validate request body
    const body: RequestBody = await req.json();
    generationId = body.generationId;
    
    const { 
      imageUrl,
      actionDirection,
      modelType
    } = body;

    // Validate required parameters
    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    if (!actionDirection || actionDirection.trim().length === 0) {
      throw new Error('Action direction is required');
    }

    console.log('🎬 AI Scene Generation request:', {
      generationId,
      modelType,
      hasImageUrl: !!imageUrl,
      actionDirection: actionDirection.substring(0, 50) + '...'
    });

    // Get model configuration
    const modelConfig = getModelConfig(modelType);
    console.log('🔧 Model config:', {
      modelType,
      useRailway: modelConfig.useRailway,
      useFAL: modelConfig.useFAL,
      endpoint: modelConfig.endpoint,
      estimatedTime: modelConfig.estimatedProcessingTime
    });

    // Route to appropriate handler based on model
    if (modelConfig.useFAL) {
      // ASYNC PATTERN: Direct FAL.ai models
      // These models are called directly and return immediately
      // FAL.ai processes asynchronously and we poll or webhook for results
      
      const falParams = prepareModelParams(modelType, body);
      return await handleFALDirect(supabaseClient, user, generationId, modelConfig, falParams);
      
    } else if (modelConfig.useRailway) {
      // ASYNC PATTERN: Railway API models  
      // Railway processes the request and calls back via webhook when complete
      
      const railwayParams = prepareModelParams(modelType, body);
      return await handleRailwayCall(supabaseClient, user, generationId, modelConfig, railwayParams);
      
    } else {
      throw new Error(`Model ${modelType} not properly configured`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Error in ai-scene-gen function:', errorMessage);

    // Update generation as failed if we have the ID
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
            error_message: errorMessage,
            completed_at: new Date().toISOString()
          })
          .eq('id', generationId);
      } catch (updateError) {
        console.error('Error updating failed generation:', updateError);
      }
    }

    return createResponse({
      error: errorMessage,
      details: 'Check the Edge Function logs for more information'
    }, 400);
  }
});

// WEBHOOK COMPLETION PATTERN:
// 
// For FAL.ai models, you need to set up polling or webhooks:
// 1. FAL.ai returns a request_id immediately
// 2. You can poll FAL.ai status endpoint: GET https://fal.run/fal-ai/requests/{request_id}/status
// 3. Or set up FAL.ai webhook to call your railway-webhook function
// 4. When complete, update the ai_generations table with output_file_url
//
// For Railway models:
// 1. Railway processes asynchronously 
// 2. Railway calls the railway-webhook function when complete
// 3. Webhook updates the ai_generations table
//
// ADDING NEW MODELS CHECKLIST:
// ✅ 1. Add to modelOptions in frontend (AISceneGen.jsx)
// ✅ 2. Add case in getModelConfig() function above
// ✅ 3. Add parameter mapping in prepareModelParams() function above  
// ✅ 4. Test async pattern: submit → return → webhook/polling → complete
// ✅ 5. Update frontend to handle new model's specific parameters
// ✅ 6. Add model-specific UI controls if needed
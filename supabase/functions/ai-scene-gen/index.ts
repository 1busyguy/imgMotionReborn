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
  aspectRatio: string;
  inferenceSteps: number;
  safetyChecker: boolean;
  promptExpansion: boolean;
  numChains: number;
  seed: number;
  modelType: string;
  modelParams?: {
    // VEO3 specific
    negativePrompt?: string;
    generateAudio?: boolean;
    enhancePrompt?: boolean;
    // Pixverse specific
    style?: string;
    // LUMA specific
    loop?: boolean;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Helper function to get the correct webhook URL
function getWebhookUrl(webhookName: string = 'railway-webhook'): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const projectRef = supabaseUrl.split('.')[0].replace('https://', '');
  return `https://${projectRef}.supabase.co/functions/v1/${webhookName}`;
}

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

// Map frontend model names to Railway model types
function mapModelType(frontendModelType: string): string {
  const mapping: { [key: string]: string } = {
    'WAN (Default)': 'wan',
    'WAN Pro': 'wan-pro',
    'Pixverse v3.5': 'pixverse',
    'LUMA Ray2': 'luma',
    'VEO3': 'veo3',
    'VEO3 Fast': 'veo3-fast'
  };
  
  return mapping[frontendModelType] || 'wan';
}

// Prepare Railway API parameters based on the Railway main.py structure
function prepareRailwayParams(body: RequestBody, webhookUrl: string): any {
  const railwayModelType = mapModelType(body.modelType);
  
  // Base parameters that all models use
  const baseParams = {
    generation_id: body.generationId,
    image_url: body.imageUrl,
    theme: String(body.theme || ""),
    background: String(body.background || ""),
    main_subject: String(body.mainSubject || ""),
    tone_and_color: String(body.toneAndColor || ""),
    action_direction: body.actionDirection,
    scene_vision: String(body.sceneVision || ""),
    resolution: body.resolution,
    aspect_ratio: body.aspectRatio,
    inference_steps: Number(body.inferenceSteps),
    safety_checker: Boolean(body.safetyChecker),
    prompt_expansion: Boolean(body.promptExpansion),
    num_chains: Number(body.numChains),
    seed: body.seed !== -1 ? body.seed : null,
    model_type: railwayModelType,
    webhook_url: webhookUrl
  };

  // Add model-specific parameters
  let modelParams: any = {};

  switch (railwayModelType) {
    case 'veo3':
    case 'veo3-fast':
      modelParams = {
        duration: "8s",
        negative_prompt: body.modelParams?.negativePrompt || "",
        enhance_prompt: body.modelParams?.enhancePrompt !== false,
        generate_audio: body.modelParams?.generateAudio || false,
        enable_safety_checker: body.safetyChecker !== false
      };
      break;
      
    case 'pixverse':
      modelParams = {
        duration: 5,
        style: body.modelParams?.style || null,
        negative_prompt: body.modelParams?.negativePrompt || "",
        aspect_ratio: body.aspectRatio
      };
      break;
      
    case 'luma':
      modelParams = {
        duration: 5,
        aspect_ratio: body.aspectRatio,
        loop: body.modelParams?.loop || false
      };
      break;
      
    case 'wan-pro':
      modelParams = {
        enable_safety_checker: body.safetyChecker !== false,
        aspect_ratio: body.aspectRatio
      };
      break;
      
    default: // wan
      modelParams = {
        aspect_ratio: body.aspectRatio
      };
  }

  return {
    ...baseParams,
    model_params: modelParams
  };
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
    if (!generationId) {
      throw new Error('Generation ID is required');
    }

    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    if (!actionDirection || actionDirection.trim().length === 0) {
      throw new Error('Action direction is required');
    }

    const railwayModelType = mapModelType(modelType);

    console.log('🎬 AI Scene Generation request:', {
      generationId,
      modelType,
      railwayModelType,
      hasImageUrl: !!imageUrl,
      actionDirection: actionDirection.substring(0, 50) + '...',
      aspectRatio: body.aspectRatio,
      resolution: body.resolution
    });

    // Update generation status to processing
    await supabaseClient
      .from('ai_generations')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', generationId)
      .eq('user_id', user.id);

    // Get the correct webhook URL
    const webhookUrl = getWebhookUrl('railway-webhook');
    console.log('🔗 Webhook URL:', webhookUrl);

    // Prepare Railway API parameters
    const railwayParams = prepareRailwayParams(body, webhookUrl);
    
    console.log('🚂 Calling Railway API with params:', {
      model_type: railwayParams.model_type,
      resolution: railwayParams.resolution,
      aspect_ratio: railwayParams.aspect_ratio,
      num_chains: railwayParams.num_chains,
      webhook_url: railwayParams.webhook_url,
      hasModelParams: !!railwayParams.model_params
    });

    // Get Railway API configuration
    const railwayApiUrl = Deno.env.get('RAILWAY_API_URL') || 'https://ai-scene-maker-production.up.railway.app';
    const railwayApiKey = Deno.env.get('RAILWAY_API_KEY') || 'railway-api-key';

    // Call Railway API with timeout for submission only (15 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const railwayResponse = await fetch(`${railwayApiUrl}/api/v1/generate-scene`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${railwayApiKey}`
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
      console.log('✅ Railway submission successful:', {
        generation_id: result.generation_id,
        model_type: railwayParams.model_type,
        estimated_time: getEstimatedTime(railwayParams.model_type)
      });

      // Store input image in standardized location for content moderation
      if (body.imageUrl) {
        try {
          const timestamp = Date.now();
          const imageResponse = await fetch(body.imageUrl);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const imagePath = `${user.id}/ai-scene-gen-image/${timestamp}.png`;
            
            await supabaseClient.storage
              .from('user-files')
              .upload(imagePath, imageBuffer, {
                contentType: 'image/png',
                cacheControl: '3600'
              });
            
            console.log('✅ AI Scene Gen input image stored:', imagePath);
          }
        } catch (imageError) {
          console.warn('⚠️ AI Scene Gen input image storage failed:', imageError);
        }
      }

      // Update generation with Railway tracking info and tool_type for storage
      const { error: updateError } = await supabaseClient
        .from('ai_generations')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString(),
          metadata: {
            railway_generation_id: result.generation_id || generationId,
            processing_started: new Date().toISOString(),
            estimated_completion: getEstimatedTime(railwayParams.model_type),
            submitted_to_railway: true,
            model_type: railwayParams.model_type,
            model_params: railwayParams.model_params,
            webhook_url: webhookUrl,
            webhook_enabled: true,
            // Important: tool_type for storage organization
            tool_type: `ai-scene-${railwayParams.model_type}`,
            // Store all generation parameters
            action_direction: body.actionDirection,
            theme: body.theme,
            background: body.background,
            main_subject: body.mainSubject,
            tone_and_color: body.toneAndColor,
            scene_vision: body.sceneVision,
            resolution: body.resolution,
            aspect_ratio: body.aspectRatio,
            inference_steps: body.inferenceSteps,
            safety_checker: body.safetyChecker,
            prompt_expansion: body.promptExpansion,
            num_chains: body.numChains,
            seed: body.seed
          }
        })
        .eq('id', generationId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('❌ Error updating generation metadata:', updateError);
      }

      // Return immediately - Railway will webhook when complete
      return createResponse({
        success: true,
        status: 'processing',
        generation_id: generationId,
        message: `Scene generation started successfully. Processing will take ${getEstimatedTime(railwayParams.model_type)}.`,
        railway_generation_id: result.generation_id || generationId,
        model_type: railwayParams.model_type,
        webhook_url: webhookUrl,
        estimated_completion: getEstimatedTime(railwayParams.model_type)
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
              note: 'Submission timed out but Railway may still be processing',
              model_type: railwayModelType,
              tool_type: `ai-scene-${railwayModelType}`,
              webhook_url: webhookUrl
            }
          })
          .eq('id', generationId);
        
        return createResponse({
          success: true,
          status: 'processing',
          generation_id: generationId,
          message: `Scene generation submitted. Processing will take ${getEstimatedTime(railwayModelType)}.`,
          timeout_handled: true
        });
      }
      
      throw error;
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
        console.error('❌ Error updating failed generation:', updateError);
      }
    }

    return createResponse({
      error: errorMessage,
      details: 'Check the Edge Function logs for more information'
    }, 400);
  }
});

// Get estimated processing time based on model type
function getEstimatedTime(modelType: string): string {
  const timeMap: { [key: string]: string } = {
    'wan': '3-8 minutes',
    'wan-pro': '3-7 minutes', 
    'pixverse': '2-5 minutes',
    'luma': '4-10 minutes',
    'veo3': '5-12 minutes',
    'veo3-fast': '2-8 minutes'
  };
  
  return timeMap[modelType] || '3-8 minutes';
}
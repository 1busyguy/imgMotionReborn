// supabase/functions/analyze-image/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface AnalyzeImageRequest {
  imageUrl: string;
}

interface AnalyzeImageResponse {
  theme: string;
  background: string;
  main_subject: string;
  tone_and_color: string;
  action_direction: string;
  scene_vision: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    // Get user from JWT for authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const body: AnalyzeImageRequest = await req.json();
    const { imageUrl } = body;

    // Validate required parameters
    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    // Get Railway API URL from environment
    const railwayApiUrl = Deno.env.get('RAILWAY_API_URL');
    if (!railwayApiUrl) {
      throw new Error('RAILWAY_API_URL not configured');
    }

    console.log('Calling Railway API for image analysis:', imageUrl);

    // Call Railway API for image analysis
    const railwayResponse = await fetch(`${railwayApiUrl}/api/v1/analyze-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RAILWAY_API_KEY') || 'railway-api-key'}`
      },
      body: JSON.stringify({
        image_url: imageUrl
      }),
    });

    if (!railwayResponse.ok) {
      const errorText = await railwayResponse.text();
      console.error('Railway API error:', errorText);
      
      let errorMessage = `Railway API error: ${railwayResponse.status}`;
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

    const result: AnalyzeImageResponse = await railwayResponse.json();
    console.log('Railway API analysis result:', JSON.stringify(result));

    // Return the analysis result
    return new Response(
      JSON.stringify({
        success: true,
        theme: result.theme,
        background: result.background,
        main_subject: result.main_subject,
        tone_and_color: result.tone_and_color,
        action_direction: result.action_direction,
        scene_vision: result.scene_vision
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in analyze-image function:', errorMessage);

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Check the Edge Function logs for more information'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
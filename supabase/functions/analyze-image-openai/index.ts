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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const { imageUrl, toolType, analysisType } = await req.json();

    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    console.log('🔍 OpenAI Vision analysis request:', {
      toolType,
      analysisType,
      hasImageUrl: !!imageUrl,
      userId: user.id
    });

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Prepare OpenAI Vision API request
    const systemPrompt = getSystemPrompt(toolType, analysisType);
    const userPrompt = getUserPrompt(toolType, analysisType);

    const openaiPayload = {
      model: "gpt-4o-mini", // Use the latest vision model
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    };

    console.log('📡 Calling OpenAI Vision API...');

    // Call OpenAI Vision API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openaiPayload),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ OpenAI API error:', openaiResponse.status, errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
    }

    const openaiResult = await openaiResponse.json();
    console.log('✅ OpenAI Vision response received');

    const analysisText = openaiResult.choices?.[0]?.message?.content;
    if (!analysisText) {
      throw new Error('No analysis content received from OpenAI');
    }

    // Parse the analysis based on tool type
    const parsedAnalysis = parseAnalysis(analysisText, toolType, analysisType);

    console.log('🎯 Parsed analysis:', parsedAnalysis);

    return new Response(JSON.stringify({
      success: true,
      ...parsedAnalysis,
      rawAnalysis: analysisText,
      toolType,
      analysisType,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in analyze-image-openai:', error);
    
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

// Get system prompt based on tool and analysis type
function getSystemPrompt(toolType: string, analysisType: string): string {
  if ((toolType === 'minimax-hailuo' || toolType === 'wan-pro' || toolType === 'kling-pro' || toolType === 'veo2' || toolType === 'ltxv' || toolType === 'veo3-fast') && analysisType === 'motion-prompt') {
  }
  if ((toolType === 'minimax-hailuo' || toolType === 'wan-pro' || toolType === 'kling-pro' || toolType === 'veo2' || toolType === 'ltxv' || toolType === 'seedance-pro') && analysisType === 'motion-prompt') {
    return `You are an expert at analyzing images and creating motion prompts for AI video generation. 

Your task is to:
1. Analyze the uploaded image carefully
2. Identify the main subject, setting, and visual elements
3. Create a compelling motion prompt that would work well for image-to-video generation
4. Focus on realistic, achievable motions that would enhance the scene

Guidelines:
- Keep motion prompts concise but descriptive (1-2 sentences)
- Focus on natural, realistic movements
- Consider the subject matter and setting
- Avoid overly complex or impossible motions
- Make the motion feel cinematic and engaging

Respond in this exact JSON format:
{
  "subject": "brief description of main subject",
  "scene": "brief description of setting/environment", 
  "motionPrompt": "your suggested motion prompt here"
}`;
  }
  
  // Default system prompt
  return "You are an AI image analysis assistant. Analyze the image and provide helpful insights.";
}

// Get user prompt based on tool and analysis type
function getUserPrompt(toolType: string, analysisType: string): string {
  if ((toolType === 'minimax-hailuo' || toolType === 'wan-pro' || toolType === 'kling-pro' || toolType === 'veo2' || toolType === 'ltxv' || toolType === 'veo3-fast') && analysisType === 'motion-prompt') {
  }
  if ((toolType === 'minimax-hailuo' || toolType === 'wan-pro' || toolType === 'kling-pro' || toolType === 'veo2' || toolType === 'ltxv' || toolType === 'seedance-pro') && analysisType === 'motion-prompt') {
    return `Please analyze this image and suggest the best motion prompt for creating an engaging video. Consider what natural movements or camera motions would bring this scene to life.

Focus on:
- What is the main subject in the image?
- What kind of setting/environment is this?
- What realistic motion would enhance this scene?
- How can we make this visually compelling as a video?

Provide your response in the exact JSON format specified.`;
  }
  
  return "Please analyze this image and provide insights.";
}

// Parse the analysis response based on tool type
function parseAnalysis(analysisText: string, toolType: string, analysisType: string): any {
  try {
    // Try to parse as JSON first
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }
    
    // Fallback parsing for non-JSON responses
    if ((toolType === 'minimax-hailuo' || toolType === 'wan-pro' || toolType === 'kling-pro' || toolType === 'veo2' || toolType === 'ltxv' || toolType === 'seedance-pro') && analysisType === 'motion-prompt') {
      return {
        subject: "Unknown subject",
        scene: "Unknown scene", 
        motionPrompt: analysisText.trim()
      };
    }
    
    return {
      analysis: analysisText.trim()
    };
    
  } catch (error) {
    console.error('❌ Error parsing analysis:', error);
    
    // Return fallback response
    return {
      subject: "Image analysis",
      scene: "Scene detected",
      motionPrompt: analysisText.trim() || "Gentle camera movement revealing the scene"
    };
  }
}
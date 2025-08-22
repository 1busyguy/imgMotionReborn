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

    // Authenticate admin user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const adminUUIDs = ['991e17a6-c1a8-4496-8b28-cc83341c028a'];
    const isAdmin = adminUUIDs.includes(user.id) || 
                    user.email === 'jim@1busyguy.com' || 
                    user.user_metadata?.email === 'jim@1busyguy.com';

    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    const { documentation, toolName, category, endpoint } = await req.json();
    
    if (!documentation) {
      throw new Error('Documentation is required');
    }

    console.log('🤖 Parsing FAL.ai documentation with OpenAI for tool:', toolName);

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Prepare OpenAI prompt for parsing FAL.ai documentation
    const systemPrompt = `You are an expert at parsing FAL.ai API documentation and extracting parameters for tool generation.

Your task is to analyze FAL.ai API documentation and extract all parameters in a specific JSON format.

For each parameter, determine:
1. Parameter name (exact API field name)
2. Type (string, number, boolean, select, file)
3. Whether it's required or optional
4. Default value if specified
5. UI component type (textarea, input, slider, checkbox, select, file-upload)
6. Validation rules (min, max, options)
7. Description for users

IMPORTANT RULES:
- Always include common FAL.ai parameters like "prompt", "image_url", "video_url", "seed", "guidance_scale", "num_inference_steps"
- For file inputs, detect if it expects image_url, video_url, or audio_url
- Map number ranges to sliders (guidance_scale, steps, etc.)
- Map enums/options to select dropdowns
- Map boolean flags to checkboxes
- Use textarea for prompts, input for simple strings
- Infer token cost calculation if mentioned

Respond with ONLY valid JSON in this exact format:
{
  "parameters": [
    {
      "name": "prompt",
      "type": "string", 
      "required": true,
      "defaultValue": "",
      "uiComponent": "textarea",
      "description": "Text prompt describing what to generate",
      "validation": {
        "maxLength": 1000
      }
    },
    {
      "name": "image_url", 
      "type": "file",
      "required": true,
      "defaultValue": "",
      "uiComponent": "file-upload",
      "description": "Source image to process",
      "validation": {
        "fileType": "image",
        "maxSize": "10MB"
      }
    },
    {
      "name": "guidance_scale",
      "type": "number",
      "required": false, 
      "defaultValue": 7.5,
      "uiComponent": "slider",
      "description": "How closely to follow the prompt",
      "validation": {
        "min": 1.0,
        "max": 20.0,
        "step": 0.5
      }
    }
  ],
  "tokenCostInfo": {
    "baseTokens": 10,
    "formula": "Base cost varies by resolution and duration",
    "factors": ["resolution", "duration", "num_images"]
  },
  "processingTime": "30-60 seconds"
}`;

    const userPrompt = `Parse this FAL.ai API documentation for tool "${toolName}" (category: ${category}):

ENDPOINT: ${endpoint}

DOCUMENTATION:
${documentation}

Extract all parameters and return the JSON format specified in the system prompt.`;

    const openaiPayload = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: userPrompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.1 // Low temperature for consistent parsing
    };

    console.log('📡 Calling OpenAI API for documentation parsing...');

    // Call OpenAI API
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
    console.log('✅ OpenAI parsing response received');

    const analysisText = openaiResult.choices?.[0]?.message?.content;
    if (!analysisText) {
      throw new Error('No analysis content received from OpenAI');
    }

    // Parse the JSON response from OpenAI
    let parsedResult;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in OpenAI response');
      }
    } catch (parseError) {
      console.error('❌ Error parsing OpenAI response:', parseError);
      console.log('Raw OpenAI response:', analysisText);
      throw new Error(`Could not parse OpenAI response as JSON: ${parseError.message}`);
    }

    // Validate the parsed result
    if (!parsedResult.parameters || !Array.isArray(parsedResult.parameters)) {
      throw new Error('Invalid response format: missing parameters array');
    }

    // Ensure each parameter has required fields
    const validatedParameters = parsedResult.parameters.map(param => ({
      name: param.name || 'unknown',
      type: param.type || 'string',
      required: Boolean(param.required),
      defaultValue: param.defaultValue ?? '',
      uiComponent: param.uiComponent || 'input',
      description: param.description || '',
      validation: param.validation || {}
    }));

    console.log(`🎯 Successfully parsed ${validatedParameters.length} parameters with OpenAI`);

    return new Response(JSON.stringify({
      success: true,
      parameters: validatedParameters,
      tokenCostInfo: parsedResult.tokenCostInfo || {
        baseTokens: 10,
        formula: 'Base cost per generation',
        factors: []
      },
      processingTime: parsedResult.processingTime || '1-3 minutes',
      rawAnalysis: analysisText
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in parse-fal-documentation:', error);
    
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
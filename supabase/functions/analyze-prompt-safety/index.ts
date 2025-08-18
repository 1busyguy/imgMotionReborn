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
    const { prompt, analysisType, sensitivity = 3 } = await req.json();

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    console.log('🔍 Prompt safety analysis request:', {
      userId: user.id,
      analysisType,
      sensitivity,
      promptLength: prompt.length
    });

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Prepare OpenAI API request for prompt safety analysis
    const systemPrompt = `You are a content safety analyzer for AI generation prompts. Analyze text prompts for content that might be rejected by AI content generation services.

Look for:
1. Requests for nudity or sexual content
2. Violence, weapons, or harmful activities
3. Hate speech or discriminatory language
4. Illegal activities or dangerous content
5. Copyrighted characters or brands
6. Content inappropriate for general audiences

Sensitivity level: ${sensitivity}/5 (1=lenient, 5=strict)

Respond with valid JSON only:
{
  "safe": boolean,
  "confidence": number (0.0-1.0),
  "violations": ["specific violations found"],
  "reasoning": "brief explanation",
  "suggestions": ["how to make it safer"]
}`;

    const userPrompt = `Analyze this prompt for content policy violations: "${prompt}"`;

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
      max_tokens: 300,
      temperature: 0.3 // Lower temperature for consistent safety analysis
    };

    console.log('📡 Calling OpenAI API for prompt safety analysis...');

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
      
      // Return safe default if OpenAI fails
      return new Response(JSON.stringify({
        safe: true,
        confidence: 0,
        violations: [],
        reasoning: 'Analysis service unavailable',
        suggestions: [],
        analysisError: true,
        errorMessage: `OpenAI API error: ${openaiResponse.status}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const openaiResult = await openaiResponse.json();
    console.log('✅ OpenAI prompt analysis response received');

    const analysisText = openaiResult.choices?.[0]?.message?.content;
    if (!analysisText) {
      throw new Error('No analysis content received from OpenAI');
    }

    // Parse the JSON response from OpenAI
    let parsedAnalysis;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Error parsing OpenAI response:', parseError);
      console.log('Raw response:', analysisText);
      
      // Fallback parsing - look for safety indicators in text
      const isUnsafe = analysisText.toLowerCase().includes('unsafe') || 
                      analysisText.toLowerCase().includes('violation') ||
                      analysisText.toLowerCase().includes('inappropriate');
      
      parsedAnalysis = {
        safe: !isUnsafe,
        confidence: isUnsafe ? 0.7 : 0.3,
        violations: isUnsafe ? ['Content policy concerns detected'] : [],
        reasoning: 'Could not parse detailed analysis',
        suggestions: ['Review prompt for potential policy violations', 'Use more family-friendly language']
      };
    }

    // Validate and sanitize the parsed result
    const result = {
      safe: Boolean(parsedAnalysis.safe),
      confidence: Math.max(0, Math.min(1, Number(parsedAnalysis.confidence) || 0)),
      violations: Array.isArray(parsedAnalysis.violations) ? parsedAnalysis.violations : [],
      reasoning: String(parsedAnalysis.reasoning || 'No specific reasoning provided'),
      suggestions: Array.isArray(parsedAnalysis.suggestions) ? parsedAnalysis.suggestions : [],
      analysisType: 'prompt_safety',
      sensitivity: sensitivity,
      timestamp: new Date().toISOString(),
      rawAnalysis: analysisText,
      promptAnalyzed: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '')
    };

    console.log('🛡️ Prompt safety analysis result:', {
      safe: result.safe,
      confidence: result.confidence,
      violations: result.violations.length,
      reasoning: result.reasoning.substring(0, 50) + '...'
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in analyze-prompt-safety:', error);
    
    // Return safe default on error to not block users
    return new Response(
      JSON.stringify({ 
        safe: true,
        confidence: 0,
        violations: [],
        reasoning: 'Analysis failed',
        suggestions: [],
        analysisError: true,
        errorMessage: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Return 200 so it doesn't block the user
      }
    );
  }
});
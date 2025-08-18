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
      prompt,
      duration = 30
    } = await req.json();

    console.log('🎵 CassetteAI Music generation request:', {
      generationId,
      prompt: prompt?.substring(0, 50) + '...',
      duration
    });

    // Validate required parameters
    if (!generationId) {
      throw new Error('Generation ID is required');
    }

    if (!prompt?.trim()) {
      throw new Error('Music prompt is required');
    }

    // Validate duration range
    if (duration < 10 || duration > 180) {
      throw new Error('Duration must be between 10 and 180 seconds');
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

    // Prepare FAL.ai API request for CassetteAI Music Generator
    const falParams = {
      prompt: prompt.trim(),
      duration: Math.max(10, Math.min(180, duration))
    };

    console.log('🎵 Calling FAL.ai API with params:', JSON.stringify(falParams, null, 2));

    // Call FAL.ai API directly
    const falResponse = await fetch('https://fal.run/CassetteAI/music-generator', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(falParams),
    });

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error('❌ FAL.ai API error:', falResponse.status, errorText);
      throw new Error(`FAL.ai API error: ${falResponse.status} - ${errorText}`);
    }

    const submitResult = await falResponse.json();
    console.log('🎵 FAL.ai submission result:', JSON.stringify(submitResult, null, 2));

    // Check if we got immediate result or need to poll
    let finalResult = submitResult;
    let requestId = submitResult.request_id;

    // If we have a request_id, we need to poll for completion
    if (requestId && !submitResult.audio_file) {
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

      // Poll for completion (max 5 minutes for music generation)
      const maxAttempts = 30; // 30 attempts × 10 seconds = 5 minutes
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts++;
        
        console.log(`🔍 Polling attempt ${attempts}/${maxAttempts} for request ${requestId}`);
        
        try {
          const statusResponse = await fetch(`https://fal.run/CassetteAI/music-generator/requests/${requestId}/status`, {
            headers: {
              'Authorization': `Key ${falApiKey}`,
            },
          });

          if (statusResponse.ok) {
            const statusResult = await statusResponse.json();
            console.log(`📊 Status check ${attempts}:`, statusResult.status);
            
            if (statusResult.status === 'COMPLETED') {
              // Get the final result
              const resultResponse = await fetch(`https://fal.run/CassetteAI/music-generator/requests/${requestId}`, {
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
              throw new Error('FAL.ai music generation failed');
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
        throw new Error('Music generation timed out after 5 minutes');
      }
    }

    // Extract audio URL from FAL.ai response
    let audioUrl = null;
    
    // MMAudio v2 returns audio in different possible formats
    if (finalResult.audio && typeof finalResult.audio === 'object' && finalResult.audio.url) {
      audioUrl = finalResult.audio.url;
    } else if (typeof finalResult.audio === 'string') {
      audioUrl = finalResult.audio;
    } else if (finalResult.audio_file && typeof finalResult.audio_file === 'object' && finalResult.audio_file.url) {
      audioUrl = finalResult.audio_file.url;
    } else if (typeof finalResult.audio_file === 'string') {
      audioUrl = finalResult.audio_file;
    } else if (finalResult.url) {
      audioUrl = finalResult.url;
    } else if (finalResult.output && finalResult.output.url) {
      audioUrl = finalResult.output.url;
    }

    if (!audioUrl) {
      console.error('❌ No audio URL found in response:', JSON.stringify(finalResult, null, 2));
      throw new Error(`No audio URL generated by FAL.ai API. Response structure: ${JSON.stringify(Object.keys(finalResult))}`);
    }

    console.log('🎵 Generated audio URL:', audioUrl);

    // Update generation with result - this triggers real-time updates
    const { error: updateError } = await supabase
      .from('ai_generations')
      .update({
        output_file_url: audioUrl,
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          fal_request_id: requestId || finalResult.request_id,
          processing_time: finalResult.processing_time || 'unknown',
          model: 'CassetteAI-music-generator',
          audio_url: audioUrl,
          duration: duration,
          prompt: prompt,
          polling_attempts: requestId ? attempts : 0
        }
      })
      .eq('id', generationId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('❌ Error updating generation record:', updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log('🎉 Music generation completed successfully');

    return new Response(JSON.stringify({
      success: true,
      audio_url: audioUrl,
      generation_id: generationId,
      metadata: {
        fal_request_id: requestId || finalResult.request_id,
        processing_time: finalResult.processing_time,
        model: 'CassetteAI-music-generator',
        duration: duration,
        polling_attempts: requestId ? attempts : 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in fal-cassetteai-music:', error);
    
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
      console.error('❌ Error updating failed generation:', updateError);
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
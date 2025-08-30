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

    const {
      videoUrl,
      generationId,
      userId,
      extractFrame = 0.5, // Extract frame at 50% of video duration
      outputFormat = 'jpeg',
      quality = 85
    } = await req.json();

    console.log('🖼️ Thumbnail generation request:', {
      generationId,
      userId,
      videoUrl: videoUrl?.substring(0, 50) + '...',
      extractFrame,
      outputFormat,
      quality
    });

    if (!videoUrl || !generationId || !userId) {
      throw new Error('videoUrl, generationId, and userId are required');
    }

    // Get FFmpeg microservice URL from environment
    const ffmpegServiceUrl = Deno.env.get('FFMPEG_SERVICE_URL') || 'http://localhost:8000';
    
    // Call FFmpeg microservice for thumbnail extraction
    const ffmpegResponse = await fetch(`${ffmpegServiceUrl}/extract-thumbnail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('FFMPEG_SERVICE_KEY') || 'ffmpeg-key'}`
      },
      body: JSON.stringify({
        video_url: videoUrl,
        generation_id: generationId,
        user_id: userId,
        extract_frame: extractFrame,
        output_format: outputFormat,
        quality: quality,
        webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ffmpeg-webhook`,
        storage_bucket: 'user-files',
        storage_path: `${userId}/thumbnails/${generationId}_thumbnail.${outputFormat}`
      })
    });

    if (!ffmpegResponse.ok) {
      const errorText = await ffmpegResponse.text();
      console.error('❌ FFmpeg service error:', ffmpegResponse.status, errorText);
      throw new Error(`FFmpeg service error: ${ffmpegResponse.status} - ${errorText}`);
    }

    const result = await ffmpegResponse.json();
    console.log('✅ Thumbnail generation started:', result);

    // Update generation metadata to track thumbnail processing
    await supabase
      .from('ai_generations')
      .update({
        metadata: {
          thumbnail_processing: {
            status: 'processing',
            started_at: new Date().toISOString(), 
            extract_frame: extractFrame,
            output_format: outputFormat,
            quality: quality,
            processing_id: result.processing_id
          }
        }
      })
      .eq('id', generationId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Thumbnail generation started',
      generation_id: generationId,
      processing_id: result.processing_id,
      estimated_time: '30-60 seconds'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in ffmpeg-thumbnail:', error);
    
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
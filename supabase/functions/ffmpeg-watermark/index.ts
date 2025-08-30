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
      contentUrl,
      generationId,
      userId,
      contentType = 'video', // 'video' or 'image'
      watermarkPosition = 'bottom-right',
      watermarkOpacity = 0.7,
      watermarkScale = 0.15,
      watermarkText = 'imgMotionMagic.com'
    } = await req.json();

    console.log('🎨 Watermark application request:', {
      generationId,
      userId,
      contentType,
      contentUrl: contentUrl?.substring(0, 50) + '...',
      watermarkPosition,
      watermarkOpacity,
      watermarkScale,
      watermarkText
    });

    if (!contentUrl || !generationId || !userId) {
      throw new Error('contentUrl, generationId, and userId are required');
    }

    // Get FFmpeg microservice URL from environment
    const ffmpegServiceUrl = Deno.env.get('FFMPEG_SERVICE_URL') || 'http://localhost:8000';
    
    // Call FFmpeg microservice for watermark application
    const ffmpegResponse = await fetch(`${ffmpegServiceUrl}/apply-watermark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('FFMPEG_SERVICE_KEY') || 'ffmpeg-key'}`
      },
      body: JSON.stringify({
        content_url: contentUrl,
        generation_id: generationId,
        user_id: userId,
        content_type: contentType,
        watermark_position: watermarkPosition,
        watermark_opacity: watermarkOpacity,
        watermark_scale: watermarkScale,
        watermark_text: watermarkText,
        watermark_logo_url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/user-files/watermark_imm.png`,
        webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ffmpeg-webhook`,
        storage_bucket: 'user-files',
        storage_path: `${userId}/watermarked/${generationId}_watermarked.${contentType === 'video' ? 'mp4' : 'jpg'}`
      })
    });

    if (!ffmpegResponse.ok) {
      const errorText = await ffmpegResponse.text();
      console.error('❌ FFmpeg service error:', ffmpegResponse.status, errorText);
      throw new Error(`FFmpeg service error: ${ffmpegResponse.status} - ${errorText}`);
    }

    const result = await ffmpegResponse.json();
    console.log('✅ Watermark application started:', result);

    // Update generation metadata to track watermark processing
    await supabase
      .from('ai_generations')
      .update({
        metadata: {
          watermark_processing: {
            status: 'processing',
            started_at: new Date().toISOString(),
            content_type: contentType,
            watermark_position: watermarkPosition,
            watermark_opacity: watermarkOpacity,
            watermark_scale: watermarkScale,
            watermark_text: watermarkText,
            processing_id: result.processing_id
          }
        }
      })
      .eq('id', generationId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Watermark application started',
      generation_id: generationId,
      processing_id: result.processing_id,
      estimated_time: '1-3 minutes'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in ffmpeg-watermark:', error);
    
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
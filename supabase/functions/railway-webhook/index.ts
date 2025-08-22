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

  console.log('🎯 Railway webhook called!');
  console.log('Request method:', req.method);
  console.log('Request headers:', Object.fromEntries(req.headers.entries()));

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse webhook payload from Railway
    const requestBody = await req.text();
    console.log('Raw request body:', requestBody);
    
    const {
      generation_id,
      status,
      progress,
      current_message,
      video_url,
      error_message,
      metadata
    } = JSON.parse(requestBody);

    console.log('Railway webhook received:', {
      generation_id,
      status,
      progress,
      current_message,
      has_video_url: !!video_url
    });

    if (!generation_id) {
      throw new Error('Generation ID is required');
    }

    // Get the generation record to access tool_type and user_id
    const { data: generation, error: fetchError } = await supabase
      .from('ai_generations')
      .select('user_id, metadata, tool_type')
      .eq('id', generation_id)
      .single();

    if (fetchError || !generation) {
      console.error('❌ Error fetching generation:', fetchError);
      throw new Error('Generation not found');
    }

    console.log('📋 Generation details:', {
      user_id: generation.user_id,
      tool_type: generation.metadata?.tool_type || generation.tool_type,
      model_type: generation.metadata?.model_type
    });

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Update status if provided
    if (status) {
      updateData.status = status;
      
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        
        if (video_url) {
          let finalVideoUrl = video_url;
          
          // Download and store video using dynamic tool_type for folder organization
          try {
            console.log('🔄 Downloading video for permanent storage...');
            const videoResponse = await fetch(video_url);
            
            if (videoResponse.ok) {
              const videoBuffer = await videoResponse.arrayBuffer();
              const timestamp = Date.now();
              
              // Use tool_type from metadata for dynamic folder organization
              // Default to 'ai-scene-gen-video' if no tool_type is set
              const toolType = generation.metadata?.tool_type || 
                              generation.tool_type || 
                              'ai-scene-gen-video';
              
              const videoPath = `${generation.user_id}/${toolType}/${timestamp}.mp4`;
              
              console.log('📁 Storing video at:', videoPath);
              console.log('📄 Tool type:', toolType);
              
              const { error: videoUploadError } = await supabase.storage
                .from('user-files')
                .upload(videoPath, videoBuffer, {
                  contentType: 'video/mp4',
                  cacheControl: '3600',
                  upsert: true
                });

              if (!videoUploadError) {
                const { data: { publicUrl } } = supabase.storage
                  .from('user-files')
                  .getPublicUrl(videoPath);
                
                finalVideoUrl = publicUrl;
                console.log('✅ Video stored permanently:', publicUrl);
              } else {
                console.error('❌ Video upload error:', videoUploadError);
              }
            } else {
              console.error('❌ Failed to download video:', videoResponse.status);
            }
          } catch (storageError) {
            console.warn('⚠️ Video storage failed, using original URL:', storageError);
            // Keep original URL if storage fails
          }
          
          updateData.output_file_url = finalVideoUrl;
          
          // Update metadata with video URLs
          updateData.metadata = {
            ...generation.metadata,
            ...metadata,
            original_video_url: video_url,
            permanent_storage_url: finalVideoUrl !== video_url ? finalVideoUrl : null,
            webhook_received: true,
            completed_via_webhook: true,
            railway_webhook_timestamp: new Date().toISOString()
          };
        }
      } else if (status === 'failed') {
        updateData.completed_at = new Date().toISOString();
        if (error_message) {
          updateData.error_message = error_message;
        }
        
        // Update metadata for failed status
        updateData.metadata = {
          ...generation.metadata,
          ...metadata,
          webhook_received: true,
          failed_via_webhook: true,
          railway_webhook_timestamp: new Date().toISOString(),
          webhook_error: error_message
        };
      }
    }

    // Update metadata with progress info (for non-final statuses)
    if ((progress !== undefined || current_message) && status !== 'completed' && status !== 'failed') {
      updateData.metadata = {
        ...generation.metadata,
        ...(metadata || {}),
        ...(progress !== undefined && { progress }),
        ...(current_message && { current_message }),
        last_webhook_update: new Date().toISOString()
      };
    }

    // Update the generation record
    const { error: updateError } = await supabase
      .from('ai_generations')
      .update(updateData)
      .eq('id', generation_id);

    if (updateError) {
      console.error('❌ Error updating generation:', updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log('✅ Successfully updated generation:', {
      generation_id,
      status,
      tool_type: generation.metadata?.tool_type,
      storage_path: updateData.output_file_url ? `${generation.user_id}/${generation.metadata?.tool_type || 'ai-scene-gen-video'}/` : null
    });

    return new Response(JSON.stringify({
      success: true,
      generation_id,
      message: 'Generation updated successfully',
      status: status || 'processing'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in railway-webhook:', error);
    
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
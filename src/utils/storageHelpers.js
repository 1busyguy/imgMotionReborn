import { supabase } from '../lib/supabaseClient';

/**
 * Upload file to user's folder in storage
 * @param {File|Blob} file - File to upload
 * @param {string} folder - Folder name (avatars, generations, etc.)
 * @param {string} fileName - Custom file name (optional)
 * @returns {Promise<{url: string, path: string}>}
 */
export const uploadFile = async (file, folder, fileName = null) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Generate file name if not provided
    const fileExt = file.name?.split('.').pop() || 'jpg';
    const finalFileName = fileName || `${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${folder}/${finalFileName}`;

    // Upload file
    const { data, error } = await supabase.storage
      .from('user-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('user-files')
      .getPublicUrl(filePath);

    return {
      url: publicUrl,
      path: filePath
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Delete file from storage
 * @param {string} filePath - Path to file in storage
 * @returns {Promise<void>}
 */
export const deleteFile = async (filePath) => {
  try {
    const { error } = await supabase.storage
      .from('user-files')
      .remove([filePath]);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

/**
 * Get signed URL for private file access
 * @param {string} filePath - Path to file in storage
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>}
 */
export const getSignedUrl = async (filePath, expiresIn = 3600) => {
  try {
    const { data, error } = await supabase.storage
      .from('user-files')
      .createSignedUrl(filePath, expiresIn);

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw error;
  }
};

/**
 * List files in user's folder
 * @param {string} folder - Folder name to list
 * @returns {Promise<Array>}
 */
export const listUserFiles = async (folder) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.storage
      .from('user-files')
      .list(`${user.id}/${folder}`, {
        limit: 100,
        offset: 0
      });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
};

// AI Generation tool types mapping
export const AI_TOOLS = {
  // FAL.ai tools
  fal_flux_redux: {
    name: 'FLUX Redux Pro',
    description: 'Create image variations with advanced IP-Adapter control',
    tokensRequired: 8,
    category: 'image'
  },
  fal_flux_kontext: {
    name: 'FLUX Kontext',
    description: 'Generate images with context-aware composition and spatial understanding',
    tokensRequired: 4,
    category: 'image'
  },
  fal_minimax_hailuo: {
    name: 'Minimax Hailuo Video',
    description: 'Transform images into cinematic videos',
    tokensRequired: 7,
    category: 'video'
  },
  wan22_pro: {
    name: 'WAN 2.2 Professional',
    description: 'Latest model with 1080P support and improved motion stability',
    tokensRequired: 50, // 480P: 50 tokens, 1080P: 100 tokens
    category: 'video'
  },
  fal_video_prompt: {
    name: 'Video Prompt Generator',
    description: 'AI-powered prompt generation for video creation',
    tokensRequired: 5,
    category: 'ai'
  },
  fal_veo2: {
    name: 'Kling Pro Video',
    description: 'Professional-grade image-to-video with Kling v2.1',
    tokensRequired: 25,
    category: 'video'
  },
  fal_flux_kontext_lora: {
    name: 'FLUX Kontext LoRA',
    description: 'Advanced text-to-image with LoRA fine-tuning',
    tokensRequired: 12,
    category: 'image'
  },
  fal_video_upscaler: {
    name: 'AI Video Upscaler',
    description: 'Enhance video quality with AI-powered upscaling',
    tokensRequired: 39,
    category: 'enhancement'
  },
  fal_ltxv: {
    name: 'LTXV Video Creator',
    description: 'Advanced image-to-video generation with extensive customization',
    tokensRequired: 25,
    category: 'video'
  },
  fal_bria_bg_remove: {
    name: 'BRIA Background Remover',
    description: 'Professional AI-powered background removal',
    tokensRequired: 5,
    category: 'image'
  },
  ai_scene_gen: {
    name: 'AI Scene Maker',
    description: 'Transform images into cinematic video sequences with advanced AI scene generation',
    tokensRequired: 100,
    category: 'video'
  },
  fal_hidream_i1: {
    name: 'HiDream I1 Dev',
    description: 'Advanced text-to-image generation with HiDream I1 development model',
    tokensRequired: 8,
    category: 'image'
  },
  fal_seedance_pro: {
    name: 'Seedance Pro Video',
    description: 'Professional image-to-video generation with Seedance Pro technology',
    tokensRequired: 120,
    category: 'video'
  },
  fal_wan_v22_a14b: {
    name: 'WAN v2.2-a14b Video',
    description: 'Advanced image-to-video generation with WAN v2.2-a14b model and interpolation',
    tokensRequired: 20, // Base cost, multiplied by resolution
    category: 'video'
  },
  fal_cassetteai_music: {
    name: 'CassetteAI Music Generator',
    description: 'Generate original music tracks with AI - from chill beats to epic orchestral pieces',
    tokensRequired: 15, // Base cost for 30 seconds, scales with duration
    category: 'audio'
  },
  fal_mmaudio_v2: {
    name: 'MMAudio v2',
    description: 'Advanced text-to-audio generation with high-quality synthesis and precise control',
    tokensRequired: 5, // Base cost, 0.625 tokens per second
    category: 'audio'
  },
  fal_mmaudio_video2: {
    name: 'MMAudio Video2Audio',
    description: 'Generate synchronized audio for videos - perfect soundtracks that match your content',
    tokensRequired: 5, // Base cost, 0.625 tokens per second
    category: 'audio'
  },
  fal_flux_kontext_max_multi: {
    name: 'FLUX Kontext Max Multi',
    description: 'Advanced multi-image composition with FLUX Pro Kontext Max',
    tokensRequired: 15, // Base cost per image generated
    category: 'image'
  },
  fal_wan_v22_text2video_lora: {
    name: 'WAN v2.2 Text2Video LoRA',
    description: 'Advanced text-to-video generation with WAN v2.2-a14b model and LoRA fine-tuning support',
    tokensRequired: 25, // Base cost, multiplied by resolution
    category: 'video'
  },
  fal_omnihuman: {
    name: 'Omnihuman Talking Avatar',
    description: 'Create realistic talking avatars from images and audio - bring photos to life with speech',
    tokensRequired: "30/sec", // 30 tokens per second of audio
    category: 'video'
  },
  fal_wan_v22_img2video_lora: {
    name: 'WAN v2.2 Img2Video LoRA',
    description: 'Advanced image-to-video generation with WAN v2.2-a14b model and LoRA fine-tuning support',
    tokensRequired: 30, // Base cost, multiplied by resolution
    category: 'video'
  },
  fal_wan_v22_video2video: {
    name: 'WAN v2.2 Video2Video',
    description: 'Transform existing videos with AI - change style, content, and motion while preserving structure',
    tokensRequired: 25, // Base cost, varies by resolution and frames
    category: 'video'
  },
  fal_veo3_fast: {
    name: 'VEO3 Fast',
    description: 'Fast image-to-video generation with Google\'s VEO3 model',
    tokensRequired: 288, // Base cost, varies by audio and resolution
    category: 'video'
  },
  fal_veo3: {
    name: 'VEO3 Standard',
    description: 'High-quality image-to-video generation with Google\'s VEO3 model',
    tokensRequired: 534, // Base cost, varies by audio and resolution
    category: 'video'
  },
  fal_gemini_flash_image_edit: {
    name: 'Gemini 2.5 Flash Image Edit',
    description: 'Advanced AI image editing with Google\'s Gemini 2.5 Flash model',
    tokensRequired: 8, // Base cost per image generated
    category: 'image'
  }
};

/**
 * Create AI generation record
 * @param {string} toolType - Tool type (gen_01, gen_02, etc.)
 * @param {string} generationName - Name for the generation
 * @param {Object} inputData - Input parameters and settings
 * @param {number} tokensUsed - Tokens consumed
 * @returns {Promise<Object>}
 */
export const createAIGeneration = async (toolType, generationName, inputData, tokensUsed) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const toolInfo = AI_TOOLS[toolType];
    if (!toolInfo) throw new Error('Invalid tool type');

    const { data, error } = await supabase
      .from('ai_generations')
      .insert({
        user_id: user.id,
        tool_type: toolType,
        tool_name: toolInfo.name,
        generation_name: generationName,
        input_data: inputData,
        tokens_used: tokensUsed,
        status: 'processing'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating AI generation:', error);
    throw error;
  }
};

/**
 * Update AI generation with results
 * @param {string} generationId - Generation ID
 * @param {string} outputFileUrl - URL to generated file
 * @param {string} status - Status (completed, failed)
 * @returns {Promise<Object>}
 */
export const updateAIGeneration = async (generationId, outputFileUrl, status = 'completed') => {
  try {
    const { data, error } = await supabase
      .from('ai_generations')
      .update({
        output_file_url: outputFileUrl,
        status: status,
        completed_at: status === 'completed' ? new Date().toISOString() : null
      })
      .eq('id', generationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating AI generation:', error);
    throw error;
  }
};

/**
 * Update user token count after generation
 * @param {string} userId - User ID
 * @param {number} tokensUsed - Tokens to deduct
 * @returns {Promise<number>} - New token count
 */
export const updateTokenCount = async (userId, tokensUsed) => {
  try {
    console.log('🔍 updateTokenCount called with:', { userId, tokensUsed });
    
    const { data, error } = await supabase.rpc('deduct_user_tokens', {
      target_user_id: userId,
      tokens_to_deduct: tokensUsed
    });

    console.log('🔍 deduct_user_tokens response:', { data, error });
    
    if (error) {
      console.error('❌ Token deduction error:', error);
      throw error;
    }
    
    if (!data || typeof data.new_total_tokens !== 'number') {
      throw new Error('Invalid response from token deduction function');
    }

    console.log('✅ Token deduction successful. New total:', data.new_total_tokens);

    return data.new_total_tokens;
  } catch (error) {
    console.error('Error updating token count:', error);
    throw error;
  }
};

/**
 * Get user's recent AI generations
 * @param {number} limit - Number of generations to fetch
 * @returns {Promise<Array>}
 */
export const getRecentGenerations = async (limit = 10) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('ai_generations')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching recent generations:', error);
    throw error;
  }
};
// Thumbnail and watermark utilities for video processing

/**
 * Check if user should get watermarked content
 * @param {Object} profile - User profile object
 * @returns {boolean} - True if content should be watermarked
 */
export const shouldWatermarkContent = (profile) => {
  if (!profile) return true; // Default to watermark if no profile
  
  // Watermark for free tier users
  return profile.subscription_status === 'free' || 
         profile.subscription_tier === 'free' ||
         profile.subscription_status === null || 
         profile.subscription_status === undefined;
};

/**
 * Request thumbnail generation for a video
 * @param {string} videoUrl - URL of the video
 * @param {string} generationId - Generation ID
 * @param {string} userId - User ID for storage path
 * @returns {Promise<string|null>} - Thumbnail URL or null if failed
 */
export const requestThumbnailGeneration = async (videoUrl, generationId, userId = null) => {
  try {
    console.log('🖼️ Requesting thumbnail generation for:', generationId);
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ffmpeg-thumbnail`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        videoUrl: videoUrl,
        generationId: generationId,
        userId: userId,
        extractFrame: 0.5, // Extract frame at 50% of video duration
        outputFormat: 'jpeg',
        quality: 85
      })
    });

    if (!response.ok) {
      console.warn('⚠️ Thumbnail generation request failed:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('✅ Thumbnail generation requested:', result);
    
    return result.thumbnail_url || null;
  } catch (error) {
    console.error('❌ Error requesting thumbnail generation:', error);
    return null;
  }
};

/**
 * Request watermark application for content
 * @param {string} contentUrl - URL of the content (video or image)
 * @param {string} generationId - Generation ID
 * @param {string} userId - User ID for storage path
 * @param {string} contentType - 'video' or 'image'
 * @returns {Promise<string|null>} - Watermarked content URL or null if failed
 */
export const requestWatermarkApplication = async (contentUrl, generationId, userId, contentType = 'video') => {
  try {
    console.log('🎨 Requesting watermark application for:', generationId);
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ffmpeg-watermark`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contentUrl: contentUrl,
        generationId: generationId,
        userId: userId,
        contentType: contentType,
        watermarkPosition: 'bottom-right',
        watermarkOpacity: 0.7,
        watermarkScale: 0.15,
        watermarkText: 'imgMotionMagic.com'
      })
    });

    if (!response.ok) {
      console.warn('⚠️ Watermark application request failed:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('✅ Watermark application requested:', result);
    
    return result.watermarked_url || null;
  } catch (error) {
    console.error('❌ Error requesting watermark application:', error);
    return null;
  }
};

/**
 * Process video with thumbnail and watermark if needed
 * @param {string} videoUrl - Original video URL
 * @param {string} generationId - Generation ID
 * @param {string} userId - User ID
 * @param {Object} profile - User profile
 * @returns {Promise<Object>} - Processing results
 */
export const processVideoComplete = async (videoUrl, generationId, userId, profile) => {
  const results = {
    originalUrl: videoUrl,
    thumbnailUrl: null,
    watermarkedUrl: null,
    needsWatermark: shouldWatermarkContent(profile)
  };

  try {
    // Always generate thumbnail for videos
    console.log('🖼️ Generating thumbnail for video...');
    results.thumbnailUrl = await requestThumbnailGeneration(videoUrl, generationId, userId);
    
    // Apply watermark if user is on free tier
    if (results.needsWatermark) {
      console.log('🎨 Applying watermark for free tier user...');
      results.watermarkedUrl = await requestWatermarkApplication(videoUrl, generationId, userId, 'video');
    }
    
    console.log('✅ Video processing complete:', {
      generationId,
      hasThumbnail: !!results.thumbnailUrl,
      hasWatermark: !!results.watermarkedUrl,
      needsWatermark: results.needsWatermark
    });
    
    return results;
  } catch (error) {
    console.error('❌ Error in video processing:', error);
    return results;
  }
};

/**
 * Process image with watermark if needed
 * @param {string} imageUrl - Original image URL
 * @param {string} generationId - Generation ID
 * @param {string} userId - User ID
 * @param {Object} profile - User profile
 * @returns {Promise<Object>} - Processing results
 */
export const processImageComplete = async (imageUrl, generationId, userId, profile) => {
  const results = {
    originalUrl: imageUrl,
    watermarkedUrl: null,
    needsWatermark: shouldWatermarkContent(profile)
  };

  try {
    // Apply watermark if user is on free tier
    if (results.needsWatermark) {
      console.log('🎨 Applying watermark for free tier user...');
      results.watermarkedUrl = await requestWatermarkApplication(imageUrl, generationId, userId, 'image');
    }
    
    console.log('✅ Image processing complete:', {
      generationId,
      hasWatermark: !!results.watermarkedUrl,
      needsWatermark: results.needsWatermark
    });
    
    return results;
  } catch (error) {
    console.error('❌ Error in image processing:', error);
    return results;
  }
};
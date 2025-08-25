// src/utils/cdnHelpers.js

const SUPABASE_STORAGE_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/`;
const CDN_BASE_URL = import.meta.env.VITE_CDN_URL;

/**
 * Transforms a Supabase Storage URL to a CDN URL.
 * Assumes the CDN is configured to serve the 'user-files' bucket directly under its root.
 * Example:
 * https://<project_ref>.supabase.co/storage/v1/object/public/user-files/path/to/file.jpg
 * becomes
 * https://cdn.imgmotion.com/user-files/path/to/file.jpg
 *
 * @param {string} supabaseUrl The original Supabase Storage URL.
 * @returns {string} The transformed CDN URL, or the original URL if transformation fails.
 */
export const toCdnUrl = (supabaseUrl) => {
  if (!supabaseUrl || !CDN_BASE_URL) {
    return supabaseUrl;
  }

  // Check if the URL is already a CDN URL
  if (supabaseUrl.startsWith(CDN_BASE_URL)) {
    return supabaseUrl;
  }

  // Replace the Supabase Storage base path with the CDN base path
  const cdnUrl = supabaseUrl.replace(SUPABASE_STORAGE_BASE_URL, `${CDN_BASE_URL}/`);

  // Basic validation to ensure the transformation was successful
  if (cdnUrl.startsWith(`${CDN_BASE_URL}/user-files/`)) {
    return cdnUrl;
  }

  // Fallback to original URL if transformation logic doesn't match
  console.warn(`Failed to transform URL to CDN: ${supabaseUrl}. Returning original.`);
  return supabaseUrl;
};

/**
 * Get thumbnail URL for a video generation
 * @param {Object} generation - Generation object
 * @returns {string|null} - Thumbnail URL or null
 */
export const getThumbnailUrl = (generation) => {
  // Check for thumbnail_url column first (direct database field)
  if (generation.thumbnail_url) {
    return toCdnUrl(generation.thumbnail_url);
  }
  
  // Check metadata for thumbnail (stored in metadata object)
  if (generation.metadata?.thumbnail_url) {
    return toCdnUrl(generation.metadata.thumbnail_url);
  }
  
  // Check for FFmpeg-generated thumbnails (especially for WAN v2.2 tools)
  if (generation.metadata?.thumbnail_processing?.thumbnail_url) {
    return toCdnUrl(generation.metadata.thumbnail_processing.thumbnail_url);
  }
  
  // Check for watermark processing thumbnails
  if (generation.metadata?.watermark_processing?.thumbnail_url) {
    return toCdnUrl(generation.metadata.watermark_processing.thumbnail_url);
  }
  
  // Enhanced fallback logic for video generations
  // Check if this is a video generation tool
  const isVideoGeneration = generation.tool_type?.includes('video') || 
                           generation.tool_type?.includes('wan') || 
                           generation.tool_type?.includes('kling') || 
                           generation.tool_type?.includes('minimax') || 
                           generation.tool_type?.includes('veo') || 
                           generation.tool_type?.includes('ltxv') || 
                           generation.tool_type?.includes('seedance') || 
                           generation.tool_type === 'ai_scene_gen' ||
                           generation.tool_type?.includes('VEO3Standard') ||
                           generation.tool_type?.includes('VEO3Fast') ||
                           generation.tool_type?.includes('omnihuman');
  
  if (isVideoGeneration) {
    // For video generations, use input image as thumbnail fallback
    // Check multiple possible locations for input image
    const inputImageUrl = generation.input_data?.imageUrl || 
                         generation.input_data?.image_url ||
                         generation.metadata?.input_image_url ||
                         generation.metadata?.original_image_url;
    
    if (inputImageUrl) {
      return toCdnUrl(inputImageUrl);
    }
    
    // For WAN v2.2 tools specifically, check if imageUrl is stored differently
    if (generation.tool_type?.includes('wan_v22') || generation.tool_type?.includes('fal_wan_v22')) {
      const wanImageUrl = generation.input_data?.imageUrl || 
                         generation.metadata?.imageUrl ||
                         generation.metadata?.source_image_url;
      
      if (wanImageUrl) {
        return toCdnUrl(wanImageUrl);
      }
    }
  }
  
  // For image generations, check if there's a source image used
  if (generation.input_data?.imageUrl) {
    return toCdnUrl(generation.input_data.imageUrl);
  }
  
  // Final fallback - check for any image URL in metadata
  if (generation.metadata?.source_image || generation.metadata?.input_image) {
    return toCdnUrl(generation.metadata.source_image || generation.metadata.input_image);
  }
  
  return null;
};

/**
 * Get the appropriate content URL (watermarked for free users, original for paid)
 * @param {Object} generation - Generation object
 * @param {Object} profile - User profile
 * @returns {string} - Content URL to display
 */
export const getContentUrl = (generation, profile) => {
  // Check if user should see watermarked content
  const needsWatermark = !profile || 
                        profile.subscription_status === 'free' || 
                        profile.subscription_tier === 'free';
  
  // If watermarked version exists and user should see it
  if (needsWatermark && generation.metadata?.watermarked_url) {
    return toCdnUrl(generation.metadata.watermarked_url);
  }
  
  // Otherwise return original content
  return toCdnUrl(generation.output_file_url);
};
/*
  # Fix WAN 22 S2V tool type constraint

  1. Database Updates
    - Add 'fal_wan22_s2v' to ai_generations tool_type constraint
    - Ensure constraint allows the new tool type

  2. Verification
    - Check current constraint values
    - Update constraint to include new tool type
*/

-- First, let's see what the current constraint allows
DO $$
BEGIN
  -- Drop the existing constraint
  ALTER TABLE ai_generations DROP CONSTRAINT IF EXISTS ai_generations_tool_type_check;
  
  -- Recreate the constraint with all tool types including the new one
  ALTER TABLE ai_generations ADD CONSTRAINT ai_generations_tool_type_check 
  CHECK ((tool_type = ANY (ARRAY[
    'gen_01'::text, 
    'gen_02'::text, 
    'gen_03'::text, 
    'gen_04'::text, 
    'gen_05'::text, 
    'gen_06'::text, 
    'fal_flux_redux'::text, 
    'fal_flux_kontext'::text, 
    'fal_minimax_hailuo'::text, 
    'fal_wan_pro'::text, 
    'fal_video_prompt'::text, 
    'fal_veo2'::text, 
    'fal_kling_pro'::text, 
    'fal_video_upscaler'::text, 
    'fal_flux_kontext_lora'::text, 
    'fal_bria_bg_remove'::text, 
    'fal_ltxv'::text, 
    'fal_veo3_fast'::text, 
    'ai_scene_gen'::text, 
    'fal_hidream_i1'::text, 
    'fal_seedance_pro'::text, 
    'wan22_pro'::text, 
    'fal_wan_v22_a14b'::text, 
    'fal_cassetteai_music'::text, 
    'fal_mmaudio_v2'::text, 
    'fal_mmaudio_video2'::text, 
    'fal_omnihuman'::text, 
    'fal_wan_v22_text2video_lora'::text, 
    'fal_wan_v22_img2video_lora'::text, 
    'fal_flux_kontext_max_multi'::text, 
    'fal_wan_v22_video2video'::text, 
    'fal_veo3'::text, 
    'fal_gemini_flash_image_edit'::text, 
    'fal_qwen_image'::text, 
    'fal_qwen_image_to_image'::text, 
    'fal_wan22_s2v'::text
  ])));
  
  RAISE NOTICE 'Successfully updated ai_generations tool_type constraint to include fal_wan22_s2v';
END $$;
/*
  # Add WAN v2.2 Video2Video Tool Type

  1. Database Changes
    - Add 'fal_wan_v22_video2video' to the ai_generations_tool_type_check constraint
    - This allows the new video-to-video transformation tool to create generation records

  2. Security
    - No changes to RLS policies needed
    - Uses existing ai_generations table structure
*/

-- Add the new tool type to the constraint
ALTER TABLE ai_generations 
DROP CONSTRAINT IF EXISTS ai_generations_tool_type_check;

ALTER TABLE ai_generations 
ADD CONSTRAINT ai_generations_tool_type_check 
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
  'fal_wan_v22_video2video'::text
])));
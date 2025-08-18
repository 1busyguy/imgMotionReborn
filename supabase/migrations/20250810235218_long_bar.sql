/*
  # Add WAN v2.2 LoRA Tool Types to Constraint

  1. Database Changes
    - Add `fal_wan_v22_text2video_lora` to ai_generations_tool_type_check constraint
    - Add `fal_wan_v22_img2video_lora` to ai_generations_tool_type_check constraint

  2. Purpose
    - Allow the new WAN v2.2 LoRA tools to create generation records
    - Fix the constraint violation error when users try to generate content

  3. Impact
    - Enables both new WAN v2.2 LoRA tools to function properly
    - Users can now create generations without database constraint errors
*/

-- Drop the existing constraint
ALTER TABLE ai_generations DROP CONSTRAINT IF EXISTS ai_generations_tool_type_check;

-- Recreate the constraint with the new tool types added
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
  'fal_wan_v22_img2video_lora'::text
])));
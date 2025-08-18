-- Add MMAudio v2 tool type to ai_generations table constraint
-- This migration adds support for the new fal_mmaudio_v2 tool type

-- Update the tool_type check constraint to include the new MMAudio v2 tool
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
  'fal_mmaudio_v2'::text
])));

-- Add comment explaining the new tool
COMMENT ON CONSTRAINT ai_generations_tool_type_check ON ai_generations IS 
'Allowed AI tool types including MMAudio v2 for advanced text-to-audio generation';
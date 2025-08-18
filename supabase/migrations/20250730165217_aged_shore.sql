-- Add MMAudio Video2Audio tool type to ai_generations table constraint
-- This allows the new fal_mmaudio_video2 tool type to be stored in the database

DO $$
BEGIN
  -- Check if the constraint exists and update it
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'ai_generations_tool_type_check'
  ) THEN
    -- Drop the existing constraint
    ALTER TABLE ai_generations DROP CONSTRAINT ai_generations_tool_type_check;
    
    -- Add the updated constraint with the new tool type
    ALTER TABLE ai_generations ADD CONSTRAINT ai_generations_tool_type_check 
    CHECK ((tool_type = ANY (ARRAY[
      'gen_01'::text, 'gen_02'::text, 'gen_03'::text, 'gen_04'::text, 'gen_05'::text, 'gen_06'::text, 
      'fal_flux_redux'::text, 'fal_flux_kontext'::text, 'fal_minimax_hailuo'::text, 'fal_wan_pro'::text, 
      'fal_video_prompt'::text, 'fal_veo2'::text, 'fal_kling_pro'::text, 'fal_video_upscaler'::text, 
      'fal_flux_kontext_lora'::text, 'fal_bria_bg_remove'::text, 'fal_ltxv'::text, 'fal_veo3_fast'::text, 
      'ai_scene_gen'::text, 'fal_hidream_i1'::text, 'fal_seedance_pro'::text, 'wan22_pro'::text, 
      'fal_wan_v22_a14b'::text, 'fal_cassetteai_music'::text, 'fal_mmaudio_v2'::text, 'fal_mmaudio_video2'::text
    ])));
    
    RAISE NOTICE '✅ Updated ai_generations tool_type constraint to include fal_mmaudio_video2';
  ELSE
    RAISE NOTICE '⚠️ ai_generations_tool_type_check constraint not found';
  END IF;
END $$;
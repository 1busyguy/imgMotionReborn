/*
  # Fix RLS Performance Issue

  The updated RLS policy may be causing performance issues. 
  This migration optimizes the RLS policies and ensures proper indexing.
*/

-- First, let's check if we have the proper index for the RLS policy
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_not_deleted 
ON ai_generations (user_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Update the RLS policy to be more efficient
DROP POLICY IF EXISTS "Users can read own generations" ON ai_generations;

CREATE POLICY "Users can read own generations"
ON ai_generations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Ensure we have an efficient index for admin queries too
CREATE INDEX IF NOT EXISTS idx_ai_generations_admin_all
ON ai_generations (user_id, created_at DESC, deleted_at);

-- Update the public_showcase view to be more efficient
DROP VIEW IF EXISTS public_showcase;

CREATE VIEW public_showcase AS
SELECT 
  ag.id,
  ag.generation_name,
  ag.output_file_url,
  ag.tool_type,
  ag.tool_name,
  ag.tokens_used,
  ag.views,
  ag.likes,
  ag.created_at,
  ag.input_data,
  p.username,
  p.avatar_url,
  p.twitter,
  p.instagram,
  p.youtube,
  p.github
FROM ai_generations ag
JOIN profiles p ON p.id = ag.user_id
WHERE ag.showcased = true 
  AND ag.status = 'completed'
  AND ag.deleted_at IS NULL
ORDER BY ag.views DESC, ag.likes DESC;

-- Grant proper permissions
GRANT SELECT ON public_showcase TO authenticated, anon;
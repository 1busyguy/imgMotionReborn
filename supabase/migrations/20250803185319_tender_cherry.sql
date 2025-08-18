/*
  # Add soft delete functionality to ai_generations

  1. Schema Changes
    - Add `deleted_at` column to track when user "deleted" a generation
    - Add index for efficient queries on non-deleted items
    
  2. RLS Policy Updates
    - Update user policies to only show non-deleted generations
    - Admin policies remain unchanged (can see all)
    
  3. View Updates
    - Update public_showcase view to exclude deleted generations
*/

-- Add deleted_at column for soft delete functionality
ALTER TABLE ai_generations 
ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Add index for efficient queries on non-deleted items
CREATE INDEX idx_ai_generations_user_not_deleted 
ON ai_generations (user_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Add index for admin queries (all generations including deleted)
CREATE INDEX idx_ai_generations_admin_all 
ON ai_generations (user_id, created_at DESC, deleted_at);

-- Update RLS policies for users to only see non-deleted generations
DROP POLICY IF EXISTS "Users can read own generations" ON ai_generations;
CREATE POLICY "Users can read own generations" 
ON ai_generations FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Update RLS policies for users to only update non-deleted generations
DROP POLICY IF EXISTS "Users can update own generations" ON ai_generations;
CREATE POLICY "Users can update own generations" 
ON ai_generations FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Add new policy for soft delete (users can "delete" their own generations)
CREATE POLICY "Users can soft delete own generations" 
ON ai_generations FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Keep admin policies unchanged (admins can see all generations including deleted)
-- Admin policies already use service role which bypasses RLS

-- Update public_showcase view to exclude deleted generations
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
  AND ag.deleted_at IS NULL  -- Exclude soft-deleted generations
ORDER BY ag.views DESC, ag.likes DESC;

-- Create function to soft delete generation
CREATE OR REPLACE FUNCTION soft_delete_generation(generation_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the generation to set deleted_at timestamp
  UPDATE ai_generations 
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = generation_id 
    AND ai_generations.user_id = soft_delete_generation.user_id
    AND deleted_at IS NULL;
  
  -- Return true if a row was updated
  RETURN FOUND;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION soft_delete_generation(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION soft_delete_generation IS 'Soft delete a generation by setting deleted_at timestamp. Only the owner can soft delete their generation.';
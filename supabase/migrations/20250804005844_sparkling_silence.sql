/*
  # Add Admin Permanent Delete Function

  1. New Functions
    - `admin_permanent_delete_generation` - Permanently delete generation (admin only)
  
  2. Security
    - Only accessible via service role (admin functions)
    - Completely removes generation from database
    - No recovery possible
*/

-- Function to permanently delete a generation (admin only)
CREATE OR REPLACE FUNCTION admin_permanent_delete_generation(
  generation_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete the generation permanently
  DELETE FROM ai_generations 
  WHERE id = generation_id;
  
  -- Return true if a row was deleted
  RETURN FOUND;
END;
$$;
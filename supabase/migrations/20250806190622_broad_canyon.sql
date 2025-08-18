/*
  # Add User Banning System

  1. Database Changes
    - Add `banned` boolean column to profiles table
    - Add `ban_reason` text column to profiles table  
    - Add `banned_at` timestamp column to profiles table
    - Add `banned_by` uuid column to profiles table (references admin user)
    - Add index for efficient banned user queries

  2. Security
    - Update RLS policies to block banned users
    - Add admin function to ban/unban users
    - Add logging for ban actions

  3. Functions
    - Create admin_ban_user function
    - Create admin_unban_user function
*/

-- Add banning columns to profiles table
DO $$
BEGIN
  -- Add banned column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'banned'
  ) THEN
    ALTER TABLE profiles ADD COLUMN banned boolean DEFAULT false NOT NULL;
  END IF;

  -- Add ban_reason column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'ban_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN ban_reason text;
  END IF;

  -- Add banned_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'banned_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN banned_at timestamptz;
  END IF;

  -- Add banned_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'banned_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN banned_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Add index for banned users
CREATE INDEX IF NOT EXISTS idx_profiles_banned ON profiles(banned) WHERE banned = true;

-- Add index for ban queries
CREATE INDEX IF NOT EXISTS idx_profiles_ban_info ON profiles(banned, banned_at, banned_by) WHERE banned = true;

-- Create admin function to ban a user
CREATE OR REPLACE FUNCTION admin_ban_user(
  target_user_id uuid,
  ban_reason_text text,
  admin_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin user exists and is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = admin_user_id 
    AND (
      id = '991e17a6-c1a8-4496-8b28-cc83341c028a'::uuid OR
      email = 'jim@1busyguy.com'
    )
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Verify target user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Ban the user
  UPDATE profiles 
  SET 
    banned = true,
    ban_reason = ban_reason_text,
    banned_at = now(),
    banned_by = admin_user_id,
    updated_at = now()
  WHERE id = target_user_id;

  -- Log the ban action
  RAISE NOTICE 'User % banned by admin % for reason: %', target_user_id, admin_user_id, ban_reason_text;

  RETURN true;
END;
$$;

-- Create admin function to unban a user
CREATE OR REPLACE FUNCTION admin_unban_user(
  target_user_id uuid,
  admin_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin user exists and is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = admin_user_id 
    AND (
      id = '991e17a6-c1a8-4496-8b28-cc83341c008a'::uuid OR
      email = 'jim@1busyguy.com'
    )
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Verify target user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Unban the user
  UPDATE profiles 
  SET 
    banned = false,
    ban_reason = null,
    banned_at = null,
    banned_by = null,
    updated_at = now()
  WHERE id = target_user_id;

  -- Log the unban action
  RAISE NOTICE 'User % unbanned by admin %', target_user_id, admin_user_id;

  RETURN true;
END;
$$;

-- Update RLS policies to block banned users from accessing their data
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id AND banned = false);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id AND banned = false);

-- Update ai_generations policies to block banned users
DROP POLICY IF EXISTS "Users can read own generations" ON ai_generations;
CREATE POLICY "Users can read own generations"
  ON ai_generations
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id AND 
    deleted_at IS NULL AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND banned = false)
  );

DROP POLICY IF EXISTS "Users can insert own generations" ON ai_generations;
CREATE POLICY "Users can insert own generations"
  ON ai_generations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND banned = false)
  );

DROP POLICY IF EXISTS "Users can update own generations" ON ai_generations;
CREATE POLICY "Users can update own generations"
  ON ai_generations
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND 
    deleted_at IS NULL AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND banned = false)
  );

-- Add comment explaining the banning system
COMMENT ON COLUMN profiles.banned IS 'Whether the user is banned from the platform';
COMMENT ON COLUMN profiles.ban_reason IS 'Reason for the ban (selected from predefined list)';
COMMENT ON COLUMN profiles.banned_at IS 'Timestamp when the user was banned';
COMMENT ON COLUMN profiles.banned_by IS 'Admin user who banned this user';
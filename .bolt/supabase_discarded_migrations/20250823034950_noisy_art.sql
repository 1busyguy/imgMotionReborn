-- Create a new user profile for cameron@radtv.com
-- Note: This creates a profile record, but for full authentication,
-- the user should sign up through the normal signup process

-- First, let's create a UUID for the user (you can also generate one manually)
-- This would typically be done by Supabase Auth, but we're creating it manually

-- Insert into profiles table
INSERT INTO profiles (
  id,
  email,
  tokens,
  purchased_tokens,
  subscription_status,
  subscription_tier,
  created_at,
  updated_at,
  banned,
  is_admin
) VALUES (
  gen_random_uuid(), -- This generates a random UUID
  'cameron@radtv.com',
  200, -- Free tier starting tokens
  0,   -- No purchased tokens
  'free',
  'free',
  now(),
  now(),
  false, -- Not banned
  false  -- Not admin
);

-- Verify the user was created
SELECT 
  id,
  email,
  tokens,
  subscription_status,
  created_at
FROM profiles 
WHERE email = 'cameron@radtv.com';
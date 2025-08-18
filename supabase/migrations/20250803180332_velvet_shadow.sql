/*
  # Add IP address tracking to profiles

  1. Schema Changes
    - Add `ip_address` column to `profiles` table
    - Add `signup_ip` column for initial signup IP
    - Add index for IP-based queries (admin use)

  2. Security
    - IP addresses are stored for record keeping only
    - Not exposed in frontend applications
    - Admin-only access for compliance and security
*/

-- Add IP address columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS signup_ip inet,
ADD COLUMN IF NOT EXISTS last_login_ip inet,
ADD COLUMN IF NOT EXISTS ip_updated_at timestamptz DEFAULT now();

-- Add index for admin IP-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_signup_ip ON profiles(signup_ip);
CREATE INDEX IF NOT EXISTS idx_profiles_last_login_ip ON profiles(last_login_ip);

-- Add comment for documentation
COMMENT ON COLUMN profiles.signup_ip IS 'IP address used during account creation - for record keeping and security';
COMMENT ON COLUMN profiles.last_login_ip IS 'Most recent login IP address - for security monitoring';
COMMENT ON COLUMN profiles.ip_updated_at IS 'Timestamp of last IP address update';
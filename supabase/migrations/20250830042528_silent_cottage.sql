/*
  # IP Signup Restrictions

  1. New Tables
    - `ip_signup_tracking`
      - `ip_address` (inet, primary key)
      - `signup_count` (integer)
      - `first_signup_at` (timestamp)
      - `last_signup_at` (timestamp)
      - `is_blocked` (boolean)
      - `blocked_reason` (text)
      - `blocked_at` (timestamp)
      - `blocked_by` (uuid)

  2. Security
    - Enable RLS on `ip_signup_tracking` table
    - Add policy for service role access only

  3. Functions
    - `check_ip_signup_limit` - Check if IP can create free accounts
    - `increment_ip_signup_count` - Track successful signups
    - `admin_block_ip` - Manual IP blocking for admins
*/

-- Create IP signup tracking table
CREATE TABLE IF NOT EXISTS ip_signup_tracking (
  ip_address inet PRIMARY KEY,
  signup_count integer DEFAULT 0 NOT NULL,
  first_signup_at timestamptz DEFAULT now(),
  last_signup_at timestamptz DEFAULT now(),
  is_blocked boolean DEFAULT false,
  blocked_reason text,
  blocked_at timestamptz,
  blocked_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ip_signup_tracking ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (for security)
CREATE POLICY "Service role can manage IP tracking"
  ON ip_signup_tracking
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to check if IP can create free accounts
CREATE OR REPLACE FUNCTION check_ip_signup_limit(client_ip inet)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ip_record record;
  max_free_accounts integer := 2; -- Maximum 2 free accounts per IP
BEGIN
  -- Get IP tracking record
  SELECT * INTO ip_record
  FROM ip_signup_tracking
  WHERE ip_address = client_ip;
  
  -- If no record exists, IP is allowed
  IF ip_record IS NULL THEN
    RETURN json_build_object(
      'allowed', true,
      'signup_count', 0,
      'max_allowed', max_free_accounts,
      'reason', 'new_ip'
    );
  END IF;
  
  -- Check if IP is manually blocked
  IF ip_record.is_blocked THEN
    RETURN json_build_object(
      'allowed', false,
      'signup_count', ip_record.signup_count,
      'max_allowed', max_free_accounts,
      'reason', 'manually_blocked',
      'blocked_reason', ip_record.blocked_reason
    );
  END IF;
  
  -- Check signup count limit
  IF ip_record.signup_count >= max_free_accounts THEN
    RETURN json_build_object(
      'allowed', false,
      'signup_count', ip_record.signup_count,
      'max_allowed', max_free_accounts,
      'reason', 'limit_exceeded',
      'first_signup', ip_record.first_signup_at,
      'last_signup', ip_record.last_signup_at
    );
  END IF;
  
  -- IP is allowed
  RETURN json_build_object(
    'allowed', true,
    'signup_count', ip_record.signup_count,
    'max_allowed', max_free_accounts,
    'reason', 'within_limit'
  );
END;
$$;

-- Function to increment IP signup count
CREATE OR REPLACE FUNCTION increment_ip_signup_count(client_ip inet)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ip_record record;
  new_count integer;
BEGIN
  -- Insert or update IP tracking record
  INSERT INTO ip_signup_tracking (ip_address, signup_count, first_signup_at, last_signup_at)
  VALUES (client_ip, 1, now(), now())
  ON CONFLICT (ip_address)
  DO UPDATE SET
    signup_count = ip_signup_tracking.signup_count + 1,
    last_signup_at = now(),
    updated_at = now()
  RETURNING * INTO ip_record;
  
  RETURN json_build_object(
    'success', true,
    'ip_address', ip_record.ip_address,
    'signup_count', ip_record.signup_count,
    'first_signup_at', ip_record.first_signup_at,
    'last_signup_at', ip_record.last_signup_at
  );
END;
$$;

-- Function for admin to manually block IPs
CREATE OR REPLACE FUNCTION admin_block_ip(
  target_ip inet,
  block_reason text,
  admin_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update IP record with block
  INSERT INTO ip_signup_tracking (ip_address, is_blocked, blocked_reason, blocked_at, blocked_by)
  VALUES (target_ip, true, block_reason, now(), admin_user_id)
  ON CONFLICT (ip_address)
  DO UPDATE SET
    is_blocked = true,
    blocked_reason = block_reason,
    blocked_at = now(),
    blocked_by = admin_user_id,
    updated_at = now();
  
  RETURN json_build_object(
    'success', true,
    'ip_address', target_ip,
    'blocked', true,
    'reason', block_reason,
    'blocked_by', admin_user_id
  );
END;
$$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ip_signup_tracking_blocked ON ip_signup_tracking (is_blocked) WHERE is_blocked = true;
CREATE INDEX IF NOT EXISTS idx_ip_signup_tracking_count ON ip_signup_tracking (signup_count);
CREATE INDEX IF NOT EXISTS idx_ip_signup_tracking_last_signup ON ip_signup_tracking (last_signup_at);
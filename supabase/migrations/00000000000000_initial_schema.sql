/*
  # Initial Database Schema for imgMotion

  This migration sets up the complete database schema required for the imgMotion platform.
  Run this migration first before any other migrations.

  ## Tables Created:
  1. profiles - User profiles and settings
  2. ai_generations - AI generation records
  3. subscriptions - Stripe subscription tracking
  4. preset_loras - LoRA model presets
  5. ip_signup_tracking - Signup abuse prevention

  ## Security:
  - RLS enabled on all tables
  - Policies for user data isolation
  - Service role access for backend operations
*/

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
-- User profiles extending Supabase Auth users

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT,
  bio TEXT,
  avatar_url TEXT,
  twitter TEXT,
  instagram TEXT,
  youtube TEXT,
  github TEXT,
  tokens INTEGER DEFAULT 0 NOT NULL,
  subscription_status TEXT DEFAULT 'free',
  subscription_tier TEXT DEFAULT 'free',
  stripe_customer_id TEXT UNIQUE,
  is_admin BOOLEAN DEFAULT false,
  is_banned BOOLEAN DEFAULT false,
  banned_reason TEXT,
  banned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role has full access to profiles"
  ON profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public profiles for showcase (limited columns)
CREATE POLICY "Public can view limited profile info for showcase"
  ON profiles FOR SELECT
  TO anon
  USING (true);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

-- Trigger for auto profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. AI_GENERATIONS TABLE
-- ============================================
-- Stores all AI generation records

CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  generation_name TEXT,
  tool_type TEXT NOT NULL,
  prompt TEXT,
  status TEXT DEFAULT 'processing' NOT NULL,
  output_file_url TEXT,
  error_message TEXT,
  showcased BOOLEAN DEFAULT false,
  tokens_used INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraint for allowed tool types
  CONSTRAINT ai_generations_tool_type_check CHECK ((tool_type = ANY (ARRAY[
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
    'fal_wan_v22_img2video_lora'::text,
    'fal_flux_kontext_max_multi'::text,
    'fal_wan_v22_video2video'::text,
    'fal_veo3'::text,
    'fal_gemini_flash_image_edit'::text,
    'fal_qwen_image'::text,
    'fal_qwen_image_to_image'::text,
    'fal_seedance_reference_to_video'::text,
    'fal_wan22_s2v'::text,
    'fal_seedream_v4_edit'::text
  ])))
);

-- Enable RLS
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

-- Users can view their own generations
CREATE POLICY "Users can view own generations"
  ON ai_generations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own generations
CREATE POLICY "Users can create own generations"
  ON ai_generations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own generations
CREATE POLICY "Users can update own generations"
  ON ai_generations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own generations
CREATE POLICY "Users can delete own generations"
  ON ai_generations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Public can view showcased generations
CREATE POLICY "Public can view showcased generations"
  ON ai_generations FOR SELECT
  TO anon
  USING (showcased = true);

-- Service role has full access
CREATE POLICY "Service role has full access to generations"
  ON ai_generations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_id ON ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_status ON ai_generations(status);
CREATE INDEX IF NOT EXISTS idx_ai_generations_showcased ON ai_generations(showcased) WHERE showcased = true;
CREATE INDEX IF NOT EXISTS idx_ai_generations_created_at ON ai_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_generations_tool_type ON ai_generations(tool_type);

-- ============================================
-- 3. SUBSCRIPTIONS TABLE
-- ============================================
-- Tracks Stripe subscriptions

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT DEFAULT 'inactive',
  price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role has full access to subscriptions"
  ON subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);

-- ============================================
-- 4. PRESET_LORAS TABLE
-- ============================================
-- Admin-managed LoRA presets

CREATE TABLE IF NOT EXISTS preset_loras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  path TEXT NOT NULL,
  weight_name TEXT,
  tool_types JSONB DEFAULT '[]',
  tier_access JSONB DEFAULT '["free", "pro", "business"]',
  default_scale FLOAT DEFAULT 0.8,
  default_transformer TEXT,
  trigger_words JSONB DEFAULT '[]',
  category TEXT DEFAULT 'style',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  preview_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE preset_loras ENABLE ROW LEVEL SECURITY;

-- Everyone can view active LoRAs
CREATE POLICY "Anyone can view active LoRAs"
  ON preset_loras FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

-- Service role has full access
CREATE POLICY "Service role has full access to LoRAs"
  ON preset_loras FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_preset_loras_active ON preset_loras(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_preset_loras_category ON preset_loras(category);

-- ============================================
-- 5. IP_SIGNUP_TRACKING TABLE
-- ============================================
-- Prevents abuse of free account signup

CREATE TABLE IF NOT EXISTS ip_signup_tracking (
  ip_address INET PRIMARY KEY,
  signup_count INTEGER DEFAULT 0 NOT NULL,
  first_signup_at TIMESTAMPTZ DEFAULT now(),
  last_signup_at TIMESTAMPTZ DEFAULT now(),
  is_blocked BOOLEAN DEFAULT false,
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,
  blocked_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE ip_signup_tracking ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (for security)
CREATE POLICY "Service role can manage IP tracking"
  ON ip_signup_tracking FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ip_signup_tracking_blocked ON ip_signup_tracking(is_blocked) WHERE is_blocked = true;
CREATE INDEX IF NOT EXISTS idx_ip_signup_tracking_count ON ip_signup_tracking(signup_count);
CREATE INDEX IF NOT EXISTS idx_ip_signup_tracking_last_signup ON ip_signup_tracking(last_signup_at);

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Check if IP can create free accounts
CREATE OR REPLACE FUNCTION check_ip_signup_limit(client_ip INET)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ip_record RECORD;
  max_free_accounts INTEGER := 2;
BEGIN
  SELECT * INTO ip_record
  FROM ip_signup_tracking
  WHERE ip_address = client_ip;

  IF ip_record IS NULL THEN
    RETURN json_build_object(
      'allowed', true,
      'signup_count', 0,
      'max_allowed', max_free_accounts,
      'reason', 'new_ip'
    );
  END IF;

  IF ip_record.is_blocked THEN
    RETURN json_build_object(
      'allowed', false,
      'signup_count', ip_record.signup_count,
      'max_allowed', max_free_accounts,
      'reason', 'manually_blocked',
      'blocked_reason', ip_record.blocked_reason
    );
  END IF;

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

  RETURN json_build_object(
    'allowed', true,
    'signup_count', ip_record.signup_count,
    'max_allowed', max_free_accounts,
    'reason', 'within_limit'
  );
END;
$$;

-- Increment IP signup count
CREATE OR REPLACE FUNCTION increment_ip_signup_count(client_ip INET)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ip_record RECORD;
BEGIN
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

-- Admin block IP function
CREATE OR REPLACE FUNCTION admin_block_ip(
  target_ip INET,
  block_reason TEXT,
  admin_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

-- Increment showcase views
CREATE OR REPLACE FUNCTION increment_showcase_views(generation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ai_generations
  SET views = views + 1, updated_at = now()
  WHERE id = generation_id AND showcased = true;
END;
$$;

-- ============================================
-- 7. STORAGE BUCKETS
-- ============================================
-- Note: Storage buckets are created via Supabase Dashboard or CLI
-- Required bucket: 'user-files'
--
-- Recommended bucket policies:
-- - Authenticated users can upload to their own folder: {user_id}/*
-- - Authenticated users can read their own files
-- - Public read access for showcased content (optional)
--
-- Example storage policy SQL (run separately):
--
-- CREATE POLICY "Users can upload to own folder"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);
--
-- CREATE POLICY "Users can view own files"
-- ON storage.objects FOR SELECT
-- TO authenticated
-- USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE profiles IS 'User profiles extending Supabase Auth. Contains user settings, token balance, and subscription status.';
COMMENT ON TABLE ai_generations IS 'Records of all AI-generated content. Tracks status, outputs, and showcase settings.';
COMMENT ON TABLE subscriptions IS 'Stripe subscription records synced via webhooks.';
COMMENT ON TABLE preset_loras IS 'Admin-managed LoRA model presets with tier-based access control.';
COMMENT ON TABLE ip_signup_tracking IS 'Tracks IP addresses to prevent free account signup abuse. Max 2 free accounts per IP.';

COMMENT ON COLUMN profiles.tokens IS 'Current token balance for AI generation usage';
COMMENT ON COLUMN profiles.subscription_status IS 'Current subscription status: free, pro, business, canceled';
COMMENT ON COLUMN ai_generations.tool_type IS 'AI tool identifier used for generation';
COMMENT ON COLUMN ai_generations.showcased IS 'Whether this generation appears in public gallery';
COMMENT ON COLUMN ai_generations.metadata IS 'Extended metadata including FAL.ai request details and model parameters';

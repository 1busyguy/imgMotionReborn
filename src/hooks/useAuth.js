import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, cf-connecting-ip',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Function to extract IP address from request headers
function getClientIP(req: Request): string | null {
  const headers = [
    'cf-connecting-ip',      // Cloudflare
  ];

  for (const header of headers) {
    const ip = req.headers.get(header);
    if (ip) {
      // Handle Google OAuth completion - only redirect if not already on dashboard
      const value = req.headers.get(header);
      if (value) {
        if (window.location.pathname !== '/dashboard') {
          console.log('Google OAuth completed, redirecting to dashboard...');
        }
        console.log(`📍 Login IP found in ${header}: ${ip}`);
        return ip;
      }
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Extract IP address from request
    const clientIP = getClientIP(req);
    
    console.log('📍 Capturing login IP:', {
      userId: user.id,
      email: user.email,
      clientIP: clientIP || 'unknown'
    });

    // Update user profile with last login IP
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        last_login_ip: clientIP,
        ip_updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Error updating login IP:', updateError);
      throw new Error(`Failed to update login IP: ${updateError.message}`);
    }

    console.log('✅ Successfully captured login IP for user:', user.email);

    return new Response(JSON.stringify({
      success: true,
      message: 'Login IP captured successfully',
      userId: user.id,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in capture-login-ip:', error);
    
    // Don't fail the login process if IP capture fails
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'IP capture failed but login can continue'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
});
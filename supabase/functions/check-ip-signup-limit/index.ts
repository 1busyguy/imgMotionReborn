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
    'x-forwarded-for',       // Standard proxy header
    'x-real-ip',             // Nginx
    'x-client-ip',           // Apache
    'x-forwarded',           // General
    'forwarded-for',         // Alternative
    'forwarded'              // RFC 7239
  ];

  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      const ip = value.split(',')[0].trim();
      if (ip && ip !== 'unknown') {
        console.log(`📍 IP found in ${header}: ${ip}`);
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

    // Extract IP address from request
    const clientIP = getClientIP(req);
    
    console.log('🔍 Checking IP signup limit:', {
      clientIP: clientIP || 'unknown',
      headers: Object.fromEntries(req.headers.entries())
    });

    if (!clientIP) {
      console.warn('⚠️ Could not extract client IP, allowing signup');
      return new Response(JSON.stringify({
        allowed: true,
        reason: 'ip_detection_failed',
        message: 'Could not detect IP address, allowing signup'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check IP signup limit using database function
    const { data: limitCheck, error: limitError } = await supabase.rpc('check_ip_signup_limit', {
      client_ip: clientIP
    });

    if (limitError) {
      console.error('❌ Error checking IP limit:', limitError);
      // Allow signup if check fails (fail open for better UX)
      return new Response(JSON.stringify({
        allowed: true,
        reason: 'check_failed',
        error: limitError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('📊 IP limit check result:', limitCheck);

    return new Response(JSON.stringify({
      allowed: limitCheck.allowed,
      signup_count: limitCheck.signup_count,
      max_allowed: limitCheck.max_allowed,
      reason: limitCheck.reason,
      blocked_reason: limitCheck.blocked_reason,
      first_signup: limitCheck.first_signup,
      last_signup: limitCheck.last_signup,
      ip_address: clientIP
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in check-ip-signup-limit:', error);
    
    // Allow signup if there's an error (fail open)
    return new Response(JSON.stringify({
      allowed: true,
      reason: 'error_occurred',
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
});
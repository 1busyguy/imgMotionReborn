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
    
    console.log('📈 Incrementing IP signup count:', {
      userId: user.id,
      email: user.email,
      clientIP: clientIP || 'unknown'
    });

    if (!clientIP) {
      console.warn('⚠️ Could not extract client IP for signup tracking');
      return new Response(JSON.stringify({
        success: false,
        message: 'Could not extract IP address'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Don't fail signup
      });
    }

    // Increment IP signup count using database function
    const { data: incrementResult, error: incrementError } = await supabase.rpc('increment_ip_signup_count', {
      client_ip: clientIP
    });

    if (incrementError) {
      console.error('❌ Error incrementing IP signup count:', incrementError);
      // Don't fail signup if tracking fails
      return new Response(JSON.stringify({
        success: false,
        error: incrementError.message,
        message: 'IP tracking failed but signup can continue'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log('✅ Successfully incremented IP signup count:', incrementResult);

    return new Response(JSON.stringify({
      success: true,
      message: 'IP signup count updated',
      result: incrementResult,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in increment-ip-signup:', error);
    
    // Don't fail the signup process if IP tracking fails
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'IP tracking failed but signup can continue'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
});
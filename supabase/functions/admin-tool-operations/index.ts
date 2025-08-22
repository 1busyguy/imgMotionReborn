import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user is admin using UUID (same method as other admin functions)
    const adminUUIDs = ['991e17a6-c1a8-4496-8b28-cc83341c028a']; // jim@1busyguy.com
    const isAdmin = adminUUIDs.includes(user.id) || 
                    user.email === 'jim@1busyguy.com' || 
                    user.user_metadata?.email === 'jim@1busyguy.com';

    if (!isAdmin) {
      console.log('❌ Admin access denied for user:', {
        id: user.id,
        email: user.email,
        metadata_email: user.user_metadata?.email
      });
      return new Response(JSON.stringify({ error: 'Unauthorized: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('✅ Admin user verified for tool operations:', {
      id: user.id,
      email: user.email
    });

    if (req.method === 'GET') {
      // Return admin verification success
      return new Response(JSON.stringify({ 
        success: true, 
        isAdmin: true,
        user: {
          id: user.id,
          email: user.email
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Handle POST operations for tool generation
    const { operation, data } = await req.json()
    
    switch (operation) {
      case 'generate_tool':
        // Handle tool generation logic here
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Tool generation started',
          data: data
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      
      default:
        return new Response(JSON.stringify({ error: 'Unknown operation' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

  } catch (error) {
    console.error('Error in admin-tool-operations:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
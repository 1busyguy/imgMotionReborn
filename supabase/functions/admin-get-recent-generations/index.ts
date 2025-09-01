import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Create Supabase client with service role for admin access
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get auth token and verify admin
        const authHeader = req.headers.get('Authorization')!;
        const token = authHeader.replace('Bearer ', '');

        // Verify the user from the JWT
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check if user is admin
        const adminUUIDs = ['991e17a6-c1a8-4496-8b28-cc83341c028a'];
        const isAdmin = adminUUIDs.includes(user.id) ||
            user.email === 'jim@1busyguy.com' ||
            user.user_metadata?.email === 'jim@1busyguy.com';

        if (!isAdmin) {
            return new Response(
                JSON.stringify({ error: 'Forbidden - Admin access required' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Parse request body
        const { limit = 64 } = await req.json();

        // Fetch recent generations with user info
        const { data: generations, error: generationsError } = await supabase
            .from('ai_generations')
            .select(`
        *,
        profiles:user_id (
          email,
          username,
          avatar_url
        )
      `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (generationsError) {
            console.error('Error fetching generations:', generationsError);
            return new Response(
                JSON.stringify({ error: 'Failed to fetch generations' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Format the response with user info
        const formattedGenerations = generations?.map(gen => ({
            ...gen,
            user_email: gen.profiles?.email || 'Unknown',
            user_username: gen.profiles?.username || null,
            user_avatar: gen.profiles?.avatar_url || null,
            profiles: undefined // Remove the nested profiles object
        })) || [];

        return new Response(
            JSON.stringify({
                success: true,
                generations: formattedGenerations,
                count: formattedGenerations.length
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );

    } catch (error) {
        console.error('Error in admin-get-recent-generations:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Authenticate admin user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }
    
    // Check if user is admin
    const adminUUIDs = ['991e17a6-c1a8-4496-8b28-cc83341c028a'];
    const isAdmin = adminUUIDs.includes(user.id) || 
                    user.email === 'jim@1busyguy.com' || 
                    user.user_metadata?.email === 'jim@1busyguy.com';
    
    if (!isAdmin) {
      throw new Error('Admin access required');
    }
    
    const { userId } = await req.json();
    
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    console.log('🔍 Admin fetching ALL generations (including soft-deleted) for user:', userId);
    
    // Fetch ALL generations for the user (INCLUDING soft-deleted)
    // Admin should see everything
    const { data: generations, error: generationsError } = await supabase
      .from('ai_generations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (generationsError) {
      console.error('❌ Error fetching generations:', generationsError);
      throw new Error(`Failed to fetch generations: ${generationsError.message}`);
    }
    
    // Count soft-deleted items (handle null case)
    const allGenerations = generations || [];
    const softDeletedCount = allGenerations.filter(g => g.deleted_at).length;
    const activeCount = allGenerations.filter(g => !g.deleted_at).length;
    
    console.log(`✅ Successfully fetched ${allGenerations.length} total generations (${activeCount} active, ${softDeletedCount} soft-deleted) for user ${userId}`);
    
    // Debug: Log some sample generation data
    if (allGenerations.length > 0) {
      console.log('📊 Sample generation data:', {
        first_generation: allGenerations[0] ? {
          id: allGenerations[0].id,
          tool_type: allGenerations[0].tool_type,
          status: allGenerations[0].status,
          created_at: allGenerations[0].created_at,
          deleted_at: allGenerations[0].deleted_at
        } : null,
        stats: {
          total: allGenerations.length,
          active: activeCount,
          soft_deleted: softDeletedCount
        }
      });
    } else {
      console.log('🔍 No generations found - checking if user exists...');
      
      // Check if user actually exists
      const { data: userCheck, error: userCheckError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('id', userId)
        .single();
      
      console.log('👤 User check result:', { 
        userExists: !!userCheck, 
        email: userCheck?.email, 
        error: userCheckError?.message 
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      generations: allGenerations,
      count: allGenerations.length,
      activeCount: activeCount,
      softDeletedCount: softDeletedCount,
      userId: userId,
      debug: {
        user_exists: true,
        query_filters: {
          user_id: userId,
          deleted_at_filter: 'none - admin sees all generations'
        },
        total_found: allGenerations.length,
        active_generations: activeCount,
        soft_deleted_generations: softDeletedCount
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error in admin-get-user-generations:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
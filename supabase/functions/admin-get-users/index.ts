import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
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
      throw new Error('Admin access required');
    }

    console.log('✅ Admin user verified:', {
      id: user.id,
      email: user.email,
      isInAdminList: adminUUIDs.includes(user.id)
    });

    console.log('🔍 Fetching all users...');
    
    // Step 1: Get all users with proper error handling
    const { data: allUsers, error: allUsersError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (allUsersError) {
      console.error('❌ Error fetching users:', allUsersError);
      throw new Error(`Failed to fetch users: ${allUsersError.message}`);
    }

    console.log(`✅ Fetched ${allUsers?.length || 0} users from profiles table`);
    
    if (!allUsers || allUsers.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        users: [],
        count: 0,
        debug: { 
          message: 'No users found in profiles table',
          timestamp: new Date().toISOString()
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Get generation counts for each user
    console.log('🔍 Fetching generation counts for each user...');
    
    let countMap = {};
    
    // Count generations for each user individually
    for (const user of allUsers) {
      try {
        const { data: userGens, error: userGenError } = await supabase
          .from('ai_generations')
          .select('id')
          .eq('user_id', user.id);
        
        if (userGenError) {
          console.error(`❌ Error counting for ${user.email}:`, userGenError);
          countMap[user.id] = 0;
        } else {
          const count = userGens ? userGens.length : 0;
          countMap[user.id] = count;
          console.log(`📊 ${user.email}: ${count} generations`);
        }
      } catch (err) {
        console.error(`❌ Exception counting for ${user.email}:`, err);
        countMap[user.id] = 0;
      }
    }
    
    // Step 3: Combine user data with counts and subscriptions
    const usersWithData: any[] = [];
    
    for (const user of allUsers) {
      try {
        // Get subscriptions for this user
        const { data: subscriptions } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        const generationCount = countMap[user.id] || 0;
        
        usersWithData.push({
          ...user,
          subscriptions: subscriptions || [],
          generation_count: generationCount
        });
        
      } catch (err) {
        console.warn(`⚠️ Error processing user ${user.email}:`, err);
        usersWithData.push({
          ...user,
          subscriptions: [],
          generation_count: 0
        });
      }
    }
    
    // Sort by generation count (highest first) for consistent ordering
    usersWithData.sort((a, b) => (b.generation_count || 0) - (a.generation_count || 0));
    
    console.log(`✅ Processed ${usersWithData.length} users with generation counts`);
    console.log('📊 Sample counts:', usersWithData.slice(0, 3).map(u => `${u.email}: ${u.generation_count}`));

    return new Response(JSON.stringify({
      success: true,
      users: usersWithData,
      count: usersWithData.length,
      debug: {
        total_profiles_fetched: allUsers?.length || 0,
        users_processed: usersWithData.length,
        admin_user: user.email,
        sample_generation_counts: usersWithData.slice(0, 3).map(u => ({
          email: u.email,
          generations: u.generation_count
        })),
        total_generations: Object.values(countMap).reduce((sum, count) => sum + count, 0),
        top_user: usersWithData[0] ? {
          email: usersWithData[0].email,
          generations: usersWithData[0].generation_count
        } : null,
        timestamp: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in admin-get-users:', error);
    
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
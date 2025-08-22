import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const adminUUIDs = ['991e17a6-c1a8-4496-8b28-cc83341c028a'];
    const isAdmin = adminUUIDs.includes(user.id) || 
                    user.email === 'jim@1busyguy.com' || 
                    user.user_metadata?.email === 'jim@1busyguy.com';

    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    const { userId, banReason, action } = await req.json();
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!action || !['ban', 'unban'].includes(action)) {
      throw new Error('Action must be "ban" or "unban"');
    }

    console.log(`🚫 Admin ${action} request:`, {
      adminId: user.id,
      adminEmail: user.email,
      targetUserId: userId,
      banReason: banReason || 'N/A',
      action
    });

    let result;
    
    if (action === 'ban') {
      if (!banReason) {
        throw new Error('Ban reason is required');
      }

      // Call admin ban function
      const { data, error } = await supabase.rpc('admin_ban_user', {
        target_user_id: userId,
        ban_reason_text: banReason,
        admin_user_id: user.id
      });

      if (error) {
        console.error('❌ Error banning user:', error);
        throw new Error(`Failed to ban user: ${error.message}`);
      }

      result = { action: 'banned', reason: banReason };
      console.log(`✅ User ${userId} banned successfully by admin ${user.email}`);

    } else if (action === 'unban') {
      // Call admin unban function
      const { data, error } = await supabase.rpc('admin_unban_user', {
        target_user_id: userId,
        admin_user_id: user.id
      });

      if (error) {
        console.error('❌ Error unbanning user:', error);
        throw new Error(`Failed to unban user: ${error.message}`);
      }

      result = { action: 'unbanned' };
      console.log(`✅ User ${userId} unbanned successfully by admin ${user.email}`);
    }

    // Get updated user info for response
    const { data: updatedUser, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, banned, ban_reason, banned_at')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.warn('⚠️ Could not fetch updated user info:', fetchError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `User ${action === 'ban' ? 'banned' : 'unbanned'} successfully`,
      user: updatedUser,
      result,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in admin-ban-user:', error);
    
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
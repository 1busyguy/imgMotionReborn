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

    const { generationId } = await req.json();
    
    if (!generationId) {
      throw new Error('Generation ID is required');
    }

    console.log('🗑️ Admin permanently deleting generation:', generationId);

    // Permanently delete the generation using service role (bypasses RLS)
    const { error: deleteError } = await supabase
      .from('ai_generations')
      .delete()
      .eq('id', generationId);

    if (deleteError) {
      console.error('❌ Error permanently deleting generation:', deleteError);
      throw new Error(`Failed to delete generation: ${deleteError.message}`);
    }

    console.log('✅ Generation permanently deleted from database');

    // Verify deletion was successful
    const { data: verifyData, error: verifyError } = await supabase
      .from('ai_generations')
      .select('id')
      .eq('id', generationId)
      .maybeSingle();

    if (verifyError) {
      console.error('❌ Error verifying deletion:', verifyError);
      throw new Error(`Failed to verify deletion: ${verifyError.message}`);
    }

    if (verifyData) {
      throw new Error('Generation still exists after deletion attempt');
    }

    console.log('✅ Deletion verified - generation no longer exists');

    return new Response(JSON.stringify({
      success: true,
      message: 'Generation permanently deleted',
      generation_id: generationId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in admin-permanent-delete:', error);
    
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
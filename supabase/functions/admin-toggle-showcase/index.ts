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

    const { generationId, showcased } = await req.json();
    
    if (!generationId) {
      throw new Error('Generation ID is required');
    }

    console.log('🌟 Admin toggling showcase for generation:', generationId, 'to:', showcased);

    // Use service role to bypass RLS and update ANY user's generation
    const { data: updateResult, error: updateError } = await supabase
      .from('ai_generations')
      .update({ 
        showcased: showcased,
        updated_at: new Date().toISOString()
      })
      .eq('id', generationId)
      .select('id, showcased, user_id, generation_name');

    if (updateError) {
      console.error('❌ Error updating showcase status:', updateError);
      throw new Error(`Failed to update showcase status: ${updateError.message}`);
    }

    if (!updateResult || updateResult.length === 0) {
      throw new Error('Generation not found or update failed');
    }

    const updatedGeneration = updateResult[0];
    console.log('✅ Successfully updated showcase status:', updatedGeneration);

    // Get user info for logging
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', updatedGeneration.user_id)
      .single();

    console.log(`🎯 Showcase ${showcased ? 'ENABLED' : 'DISABLED'} for "${updatedGeneration.generation_name}" by ${profile?.email || 'unknown user'}`);

    return new Response(JSON.stringify({
      success: true,
      generation: updatedGeneration,
      message: showcased ? 'Added to showcase' : 'Removed from showcase',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in admin-toggle-showcase:', error);
    
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
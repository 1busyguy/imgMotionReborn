import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting token reset process...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date().toISOString().split('T')[0];
    console.log('📅 Processing resets for date:', today);

    // Step 1: Get all token reset schedules due today
    const { data: schedules, error: scheduleError } = await supabase
      .from('token_reset_schedule')
      .select('*')
      .eq('is_active', true)
      .lte('next_reset_date', today);

    if (scheduleError) {
      console.error('❌ Error fetching schedules:', scheduleError);
      throw new Error(`Failed to fetch schedules: ${scheduleError.message}`);
    }

    console.log(`📊 Found ${schedules ? schedules.length : 0} schedules due today`);

    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No token resets due today',
        processed_count: 0,
        total_due: 0,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let processedCount = 0;
    const processedUsers = [];
    const errors = [];

    // Step 2: Process each schedule individually
    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];
      
      try {
        console.log(`🔄 Processing schedule ${i + 1}/${schedules.length} for user: ${schedule.user_id}`);

        // Get user email for logging
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', schedule.user_id)
          .single();

        const userEmail = profile?.email || 'unknown';
        console.log(`👤 Processing user: ${userEmail}`);

        // Step 3: Update user tokens
        const { error: tokenError } = await supabase
          .from('profiles')
          .update({
            tokens: schedule.reset_amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', schedule.user_id);

        if (tokenError) {
          console.error(`❌ Error updating tokens for ${userEmail}:`, tokenError);
          errors.push(`Failed to update tokens for ${userEmail}: ${tokenError.message}`);
          continue;
        }

        // Step 4: Calculate next reset date
        const nextResetDate = new Date();
        if (schedule.billing_cycle === 'yearly') {
          nextResetDate.setFullYear(nextResetDate.getFullYear() + 1);
        } else {
          // Default to monthly
          nextResetDate.setMonth(nextResetDate.getMonth() + 1);
        }

        const nextResetDateString = nextResetDate.toISOString().split('T')[0];

        // Step 5: Update reset schedule
        const { error: scheduleUpdateError } = await supabase
          .from('token_reset_schedule')
          .update({
            next_reset_date: nextResetDateString,
            updated_at: new Date().toISOString()
          })
          .eq('id', schedule.id);

        if (scheduleUpdateError) {
          console.error(`❌ Error updating schedule for ${userEmail}:`, scheduleUpdateError);
          errors.push(`Failed to update schedule for ${userEmail}: ${scheduleUpdateError.message}`);
          continue;
        }

        processedCount++;
        processedUsers.push({
          email: userEmail,
          user_id: schedule.user_id,
          tokens_reset_to: schedule.reset_amount,
          next_reset_date: nextResetDateString,
          billing_cycle: schedule.billing_cycle || 'monthly'
        });

        console.log(`✅ Successfully processed reset for ${userEmail}`);

      } catch (userError) {
        console.error(`❌ Error processing user ${schedule.user_id}:`, userError);
        errors.push(`Error processing user ${schedule.user_id}: ${userError.message}`);
      }
    }

    console.log(`🎉 Token reset process completed. Processed: ${processedCount}/${schedules.length}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Token reset completed successfully`,
      processed_count: processedCount,
      total_due: schedules.length,
      processed_users: processedUsers,
      errors: errors,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Critical error in token reset:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      message: "Token anniversary reset process failed"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
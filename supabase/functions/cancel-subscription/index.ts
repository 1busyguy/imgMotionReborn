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

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    console.log('🚫 Processing subscription cancellation for user:', user.id);

    // Get user's active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      throw new Error('No active subscription found');
    }

    console.log('📋 Found active subscription:', subscription.stripe_subscription_id);

    // Cancel subscription in Stripe
    const stripeApiKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeApiKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    console.log('🔄 Canceling subscription in Stripe...');
    
    let stripeAlreadyCanceled = false;
    
    try {
      const stripeResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscription.stripe_subscription_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${stripeApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!stripeResponse.ok) {
        const errorText = await stripeResponse.text();
        console.error('❌ Stripe cancellation error:', stripeResponse.status, errorText);
        
        // Check if subscription was already canceled (404 error)
        if (stripeResponse.status === 404) {
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { error: { message: errorText } };
          }
          
          if (errorData.error?.code === 'resource_missing' || 
              errorData.error?.message?.includes('No such subscription')) {
            console.log('⚠️ Subscription was already canceled in Stripe, continuing with database cleanup...');
            stripeAlreadyCanceled = true;
          } else {
            throw new Error(`Failed to cancel subscription in Stripe: ${stripeResponse.status} - ${errorText}`);
          }
        } else {
          throw new Error(`Failed to cancel subscription in Stripe: ${stripeResponse.status} - ${errorText}`);
        }
      } else {
        const canceledSubscription = await stripeResponse.json();
        console.log('✅ Subscription canceled in Stripe');
      }
    } catch (stripeError) {
      // If it's a network error or other issue, still try to clean up database
      console.error('❌ Error communicating with Stripe:', stripeError.message);
      
      // Check if it's the "already canceled" case
      if (stripeError.message.includes('404') || stripeError.message.includes('resource_missing')) {
        console.log('⚠️ Treating as already canceled, continuing with database cleanup...');
        stripeAlreadyCanceled = true;
      } else {
        throw stripeError;
      }
    }

    // Update subscription status in database
    const { error: updateSubError } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    if (updateSubError) {
      console.error('❌ Error updating subscription status:', updateSubError);
      throw updateSubError;
    }

    // Update user profile - move to free plan but keep purchased tokens
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('purchased_tokens')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      throw profileError;
    }

    // Keep subscription tokens until billing period ends, just update status
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'free',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateProfileError) {
      console.error('❌ Error updating profile:', updateProfileError);
      throw updateProfileError;
    }

    // Cancel token reset schedule
    const { error: cancelResetError } = await supabase
      .from('token_reset_schedule')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (cancelResetError) {
      console.error('❌ Error canceling token reset schedule:', cancelResetError);
      // Don't throw - this is not critical
    }

    console.log('✅ Subscription cancellation completed successfully');
    
    const accessUntilDate = subscription.current_period_end 
      ? new Date(subscription.current_period_end).toLocaleDateString()
      : 'end of current billing period';
    
    console.log(`📊 User moved to free plan, subscription tokens will remain until ${accessUntilDate}`);
    console.log(`📊 Kept ${profile.purchased_tokens || 0} purchased tokens`);

    // Determine the appropriate success message
    const successMessage = stripeAlreadyCanceled 
      ? 'Subscription was already canceled in Stripe. Your account has been updated to reflect this change.'
      : 'Subscription canceled successfully! You will keep access until your current billing period ends.';
    return new Response(
      JSON.stringify({
        success: true,
        message: successMessage,
        already_canceled_in_stripe: stripeAlreadyCanceled,
        details: {
          subscription_id: subscription.stripe_subscription_id,
          canceled_at: new Date().toISOString(),
          access_until: subscription.current_period_end,
          purchased_tokens_retained: profile.purchased_tokens || 0,
          new_status: 'free',
          note: stripeAlreadyCanceled ? 'Subscription was already canceled in Stripe' : null
        }
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    
    // Provide user-friendly error messages
    let userMessage = error.message;
    
    if (error.message.includes('No active subscription found')) {
      userMessage = 'You don\'t have any active subscription to cancel. Your account is already on the free plan.';
    } else if (error.message.includes('404') || error.message.includes('resource_missing')) {
      userMessage = 'This subscription was already canceled. Your account has been updated to reflect the current status.';
    } else if (error.message.includes('Failed to cancel subscription in Stripe')) {
      userMessage = 'There was an issue communicating with our payment processor. Please contact support if this persists.';
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: userMessage,
        technical_error: error.message // Keep technical details for debugging
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
        status: 500 
      }
    );
  }
});
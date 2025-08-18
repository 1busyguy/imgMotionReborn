import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.1.1?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Initialize Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
});

// Main handler - NO AUTH CHECK
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    // Initialize Supabase client with service role key (for admin access)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get raw body and signature
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    
    console.log('📄 Webhook received');
    console.log('🔐 Signature exists:', !!signature);

    if (!signature) {
      console.error('❌ No Stripe signature header');
      return new Response('No signature', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Get webhook secret
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
      return new Response('Webhook secret not configured', { 
        status: 500,
        headers: corsHeaders 
      });
    }

    // Verify signature using Stripe SDK
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log('✅ Event verified and parsed');
      console.log('📋 Event type:', event.type);
      console.log('📋 Event ID:', event.id);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return new Response('Invalid signature', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    console.log('🔄 Processing event type:', event.type);

    // Process the event
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('💳 Processing checkout.session.completed');
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        console.log('📋 Processing subscription change');
        await handleSubscriptionChange(event.data.object as Stripe.Subscription, supabase);
        break;
      case 'customer.subscription.deleted':
        console.log('🗑️ Processing subscription deletion');
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabase);
        break;
      case 'invoice.payment_succeeded':
        console.log('💰 Processing payment succeeded');
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice, supabase);
        break;
      default:
        console.log('⚠️ Unhandled event type:', event.type);
    }
    
    console.log('✅ Webhook processed successfully');
    
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Return 200 to prevent Stripe from retrying
    // Log the error but acknowledge receipt
    return new Response(
      JSON.stringify({ 
        received: true,
        error: error.message 
      }), 
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function handleCheckoutCompleted(session: any, supabase: any) {
  console.log('🛒 ===== PROCESSING CHECKOUT SESSION COMPLETED =====');
  console.log('Session ID:', session.id);
  console.log('Customer:', session.customer);
  console.log('Mode:', session.mode);
  console.log('Payment status:', session.payment_status);
  console.log('Amount total:', session.amount_total);
  console.log('Currency:', session.currency);

  // Find user by customer ID or email
  let profile = null;
  
  if (session.customer) {
    console.log('🔍 Looking up profile by stripe_customer_id:', session.customer);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, purchased_tokens')
      .eq('stripe_customer_id', session.customer)
      .single();
    
    if (data) {
      profile = data;
      console.log('✅ Found profile by customer ID');
    }
  }
  
  // If not found by customer ID, try email
  if (!profile && session.customer_details?.email) {
    console.log('🔍 Looking up profile by email:', session.customer_details.email);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, purchased_tokens')
      .eq('email', session.customer_details.email)
      .single();
    
    if (data) {
      profile = data;
      console.log('✅ Found profile by email');
      
      // Update the stripe_customer_id if we have one
      if (session.customer) {
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: session.customer })
          .eq('id', profile.id);
        console.log('✅ Updated profile with customer ID');
      }
    }
  }
  
  if (!profile) {
    console.error('❌ Could not find profile for checkout session');
    // Create error log for manual investigation
    await supabase
      .from('webhook_errors')
      .insert({
        event_type: 'checkout.session.completed',
        error: 'Profile not found',
        session_id: session.id,
        customer_id: session.customer,
        customer_email: session.customer_details?.email,
        created_at: new Date().toISOString()
      });
    return;
  }

  console.log('✅ Processing for profile:', profile.id, profile.email);
  
  // Only process one-time payments (token purchases)
  if (session.mode === 'payment') {
    console.log('💰 ===== PROCESSING TOKEN PURCHASE =====');
    
    // Map amount to tokens
    const amountToTokensMap: { [key: number]: number } = {
      500: 400,      // $5.00 = 400 tokens
      1000: 800,     // $10.00 = 800 tokens
      2000: 2000,    // $20.00 = 2000 tokens
      5000: 5500,    // $50.00 = 5500 tokens
      10000: 11000,  // $100.00 = 11000 tokens
      25000: 27000   // $250.00 = 27000 tokens
    };
    
    const tokensToAdd = amountToTokensMap[session.amount_total];
    console.log('💰 Amount paid:', session.amount_total, 'cents');
    console.log('🎯 Tokens to add:', tokensToAdd);
    
    if (tokensToAdd) {
      const currentTokens = profile.purchased_tokens || 0;
      const newTokens = currentTokens + tokensToAdd;
      
      console.log('📊 Current purchased tokens:', currentTokens);
      console.log('📈 New purchased tokens total:', newTokens);
      
      // Update user's purchased token count
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          purchased_tokens: newTokens,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);
      
      if (updateError) {
        console.error('❌ Error updating tokens:', updateError);
        throw updateError;
      }
      
      // Log the transaction
      await supabase
        .from('token_transactions')
        .insert({
          user_id: profile.id,
          amount: tokensToAdd,
          type: 'purchase',
          stripe_session_id: session.id,
          created_at: new Date().toISOString()
        });
      
      console.log(`🎉 SUCCESS! Added ${tokensToAdd} tokens to user ${profile.email}`);
      console.log(`🎉 New total purchased tokens: ${newTokens}`);
    } else {
      console.error('❌ Unknown amount for token package:', session.amount_total);
      console.error('📋 Available amounts:', Object.keys(amountToTokensMap));
    }
  } else {
    console.log('📋 Subscription checkout, tokens handled by subscription webhook');
  }
}

async function handleSubscriptionChange(subscription: any, supabase: any) {
  console.log('📝 Processing subscription change:', subscription.id);
  
  // Find user by customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single();

  if (!profile) {
    console.error('❌ No profile found for customer:', subscription.customer);
    return;
  }

  // Determine token amount and plan
  const priceId = subscription.items.data[0].price.id;
  const tokenMap: { [key: string]: number } = {
    'price_1RlO7gHKxMyAU8jaNzAksz4f': 3000, // Pro monthly
    'price_1RlO9JHKxMyAU8jaZ2PXyluX': 6000, // Business monthly
    'price_1RlO7gHKxMyAU8jaJe4Rt2Lp': 3000, // Pro yearly
    'price_1RlOC6HKxMyAU8jaVKZdw7TA': 6000, // Business yearly
  };
  
  const planMap: { [key: string]: string } = {
    'price_1RlO7gHKxMyAU8jaNzAksz4f': 'pro',
    'price_1RlO9JHKxMyAU8jaZ2PXyluX': 'business', 
    'price_1RlO7gHKxMyAU8jaJe4Rt2Lp': 'pro',
    'price_1RlOC6HKxMyAU8jaVKZdw7TA': 'business'
  };
  
  const tokenAmount = tokenMap[priceId] || 0;
  const planName = planMap[priceId] || 'free';

  // Update subscription record
  await supabase
    .from('subscriptions')
    .upsert({
      user_id: profile.id,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      price_id: priceId,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'stripe_subscription_id'
    });

  // Update profile
  await supabase
    .from('profiles')
    .update({
      subscription_status: subscription.status === 'active' ? planName : subscription.status,
      tokens: tokenAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  console.log(`✅ Subscription updated for user ${profile.id}`);
}

async function handleSubscriptionDeleted(subscription: any, supabase: any) {
  console.log('🗑️ Processing subscription deletion:', subscription.id);
  
  // Find user by customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single();

  if (!profile) return;

  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  await supabase
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      tokens: 0, // Remove subscription tokens
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  console.log(`✅ Subscription canceled for user ${profile.id}`);
}

async function handlePaymentSucceeded(invoice: any, supabase: any) {
  console.log('💳 Processing payment succeeded:', invoice.id);
  // This is mainly for subscription renewals
  // Token purchases are handled in checkout.session.completed
}
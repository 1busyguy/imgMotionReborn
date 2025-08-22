import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&no-check';

const stripe = Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '');

const cryptoProvider = Stripe.createSubtleCryptoProvider();

console.log("Stripe webhook handler loaded");

Deno.serve(async (request) => {
  console.log('🎯 Webhook received!');
  console.log('Headers:', Object.fromEntries(request.headers.entries()));
  
  const signature = request.headers.get('Stripe-Signature');
  const body = await request.text();
  
  console.log('Body length:', body.length);
  console.log('Signature exists:', !!signature);
  
  let receivedEvent;
  try {
    receivedEvent = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
      undefined,
      cryptoProvider
    );
    console.log('✅ Webhook signature verified');
  } catch (err) {
    console.error(`❌ Webhook signature verification failed:`, err.message);
    return new Response(err.message, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  console.log(`🔔 Processing webhook event: ${receivedEvent.type}`);
  console.log('Event data keys:', Object.keys(receivedEvent.data.object));

  try {
    switch (receivedEvent.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(receivedEvent.data.object, supabase);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(receivedEvent.data.object, supabase);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(receivedEvent.data.object, supabase);
        break;
      case 'checkout.session.completed':
        await handleCheckoutCompleted(receivedEvent.data.object, supabase);
        break;
      default:
        console.log(`Unhandled event type: ${receivedEvent.type}`);
    }
    
    console.log('✅ Webhook processed successfully');
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    console.error('Error stack:', error.stack);
    return new Response('Webhook processing failed', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});

async function handleSubscriptionChange(subscription: any, supabase: any) {
  console.log('📝 Processing subscription change:', subscription.id);
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single();

  if (!profile) {
    console.error('❌ No profile found for customer:', subscription.customer);
    return;
  }

  console.log('👤 Found profile:', profile.id);
  
  // Determine token amount based on price ID
  const priceId = subscription.items.data[0].price.id;
  console.log('💰 Price ID:', priceId);
  
  const tokenMap = {
    'price_1RlO7gHKxMyAU8jaNzAksz4f': 3000, // Pro monthly
    'price_1RlO9JHKxMyAU8jaZ2PXyluX': 6000, // Business monthly
    'price_1RlO7gHKxMyAU8jaJe4Rt2Lp': 3000, // Pro yearly
    'price_1RlOC6HKxMyAU8jaVKZdw7TA': 6000, // Business yearly
  };
  
  const tokenAmount = tokenMap[priceId] || 0;
  console.log('🎯 Token amount:', tokenAmount);
  
  // Determine plan name based on price ID
  const planMap = {
    'price_1RlO7gHKxMyAU8jaNzAksz4f': 'pro',
    'price_1RlO9JHKxMyAU8jaZ2PXyluX': 'business', 
    'price_1RlO7gHKxMyAU8jaJe4Rt2Lp': 'pro',
    'price_1RlOC6HKxMyAU8jaVKZdw7TA': 'business'
  };
  
  const planName = planMap[priceId] || 'free';
  console.log('📋 Plan name:', planName);

  // Update or create subscription record
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: profile.id,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      price_id: subscription.items.data[0].price.id,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      updated_at: new Date(),
    }, {
      onConflict: 'stripe_subscription_id'
    });

  if (error) {
    console.error('❌ Error updating subscription:', error);
    return;
  }

  console.log('✅ Subscription record updated');
  
  // Get the subscription record to get the ID
  const { data: subscriptionRecord } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  // Update profile subscription status
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      subscription_status: subscription.status === 'active' ? planName : subscription.status,
      tokens: tokenAmount, // Give immediate tokens on subscription
      updated_at: new Date(),
    })
    .eq('id', profile.id);

  if (profileError) {
    console.error('❌ Error updating profile:', profileError);
    return;
  }
  
  console.log('✅ Profile updated with tokens:', tokenAmount);
  
  // Schedule token reset on subscription anniversary
  if (subscription.status === 'active' && tokenAmount > 0) {
    const { error: scheduleError } = await supabase.rpc('schedule_token_reset', {
      target_user_id: profile.id,
      subscription_start_date: new Date(subscription.current_period_start * 1000).toISOString(),
      token_amount: tokenAmount,
      target_subscription_id: subscriptionRecord?.id || null
    });

    if (scheduleError) {
      console.error('❌ Error scheduling token reset:', scheduleError);
    } else {
      console.log(`✅ Token reset scheduled for user ${profile.id} with ${tokenAmount} tokens`);
    }
  }
}

async function handleSubscriptionDeleted(subscription: any, supabase: any) {
  console.log('🗑️ Processing subscription deletion:', subscription.id);
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single();

  if (!profile) return;

  // Update subscription status
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date(),
    })
    .eq('stripe_subscription_id', subscription.id);

  // Update profile
  await supabase
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      updated_at: new Date(),
    })
    .eq('id', profile.id);

  // Cancel token reset schedule
  await supabase.rpc('cancel_token_reset_schedule', {
    target_user_id: profile.id
  });
}

async function handlePaymentSucceeded(invoice: any, supabase: any) {
  console.log('💳 Processing payment succeeded:', invoice.id);
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', invoice.customer)
    .single();

  if (!profile) return;

  // For recurring payments, the token reset is handled by the anniversary system
  // This function now mainly handles one-time payments or special cases
  const priceId = invoice.lines.data[0].price.id;
  const tokenMap = {
    'price_pro_monthly': 3000,
    'price_business_monthly': 6000,
    'price_pro_yearly': 3000,
    'price_business_yearly': 6000,
  };

  const tokenAmount = tokenMap[priceId] || 0;

  // Only add tokens for one-time purchases or if this is the first payment
  if (tokenAmount > 0 && invoice.billing_reason === 'subscription_create') {
    console.log(`Initial subscription payment processed for user ${profile.id}`);
    // Tokens are already handled in handleSubscriptionChange
  }
}

async function handleCheckoutCompleted(session: any, supabase: any) {
  console.log('🛒 Processing checkout.session.completed event');
  console.log('Session ID:', session.id);
  console.log('Customer:', session.customer);
  console.log('Mode:', session.mode);
  console.log('Payment status:', session.payment_status);
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', session.customer)
    .single();

  if (!profile) {
    console.error('❌ No profile found for customer:', session.customer);
    return;
  }

  console.log('👤 Found profile for checkout:', profile.id);
  
  // Check if this is a token purchase (one-time payment)
  if (session.mode === 'payment') {
    console.log('💰 Processing one-time token purchase');
    
    // Get line items from the session
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    console.log('📦 Line items count:', lineItems.data?.length);
    
    const priceId = lineItems.data?.[0]?.price?.id;
    console.log('💳 Extracted price ID:', priceId);
    
    if (!priceId) {
      console.error('❌ No price ID found in checkout session');
      return;
    }
    
    // Token package mapping
    const tokenPackageMap = {
      'price_1RnBQ4HKxMyAU8jafOYi9HQv': 400,   // $5.00 - 400 tokens
      'price_1RnBSHHKxMyAU8jaHsytrl5X': 800,   // $10.00 - 820 tokens  
      'price_1RnBV0HKxMyAU8jarmUjHGkj': 2000,  // $20.00 - 2000 tokens
      'price_1RnBWkHKxMyAU8jaYzz3EOcu': 5500,  // $50.00 - 5500 tokens
      'price_1RnBYFHKxMyAU8javbQklHwA': 11000,  // $100.00 - 11000 tokens
      'price_1RnBZcHKxMyAU8jaXZDOyevi': 27000, // $250.00 - 27000 tokens
    };
    
    console.log('🗺️ Available price mappings:', Object.keys(tokenPackageMap));
    
    const tokensToAdd = tokenPackageMap[priceId];
    console.log('🎯 Tokens to add:', tokensToAdd);
    
    if (tokensToAdd) {
      // Get current token count
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('purchased_tokens')
        .eq('id', profile.id)
        .single();
      
      console.log('📊 Current purchased tokens:', currentProfile?.purchased_tokens || 0);
      
      const newPurchasedTokens = (currentProfile?.purchased_tokens || 0) + tokensToAdd;
      console.log('📈 New purchased tokens total:', newPurchasedTokens);
      
      // Update user's purchased token count
      const { error } = await supabase
        .from('profiles')
        .update({
          purchased_tokens: newPurchasedTokens,
          updated_at: new Date(),
        })
        .eq('id', profile.id);
      
      if (error) {
        console.error('❌ Error updating token count:', error);
        throw error;
      } else {
        console.log(`✅ Added ${tokensToAdd} purchased tokens to user ${profile.id}. New total: ${newPurchasedTokens}`);
      }
    } else {
      console.error('❌ Unknown token package price ID:', priceId);
      console.error('📋 Available price IDs:', Object.keys(tokenPackageMap));
      throw new Error(`Unknown price ID: ${priceId}`);
    }
  } else {
    console.log('📋 Checkout session is subscription mode, skipping token addition');
  }
}
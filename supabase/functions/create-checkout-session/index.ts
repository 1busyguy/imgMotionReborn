import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&no-check';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
console.log('Stripe secret key exists:', !!stripeSecretKey);
console.log('Stripe secret key prefix:', stripeSecretKey?.substring(0, 7));

const stripe = Stripe(stripeSecretKey || '');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Create checkout session request received');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody = await req.text();
    console.log('Raw request body:', requestBody);
    
    const { priceId } = JSON.parse(requestBody);
    console.log('Price ID:', priceId);
    
    if (!priceId) {
      throw new Error('Price ID is required');
    }
    
    const authHeader = req.headers.get('Authorization')!;
    console.log('Auth header exists:', !!authHeader);
    
    const token = authHeader.replace('Bearer ', '');
    console.log('Token length:', token?.length);
    
    const { data: { user } } = await supabase.auth.getUser(token);
    console.log('User found:', !!user);
    console.log('User ID:', user?.id);
    
    if (!user) {
      throw new Error('No user found');
    }

    // Get or create customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    console.log('Profile:', profile);
    console.log('Existing customer ID:', profile?.stripe_customer_id);

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      console.log('Creating new Stripe customer');
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.user_metadata?.full_name || user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      customerId = customer.id;
      console.log('Created customer:', customerId);
      console.log('Customer email:', customer.email);

      // Update profile with customer ID
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    } else {
      console.log('Using existing customer:', customerId);
    }

    // Create checkout session
    console.log('Creating Stripe checkout session');
    console.log('Customer ID:', customerId);
    console.log('Price ID:', priceId);
    console.log('Success URL:', `${req.headers.get('origin')}/dashboard?session_id={CHECKOUT_SESSION_ID}`);
    console.log('Cancel URL:', `${req.headers.get('origin')}/dashboard`);
    
    // Determine if this is a subscription or one-time payment based on price ID
    // Token packages use one-time payment, subscriptions use recurring
    const subscriptionPriceIds = [
      'price_1RlO7gHKxMyAU8jaNzAksz4f', // Pro monthly
      'price_1RlO9JHKxMyAU8jaZ2PXyluX', // Business monthly
      'price_1RlO7gHKxMyAU8jaJe4Rt2Lp', // Pro yearly
      'price_1RlOC6HKxMyAU8jaVKZdw7TA'  // Business yearly
    ];
    
    const isSubscription = subscriptionPriceIds.includes(priceId);
    const mode = isSubscription ? 'subscription' : 'payment';
    
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: mode,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: `${req.headers.get('origin')}/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/settings?tab=billing`,
    });

    console.log('Checkout session created:', session.id);

    return new Response(
      JSON.stringify({ sessionId: session.id }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    return new Response(
      JSON.stringify({ error: error.message }),
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
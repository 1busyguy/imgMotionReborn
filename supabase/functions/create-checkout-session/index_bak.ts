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

    const { priceId } = await req.json();
    
    if (!priceId) {
      throw new Error('Price ID is required');
    }

    console.log('Creating checkout session for user:', user.id);
    console.log('Price ID:', priceId);

    // Get or create customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single();

    console.log('Profile found:', !!profile);
    console.log('Existing customer ID:', profile?.stripe_customer_id);

    let customerId = profile?.stripe_customer_id;

    // If no customer ID, we'll create one in Stripe
    if (!customerId) {
      console.log('No existing customer, will create new one');
      
      // We'll let Stripe create the customer during checkout
      // This avoids the Deno compatibility issues
    }

    // Create checkout session using Stripe API directly
    const stripeApiKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeApiKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    // Determine mode based on price ID
    const subscriptionPriceIds = [
      'price_1RlO7gHKxMyAU8jaNzAksz4f', // Pro monthly
      'price_1RlO9JHKxMyAU8jaZ2PXyluX', // Business monthly
      'price_1RlO7gHKxMyAU8jaJe4Rt2Lp', // Pro yearly
      'price_1RlOC6HKxMyAU8jaVKZdw7TA'  // Business yearly
    ];
    
    const mode = subscriptionPriceIds.includes(priceId) ? 'subscription' : 'payment';
    console.log('Checkout mode:', mode);

    // Create checkout session using fetch (avoids Deno Stripe library issues)
    const checkoutData = {
      mode: mode,
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      success_url: `${req.headers.get('origin')}/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/settings?tab=billing`,
      allow_promotion_codes: true,
    };

    // Add customer info
    if (customerId) {
      checkoutData.customer = customerId;
    } else {
      checkoutData.customer_email = user.email;
    }

    console.log('Creating checkout session with data:', JSON.stringify(checkoutData, null, 2));

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': checkoutData.mode,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': checkoutData.success_url,
        'cancel_url': checkoutData.cancel_url,
        'allow_promotion_codes': 'true',
        ...(customerId ? { 'customer': customerId } : { 'customer_email': user.email })
      }),
    });

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      console.error('Stripe API error:', stripeResponse.status, errorText);
      throw new Error(`Stripe API error: ${stripeResponse.status} - ${errorText}`);
    }

    const session = await stripeResponse.json();
    console.log('Checkout session created:', session.id);

    // Update profile with customer ID if it was created
    if (!customerId && session.customer) {
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: session.customer })
        .eq('id', user.id);
      console.log('Updated profile with new customer ID:', session.customer);
    }

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
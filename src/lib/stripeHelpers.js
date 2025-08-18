import { supabase } from './supabaseClient';
import { tokenPackages } from '../data/data';
import stripePromise from './stripe';

export const createCheckoutSession = async (priceId) => {
  try {
    console.log('Creating checkout session with price ID:', priceId);
    console.log('Environment check:');
    console.log('- Supabase URL:', import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) + '...');
    console.log('- Stripe key exists:', !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
    
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Session exists:', !!session);
    console.log('Access token exists:', !!session?.access_token);
    
    if (!session) {
      throw new Error('No authenticated session');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    console.log('Making request to:', `${supabaseUrl}/functions/v1/create-checkout-session`);
    console.log('Request payload:', { priceId });
    
    const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ priceId }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Raw response:', responseText);
    
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }
      console.error('Server error:', errorData);
      throw new Error(errorData.error || 'Failed to create checkout session');
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse success response:', parseError);
      throw new Error('Invalid response format');
    }
    
    const { sessionId } = responseData;
    console.log('Received session ID:', sessionId);
    
    if (!sessionId) {
      throw new Error('No session ID returned from server');
    }
    
    const stripe = await stripePromise;
    if (!stripe) {
      throw new Error('Stripe failed to load');
    }
    
    console.log('Redirecting to Stripe checkout...');
    const { error } = await stripe.redirectToCheckout({ sessionId });

    if (error) {
      throw new Error(`Stripe redirect error: ${error.message}`);
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

export const getSubscriptionStatus = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching subscription:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return null;
  }
};

export const updateTokenCount = async (userId, tokensUsed) => {
  try {
    // Use the new smart deduction function that handles subscription + purchased tokens
    const { data, error } = await supabase.rpc('deduct_user_tokens', {
      target_user_id: userId,
      tokens_to_deduct: tokensUsed
    });

    if (error) throw error;

    // Return the new total token count
    return data.new_total_tokens;
  } catch (error) {
    console.error('Error updating token count:', error);
    throw error;
  }
};
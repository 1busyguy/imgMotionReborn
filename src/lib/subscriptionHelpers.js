import { supabase } from './supabaseClient';

/**
 * Cancel user's subscription
 * @returns {Promise<Object>} Result of cancellation
 */
export const cancelSubscription = async () => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to cancel subscription');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

/**
 * Get subscription details for display
 * @param {Object} subscription - Subscription object from database
 * @returns {Object} Formatted subscription details
 */
export const getSubscriptionDetails = (subscription) => {
  if (!subscription) return null;

  const planNames = {
    'price_1RlO7gHKxMyAU8jaNzAksz4f': 'Pro Monthly',
    'price_1RlO9JHKxMyAU8jaZ2PXyluX': 'Business Monthly',
    'price_1RlO7gHKxMyAU8jaJe4Rt2Lp': 'Pro Yearly',
    'price_1RlOC6HKxMyAU8jaVKZdw7TA': 'Business Yearly'
  };

  const tokenAmounts = {
    'price_1RlO7gHKxMyAU8jaNzAksz4f': 3000,
    'price_1RlO9JHKxMyAU8jaZ2PXyluX': 6000,
    'price_1RlO7gHKxMyAU8jaJe4Rt2Lp': 3000,
    'price_1RlOC6HKxMyAU8jaVKZdw7TA': 6000
  };

  const isYearly = subscription.price_id?.includes('yearly') || 
                   subscription.price_id === 'price_1RlO7gHKxMyAU8jaJe4Rt2Lp' || 
                   subscription.price_id === 'price_1RlOC6HKxMyAU8jaVKZdw7TA';

  return {
    planName: planNames[subscription.price_id] || 'Unknown Plan',
    tokenAmount: tokenAmounts[subscription.price_id] || 0,
    isYearly,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end,
    status: subscription.status
  };
};
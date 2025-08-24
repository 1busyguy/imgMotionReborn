import { toCdnUrl } from '../utils/cdnHelpers';

export const tools = [
];

export const subscriptionTiers = [
  {
    id: 'free',
    name: 'Free Trial',
    price: 0,
    tokens: 200,
    features: [
      'Access to basic tools',
      '200 tokens to start',
      'Community support',
      'Saftey Features ON'
    ],
    popular: false,
    stripeProductId: null
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 25.99,
    tokens: 3000,
    features: [
      'Access to Better Tools',
      '3000 tokens monthly',
      'Saftey Features Optional',
      'Faster processing',
       'Commercial usage'
    ],
    popular: true,
    stripePriceId: 'price_1RlO7gHKxMyAU8jaNzAksz4f', // Replace with your actual Pro monthly price ID
    yearlyPriceId: 'price_1RlO7gHKxMyAU8jaJe4Rt2Lp' // Replace with your actual Pro yearly price ID
  },
  {
    id: 'business',
    name: 'Business',
    price: 49.99,
    tokens: 6000,
    features: [
      'Everything in Pro',
      '6000 tokens monthly',
      'Dedicated support',
      'Early Access New Models',
      'Developer Expo Access'
    ],
    popular: false,
    stripePriceId: 'price_1RlO9JHKxMyAU8jaZ2PXyluX', // Replace with your actual Business monthly price ID
    yearlyPriceId: 'price_1RlOC6HKxMyAU8jaVKZdw7TA' // Replace with your actual Business yearly price ID
  }
];

// Token purchase packages (one-time purchases)
export const tokenPackages = [
  {
    id: 'tokens_310',
    name: 'Starter Pack',
    tokens: 400,
    price: 5,
    stripePriceId: 'price_1RnBQ4HKxMyAU8jafOYi9HQv', // Replace with your actual 310 token price ID
    popular: false,
    description: 'Perfect for getting started'
  },
  {
    id: 'tokens_620',
    name: 'Creator Pack',
    tokens: 800,
    price: 10,
    stripePriceId: 'price_1RnBSHHKxMyAU8jaHsytrl5X', // Replace with your actual 620 token price ID
    popular: false,
    description: 'Great for regular content creation'
  },
  {
    id: 'tokens_1240',
    name: 'Pro Pack',
    tokens: 2000,
    price: 20,
    stripePriceId: 'price_1RnBV0HKxMyAU8jarmUjHGkj', // Replace with your actual 1240 token price ID
    popular: true,
    description: 'Most popular token package'
  },
  {
    id: 'tokens_3500',
    name: 'Power Pack',
    tokens: 5500,
    price: 50,
    stripePriceId: 'price_1RnBWkHKxMyAU8jaYzz3EOcu', // Replace with your actual 3500 token price ID
    popular: false,
    description: 'For heavy content creators'
  },
  {
    id: 'tokens_6600',
    name: 'Studio Pack',
    tokens: 11000,
    price: 100,
    stripePriceId: 'price_1RnBYFHKxMyAU8javbQklHwA', // Replace with your actual 6600 token price ID
    popular: false,
    description: 'Professional studio package'
  },
  {
    id: 'tokens_16000',
    name: 'Enterprise Pack',
    tokens: 27000,
    price: 250,
    stripePriceId: 'price_1RnBZcHKxMyAU8jaXZDOyevi', // Replace with your actual 16000 token price ID
    popular: false,
    description: 'Maximum value for enterprises'
  }
];

// Import FAL tools
import { falTools } from './falTools.js';

// Combine original tools with FAL tools - ensure all tools are included
export const allTools = [...tools, ...falTools];

export const userGallery = [
 {
    id: 1,
    username: "CreativeArtist",
    creation: toCdnUrl("https://images.pexels.com/photos/2693212/pexels-photo-2693212.png?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
    tool: "Flux Img Generator",
    type: "image"
  },
  {
    id: 2,
    username: "MotionMaster",
    creation: toCdnUrl("https://images.pexels.com/photos/7991473/pexels-photo-7991473.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
    tool: "Kling Img2Vid Generator",
    type: "video"
  },
  {
    id: 3,
    username: "VideoWizard",
    creation: toCdnUrl("https://images.pexels.com/photos/4088015/pexels-photo-4088015.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
    tool: "AI Auto Video Caption",
    type: "video"
  },
  {
    id: 4,
    username: "DesignGuru",
    creation: toCdnUrl("https://images.pexels.com/photos/7552674/pexels-photo-7552674.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
    tool: "AI Video Extender",
    type: "video"
  },
  {
    id: 5,
    username: "AIEnthusiast",
    creation: toCdnUrl("https://images.pexels.com/photos/699122/pexels-photo-699122.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
    tool: "Auto 9:16 Img Improver Tool",
    type: "image"
  },
  {
    id: 6,
    username: "TechCreator",
    creation: toCdnUrl("https://images.pexels.com/photos/1998479/pexels-photo-1998479.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
    tool: "AI Scene Maker",
    type: "image"
  }
];
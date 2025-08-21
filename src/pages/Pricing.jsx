import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Zap, 
  Check, 
  X, 
  Star, 
  Shield, 
  Headphones, 
  Crown,
  Users,
  Sparkles,
  Clock,
  Download,
  Palette,
  Video,
  Image as ImageIcon,
  Music,
  Scissors,
  TrendingUp,
  Globe
} from 'lucide-react';

const Pricing = () => {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const pricingTiers = [
    {
      id: 'free',
      name: 'Free Trial',
      price: { monthly: 0, yearly: 0 },
      tokens: 200,
      popular: false,
      description: 'Perfect for trying out our AI tools',
      color: 'from-gray-500 to-gray-600',
      features: {
        tokens: '200 tokens monthly',
        tools: 'Access to basic tools',
        quality: 'Standard quality outputs',
        watermark: 'imgMotion watermark included',
        support: 'Community support',
        commercial: 'Personal use only',
        priority: 'Standard processing',
        storage: '1GB cloud storage',
        exports: 'Standard export formats',
        analytics: 'Basic usage analytics'
      },
      toolAccess: [
        { name: 'FLUX Kontext', available: true },
        { name: 'Minimax Hailuo', available: true },
        { name: 'WAN Pro Video', available: false },
        { name: 'Kling Pro Video', available: false },
        { name: 'VEO2 Video', available: false },
        { name: 'AI Scene Maker', available: false },
        { name: 'Background Remover', available: true },
        { name: 'Video Upscaler', available: false }
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      price: { monthly: 25.99, yearly: 20.79 },
      tokens: 3000,
      popular: true,
      description: 'For serious content creators',
      color: 'from-purple-500 to-pink-500',
      features: {
        tokens: '3,000 tokens monthly',
        tools: 'Access to premium tools',
        quality: 'High quality outputs',
        watermark: 'No watermark (clean outputs)',
        support: 'Priority email support',
        commercial: 'Full commercial usage rights',
        priority: 'Faster processing queue',
        storage: '10GB cloud storage',
        exports: 'HD export formats',
        analytics: 'Advanced usage analytics'
      },
      toolAccess: [
        { name: 'FLUX Kontext', available: true },
        { name: 'Minimax Hailuo', available: true },
        { name: 'WAN Pro Video', available: true },
        { name: 'Kling Pro Video', available: true },
        { name: 'VEO2 Video', available: true },
        { name: 'AI Scene Maker', available: true },
        { name: 'Background Remover', available: true },
        { name: 'Video Upscaler', available: true }
      ]
    },
    {
      id: 'business',
      name: 'Business',
      price: { monthly: 49.99, yearly: 39.99 },
      tokens: 6000,
      popular: false,
      description: 'For teams and agencies',
      color: 'from-indigo-500 to-purple-500',
      features: {
        tokens: '6,000 tokens monthly',
        tools: 'Access to all premium tools',
        quality: 'Ultra-high quality outputs',
        watermark: 'No watermark + custom branding',
        support: 'Dedicated support manager',
        commercial: 'Extended commercial license',
        priority: 'Highest priority processing',
        storage: '50GB cloud storage',
        exports: '4K export formats',
        analytics: 'Team analytics dashboard'
      },
      toolAccess: [
        { name: 'FLUX Kontext', available: true },
        { name: 'Minimax Hailuo', available: true },
        { name: 'WAN Pro Video', available: true },
        { name: 'Kling Pro Video', available: true },
        { name: 'VEO2 Video', available: true },
        { name: 'AI Scene Maker', available: true },
        { name: 'Background Remover', available: true },
        { name: 'Video Upscaler', available: true }
      ]
    }
  ];

  const featureCategories = [
    {
      name: 'Tokens & Usage',
      icon: <Zap className="w-5 h-5" />,
      features: [
        { key: 'tokens', label: 'Monthly Tokens' },
        { key: 'priority', label: 'Processing Priority' }
      ]
    },
    {
      name: 'Tools & Quality',
      icon: <Sparkles className="w-5 h-5" />,
      features: [
        { key: 'tools', label: 'Tool Access' },
        { key: 'quality', label: 'Output Quality' },
        { key: 'watermark', label: 'Watermark Policy' }
      ]
    },
    {
      name: 'Support & Usage Rights',
      icon: <Shield className="w-5 h-5" />,
      features: [
        { key: 'support', label: 'Customer Support' },
        { key: 'commercial', label: 'Commercial Rights' }
      ]
    },
    {
      name: 'Storage & Analytics',
      icon: <Download className="w-5 h-5" />,
      features: [
        { key: 'storage', label: 'Cloud Storage' },
        { key: 'exports', label: 'Export Quality' },
        { key: 'analytics', label: 'Analytics' }
      ]
    }
  ];

  const handleSubscribe = (tier) => {
    if (tier.id === 'free') {
      window.location.href = '/signup';
    } else {
      window.location.href = '/signup';
    }
  };

  const getDiscountPercentage = () => {
    return Math.round(((25.99 - 20.79) / 25.99) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="flex items-center space-x-2 text-purple-200 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Home</span>
              </Link>
              <div className="h-6 w-px bg-white/20"></div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white">Pricing Plans</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Choose Your Creative Plan
          </h1>
          <p className="text-xl text-purple-200 max-w-3xl mx-auto mb-8">
            Unlock the full potential of AI-powered content creation. 
            Start free and scale as you grow.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-12">
            <span className={`text-sm ${billingCycle === 'monthly' ? 'text-white' : 'text-purple-300'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="relative w-14 h-7 bg-white/20 rounded-full transition-colors focus:outline-none"
            >
              <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                billingCycle === 'yearly' ? 'transform translate-x-7' : ''
              }`}></div>
            </button>
            <span className={`text-sm ${billingCycle === 'yearly' ? 'text-white' : 'text-purple-300'}`}>
              Yearly
            </span>
            {billingCycle === 'yearly' && (
              <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                Save {getDiscountPercentage()}%
              </span>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {pricingTiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative bg-white/10 backdrop-blur-md rounded-3xl p-8 border transition-all duration-300 hover:transform hover:scale-105 ${
                tier.popular 
                  ? 'border-purple-400 ring-2 ring-purple-400/50 shadow-2xl' 
                  : 'border-white/20 hover:border-white/40'
              }`}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-semibold flex items-center space-x-1 shadow-lg">
                    <Star className="w-4 h-4" />
                    <span>Most Popular</span>
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                <p className="text-purple-200 text-sm mb-4">{tier.description}</p>
                
                <div className="flex items-center justify-center space-x-1 mb-4">
                  <span className="text-4xl font-bold text-white">
                    ${billingCycle === 'yearly' ? tier.price.yearly : tier.price.monthly}
                  </span>
                  <span className="text-purple-200">
                    {tier.price.monthly > 0 ? '/month' : ''}
                  </span>
                </div>

                <div className="flex items-center justify-center space-x-2 text-purple-200 mb-6">
                  <Zap className="w-5 h-5 text-purple-400" />
                  <span className="text-lg font-semibold">{tier.tokens.toLocaleString()} tokens</span>
                </div>
              </div>

              {/* Key Features */}
              <div className="space-y-4 mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white">{tier.features.tokens}</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white">{tier.features.quality}</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white">{tier.features.watermark}</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white">{tier.features.support}</span>
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={() => handleSubscribe(tier)}
                className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                  tier.popular
                    ? `bg-gradient-to-r ${tier.color} text-white shadow-lg`
                    : tier.id === 'free'
                    ? 'bg-white/20 hover:bg-white/30 text-white border border-white/30'
                    : `bg-gradient-to-r ${tier.color} text-white`
                }`}
              >
                {tier.id === 'free' ? 'Start Free Trial' : `Get ${tier.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* Detailed Feature Comparison */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Detailed Feature Comparison
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-4 px-6 text-white font-semibold">Features</th>
                  {pricingTiers.map((tier) => (
                    <th key={tier.id} className="text-center py-4 px-6">
                      <div className="text-white font-semibold">{tier.name}</div>
                      <div className="text-purple-200 text-sm">
                        ${billingCycle === 'yearly' ? tier.price.yearly : tier.price.monthly}
                        {tier.price.monthly > 0 ? '/mo' : ''}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureCategories.map((category, categoryIndex) => (
                  <React.Fragment key={category.name}>
                    {/* Category Header */}
                    <tr className="border-b border-white/10">
                      <td colSpan={4} className="py-6 px-6">
                        <div className="flex items-center space-x-2 text-purple-300 font-semibold">
                          {category.icon}
                          <span>{category.name}</span>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Category Features */}
                    {category.features.map((feature) => (
                      <tr key={feature.key} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-4 px-6 text-purple-200">{feature.label}</td>
                        {pricingTiers.map((tier) => (
                          <td key={tier.id} className="py-4 px-6 text-center text-white">
                            {tier.features[feature.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tool Access Comparison */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            AI Tool Access by Plan
          </h2>

          <div className="grid lg:grid-cols-3 gap-8">
            {pricingTiers.map((tier) => (
              <div key={tier.id} className="bg-white/5 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-6 text-center">{tier.name}</h3>
                <div className="space-y-3">
                  {tier.toolAccess.map((tool) => (
                    <div key={tool.name} className="flex items-center justify-between">
                      <span className="text-purple-200">{tool.name}</span>
                      {tool.available ? (
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                          <X className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">What are tokens?</h3>
              <p className="text-purple-200 mb-6">
                Tokens are credits used to generate AI content. Different tools consume different amounts of tokens based on complexity and processing time.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3">Can I upgrade or downgrade anytime?</h3>
              <p className="text-purple-200 mb-6">
                Yes! You can change your plan at any time. Upgrades take effect immediately, and downgrades take effect at your next billing cycle.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3">Do unused tokens roll over?</h3>
              <p className="text-purple-200">
                Subscription tokens reset each month. However, purchased token packs never expire and can be used anytime.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-3">What's the difference between plans?</h3>
              <p className="text-purple-200 mb-6">
                Higher plans include more tokens, access to premium tools, no watermarks, priority processing, and better support.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3">Can I use content commercially?</h3>
              <p className="text-purple-200 mb-6">
                Pro and Business plans include full commercial usage rights. Free plan is for personal use only.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3">Is there a free trial?</h3>
              <p className="text-purple-200">
                Yes! Every new account gets 200 free tokens to try our tools. No credit card required.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Start Creating?
          </h2>
          <p className="text-xl text-purple-200 mb-8">
            Join thousands of creators who are already using imgMotion to bring their visions to life.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105"
            >
              Start Free Trial
            </Link>
            <Link
              to="/contact"
              className="bg-white/10 backdrop-blur-md hover:bg-white/20 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 border border-white/20"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pricing;
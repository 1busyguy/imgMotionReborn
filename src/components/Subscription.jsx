import React from 'react';
import { useNavigate } from 'react-router-dom';
import { subscriptionTiers } from '../data/data';
import { Check, Star, Zap } from 'lucide-react';

const Subscription = () => {
  const navigate = useNavigate();

  const handleSubscribeClick = (tier) => {
    // TODO: Implement Stripe subscription flow
    console.log('Subscribe to:', tier);
    // For now, redirect to signup if not logged in
    navigate('/signup');
  };

  return (
    <section id="pricing" className="py-20 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Choose Your Plan
          </h2>
          <p className="text-xl text-purple-200 max-w-3xl mx-auto">
            Subscribe monthly to get tokens—each AI tool uses tokens per generation. 
            Top up anytime to keep creating without limits.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {subscriptionTiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 ${
                tier.popular 
                  ? 'ring-2 ring-purple-400 transform scale-105' 
                  : 'hover:bg-white/20'
              } transition-all duration-300`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center space-x-1">
                    <Star className="w-4 h-4" />
                    <span>Most Popular</span>
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                <div className="flex items-center justify-center space-x-1 mb-4">
                  <span className="text-4xl font-bold text-white">${tier.price}</span>
                  <span className="text-purple-200">/month</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-purple-200">
                  <Zap className="w-5 h-5" />
                  <span className="text-lg font-semibold">{tier.tokens.toLocaleString()} tokens</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span className="text-purple-100">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribeClick(tier)}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
                  tier.popular
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                    : 'bg-white/20 hover:bg-white/30 text-white border border-white/30'
                }`}
              >
                {tier.price === 0 ? 'Start Free Trial' : `Subscribe to ${tier.name}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Subscription;
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, HelpCircle, Zap, CreditCard, RefreshCw, Settings, Shield, Clock } from 'lucide-react';

const FAQ = () => {
  const faqs = [
    {
      id: 1,
      question: "What are img tokens?",
      answer: "Img tokens are a measure of computational resources used to generate images or videos. They represent the processing power, memory, and time required for each creation. Different tasks consume varying amounts of img tokens based on their complexity and output quality. For example, generating a high-resolution image or a longer video will use more img tokens than a smaller image or shorter video.",
      icon: <Zap className="w-5 h-5" />
    },
    {
      id: 2,
      question: "Can I roll over unused img tokens to the following month?",
      answer: "Img tokens do not accumulate or carry over between billing cycles. At the start of each month, your img token balance is reset to your plan's allocated amount, regardless of any unused units from the previous month. This ensures a fresh start and consistent resource availability for all users each month. img token packs expire after 90 days",
      icon: <RefreshCw className="w-5 h-5" />
    },
    {
      id: 3,
      question: "What options do I have if I exceed my img token limit?",
      answer: "If you exceed your img token limit, you have several options to continue your work: Upgrade to a higher-tier subscription with increased img tokens. Purchase additional img tokens to complement your current plan.",
      icon: <CreditCard className="w-5 h-5" />
    },
    {
      id: 4,
      question: "How can I get additional img tokens?",
      answer: "Additional img tokens are available on the billing page in settigns area to users with a subscription. These supplementary units serve as a backup, activating only when your plan's allocated units are depleted. Once purchased, they remain available for use within 90 days.",
      icon: <Zap className="w-5 h-5" />
    },
    {
      id: 5,
      question: "How can I monitor my remaining img tokens?",
      answer: "To monitor your img token usage, click your profile picture in the top-right corner to view a quick summary. For a more detailed breakdown, visit your account usage page, where you can track your consumption over time and manage your resources effectively.",
      icon: <Settings className="w-5 h-5" />
    },
    {
      id: 6,
      question: "Is it possible to modify my subscription plan?",
      answer: "Yes! You can easily modify your subscription plan at any time. Simply navigate to your account page, where you'll find options to manage and adjust your current plan to better suit your needs.",
      icon: <Settings className="w-5 h-5" />
    },
    {
      id: 7,
      question: "What is imgMotion's refund policy?",
      answer: "Due to the nature of computation usage with our partners, we can not offer a refund for a current subscription, or purchase of img token packs. NOTE: If a generation fails due to technical difficulties, we can credit you the tokens, if the generation fails due to inappropriate usage, or NSFW img or video generation those credit will not be refunded. Please be aware of this policy, we have ZERO control over how are partners view your prompts or image uploads, so THEY set the moderation control. WAN seems to be less moderated, FLUX is very prudish. ",
      icon: <Shield className="w-5 h-5" />
    }
  ];

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
                  <HelpCircle className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white">Frequently Asked Questions</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <HelpCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-purple-200 max-w-3xl mx-auto">
            Find answers to common questions about imgMotionMagic, img tokens, subscriptions, and more.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-6">
          {faqs.map((faq) => (
            <div
              key={faq.id}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-6 hover:bg-white/15 transition-all duration-300"
            >
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  {faq.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-3">
                    {faq.question}
                  </h3>
                  <p className="text-purple-200 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact Section */}
        <div className="mt-16 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Still Have Questions?</h2>
          <p className="text-purple-200 mb-6">
            Can't find what you're looking for? Our support team is here to help you get the most out of imgMotionMagic.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/contact"
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              Contact Support
            </Link>
            <Link
              to="/dashboard"
              className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 border border-white/20"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <Link
            to="/settings?tab=billing"
            className="bg-white/10 backdrop-blur-md rounded-xl p-6 hover:bg-white/20 transition-all duration-300 text-center group"
          >
            <CreditCard className="w-8 h-8 text-purple-400 mx-auto mb-3 group-hover:text-purple-300 transition-colors" />
            <h3 className="text-white font-semibold mb-2">Manage Billing</h3>
            <p className="text-purple-300 text-sm">View your subscription and purchase tokens</p>
          </Link>

          <Link
            to="/gallery"
            className="bg-white/10 backdrop-blur-md rounded-xl p-6 hover:bg-white/20 transition-all duration-300 text-center group"
          >
            <Clock className="w-8 h-8 text-purple-400 mx-auto mb-3 group-hover:text-purple-300 transition-colors" />
            <h3 className="text-white font-semibold mb-2">Usage History</h3>
            <p className="text-purple-300 text-sm">Track your token usage and generations</p>
          </Link>

          <Link
            to="/settings"
            className="bg-white/10 backdrop-blur-md rounded-xl p-6 hover:bg-white/20 transition-all duration-300 text-center group"
          >
            <Settings className="w-8 h-8 text-purple-400 mx-auto mb-3 group-hover:text-purple-300 transition-colors" />
            <h3 className="text-white font-semibold mb-2">Account Settings</h3>
            <p className="text-purple-300 text-sm">Update your profile and preferences</p>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default FAQ;
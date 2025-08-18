import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, Lock, Database, Users, FileText } from 'lucide-react';

const Privacy = () => {
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
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white">Privacy Policy</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Privacy Policy
          </h1>
          <p className="text-xl text-purple-200">
            Your privacy is important to us. This policy explains how we collect, use, and protect your information.
          </p>
          <p className="text-purple-300 mt-4">
            <strong>Last updated:</strong> January 2025
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Information We Collect */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Database className="w-6 h-6 mr-3 text-blue-400" />
              Information We Collect
            </h2>
            <div className="space-y-4 text-purple-200">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Account Information</h3>
                <p>When you create an account, we collect your email address, username, and any profile information you choose to provide.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Usage Data</h3>
                <p>We collect information about how you use our service, including the AI tools you use, generation history, and token usage.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Content Data</h3>
                <p>We temporarily store the images and videos you upload and generate to provide our services. Generated content is linked to your account.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Payment Information</h3>
                <p>Payment processing is handled by Stripe. We store only basic subscription information and do not store your payment card details.</p>
              </div>
            </div>
          </div>

          {/* How We Use Information */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Eye className="w-6 h-6 mr-3 text-green-400" />
              How We Use Your Information
            </h2>
            <div className="space-y-3 text-purple-200">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>Provide and improve our AI-powered content generation services</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>Process payments and manage your subscription</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>Send important service updates and security notifications</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>Analyze usage patterns to improve our platform and develop new features</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>Provide customer support and respond to your inquiries</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>Ensure platform security and prevent abuse</p>
              </div>
            </div>
          </div>

          {/* Data Protection */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Lock className="w-6 h-6 mr-3 text-yellow-400" />
              Data Protection & Security
            </h2>
            <div className="space-y-4 text-purple-200">
              <p>
                We implement industry-standard security measures to protect your personal information:
              </p>
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-2">Encryption</h4>
                  <p className="text-sm">All data is encrypted in transit and at rest using AES-256 encryption.</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-2">Access Control</h4>
                  <p className="text-sm">Strict access controls ensure only authorized personnel can access user data.</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-2">Regular Audits</h4>
                  <p className="text-sm">We conduct regular security audits and vulnerability assessments.</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-2">Data Minimization</h4>
                  <p className="text-sm">We collect only the data necessary to provide our services.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Data Sharing */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Users className="w-6 h-6 mr-3 text-pink-400" />
              Data Sharing & Third Parties
            </h2>
            <div className="space-y-4 text-purple-200">
              <p>
                We do not sell, trade, or rent your personal information to third parties. We may share your information only in these limited circumstances:
              </p>
              <div className="space-y-3">
                <div>
                  <h4 className="text-white font-semibold">Service Providers</h4>
                  <p>We work with trusted third-party services including Supabase (database), Stripe (payments), and FAL.ai (AI processing).</p>
                </div>
                <div>
                  <h4 className="text-white font-semibold">Legal Requirements</h4>
                  <p>We may disclose information if required by law or to protect our rights and the safety of our users.</p>
                </div>
                <div>
                  <h4 className="text-white font-semibold">Business Transfers</h4>
                  <p>In the event of a merger or acquisition, user data may be transferred as part of the business assets.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Your Rights */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <FileText className="w-6 h-6 mr-3 text-indigo-400" />
              Your Rights & Choices
            </h2>
            <div className="space-y-4 text-purple-200">
              <p>You have the following rights regarding your personal information:</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-white font-semibold mb-2">Access & Portability</h4>
                  <p className="text-sm">Request a copy of your personal data in a portable format.</p>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">Correction</h4>
                  <p className="text-sm">Update or correct your personal information through your account settings.</p>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">Deletion</h4>
                  <p className="text-sm">Request deletion of your account and associated data.</p>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">Opt-out</h4>
                  <p className="text-sm">Unsubscribe from marketing communications at any time.</p>
                </div>
              </div>
              <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4 mt-6">
                <p className="text-purple-100">
                  <strong>To exercise your rights:</strong> Contact us at imgmotionapp@gmail.com or use the account settings in your dashboard.
                </p>
              </div>
            </div>
          </div>

          {/* Data Retention */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Data Retention</h2>
            <div className="text-purple-200 space-y-3">
              <p>We retain your information for as long as necessary to provide our services:</p>
              <ul className="space-y-2 ml-4">
                <li>• <strong className="text-white">Account data:</strong> Until you delete your account</li>
                <li>• <strong className="text-white">Generated content:</strong> Until you delete it or close your account</li>
                <li>• <strong className="text-white">Usage logs:</strong> 12 months for analytics and security</li>
                <li>• <strong className="text-white">Payment records:</strong> 7 years for tax and legal compliance</li>
              </ul>
            </div>
          </div>

          {/* Cookies */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Cookies & Tracking</h2>
            <div className="text-purple-200 space-y-3">
              <p>We use cookies and similar technologies to:</p>
              <ul className="space-y-2 ml-4">
                <li>• Keep you logged in to your account</li>
                <li>• Remember your preferences and settings</li>
                <li>• Analyze how our service is used</li>
                <li>• Provide security features</li>
              </ul>
              <p>You can control cookies through your browser settings, but some features may not work properly if cookies are disabled.</p>
            </div>
          </div>

          {/* Updates */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Policy Updates</h2>
            <div className="text-purple-200 space-y-3">
              <p>
                We may update this privacy policy from time to time. When we make significant changes, we will:
              </p>
              <ul className="space-y-2 ml-4">
                <li>• Send you an email notification</li>
                <li>• Display a notice on our website</li>
                <li>• Update the "Last updated" date at the top of this policy</li>
              </ul>
              <p>
                Your continued use of our service after any changes constitutes acceptance of the updated policy.
              </p>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Questions About Privacy?</h2>
            <p className="text-purple-200 mb-6">
              If you have any questions about this privacy policy or how we handle your data, please don't hesitate to contact us.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/contact"
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
              >
                Contact Us
              </Link>
              <a
                href="mailto:imgmotionapp@gmail.com"
                className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 border border-white/20"
              >
                Email Directly
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
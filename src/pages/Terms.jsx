import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Scale, AlertTriangle, CreditCard, Shield, Users } from 'lucide-react';

const Terms = () => {
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
                  <Scale className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white">Terms of Service</h1>
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
            Terms of Service
          </h1>
          <p className="text-xl text-purple-200">
            Please read these terms carefully before using imgMotion. By using our service, you agree to these terms.
          </p>
          <p className="text-purple-300 mt-4 mb-12">
            <strong>Last updated:</strong> August 2025
          </p>

          {/* Important Notice */}
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
            <h3 className="text-red-200 font-semibold mb-3 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              PLEASE READ CAREFULLY BEFORE USING THIS SERVICE
            </h3>
            <p className="text-red-300 text-sm leading-relaxed">
              By reacting to accept or using any features of this bot, you agree to be bound by these Terms & Conditions in their entirety.
            </p>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Acceptance */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <FileText className="w-6 h-6 mr-3 text-blue-400" />
              Acceptance of Terms
            </h2>
            <div className="text-purple-200 space-y-4">
              <p>
                By accessing or using imgMotion ("the Service"), you agree to be bound by these Terms of Service ("Terms"). 
                If you disagree with any part of these terms, you may not access the Service.
              </p>
              <p>
                These Terms apply to all visitors, users, and others who access or use the Service. We reserve the right to 
                update these Terms at any time, and your continued use of the Service constitutes acceptance of any changes.
              </p>
            </div>
          </div>

          {/* Service Description */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Users className="w-6 h-6 mr-3 text-green-400" />
              Service Description
            </h2>
            <div className="text-purple-200 space-y-4">
              <p>
                imgMotion is a platform that provides AI-powered content generation tools, including but not limited to:
              </p>
              <ul className="space-y-2 ml-6">
                <li>• Text-to-image generation</li>
                <li>• Image-to-video conversion</li>
                <li>• Video enhancement and upscaling</li>
                <li>• Background removal and image editing</li>
                <li>• Other AI-powered creative tools</li>
              </ul>
              <p>
                The Service operates on a token-based system where users purchase tokens to access AI generation capabilities.
              </p>
            </div>
          </div>

          {/* User Liability & Content Ownership */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Shield className="w-6 h-6 mr-3 text-red-400" />
              User Liability & Content Ownership
            </h2>
            <div className="text-purple-200 space-y-4">
              <ul className="space-y-3">
                <li>• You must be 18 years of age or older to use this service</li>
                <li>• All images and videos generated by this bot are created at your explicit request</li>
                <li>• You alone are responsible for how you use, share, or distribute any generated content</li>
                <li>• The server owner, operators, and staff bear no liability for any generated content or its subsequent use</li>
                <li>• You affirm that you have all necessary rights to any images, prompts, or other inputs you provide</li>
              </ul>
            </div>
          </div>

          {/* Prohibited Content & Activities */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <AlertTriangle className="w-6 h-6 mr-3 text-red-400" />
              Prohibited Content & Activities
            </h2>
            <div className="text-purple-200 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">2.0 Content Moderation</h3>
                <ul className="space-y-2 ml-4">
                  <li>• All images and videos created through this bot are subject to moderation</li>
                  <li>• Violations of these terms will result in immediate action, including potential banning</li>
                  <li>• We reserve the right to report serious violations to relevant authorities</li>
                  <li>• Moderators have final discretion on what constitutes a violation</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-red-300 mb-2">2.1 Zero Tolerance for Underage Content</h3>
                <ul className="space-y-2 ml-4 text-red-200">
                  <li>• Any attempt to generate, share, or discuss sexualized or exploitative content involving minors or underage characters will result in an immediate, permanent ban</li>
                  <li>• This includes fictional characters depicted as or implied to be under 18 years of age</li>
                  <li>• All violations will be reported to Discord and relevant authorities</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">2.2 Deepfakes & Non-Consensual Imagery</h3>
                <ul className="space-y-2 ml-4">
                  <li>• Creating deepfakes, face-swaps, or any synthetic media depicting real people is strictly prohibited</li>
                  <li>• Using this bot to create non-consensual intimate imagery of any kind is forbidden</li>
                  <li>• Attempting to create deceptive content misrepresenting real individuals is not permitted</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">2.3 Intellectual Property Rights</h3>
                <ul className="space-y-2 ml-4">
                  <li>• Do not use this bot to infringe upon copyrights, trademarks, or other intellectual property rights</li>
                  <li>• You must have proper rights or permissions for any proprietary content used in prompts</li>
                  <li>• Generated content that substantially reproduces protected works may violate copyright law</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">2.4 Other Prohibited Uses</h3>
                <ul className="space-y-2 ml-4">
                  <li>• Creating content that violates any local, state, national, or international law</li>
                  <li>• Generating discriminatory, defamatory, or harassing content</li>
                  <li>• Creating content that promotes illegal activities or violence</li>
                  <li>• Using the bot to spread misinformation or create deceptive media</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Legal & Discord Compliance */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Scale className="w-6 h-6 mr-3 text-blue-400" />
              Legal & Discord Compliance
            </h2>
            <div className="text-purple-200 space-y-4">
              <ul className="space-y-3">
                <li>• You must comply with all applicable laws and Discord's Community Guidelines & Terms of Service</li>
                <li>• Illegal content or activities are strictly prohibited</li>
                <li>• You are responsible for ensuring your use of generated content complies with relevant regulations in your jurisdiction</li>
                <li>• Users must adhere to their local laws regarding AI-generated content, deepfakes, and digital media, which vary significantly worldwide</li>
                <li>• What may be legal in one country might be illegal in another; ignorance of local laws is not a valid defense</li>
                <li>• The international nature of this service does not exempt you from your local legal obligations</li>
              </ul>
            </div>
          </div>

          {/* Community Standards */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Users className="w-6 h-6 mr-3 text-green-400" />
              Community Standards
            </h2>
            <div className="text-purple-200 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.1 Respect & Harassment</h3>
                <ul className="space-y-2 ml-4">
                  <li>• Harassment, hate speech, or discrimination of any kind is not allowed</li>
                  <li>• Keep discussions civil and on-topic</li>
                  <li>• Respect the dignity and rights of all individuals</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.2 NSFW Content Restrictions</h3>
                <ul className="space-y-2 ml-4">
                  <li>• Adult or NSFW content must only be posted in designated channels (if enabled)</li>
                  <li>• Do not share such content elsewhere or with users who have not opted in</li>
                  <li>• All NSFW content must still comply with Discord's Terms of Service</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Operation & Enforcement */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Shield className="w-6 h-6 mr-3 text-yellow-400" />
              Operation & Enforcement
            </h2>
            <div className="text-purple-200 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">5.1 Channel Conduct</h3>
                <ul className="space-y-2 ml-4">
                  <li>• Use each channel for its intended purpose</li>
                  <li>• Off-topic posts may be moved or deleted by staff</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">5.2 Staff Authority</h3>
                <ul className="space-y-2 ml-4">
                  <li>• Moderators reserve the right to warn, mute, kick, or ban members at their discretion for rule violations</li>
                  <li>• Staff decisions regarding content moderation are final</li>
                  <li>• The bot service may be modified, suspended, or terminated at any time without prior notice</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">5.3 Reporting Violations</h3>
                <ul className="space-y-2 ml-4">
                  <li>• Users have a responsibility to report violations of these terms</li>
                  <li>• Report improper use or content to server moderators immediately</li>
                  <li>• For serious violations involving illegal content, contact relevant authorities</li>
                </ul>
              </div>
            </div>
          </div>
          {/* User Accounts */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Shield className="w-6 h-6 mr-3 text-purple-400" />
              User Accounts & Responsibilities
            </h2>
            <div className="text-purple-200 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Account Creation</h3>
                <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your account credentials.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Acceptable Use</h3>
                <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. You will not:</p>
                <ul className="space-y-1 ml-6 mt-2">
                  <li>• Generate content that violates any laws or regulations</li>
                  <li>• Create content that infringes on others' intellectual property rights</li>
                  <li>• Generate harmful, offensive, or inappropriate content</li>
                  <li>• Attempt to reverse engineer or exploit the Service</li>
                  <li>• Share your account credentials with others</li>
                  <li>• Use the Service to compete with or harm our business</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Content & Intellectual Property */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <FileText className="w-6 h-6 mr-3 text-yellow-400" />
              Content & Intellectual Property
            </h2>
            <div className="text-purple-200 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Your Content</h3>
                <p>You retain ownership of content you upload to the Service. By uploading content, you grant us a license to process it for the purpose of providing our services.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Generated Content</h3>
                <p>You own the content generated through our Service, subject to these Terms and applicable laws. However, you are responsible for ensuring your use of generated content complies with all applicable laws and third-party rights.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Our Intellectual Property</h3>
                <p>The Service, including its software, design, and underlying technology, is owned by imgMotion and protected by intellectual property laws.</p>
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <CreditCard className="w-6 h-6 mr-3 text-pink-400" />
              Payment Terms
            </h2>
            <div className="text-purple-200 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Token System</h3>
                <p>Our Service operates on a token-based pricing model. Tokens are consumed when you use AI generation tools. Token prices and consumption rates are clearly displayed in the Service.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Subscriptions</h3>
                <p>Subscription plans automatically renew unless cancelled. You can cancel your subscription at any time through your account settings. Cancellation takes effect at the end of the current billing period.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Refunds</h3>
                <p>Token purchases are generally non-refundable. Subscription refunds may be considered on a case-by-case basis for unused periods due to service issues.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Payment Processing</h3>
                <p>Payments are processed by Stripe. By making a purchase, you agree to Stripe's terms of service and privacy policy.</p>
              </div>
            </div>
          </div>

          {/* Service Availability */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <AlertTriangle className="w-6 h-6 mr-3 text-orange-400" />
              Service Availability & Limitations
            </h2>
            <div className="text-purple-200 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Service Availability</h3>
                <p>We strive to maintain high service availability but cannot guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, or technical issues.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Usage Limits</h3>
                <p>We may impose reasonable usage limits to ensure fair access for all users and to prevent abuse of the Service.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Content Moderation</h3>
                <p>We reserve the right to review, moderate, or remove content that violates these Terms or applicable laws. We may also suspend or terminate accounts that repeatedly violate our policies.</p>
              </div>
            </div>
          </div>

          {/* Disclaimers */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Shield className="w-6 h-6 mr-3 text-red-400" />
              Disclaimers & Limitation of Liability
            </h2>
            <div className="text-purple-200 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Service "As Is"</h3>
                <p>The Service is provided "as is" without warranties of any kind. We do not guarantee the accuracy, reliability, or quality of generated content.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">AI-Generated Content</h3>
                <p>AI-generated content may not always be accurate or appropriate. You are responsible for reviewing and validating all generated content before use.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Limitation of Liability</h3>
                <p>To the maximum extent permitted by law, imgMotion shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Indemnification</h3>
                <p>You agree to indemnify and hold harmless the bot operators from any claims arising from your use of this service. We make no guarantees about the quality, accuracy, or appropriateness of generated content.</p>
              </div>
            </div>
          </div>

          {/* Data Usage & Privacy */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <FileText className="w-6 h-6 mr-3 text-blue-400" />
              Data Usage & Privacy
            </h2>
            <div className="text-purple-200 space-y-3">
              <ul className="space-y-2 ml-4">
                <li>• You acknowledge that any inputs you provide may be logged for moderation and abuse prevention</li>
                <li>• We may review generated content to ensure compliance with these terms</li>
                <li>• User data may be retained as necessary to enforce these terms or comply with legal obligations</li>
              </ul>
            </div>
          </div>

          {/* Service Limitations */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Service Limitations</h2>
            <div className="text-purple-200 space-y-3">
              <ul className="space-y-2 ml-4">
                <li>• We reserve the right to limit usage or implement additional restrictions to prevent abuse</li>
                <li>• The bot service may be modified, suspended, or terminated at any time without prior notice</li>
                <li>• Staff decisions regarding content moderation are final</li>
              </ul>
            </div>
          </div>
          {/* Termination */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Termination</h2>
            <div className="text-purple-200 space-y-3">
              <p>
                Either party may terminate this agreement at any time. We may suspend or terminate your account immediately if you violate these Terms.
              </p>
              <p>
                Upon termination, your right to use the Service ceases immediately. We may delete your account and associated data in accordance with our data retention policies.
              </p>
            </div>
          </div>

          {/* Changes to Terms */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Changes to Terms</h2>
            <div className="text-purple-200 space-y-3">
              <ul className="space-y-2 ml-4">
                <li>• These terms may be updated at any time without prior notice</li>
                <li>• Continued use of the bot after changes constitutes acceptance of the revised terms</li>
                <li>• It is your responsibility to review these terms periodically</li>
                <li>• Major changes may be announced in the server, but this is not guaranteed</li>
              </ul>
            </div>
          </div>

          {/* Governing Law */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Governing Law</h2>
            <div className="text-purple-200 space-y-3">
              <p>
                These Terms are governed by the laws of Pennsylvania, United States, without regard to conflict of law principles. 
                Any disputes arising from these Terms or your use of the Service will be resolved in the courts of Pennsylvania.
              </p>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Questions About These Terms?</h2>
            <p className="text-purple-200 mb-6">
              If you have any questions about these Terms of Service, please contact us.
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
                Email: imgmotionapp@gmail.com
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Terms;
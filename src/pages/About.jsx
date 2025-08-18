import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Users, Target, Award, Heart, Sparkles } from 'lucide-react';

const About = () => {
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
                <h1 className="text-xl font-bold text-white">About imgMotionMagic</h1>
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
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Transforming Creative Vision
            <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Into Reality
            </span>
          </h1>
          <p className="text-xl text-purple-200 max-w-3xl mx-auto">
            We're on a mission to democratize AI-powered content creation, making professional-quality 
            image and video generation accessible to creators worldwide.
          </p>
        </div>

        {/* Story Section */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-12">
          <h2 className="text-3xl font-bold text-white mb-6 flex items-center">
            <Heart className="w-8 h-8 mr-3 text-pink-400" />
            Our Story
          </h2>
          <div className="space-y-6 text-purple-200 leading-relaxed">
            <p>
              imgMotionMagic was born from a simple belief: everyone should have access to cutting-edge 
              AI tools for creative expression. We saw a world where powerful AI models were locked 
              behind complex APIs and technical barriers, limiting their potential to transform how 
              people create and share visual content.
            </p>
            <p>
              Our team of passionate developers, designers, and AI enthusiasts came together to build 
              a platform that bridges this gap. We've integrated the most advanced AI models from 
              leading providers like FAL.ai, making them accessible through an intuitive, 
              user-friendly interface.
            </p>
            <p>
              Today, imgMotionMagic serves thousands of creators, from social media influencers and 
              marketing professionals to artists and hobbyists, helping them bring their creative 
              visions to life with just a few clicks.
            </p>
          </div>
        </div>

        {/* Values Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4">
              <Target className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Our Mission</h3>
            <p className="text-purple-200">
              To democratize AI-powered creativity by providing accessible, powerful tools that 
              enable anyone to create professional-quality visual content without technical expertise.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Our Community</h3>
            <p className="text-purple-200">
              We're building a vibrant community of creators who inspire each other, share techniques, 
              and push the boundaries of what's possible with AI-generated content.
            </p>
          </div>
        </div>

        {/* Features Section */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-12">
          <h2 className="text-3xl font-bold text-white mb-8 flex items-center">
            <Award className="w-8 h-8 mr-3 text-yellow-400" />
            What Makes Us Different
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Cutting-Edge AI Models</h4>
                  <p className="text-purple-200">
                    Access to the latest and most powerful AI models including FLUX, Kling, VEO, 
                    and more, all in one platform.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">User-Centric Design</h4>
                  <p className="text-purple-200">
                    Intuitive interfaces designed for creators, not engineers. No coding required, 
                    just pure creative expression.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <Target className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Professional Quality</h4>
                  <p className="text-purple-200">
                    Generate content that meets professional standards, suitable for commercial 
                    use and client projects.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <Heart className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Fair Pricing</h4>
                  <p className="text-purple-200">
                    Transparent token-based pricing that scales with your usage. No hidden fees, 
                    no surprise charges.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <Award className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Continuous Innovation</h4>
                  <p className="text-purple-200">
                    Regular updates with new models, features, and improvements based on 
                    community feedback.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Real-Time Processing</h4>
                  <p className="text-purple-200">
                    Live updates on generation progress with real-time notifications when 
                    your content is ready.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Team Section */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-12">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">
            Built by Creators, for Creators
          </h2>
          <p className="text-purple-200 text-center max-w-2xl mx-auto">
            Our team combines deep technical expertise with a genuine passion for creative expression. 
            We understand the challenges creators face because we are creators ourselves.
          </p>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Ready to Transform Your Creative Process?</h2>
          <p className="text-xl text-purple-200 mb-8">
            Join thousands of creators who are already using imgMotionMagic to bring their visions to life.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105"
            >
              Start Creating Free
            </Link>
            <Link
              to="/#tools"
              className="bg-white/10 backdrop-blur-md hover:bg-white/20 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 border border-white/20"
            >
              Explore AI Tools
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default About;
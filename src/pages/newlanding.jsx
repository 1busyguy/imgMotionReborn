import React from 'react';
import { useNavigate } from 'react-router-dom';
import Hero from '../components/Hero';
import Tools from '../components/Tools';
import ToolShowcase from '../components/ToolShowcase';
import UserShowcase from '../components/UserShowcase';
import Testimonials from '../components/Testimonials';
import Subscription from '../components/Subscription';
import Footer from '../components/Footer';
import { 
  Smartphone, 
  Sparkles, 
  Palette, 
  Camera, 
  Wand2,
  Check,
  ArrowRight,
  Play,
  Apple,
  Monitor,
  Zap,
  Users,
  ShoppingCart,
  Brain,
  Book,
  Gift,
  Scan,
  Bookmark,
  Globe,
  Rocket,
  Eye,
  Link,
  Layers,
  Upload,
  Download,
  CircleDot,
  ArrowDown
} from 'lucide-react';

const NewLanding = () => {
  const navigate = useNavigate();

  const handleSignUpClick = () => {
    navigate('/signup');
  };

  return (
    <div className="min-h-screen">
      {/* Original Hero Section */}
      <Hero />

      {/* The Complete Ecosystem Section */}
      <section className="py-20 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Create. Animate. Experience.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
                The Complete AR Content Ecosystem
              </span>
            </h2>
            <p className="text-xl text-purple-200 max-w-4xl mx-auto">
              imgMotionMagic powers creators with AI tools to generate and animate content. 
              imgMotion brings those creations to life through augmented reality. 
              One ecosystem, infinite possibilities.
            </p>
          </div>

          {/* Visual Flow Diagram */}
          <div className="relative mb-16">
            <div className="grid lg:grid-cols-3 gap-8 items-center">
              {/* Step 1: Create with imgMotionMagic */}
              <div className="text-center">
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300">
                  <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Wand2 className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">1. Create with AI</h3>
                  <p className="text-purple-200 mb-4">
                    Use imgMotionMagic's 20+ AI tools to generate images, videos, and animations
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs">Text-to-Image</span>
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs">Image-to-Video</span>
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs">AI Animation</span>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="hidden lg:flex justify-center">
                <ArrowRight className="w-12 h-12 text-white/50" />
              </div>
              <div className="lg:hidden flex justify-center">
                <ArrowDown className="w-12 h-12 text-white/50" />
              </div>

              {/* Step 2: Experience with imgMotion */}
              <div className="text-center">
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-cyan-500/30 hover:border-cyan-400/50 transition-all duration-300">
                  <div className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Eye className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">2. Experience in AR</h3>
                  <p className="text-purple-200 mb-4">
                    Your creations come to life through the imgMotion app with AR scanning
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-xs">AR Activation</span>
                    <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-xs">No QR Needed</span>
                    <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-xs">Shopping</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Use Case Examples */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/10">
            <h3 className="text-2xl font-bold text-white mb-8 text-center">How It Works Together</h3>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl p-6">
                  <Book className="w-8 h-8 text-purple-400 mx-auto mb-3" />
                  <h4 className="font-bold text-white mb-2">Publishers</h4>
                  <p className="text-purple-300 text-sm">
                    Create animated content for books → Readers scan pages to see videos & 3D
                  </p>
                </div>
              </div>

              <div className="text-center">
                <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl p-6">
                  <ShoppingCart className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
                  <h4 className="font-bold text-white mb-2">Brands</h4>
                  <p className="text-cyan-300 text-sm">
                    Generate product animations → Customers scan to shop directly from images
                  </p>
                </div>
              </div>

              <div className="text-center">
                <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl p-6">
                  <Gift className="w-8 h-8 text-orange-400 mx-auto mb-3" />
                  <h4 className="font-bold text-white mb-2">Creators</h4>
                  <p className="text-orange-300 text-sm">
                    Design AR experiences → Share magical moments through greeting cards
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Creator Tools Section (imgMotionMagic) */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-purple-500/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-purple-300 text-sm font-medium">CREATOR TOOLS</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              imgMotionMagic: Your AI Creation Studio
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Professional tools to generate, animate, and prepare content for AR experiences
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {/* Key Creation Tools */}
            <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                <Wand2 className="w-6 h-6 text-purple-400" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">AI Image Generation</h4>
              <p className="text-gray-400 text-sm mb-3">
                Create stunning images with FLUX, Stable Diffusion, and more
              </p>
              <div className="flex items-center text-purple-300 text-xs">
                <Zap className="w-3 h-3 mr-1" />
                <span>7-20 tokens per generation</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                <Camera className="w-6 h-6 text-purple-400" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Image to Video</h4>
              <p className="text-gray-400 text-sm mb-3">
                Animate any image into dynamic videos perfect for AR activation
              </p>
              <div className="flex items-center text-purple-300 text-xs">
                <Zap className="w-3 h-3 mr-1" />
                <span>20-50 tokens per video</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                <Layers className="w-6 h-6 text-purple-400" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">AR Ready Export</h4>
              <p className="text-gray-400 text-sm mb-3">
                Optimize and prepare content for seamless AR experiences
              </p>
              <div className="flex items-center text-purple-300 text-xs">
                <Upload className="w-3 h-3 mr-1" />
                <span>Direct to imgMotion app</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => navigate('/signup')}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 inline-flex items-center space-x-2"
            >
              <span>Start Creating Content</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-purple-400 text-sm mt-3">Get 200 free tokens when you sign up</p>
          </div>
        </div>
      </section>

      {/* Consumer Experience Section (imgMotion App) */}
      <section className="py-20 bg-gradient-to-br from-cyan-900 via-blue-900 to-indigo-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-cyan-500/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <Eye className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-300 text-sm font-medium">CONSUMER APP</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              imgMotion: Experience AR Magic
            </h2>
            <p className="text-xl text-cyan-200 max-w-3xl mx-auto">
              Scan any image to unlock videos, 3D objects, shopping, and immersive experiences
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Phone Mockup */}
            <div className="relative flex justify-center">
              <div className="relative" style={{ maxWidth: '320px' }}>
                <div className="relative bg-gradient-to-b from-gray-900 to-gray-800 rounded-[3rem] p-3 shadow-2xl">
                  <div className="bg-black rounded-[2.5rem] p-2">
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-black rounded-full"></div>
                    <div className="bg-gradient-to-br from-cyan-600 to-blue-600 rounded-[2rem] aspect-[9/19.5] flex items-center justify-center overflow-hidden">
                      <div className="text-center p-6">
                        <Scan className="w-16 h-16 text-white mx-auto mb-4" />
                        <h3 className="text-white text-xl font-bold mb-2">Scan to Activate</h3>
                        <p className="text-cyan-100 text-sm">Point at any image</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-cyan-500 rounded-full opacity-30 blur-xl animate-pulse"></div>
                <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-blue-500 rounded-full opacity-30 blur-xl animate-pulse animation-delay-1000"></div>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Scan className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white mb-2">No QR Codes Needed</h4>
                  <p className="text-cyan-200">
                    Advanced AI recognizes images instantly - just point and scan
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white mb-2">Shop from Images</h4>
                  <p className="text-cyan-200">
                    See it, scan it, buy it - seamless e-commerce integration
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white mb-2">Social AR Community</h4>
                  <p className="text-cyan-200">
                    Follow creators, bookmark experiences, share discoveries
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Brain className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white mb-2">AI Image Analysis</h4>
                  <p className="text-cyan-200">
                    Smart AI reveals hidden content and secrets in any image
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => navigate('/imgmotion-app')}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 inline-flex items-center space-x-2"
                >
                  <span>Learn More About the App</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <p className="text-cyan-300 text-sm mt-3">Coming March 2025 - Join the waitlist</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Original AI Tools Section */}
      <Tools onSignUpClick={handleSignUpClick} />
      
      {/* Original Tool Showcase */}
      <ToolShowcase />
      
      {/* Pricing Section */}
      <Subscription />
      
      {/* Original User Showcase */}
      <UserShowcase />
      
      {/* Platform Partners */}
      <section className="py-20 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Powered by Industry Leaders
            </h2>
            <p className="text-xl text-gray-600">
              We partner with the best in AI and AR technology
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
            <div className="text-2xl font-bold text-gray-500">NVIDIA</div>
            <div className="text-2xl font-bold text-gray-500">Stability AI</div>
            <div className="text-2xl font-bold text-gray-500">FLUX</div>
            <div className="text-2xl font-bold text-gray-500">VEO2</div>
            <div className="text-2xl font-bold text-gray-500">Minimax</div>
          </div>
        </div>
      </section>
      
      {/* Original Testimonials */}
      <Testimonials />
      
      {/* Join Community CTA */}
      <section className="py-20 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Join the AR Content Revolution
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Create with AI. Experience in AR. One ecosystem connecting creators and consumers 
            through the magic of augmented reality.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/signup')}
              className="bg-white hover:bg-gray-100 text-purple-600 font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2"
            >
              <Wand2 className="w-5 h-5" />
              <span>Start Creating</span>
            </button>
            
            <a
              href="https://discord.gg/tgTAukNB46"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 border border-white/30 flex items-center justify-center space-x-2"
            >
              <Users className="w-5 h-5" />
              <span>Join Discord Community</span>
            </a>
          </div>
          
          <p className="text-white/70 text-sm mt-6">
            imgMotionMagic available now • imgMotion app launching March 2025
          </p>
        </div>
      </section>
      
      {/* Original Footer */}
      <Footer />
    </div>
  );
};

export default NewLanding;
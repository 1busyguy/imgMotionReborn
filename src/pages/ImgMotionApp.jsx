import React, { useState } from 'react';
import { 
  Smartphone, 
  Scan, 
  Sparkles, 
  Building2, 
  Camera, 
  Wand2,
  Check,
  ArrowRight,
  Play,
  Apple,
  Star,
  Zap,
  Heart,
  Share2,
  Settings,
  Image,
  Film,
  ChevronLeft,
  ChevronRight,
  Quote,
  ArrowLeft,
  ExternalLink,
  Music,
  Palette,
  ShoppingCart,
  Users,
  Package,
  BookOpen,
  Gift
} from 'lucide-react';


useEffect(() => { window.scrollTo(0, 0); }, []);


const ImgMotionApp = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [activeUseCase, setActiveUseCase] = useState(0);

  const features = [
    {
      icon: <Scan className="w-6 h-6" />,
      title: "AR Activation",
      description: "Scan any imgMotion-enabled image to unlock immersive AR experiences. No QR codes needed - just point and discover.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Package className="w-6 h-6" />,
      title: "Create Collections",
      description: "Build and publish your own AR collections. Perfect for artists, brands, and creators looking to elevate their visual content.",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: <ShoppingCart className="w-6 h-6" />,
      title: "Commerce Integration",
      description: "Transform any image into a shopping experience. Embed products directly into AR activations for seamless e-commerce.",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Partner Platform",
      description: "Join as a partner to create custom AR experiences for your audience, clients, or customers with our powerful tools.",
      color: "from-green-500 to-teal-500"
    }
  ];

  const useCases = [
    {
      icon: <Music className="w-8 h-8" />,
      title: "Musicians & Artists",
      description: "Transform album covers into interactive experiences. Let fans discover exclusive content, behind-the-scenes footage, and connect deeper with your art.",
      gradient: "from-purple-600 to-pink-600"
    },
    {
      icon: <Building2 className="w-8 h-8" />,
      title: "Marketing Agencies",
      description: "Create unforgettable campaigns that bridge physical and digital. Turn print ads, billboards, and packaging into interactive brand experiences.",
      gradient: "from-blue-600 to-cyan-600"
    },
    {
      icon: <Palette className="w-8 h-8" />,
      title: "Visual Artists",
      description: "Add new dimensions to your artwork. Gallery visitors can scan your pieces to reveal artist statements, process videos, or augmented layers.",
      gradient: "from-orange-600 to-red-600"
    },
    {
      icon: <Gift className="w-8 h-8" />,
      title: "Personal Moments",
      description: "Make greeting cards magical, wedding invitations memorable, or create AR-activated photo albums that tell deeper stories.",
      gradient: "from-green-600 to-teal-600"
    },
    {
      icon: <BookOpen className="w-8 h-8" />,
      title: "Publishers",
      description: "Revolutionize reading experiences. Children's books come alive, magazines offer instant shopping, and textbooks become interactive.",
      gradient: "from-indigo-600 to-purple-600"
    },
    {
      icon: <Package className="w-8 h-8" />,
      title: "Product Brands",
      description: "Transform packaging into engagement tools. Let customers discover product stories, tutorials, and exclusive offers through AR.",
      gradient: "from-red-600 to-pink-600"
    }
  ];

  const partnerBenefits = [
    {
      title: "No Technical Barriers",
      description: "Easy-to-use tools to create AR experiences without coding"
    },
    {
      title: "Analytics Dashboard",
      description: "Track engagement, scans, and user interactions in real-time"
    },
    {
      title: "Cloud Storage",
      description: "All AR content stored securely and available instantly"
    },
    {
      title: "White Label Options",
      description: "Custom branding for enterprise partners"
    }
  ];

  const testimonials = [
    {
      name: "Alex Chen",
      role: "Creative Director, Studio X",
      rating: 5,
      text: "imgMotion transformed our print campaigns. Clients are blown away when their posters come to life with AR."
    },
    {
      name: "Maria Rodriguez",
      role: "Independent Musician",
      rating: 5,
      text: "My album covers now give fans exclusive content and behind-the-scenes footage. It's changed how I connect with my audience."
    },
    {
      name: "David Park",
      role: "Marketing Manager, Fashion Brand",
      rating: 5,
      text: "We embedded shopping experiences right into our lookbooks. Sales from AR activations exceeded all expectations."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900">
      {/* Header */}
      <header className="relative z-20 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <a
                href="/"
                className="flex items-center space-x-2 text-purple-200 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Home</span>
              </a>
              <div className="h-6 w-px bg-white/20" />
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">imgMotion</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <a
                href="https://mailchi.mp/0b6c5c813295/join-imgmotion"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center space-x-2"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Become a Partner</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 mb-6">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-300 text-sm font-medium">Turning IMGs into Experiences</span>
              </div>

              <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight relative z-10">
                Unlock AR experiences
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 pb-2">
                  from any image
                </span>
              </h1>

              <p className="text-xl text-purple-200 mb-8 leading-relaxed">
                Transform static images into immersive AR experiences. Partner with imgMotion to create collections that elevate your personal, professional, or corporate brand through activated experiences on any mobile device.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <a
                  href="https://mailchi.mp/0b6c5c813295/join-imgmotion"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white hover:bg-gray-100 text-gray-900 font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2"
                >
                  <Users className="w-5 h-5" />
                  <span>Become a Partner</span>
                </a>
                
                <button
                  onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                  className="bg-white/10 backdrop-blur-md hover:bg-white/20 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 border border-white/20 flex items-center justify-center space-x-2"
                >
                  <Play className="w-5 h-5" />
                  <span>See It In Action</span>
                </button>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">500+</div>
                  <div className="text-sm text-purple-200">Partners</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">1M+</div>
                  <div className="text-sm text-purple-200">AR Activations</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">∞</div>
                  <div className="text-sm text-purple-200">Possibilities</div>
                </div>
              </div>
            </div>

            {/* Right Content - AR Demonstration */}
            <div className="relative flex justify-center">
              <div className="relative" style={{ maxWidth: '400px' }}>
                {/* AR Visualization */}
                <div className="relative">
                  {/* Base Image */}
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 shadow-2xl">
                    <div className="aspect-square bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-xl flex items-center justify-center relative overflow-hidden">
                      <Image className="w-24 h-24 text-white/30" />
                      
                      {/* AR Overlay Animation */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-32 h-32 border-4 border-cyan-400 rounded-2xl animate-pulse"></div>
                      </div>
                      
                      {/* Scanning Effect */}
                      <div className="absolute inset-0 bg-gradient-to-b from-cyan-400/20 to-transparent animate-pulse"></div>
                      
                      {/* AR Content Preview */}
                      <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md rounded-lg p-2">
                        <Scan className="w-6 h-6 text-cyan-400 animate-pulse" />
                      </div>
                    </div>
                    
                    <div className="mt-6 text-center">
                      <p className="text-white font-semibold mb-2">Scan • Discover • Experience</p>
                      <p className="text-purple-300 text-sm">Point your camera at any imgMotion-enabled image</p>
                    </div>
                  </div>
                </div>

                {/* Floating Elements */}
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-cyan-500 rounded-full opacity-30 blur-xl animate-pulse"></div>
                <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-blue-500 rounded-full opacity-30 blur-xl animate-pulse animation-delay-1000"></div>
                <div className="absolute top-1/2 -right-8 w-16 h-16 bg-purple-500 rounded-full opacity-30 blur-xl animate-pulse animation-delay-2000"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Platform Features
            </h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              Everything you need to create and deploy AR experiences at scale
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`relative bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 cursor-pointer transform hover:-translate-y-1 ${
                  activeFeature === index ? 'ring-2 ring-cyan-400' : ''
                }`}
                onClick={() => setActiveFeature(index)}
              >
                <div className={`w-12 h-12 bg-gradient-to-r ${feature.color} rounded-xl flex items-center justify-center mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-purple-200 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Elevate Every Industry
            </h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              From personal projects to enterprise campaigns, imgMotion transforms how images engage audiences
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {useCases.map((useCase, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                onClick={() => setActiveUseCase(index)}
              >
                <div className={`w-16 h-16 bg-gradient-to-r ${useCase.gradient} rounded-xl flex items-center justify-center mb-4`}>
                  {useCase.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{useCase.title}</h3>
                <p className="text-purple-200 text-sm">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              Create AR experiences in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Upload & Create</h3>
              <p className="text-purple-200">Partners upload images and create AR experiences using our intuitive tools - no coding required</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Distribute</h3>
              <p className="text-purple-200">Share AR-enabled images through print, digital, or physical products - anywhere images exist</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Engage</h3>
              <p className="text-purple-200">Users scan with imgMotion app to instantly unlock immersive AR experiences</p>
            </div>
          </div>
        </div>
      </section>

      {/* Partner Benefits */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Partner Benefits
            </h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              Join the AR revolution with powerful tools and support
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {partnerBenefits.map((benefit, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center mb-4">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{benefit.title}</h3>
                <p className="text-purple-200 text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Partner Success Stories
            </h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              See how partners are transforming their industries with AR
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <div className="flex items-center space-x-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <Quote className="w-8 h-8 text-purple-400 mb-4" />
                <p className="text-white mb-4">{testimonial.text}</p>
                <div>
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p className="text-purple-300 text-sm">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-cyan-600 to-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Images?
          </h2>
          <p className="text-xl text-cyan-100 mb-8 max-w-2xl mx-auto">
            Join imgMotion as a partner and start creating AR experiences that elevate your brand and engage your audience like never before.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://mailchi.mp/0b6c5c813295/join-imgmotion"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white hover:bg-gray-100 text-gray-900 font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2"
            >
              <Users className="w-5 h-5" />
              <span>Become a Partner</span>
            </a>
            
            <a
              href="https://discord.gg/tgTAukNB46"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 border border-white/30 flex items-center justify-center space-x-2"
            >
              <span>Join Our Discord</span>
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>

          <div className="mt-8 text-cyan-100">
            <p className="text-sm">Already a partner? Download the app to start scanning</p>
            <div className="flex justify-center mt-4">
              <a
                href="#"
                className="inline-flex items-center space-x-2 text-white hover:text-cyan-200 transition-colors"
              >
                <Apple className="w-5 h-5" />
                <span>Coming to App Store Q4 2025</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-black/20 backdrop-blur-md border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-semibold">imgMotion</span>
              <span className="text-purple-300">© 2025 - Turning IMGs into Experiences</span>
            </div>
            
            <div className="flex items-center space-x-6">
              <a href="/team" className="text-purple-300 hover:text-white transition-colors">About</a>
              <a href="https://mailchi.mp/0b6c5c813295/join-imgmotion" className="text-purple-300 hover:text-white transition-colors">Partnership</a>
              <a href="/contact" className="text-purple-300 hover:text-white transition-colors">Career</a>
              <a href="/contact" className="text-purple-300 hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        @keyframes scan {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(100%);
          }
        }
        .scan-line {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ImgMotionApp;
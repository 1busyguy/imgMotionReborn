import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Smartphone, 
  Download, 
  Sparkles, 
  Palette, 
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
  ExternalLink
} from 'lucide-react';

const ImgMotionApp = () => {
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = useState(0);
  const [activeScreenshot, setActiveScreenshot] = useState(0);

  const features = [
    {
      icon: <Camera className="w-6 h-6" />,
      title: "Instant Photo Animation",
      description: "Transform any photo into a captivating video with just one tap. Our AI analyzes your image and creates natural, smooth animations.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "Multiple Animation Styles",
      description: "Choose from various animation styles including Cinematic, 3D Depth, Parallax, Zoom, and more to match your creative vision.",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: <Wand2 className="w-6 h-6" />,
      title: "AI-Powered Effects",
      description: "Advanced AI technology creates realistic motion, depth perception, and dynamic effects that bring your photos to life.",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: <Share2 className="w-6 h-6" />,
      title: "Easy Sharing",
      description: "Export in HD quality and share directly to Instagram, TikTok, YouTube, or save to your camera roll in various formats.",
      color: "from-green-500 to-teal-500"
    }
  ];

  const screenshots = [
    {
      title: "Home Screen",
      description: "Clean, intuitive interface",
      image: "gradient-1"
    },
    {
      title: "Animation Styles",
      description: "Choose your effect",
      image: "gradient-2"
    },
    {
      title: "Processing",
      description: "Real-time AI processing",
      image: "gradient-3"
    },
    {
      title: "Result",
      description: "Share your creation",
      image: "gradient-4"
    }
  ];

  const testimonials = [
    {
      name: "Sarah M.",
      role: "Content Creator",
      rating: 5,
      text: "This app has completely changed my Instagram game! The animations are so smooth and professional looking."
    },
    {
      name: "David L.",
      role: "Photographer",
      rating: 5,
      text: "As a photographer, I love being able to add motion to my still images. It's like magic!"
    },
    {
      name: "Emma K.",
      role: "Social Media Manager",
      rating: 5,
      text: "The ease of use is incredible. I can create engaging content for my clients in seconds."
    }
  ];

  const getGradientByIndex = (index) => {
    const gradients = [
      "from-blue-500 to-cyan-500",
      "from-purple-500 to-pink-500",
      "from-orange-500 to-red-500",
      "from-green-500 to-teal-500"
    ];
    return gradients[index % gradients.length];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900">
      {/* Header */}
      <header className="relative z-20 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 text-purple-200 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Home</span>
              </button>
              <div className="h-6 w-px bg-white/20" />
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">imgMotion App</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <a
                href="https://apps.apple.com/app/imgmotion"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-black hover:bg-gray-900 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
              >
                <Apple className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
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
              <div className="inline-flex items-center space-x-2 bg-cyan-500/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
             <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-cyan-200 text-sm font-medium">4.9 Rating on App Store</span>
              </div>

              <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                Make images
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                  come alive with AR
                </span>
              </h1>

              <p className="text-xl text-purple-200 mb-8 leading-relaxed">
                Transform static images into mesmerizing animations with the power of AI. 
                Create stunning content for social media in seconds, right from your iPhone.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <a
                  href="https://apps.apple.com/app/imgmotion"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white hover:bg-gray-100 text-gray-900 font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-3"
                >
                  <Apple className="w-6 h-6" />
                  <div className="text-left">
                    <div className="text-xs text-gray-600">Download on the</div>
                    <div className="text-lg font-bold">App Store</div>
                  </div>
                </a>
                
                <button
                  onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                  className="bg-white/10 backdrop-blur-md hover:bg-white/20 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 border border-white/20 flex items-center justify-center space-x-2"
                >
                  <Play className="w-5 h-5" />
                  <span>Watch Demo</span>
                </button>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">100K+</div>
                  <div className="text-sm text-purple-200">Downloads</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">1M+</div>
                  <div className="text-sm text-purple-200">Animations</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">4.9★</div>
                  <div className="text-sm text-purple-200">Rating</div>
                </div>
              </div>
            </div>

            {/* Right Content - Phone Mockup */}
            <div className="relative flex justify-center">
              <div className="relative" style={{ maxWidth: '320px' }}>
                {/* Phone Frame */}
                <div className="relative bg-gradient-to-b from-gray-900 to-gray-800 rounded-[3rem] p-3 shadow-2xl transform rotate-6 hover:rotate-3 transition-transform duration-300">
                  <div className="bg-black rounded-[2.5rem] p-2">
                    {/* Notch */}
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-black rounded-full"></div>
                    
                    {/* Screen Content */}
                    <div className={`bg-gradient-to-br ${getGradientByIndex(activeScreenshot)} rounded-[2rem] aspect-[9/19.5] flex items-center justify-center overflow-hidden`}>
                      <div className="text-center p-6 animate-pulse">
                        <div className="w-24 h-24 bg-white/20 backdrop-blur rounded-3xl flex items-center justify-center mx-auto mb-4">
                          <Camera className="w-12 h-12 text-white" />
                        </div>
                        <h3 className="text-white text-2xl font-bold mb-2">imgMotion</h3>
                        <p className="text-white/80">Tap to Animate</p>
                      </div>
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
              Powerful Features
            </h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              Everything you need to create stunning animated content, all in one app
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

      {/* How It Works Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              Create amazing animations in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Choose Photo</h3>
              <p className="text-purple-200">Select any photo from your gallery or take a new one with the camera</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Select Style</h3>
              <p className="text-purple-200">Pick from various animation styles to match your creative vision</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Export & Share</h3>
              <p className="text-purple-200">Save your animated video and share it directly to social media</p>
            </div>
          </div>
        </div>
      </section>

      {/* Animation Styles Gallery */}
      <section className="py-20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Animation Styles
            </h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              Choose from a variety of professional animation effects
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Cinematic", desc: "Smooth camera movements", icon: <Film className="w-8 h-8" /> },
              { name: "3D Depth", desc: "Realistic depth perception", icon: <Camera className="w-8 h-8" /> },
              { name: "Parallax", desc: "Multi-layer motion", icon: <Image className="w-8 h-8" /> },
              { name: "Zoom", desc: "Dynamic zoom effects", icon: <Zap className="w-8 h-8" /> },
              { name: "Portrait", desc: "Focus on subjects", icon: <Heart className="w-8 h-8" /> },
              { name: "Nature", desc: "Organic movements", icon: <Sparkles className="w-8 h-8" /> }
            ].map((style, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
                <div className={`w-16 h-16 bg-gradient-to-r ${getGradientByIndex(index)} rounded-xl flex items-center justify-center mb-4`}>
                  {style.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{style.name}</h3>
                <p className="text-purple-200 text-sm">{style.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              What Users Say
            </h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              Join thousands of happy creators using imgMotion
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
            Ready to Animate Your World?
          </h2>
          <p className="text-xl text-cyan-100 mb-8 max-w-2xl mx-auto">
            Download imgMotion today and start creating stunning animations from your photos in seconds.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://apps.apple.com/app/imgmotion"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-black hover:bg-gray-900 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-3"
            >
              <Apple className="w-6 h-6" />
              <div className="text-left">
                <div className="text-xs">Download on the</div>
                <div className="text-lg font-bold">App Store</div>
              </div>
            </a>
            
            <button
              onClick={() => navigate('/')}
              className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 border border-white/30 flex items-center justify-center space-x-2"
            >
              <span>Explore Web Platform</span>
              <ExternalLink className="w-5 h-5" />
            </button>
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
              <span className="text-purple-300">© 2025</span>
            </div>
            
            <div className="flex items-center space-x-6">
              <a href="/privacy" className="text-purple-300 hover:text-white transition-colors">Privacy</a>
              <a href="/terms" className="text-purple-300 hover:text-white transition-colors">Terms</a>
              <a href="/support" className="text-purple-300 hover:text-white transition-colors">Support</a>
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
      `}</style>
    </div>
  );
};

export default ImgMotionApp;
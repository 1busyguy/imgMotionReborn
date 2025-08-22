import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { toCdnUrl } from '../utils/cdnHelpers';
import { Zap, Play, ArrowRight, Menu, X, User, LogIn } from 'lucide-react';

const Hero = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [profile, setProfile] = useState(null);

  // Fetch user profile when user is available
  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMobileMenuOpen && !event.target.closest('.mobile-menu-container')) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isMobileMenuOpen]);

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 overflow-hidden">
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <video
          className="w-full h-full object-cover opacity-30"
          autoPlay
          muted
          loop
          playsInline
          onLoadedData={() => setIsVideoLoaded(true)}
          poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%238B5CF6;stop-opacity:1' /%3E%3Cstop offset='50%25' style='stop-color:%23EC4899;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%2306B6D4;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23bg)' /%3E%3C/svg%3E"
        >
          <source src={toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/imm-videos/imgMotion_V1_shrunk.mp4")} type="video/mp4" />
        </video>
        
        {/* Video Overlay */}
      {/*  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/80 via-blue-900/70 to-indigo-900/80"></div>*/}
        
        {/* Animated Particles */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-4 h-4 bg-purple-400 rounded-full opacity-60 animate-pulse"></div>
          <div className="absolute top-40 right-20 w-6 h-6 bg-pink-400 rounded-full opacity-40 animate-pulse animation-delay-1000"></div>
          <div className="absolute bottom-20 left-20 w-5 h-5 bg-cyan-400 rounded-full opacity-50 animate-pulse animation-delay-2000"></div>
          <div className="absolute top-1/3 left-1/4 w-3 h-3 bg-yellow-400 rounded-full opacity-30 animate-pulse animation-delay-3000"></div>
          <div className="absolute bottom-1/3 right-1/4 w-4 h-4 bg-green-400 rounded-full opacity-40 animate-pulse animation-delay-4000"></div>
        </div>
      </div>

      {/* Header */}
      <header className="relative z-20 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">imgMotion</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#tools" className="text-purple-200 hover:text-white transition-colors">Tools</a>
              <a href="/imgmotionapp" className="text-purple-200 hover:text-white transition-colors">APP</a>
              <a href="/pricing" className="text-purple-200 hover:text-white transition-colors">Pricing</a>
              <a href="/showcase" className="text-purple-200 hover:text-white transition-colors">Showcase</a>
              <a href="/about" className="text-purple-200 hover:text-white transition-colors">About</a>
              <a href="/contact" className="text-purple-200 hover:text-white transition-colors">Contact</a>
            </nav>

            {/* Desktop Auth Buttons / User Info */}
            <div className="hidden md:flex items-center space-x-4">
              {user && profile ? (
                <>
                  {/* User Tokens */}
                  <button
                    onClick={() => navigate('/settings?tab=billing')}
                    className="flex items-center space-x-2 hover:bg-white/10 px-3 py-2 rounded-lg transition-colors group"
                    title="Click to manage billing and tokens"
                  >
                    <Zap className="w-4 h-4 text-purple-400" />
                    <span className="text-white font-semibold text-sm group-hover:text-purple-200">
                      {(profile?.tokens || 0) + (profile?.purchased_tokens || 0)} tokens
                    </span>
                  </button>
                  
                  {/* User Avatar */}
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold text-sm hover:from-purple-500 hover:to-pink-500 transition-all duration-200"
                    title="Go to Dashboard"
                  >
                    {profile?.avatar_url ? (
                      <img 
                        src={toCdnUrl(profile.avatar_url)} 
                        alt="Profile" 
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      user?.email?.charAt(0).toUpperCase() || 'U'
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="flex items-center space-x-2 text-purple-200 hover:text-white transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </button>
                  <button
                    onClick={() => navigate('/signup')}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 transform hover:scale-105"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden mobile-menu-container">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              {/* Mobile Menu */}
              {isMobileMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl">
                  <div className="p-4 space-y-4">
                    <a href="#tools" className="block text-purple-200 hover:text-white transition-colors py-2">Tools</a>
                    <a href="/imgmotionapp" className="block text-purple-200 hover:text-white transition-colors py-2">APP</a>
                    <a href="#pricing" className="block text-purple-200 hover:text-white transition-colors py-2">Pricing</a>
                    <a href="/showcase" className="block text-purple-200 hover:text-white transition-colors py-2">Showcase</a>
                    <a href="/about" className="block text-purple-200 hover:text-white transition-colors py-2">About</a>
                    <a href="/contact" className="block text-purple-200 hover:text-white transition-colors py-2">Contact</a>
                    <hr className="border-white/20" />
                    {user && profile ? (
                      <>
                        {/* Mobile User Info */}
                        <div className="flex items-center space-x-3 py-2">
                          <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                            {profile?.avatar_url ? (
                              <img 
                                src={toCdnUrl(profile.avatar_url)} 
                                alt="Profile" 
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              user?.email?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                          <div>
                            <div className="text-white font-medium text-sm">{user.email}</div>
                            <div className="text-purple-300 text-xs">
                              {(profile?.tokens || 0) + (profile?.purchased_tokens || 0)} tokens
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate('/dashboard')}
                          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300"
                        >
                          Go to Dashboard
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => navigate('/login')}
                          className="w-full flex items-center space-x-2 text-purple-200 hover:text-white transition-colors py-2"
                        >
                          <LogIn className="w-4 h-4" />
                          <span>Sign In</span>
                        </button>
                        <button
                          onClick={() => navigate('/signup')}
                          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300"
                        >
                          Get Started
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Content */}
      <div className="relative z-10 flex items-center min-h-[calc(100vh-4rem)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Text Content */}
            <div className="text-center lg:text-left lg:col-span-2">
              <div className="flex items-center justify-center lg:justify-start space-x-2 mb-6">
         {/*       <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">*/}
              {/*    <Zap className="w-6 h-6 text-white" /> 
                </div>*/}
             {/*  <span className="text-2xl font-bold text-white">imgMotion</span>*/}
              </div>

              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                Transform Your
                <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Creative Vision
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-purple-200 mb-8 max-w-2xl mx-auto lg:mx-0">
                Step into the future of creation. 
                Unleash the power of AI to create stunning images, videos, and get access to powerful tools to take your 
                concept to creation in seconds. 
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <button
                  onClick={() => navigate('/signup')}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 shadow-2xl"
                >
                  <span>Start Creating Free</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                
                <button
                  onClick={() => navigate('/login')}
                  className="bg-white/10 backdrop-blur-md hover:bg-white/20 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 border border-white/20 shadow-xl"
                >
                  Sign In
                </button>
              </div>

              <div className="flex items-center justify-center lg:justify-start space-x-8 text-purple-200">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">20+</div>
                  <div className="text-sm">AI Tools</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">50K+</div>
                  <div className="text-sm">Creations</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">10K+</div>
                  <div className="text-sm">Happy Users</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
        <div className="animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-pulse"></div>
          </div>
        </div>
      </div>

      <style>{`
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-3000 {
          animation-delay: 3s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </section>
  );
};

export default Hero;
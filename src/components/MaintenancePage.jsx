import React from 'react';
import { maintenanceConfig } from '../config/maintenance';
import { 
  Zap, 
  Mail, 
  Clock, 
  Wrench, 
  Sparkles,
  Twitter,
  Instagram,
  Youtube,
  RefreshCw
} from 'lucide-react';

const MaintenancePage = () => {
  const config = maintenanceConfig;

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${config.theme.backgroundColor} flex items-center justify-center relative overflow-hidden`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, ${config.theme.primaryColor} 0%, transparent 50%), 
                           radial-gradient(circle at 75% 75%, ${config.theme.secondaryColor} 0%, transparent 50%)`
        }}></div>
      </div>

      {/* Floating Elements */}
      <div className="absolute top-20 left-10 w-4 h-4 rounded-full opacity-60 animate-pulse" style={{ backgroundColor: config.theme.primaryColor }}></div>
      <div className="absolute top-40 right-20 w-6 h-6 rounded-full opacity-40 animate-pulse animation-delay-1000" style={{ backgroundColor: config.theme.secondaryColor }}></div>
      <div className="absolute bottom-20 left-20 w-5 h-5 rounded-full opacity-50 animate-pulse animation-delay-2000" style={{ backgroundColor: config.theme.primaryColor }}></div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{
            background: `linear-gradient(135deg, ${config.theme.primaryColor}, ${config.theme.secondaryColor})`
          }}>
            <Zap className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Brand Name */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-2">
            imgMotionMagic
          </h1>
          <div className="flex items-center justify-center space-x-2 text-purple-200">
            <Wrench className="w-5 h-5" />
            <span className="text-lg">Under Maintenance</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 md:p-12 mb-8 border border-white/20">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{
              background: `linear-gradient(135deg, ${config.theme.primaryColor}40, ${config.theme.secondaryColor}40)`
            }}>
              <Sparkles className="w-8 h-8 text-white animate-pulse" />
            </div>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {config.title}
          </h2>
          
          <p className="text-xl text-purple-200 mb-6">
            {config.subtitle}
          </p>
          
          <p className="text-lg text-purple-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            {config.message}
          </p>

          {/* Status */}
          <div className="flex items-center justify-center space-x-3 mb-8">
            <div className="flex space-x-1">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: config.theme.primaryColor }}></div>
              <div className="w-2 h-2 rounded-full animate-pulse animation-delay-200" style={{ backgroundColor: config.theme.secondaryColor }}></div>
              <div className="w-2 h-2 rounded-full animate-pulse animation-delay-400" style={{ backgroundColor: config.theme.primaryColor }}></div>
            </div>
            <span className="text-white font-medium">Working on improvements...</span>
          </div>

          {/* Estimated Completion */}
          <div className="flex items-center justify-center space-x-2 text-purple-200 mb-8">
            <Clock className="w-5 h-5" />
            <span>{config.estimatedCompletion}</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 text-white"
            style={{
              background: `linear-gradient(135deg, ${config.theme.primaryColor}, ${config.theme.secondaryColor})`
            }}
          >
            <RefreshCw className="w-5 h-5" />
            <span>Check Again</span>
          </button>
        </div>

        {/* Contact Information */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">Need Help?</h3>
          
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8">
            <a
              href={`mailto:${config.contactEmail}`}
              className="flex items-center space-x-2 text-purple-200 hover:text-white transition-colors"
            >
              <Mail className="w-5 h-5" />
              <span>{config.contactEmail}</span>
            </a>
            
            {/* Social Links */}
            <div className="flex items-center space-x-4">
              {config.socialLinks.twitter && (
                <a
                  href={config.socialLinks.twitter}
                  className="text-purple-300 hover:text-white transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Twitter className="w-5 h-5" />
                </a>
              )}
              {config.socialLinks.instagram && (
                <a
                  href={config.socialLinks.instagram}
                  className="text-purple-300 hover:text-white transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {config.socialLinks.youtube && (
                <a
                  href={config.socialLinks.youtube}
                  className="text-purple-300 hover:text-white transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Youtube className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-purple-300">
          <p>&copy; 2025 imgMotionMagic. We'll be back soon!</p>
        </div>
      </div>

      {/* Custom Styles */}
      <style>{`
        .animation-delay-200 {
          animation-delay: 200ms;
        }
        .animation-delay-400 {
          animation-delay: 400ms;
        }
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

export default MaintenancePage;
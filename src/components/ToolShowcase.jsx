import React, { useState } from 'react';
import { toCdnUrl } from '../utils/cdnHelpers';
import { Play, ArrowRight, Zap, Video, Image as ImageIcon, Music, Wand2 } from 'lucide-react';

const ToolShowcase = () => {
  const [activeDemo, setActiveDemo] = useState(0);

  const toolDemos = [
    {
      id: 1,
      name: "AI Scene Maker",
      description: "Transform static images into cinematic video sequences with advanced AI scene generation. Perfect for creating dynamic content from photos.",
      videoUrl: toCdnUrl("https://images.pexels.com/photos/66134/pexels-photo-66134.jpeg"),
      thumbnailUrl: toCdnUrl("https://images.pexels.com/photos/66134/pexels-photo-66134.jpeg"),
      category: "video",
      icon: <Video className="w-6 h-6" />,
      features: [
        "Cinematic camera movements",
        "Intelligent scene analysis",
        "Multiple AI models",
        "Professional quality output"
      ],
      tokensRequired: "250+",
      color: "from-purple-500 to-pink-500"
    },
    {
      id: 2,
      name: "WAN v2.2-a14b Video",
      description: "Advanced imag2vid generation with WAN v2.2-a14b model and frame interpolation. Create professional videos with improved motion stability.",
      videoUrl: toCdnUrl("https://images.pexels.com/photos/5086477/pexels-photo-5086477.jpeg"),
      thumbnailUrl: toCdnUrl("https://images.pexels.com/photos/5086477/pexels-photo-5086477.jpeg"),
      category: "video",
      icon: <Video className="w-6 h-6" />,
      features: [
        "1080P support",
        "Frame interpolation",
        "Motion stability",
        "Professional quality"
      ],
      tokensRequired: "20+",
      color: "from-indigo-500 to-purple-500"
    },
    {
      id: 3,
      name: "HiDream I1 Dev",
      description: "Advanced text-to-image generation with HiDream I1 development model. Create stunning images with cutting-edge AI technology.",
      videoUrl: toCdnUrl("https://images.pexels.com/photos/956999/milky-way-starry-sky-night-sky-star-956999.jpeg"),
      thumbnailUrl: toCdnUrl("https://images.pexels.com/photos/956999/milky-way-starry-sky-night-sky-star-956999.jpeg"),
      category: "image",
      icon: <ImageIcon className="w-6 h-6" />,
      features: [
        "Development model",
        "High-quality images",
        "Fast generation",
        "Multiple outputs"
      ],
      tokensRequired: "7+",
      color: "from-violet-500 to-purple-500"
    },
    {
      id: 4,
      name: "CassetteAI Music",
      description: "Generate original music tracks with AI - from chill beats to epic orchestral pieces. Create the perfect soundtrack for your content.",
      videoUrl: toCdnUrl("https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg"),
      thumbnailUrl: toCdnUrl("https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg"),
      category: "audio",
      icon: <Music className="w-6 h-6" />,
      features: [
        "Multiple music genres",
        "Custom duration control",
        "High-quality audio",
        "Commercial usage rights"
      ],
      tokensRequired: "15+",
      color: "from-pink-500 to-rose-500"
    }
  ];

  const currentTool = toolDemos[activeDemo];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
            See Our Tools in Action
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Watch how our AI tools transform ideas into reality. Each tool is designed to deliver professional results in seconds.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Video Demo */}
          <div className="relative">
            <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 shadow-2xl">
              <div className="relative rounded-2xl overflow-hidden">
                <img
                  src={currentTool.thumbnailUrl}
                  alt={currentTool.name}
                  className="w-full aspect-video object-cover"
                  loading="lazy"
                />
                
                {/* Play Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors cursor-pointer">
                    <Play className="w-10 h-10 text-white ml-1" />
                  </div>
                </div>

                {/* Tool Badge */}
                <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">
                  {currentTool.name}
                </div>

                {/* Token Cost */}
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center space-x-1">
                  <Zap className="w-3 h-3 text-purple-500" />
                  <span className="text-xs font-medium text-gray-700">{currentTool.tokensRequired}</span>
                </div>
              </div>

              {/* Decorative Elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full opacity-20 blur-xl"></div>
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full opacity-20 blur-xl"></div>
            </div>
          </div>

          {/* Tool Information */}
          <div>
            <div className="flex items-center space-x-3 mb-6">
              <div className={`w-12 h-12 bg-gradient-to-r ${currentTool.color} rounded-2xl flex items-center justify-center text-white`}>
                {currentTool.icon}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{currentTool.name}</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span className="capitalize">{currentTool.category}</span>
                  <span>•</span>
                  <span>{currentTool.tokensRequired} tokens</span>
                </div>
              </div>
            </div>

            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
              {currentTool.description}
            </p>

            {/* Features */}
            <div className="mb-8">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Key Features:</h4>
              <div className="grid grid-cols-2 gap-3">
                {currentTool.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Try Now Button */}
            <button 
              onClick={() => window.location.href = '/signup'}
              className={`bg-gradient-to-r ${currentTool.color} hover:shadow-lg text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center space-x-2`}
            >
              <span>Try {currentTool.name}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tool Selector */}
        <div className="mt-16">
          <div className="flex flex-wrap justify-center gap-4">
            {toolDemos.map((tool, index) => (
              <button
                key={tool.id}
                onClick={() => setActiveDemo(index)}
                className={`flex items-center space-x-3 px-6 py-3 rounded-xl transition-all duration-300 ${
                  activeDemo === index
                    ? `bg-gradient-to-r ${tool.color} text-white shadow-lg`
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  activeDemo === index ? 'bg-white/20' : 'bg-gray-300'
                }`}>
                  {React.cloneElement(tool.icon, { 
                    className: `w-4 h-4 ${activeDemo === index ? 'text-white' : 'text-gray-600'}` 
                  })}
                </div>
                <span className="font-medium">{tool.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ToolShowcase;
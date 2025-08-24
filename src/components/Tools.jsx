import React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toCdnUrl } from '../utils/cdnHelpers';
import { tools } from '../data/data';
import { falTools } from '../data/falTools.jsx';
import { Zap, Image, Video, Wand2, ChevronLeft, ChevronRight } from 'lucide-react';

const Tools = ({ onSignUpClick }) => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);

  // Use all available tools
  const displayTools = falTools;
  const toolsPerPage = 3;
  const totalPages = Math.ceil(displayTools.length / toolsPerPage);
  
  const getCurrentTools = () => {
    const startIndex = currentPage * toolsPerPage;
    return displayTools.slice(startIndex, startIndex + toolsPerPage);
  };
  
  const nextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };
  
  const prevPage = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  const getIcon = (category) => {
    switch (category) {
      case 'image':
        return <Image className="w-6 h-6" />;
      case 'motion':
        return <Video className="w-6 h-6" />;
      case 'video':
        return <Video className="w-6 h-6" />;
      case 'ai':
        return <Wand2 className="w-6 h-6" />;
      default:
        return <Zap className="w-6 h-6" />;
    }
  };

  const handleToolClick = (tool) => {
    navigate('/login');
  };

  return (
    <section id="tools" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
            Explore Our AI Tools
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover powerful AI-driven tools that transform your creative process. 
            Swipe to explore all our amazing tools.
          </p>
        </div>

        {/* Tools Container with Navigation */}
        <div className="relative">
          {/* Navigation Buttons */}
          <button
            onClick={prevPage}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 bg-white shadow-lg rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          
          <button
            onClick={nextPage}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 z-10 w-12 h-12 bg-white shadow-lg rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-gray-600" />
          </button>

          {/* Tools Grid */}
          <div className="grid md:grid-cols-3 gap-8 transition-all duration-500">
            {getCurrentTools().map((tool) => (
              <div
                key={tool.id}
                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden"
              >
                <div className="relative">
                  <img
                    src={toCdnUrl(tool.image)}
                    alt={tool.name}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center space-x-1">
                    <Zap className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-gray-700">{tool.tokensRequired || 10} tokens</span>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white">
                      {getIcon(tool.category)}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{tool.name}</h3>
                  </div>
                  
                  <p className="text-gray-600 mb-4">{tool.description}</p>
                  
                  <button 
                    onClick={() => onSignUpClick ? onSignUpClick() : handleToolClick(tool)}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105">
                    Try Now
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Page Indicators */}
          <div className="flex justify-center mt-8 space-x-2">
            {Array.from({ length: totalPages }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentPage(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentPage
                    ? 'bg-purple-500 scale-125'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Tools;
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toCdnUrl } from '../utils/cdnHelpers';
import { Play, User, Heart, Eye, Download, X, Volume2, VolumeX } from 'lucide-react';

const UserShowcase = () => {
  const [showcaseVideos, setShowcaseVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  const [userLikes, setUserLikes] = useState(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    // Fetch showcased content regardless of login status
    fetchShowcasedGenerations();
  }, []);

  const fetchShowcasedGenerations = async () => {
    try {
      console.log('🔍 Fetching showcased generations...');
      
      // Use public showcase view for public access with better error handling
      const { data: showcasedGenerations, error } = await supabase
        .from('public_showcase')
        .select('*')
        .order('views', { ascending: false })
        .limit(50); // Limit to prevent too much data

      if (error) {
        console.error('❌ Error fetching showcased generations:', error);
        console.error('❌ Error details:', error.message, error.details);
        setShowcaseVideos([]);
        return;
      }

      console.log('✅ Fetched showcased generations:', showcasedGenerations?.length || 0);
      console.log('📊 Sample data:', showcasedGenerations?.slice(0, 2));

      if (showcasedGenerations && showcasedGenerations.length > 0) {
        // Transform the data to match the expected format
        const transformedData = showcasedGenerations.map((gen, index) => ({
          id: gen.id,
          title: gen.generation_name,
          creator: gen.username || 'Community Creator',
          videoUrl: getImageUrl(gen.output_file_url),
          thumbnailUrl: getImageUrl(gen.output_file_url),
          tool: getToolName(gen.tool_type),
          featured: index < 3, // First 3 are featured
          type: getMediaType(gen.tool_type),
          avatar: gen.avatar_url,
          views: gen.views || 0,
          likes: gen.likes || 0,
          socialLinks: {
            twitter: gen.twitter,
            instagram: gen.instagram,
            youtube: gen.youtube,
            github: gen.github
          },
          createdAt: gen.created_at,
          tokensUsed: gen.tokens_used,
          originalData: gen // Keep original data for viewer
        }));

        setShowcaseVideos(transformedData);
      } else {
        console.log('ℹ️ No showcased generations found');
        setShowcaseVideos([]);
      }
    } catch (error) {
      console.error('❌ Error in fetchShowcasedGenerations:', error);
      setShowcaseVideos([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get image URL from potential JSON array
  const getImageUrl = (url) => {
    if (!url) return null;
    
    if (!url) return null;
    
    if (typeof url === 'string' && url.startsWith('[')) {
      try {
        const urlArray = JSON.parse(url);
        return Array.isArray(urlArray) ? urlArray[0] : url;
      } catch (error) {
        return url;
      }
    }
    
    return url;
  };

  // Helper function to get tool display name
  const getToolName = (toolType) => {
    const toolNameMap = {
      'fal_wan_v22_a14b': 'WAN v2.2-a14b Video',
      'ai_scene_gen': 'AI Scene Maker',
      'fal_flux_kontext': 'FLUX Kontext',
      'fal_flux_kontext_lora': 'FLUX Kontext LoRA',
      'fal_flux_redux': 'FLUX Redux Pro',
      'fal_minimax_hailuo': 'Minimax Hailuo Video',
      'fal_kling_pro': 'Kling Pro Video',
      'fal_ltxv': 'LTXV Video Creator',
      'fal_video_upscaler': 'FAL Video Upscaler',
      'fal_bria_bg_remove': 'BRIA Background Remover',
      'fal_veo3_fast': 'VEO3 Fast',
      'fal_hidream_i1': 'HiDream I1 Dev',
      'fal_seedance_pro': 'Seedance Pro Video',
      'fal_cassetteai_music': 'CassetteAI Music Generator'
    };
    
    return toolNameMap[toolType] || toolType;
  };

  // Helper function to determine media type
  const getMediaType = (toolType) => {
    if (toolType?.includes('video') || toolType?.includes('kling') || toolType?.includes('wan') || toolType?.includes('minimax') || toolType?.includes('veo') || toolType?.includes('ltxv') || toolType?.includes('seedance') || toolType === 'ai_scene_gen') {
      return 'video';
    } else if (toolType?.includes('music') || toolType?.includes('cassetteai')) {
      return 'audio';
    } else {
      return 'image';
    }
  };

  // Dynamic masonry grid classes
  const getMasonryClass = (index) => {
    // Better masonry patterns that work with content
    const patterns = [
      '', // Normal - 1x1
      'md:col-span-2', // Wide - 2x1
      '', // Normal - 1x1
      '', // Normal - 1x1
      'md:col-span-2', // Wide - 2x1
      '', // Normal - 1x1
      '', // Normal - 1x1
      '', // Normal - 1x1
    ];
    return patterns[index % patterns.length];
  };

  // Handle media click - track view and open viewer
  const handleMediaClick = (creation) => {
    // Only increment views if user is logged in (to prevent spam)
    try {
      incrementViews(creation.id);
    } catch (error) {
      console.log('View tracking requires login');
    }

    // Open viewer
    setSelectedMedia(creation);
    setShowViewer(true);
  };

  // Increment views in database
  const incrementViews = async (generationId) => {
    try {
      const { error } = await supabase.rpc('increment_showcase_views', {
        generation_id: generationId
      });

      if (error) {
        console.error('Error incrementing views:', error);
      } else {
        // Update local state to reflect the change immediately
        setShowcaseVideos(prev => prev.map(item => 
          item.id === generationId 
            ? { ...item, views: (item.views || 0) + 1 }
            : item
        ));
      }
    } catch (error) {
      console.log('View tracking not available for logged out users');
    }
  };

  // Handle like toggle
  const handleLikeToggle = async (e, creationId) => {
    e.stopPropagation();
    
    // Check if user is logged in for likes
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please log in to like content');
        return;
      }
    } catch (error) {
      alert('Please log in to like content');
      return;
    }
    
    const isLiked = userLikes.has(creationId);
    const creation = showcaseVideos.find(item => item.id === creationId);
    
    if (!creation) return;
    
    try {
      if (isLiked) {
        // Unlike - decrement in database
        const { error } = await supabase.rpc('increment_showcase_likes', {
          generation_id: creationId
        });

        if (error) {
          console.error('Error decrementing likes:', error);
          return;
        }

        // Update local state
        setUserLikes(prev => {
          const newSet = new Set(prev);
          newSet.delete(creationId);
          return newSet;
        });
        
        setShowcaseVideos(prev => prev.map(item => 
          item.id === creationId 
            ? { ...item, likes: Math.max(0, (item.likes || 0) - 1) }
            : item
        ));
      } else {
        // Like - increment in database
        const { error } = await supabase.rpc('increment_showcase_likes', {
          generation_id: creationId
        });

        if (error) {
          console.error('Error incrementing likes:', error);
          return;
        }

        // Update local state
        setUserLikes(prev => new Set([...prev, creationId]));
        
        setShowcaseVideos(prev => prev.map(item => 
          item.id === creationId 
            ? { ...item, likes: (item.likes || 0) + 1 }
            : item
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // Close viewer
  const closeViewer = () => {
    setShowViewer(false);
    setSelectedMedia(null);
    setIsPlaying(false);
  };

  // Handle download
  const handleDownload = (url, title) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <section id="showcase" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
              Community Showcase
            </h2>
            <div className="animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-3/4 mx-auto"></div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-300 rounded-2xl h-64"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
            Community Showcase
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover amazing creations from our community. See what's possible with the combination of creativity and life experience melds with innovative AI tools, and make ideas come alive.
          </p>
        </div>

        {showcaseVideos.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <User className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">No Showcased Content Yet</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Amazing user creations will appear here once they're featured by our team.
            </p>
          </div>
        ) : (
          <>
            {/* Unlimited Masonry Grid */}
            <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
              {showcaseVideos.map((creation, index) => (
                <div
                  key={creation.id}
                  className="group relative bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden cursor-pointer break-inside-avoid mb-6"
                  onClick={() => handleMediaClick(creation)}
                >
                  {/* Featured Badge */}
                  {creation.featured && (
                    <div className="absolute top-4 left-4 z-10 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                      Featured
                    </div>
                  )}

                  {/* Media Thumbnail */}
                  <div className="relative overflow-hidden">
                    {creation.type === 'video' ? (
                      <video
                        src={creation.videoUrl}
                        className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                        muted
                        preload="metadata"
                      />
                    ) : creation.type === 'audio' ? (
                      <div className="w-full aspect-square bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                        <div className="w-24 h-24 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center">
                          <Volume2 className="w-12 h-12 text-white" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={toCdnUrl(creation.thumbnailUrl)}
                        alt={creation.title}
                        className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    )}
                    
                    {/* Play Overlay for Videos */}
                    {creation.type === 'video' && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                          <Play className="w-8 h-8 text-white ml-1" />
                        </div>
                      </div>
                    )}

                    {/* Stats Overlay */}
                    <div className="absolute bottom-3 left-3 flex items-center space-x-3 text-white text-sm">
                      <div className="flex items-center space-x-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                        <Eye className="w-3 h-3" />
                        <span>{creation.views || 0}</span>
                      </div>
                      <button
                        onClick={(e) => handleLikeToggle(e, creation.id)}
                        className={`flex items-center space-x-1 backdrop-blur-sm px-2 py-1 rounded-full transition-all duration-200 hover:scale-110 ${
                          userLikes.has(creation.id) 
                            ? 'bg-red-500/80 text-white' 
                            : 'bg-black/50 text-white hover:bg-red-500/60'
                        }`}
                      >
                        <Heart className={`w-3 h-3 ${userLikes.has(creation.id) ? 'fill-current' : ''}`} />
                        <span>{creation.likes || 0}</span>
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors line-clamp-2">
                      {creation.title}
                    </h3>
                    
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center overflow-hidden">
                        {creation.avatar ? (
                          <img 
                            src={creation.avatar} 
                            alt={creation.creator}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">{creation.creator}</p>
                        <p className="text-xs text-gray-500">{creation.tool}</p>
                      </div>
                    </div>

                    {/* Social Links */}
                    {creation.socialLinks && (creation.socialLinks.twitter || creation.socialLinks.instagram || creation.socialLinks.youtube || creation.socialLinks.github) && (
                      <div className="flex items-center space-x-2 mb-3">
                        {creation.socialLinks.twitter && (
                          <a 
                            href={`https://twitter.com/${creation.socialLinks.twitter}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-blue-400 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                          </a>
                        )}
                        {creation.socialLinks.instagram && (
                          <a 
                            href={`https://instagram.com/${creation.socialLinks.instagram}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-pink-400 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987s11.987-5.367 11.987-11.987C24.004 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.611-3.132-1.551-.684-.94-.684-2.126 0-3.066.684-.94 1.835-1.551 3.132-1.551s2.448.611 3.132 1.551c.684.94.684 2.126 0 3.066-.684.94-1.835 1.551-3.132 1.551zm7.718 0c-1.297 0-2.448-.611-3.132-1.551-.684-.94-.684-2.126 0-3.066.684-.94 1.835-1.551 3.132-1.551s2.448.611 3.132 1.551c.684.94.684 2.126 0 3.066-.684.94-1.835 1.551-3.132 1.551z"/></svg>
                          </a>
                        )}
                        {creation.socialLinks.youtube && (
                          <a 
                            href={`https://youtube.com/${creation.socialLinks.youtube}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-red-400 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                          </a>
                        )}
                        {creation.socialLinks.github && (
                          <a 
                            href={`https://github.com/${creation.socialLinks.github}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <button 
                onClick={fetchShowcasedGenerations}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-full font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105"
              >
                Refresh Showcase
              </button>
            </div>
          </>
        )}
      </div>

      {/* Media Viewer Modal */}
      {showViewer && selectedMedia && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative max-w-6xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden">
            {/* Close Button */}
            <button
              onClick={closeViewer}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Media Content */}
            <div className="relative">
              {selectedMedia.type === 'video' ? (
                <video
                  src={toCdnUrl(selectedMedia.videoUrl)}
                  controls
                  autoPlay
                  className="w-full max-h-[70vh] object-contain bg-black"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              ) : selectedMedia.type === 'audio' ? (
                <div className="w-full h-96 bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-32 h-32 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Volume2 className="w-16 h-16 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">{selectedMedia.title}</h3>
                    <audio
                      src={toCdnUrl(selectedMedia.videoUrl)}
                      controls                      
                      autoPlay
                      preload="metadata"                      
                      loading="lazy"
                    />
                  </div>
                </div>
              ) : (
                <img
                  src={selectedMedia.thumbnailUrl}
                  alt={selectedMedia.title}
                  className="w-full max-h-[70vh] object-contain bg-black"
                  loading="lazy"
                />
              )}
            </div>

            {/* Media Info */}
            <div className="p-6 bg-white">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedMedia.title}</h2>
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center overflow-hidden">
                      {selectedMedia.avatar ? (
                        <img 
                          src={selectedMedia.avatar} 
                          alt={selectedMedia.creator}
                          className="w-full h-full object-cover"                          
                          loading="lazy"
                        />
                      ) : (
                        <User className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedMedia.creator}</p>
                      <p className="text-sm text-gray-600">{selectedMedia.tool}</p>
                    </div>
                  </div>
                </div>

                {/* Stats and Actions */}
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1 text-gray-600">
                    <Eye className="w-4 h-4" />
                    <span>{selectedMedia.views || 0}</span>
                  </div>
                  <button
                    onClick={(e) => handleLikeToggle(e, selectedMedia.id)}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-full transition-all duration-200 ${
                      userLikes.has(selectedMedia.id) 
                        ? 'bg-red-500 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${userLikes.has(selectedMedia.id) ? 'fill-current' : ''}`} />
                    <span>{selectedMedia.likes || 0}</span>
                  </button>
                  <button
                    onClick={() => handleDownload(toCdnUrl(selectedMedia.videoUrl), selectedMedia.title)}
                    className="flex items-center space-x-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              {/* Social Links */}
              {selectedMedia.socialLinks && (selectedMedia.socialLinks.twitter || selectedMedia.socialLinks.instagram || selectedMedia.socialLinks.youtube || selectedMedia.socialLinks.github) && (
                <div className="flex items-center space-x-3 pt-3 border-t border-gray-200">
                  <span className="text-sm text-gray-500">Follow the creator:</span>
                  {selectedMedia.socialLinks.twitter && (
                    <a 
                      href={`https://twitter.com/${selectedMedia.socialLinks.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                    </a>
                  )}
                  {selectedMedia.socialLinks.instagram && (
                    <a 
                      href={`https://instagram.com/${selectedMedia.socialLinks.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-pink-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987s11.987-5.367 11.987-11.987C24.004 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.611-3.132-1.551-.684-.94-.684-2.126 0-3.066.684-.94 1.835-1.551 3.132-1.551s2.448.611 3.132 1.551c.684.94.684 2.126 0 3.066-.684.94-1.835 1.551-3.132 1.551zm7.718 0c-1.297 0-2.448-.611-3.132-1.551-.684-.94-.684-2.126 0-3.066.684-.94 1.835-1.551 3.132-1.551s2.448.611 3.132 1.551c.684.94.684 2.126 0 3.066-.684.94-1.835 1.551-3.132 1.551z"/></svg>
                    </a>
                  )}
                  {selectedMedia.socialLinks.youtube && (
                    <a 
                      href={`https://youtube.com/${selectedMedia.socialLinks.youtube}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    </a>
                  )}
                  {selectedMedia.socialLinks.github && (
                    <a 
                      href={`https://github.com/${selectedMedia.socialLinks.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default UserShowcase;
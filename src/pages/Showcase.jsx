import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { toCdnUrl, getThumbnailUrl } from '../utils/cdnHelpers';
import { useAuth } from '../hooks/useAuth';
import { 
  ArrowLeft, 
  Zap, 
  Play, 
  User, 
  Heart, 
  Eye, 
  Download, 
  X, 
  Volume2, 
  VolumeX,
  RefreshCw,
  Sparkles,
  Filter,
  Grid,
  List
} from 'lucide-react';

const Showcase = () => {
  const { user } = useAuth();
  const [showcaseContent, setShowcaseContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  const [userLikes, setUserLikes] = useState(new Set());
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('views');

  useEffect(() => {
    fetchShowcasedGenerations();
  }, []);

  const fetchShowcasedGenerations = async () => {
    try {
      console.log('🔍 Fetching showcased generations...');
      
      const { data: showcasedGenerations, error } = await supabase
        .from('public_showcase')
        .select('*')
        .order(sortBy === 'views' ? 'views' : sortBy === 'likes' ? 'likes' : 'created_at', { 
          ascending: false 
        })
        .limit(100);

      if (error) {
        console.error('❌ Error fetching showcased generations:', error);
        setShowcaseContent([]);
        return;
      }

      console.log('✅ Fetched showcased generations:', showcasedGenerations?.length || 0);

      if (showcasedGenerations && showcasedGenerations.length > 0) {
        const transformedData = showcasedGenerations.map((gen) => ({
          id: gen.id,
          title: gen.generation_name,
          creator: gen.username || 'Community Creator',
          videoUrl: getImageUrl(gen.output_file_url),
          thumbnailUrl: getImageUrl(gen.output_file_url),
          tool: getToolName(gen.tool_type),
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
          originalData: gen
        }));

        setShowcaseContent(transformedData);
      } else {
        setShowcaseContent([]);
      }
    } catch (error) {
      console.error('❌ Error in fetchShowcasedGenerations:', error);
      setShowcaseContent([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const getImageUrl = (url) => {
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
      'fal_cassetteai_music': 'CassetteAI Music',
      'fal_mmaudio_v2': 'MMAudio v2',
      'fal_mmaudio_video2': 'MMAudio Video2Audio',
      'fal_omnihuman': 'Omnihuman Talking Avatar',
    };
    
    return toolNameMap[toolType] || toolType;
  };

  const getMediaType = (toolType) => {
    if (toolType?.includes('video') || toolType?.includes('kling') || toolType?.includes('wan') || 
        toolType?.includes('minimax') || toolType?.includes('veo') || toolType?.includes('ltxv') || 
        toolType?.includes('seedance') || toolType === 'ai_scene_gen' || toolType?.includes('omnihuman')) {
      return 'video';
    } else if (toolType?.includes('music') || toolType?.includes('cassetteai') || toolType?.includes('mmaudio')) {
      return 'audio';
    } else {
      return 'image';
    }
  };

  // Filter content based on type
  const filteredContent = showcaseContent.filter(item => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  // Handle media click
  const handleMediaClick = (creation) => {
    try {
      incrementViews(creation.id);
    } catch (error) {
      console.log('View tracking requires login');
    }

    setSelectedMedia(creation);
    setShowViewer(true);
  };

  // Increment views
  const incrementViews = async (generationId) => {
    try {
      const { error } = await supabase.rpc('increment_showcase_views', {
        generation_id: generationId
      });

      if (error) {
        console.error('Error incrementing views:', error);
      } else {
        setShowcaseContent(prev => prev.map(item => 
          item.id === generationId 
            ? { ...item, views: (item.views || 0) + 1 }
            : item
        ));
      }
    } catch (error) {
      console.log('View tracking not available');
    }
  };

  // Handle like toggle
  const handleLikeToggle = async (e, creationId) => {
    e.stopPropagation();
    
    if (!user) {
      alert('Please log in to like content');
      return;
    }
    
    const isLiked = userLikes.has(creationId);
    
    try {
      const { error } = await supabase.rpc('increment_showcase_likes', {
        generation_id: creationId
      });

      if (error) {
        console.error('Error toggling like:', error);
        return;
      }

      if (isLiked) {
        setUserLikes(prev => {
          const newSet = new Set(prev);
          newSet.delete(creationId);
          return newSet;
        });
        
        setShowcaseContent(prev => prev.map(item => 
          item.id === creationId 
            ? { ...item, likes: Math.max(0, (item.likes || 0) - 1) }
            : item
        ));
      } else {
        setUserLikes(prev => new Set([...prev, creationId]));
        
        setShowcaseContent(prev => prev.map(item => 
          item.id === creationId 
            ? { ...item, likes: (item.likes || 0) + 1 }
            : item
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // Handle download
  const handleDownload = (url, title) => {
    const link = document.createElement('a');
    link.href = toCdnUrl(url);
    link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
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
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-xl font-bold text-white">Community Showcase</h1>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-white text-xl">Loading showcase...</div>
        </div>
      </div>
    );
  }

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
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white">Community Showcase</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {user && (
                <Link
                  to="/dashboard"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300"
                >
                  Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Community Showcase
          </h1>
          <p className="text-xl text-purple-200 max-w-3xl mx-auto mb-8">
            Discover amazing creations from our community. See what's possible when creativity meets cutting-edge AI technology.
          </p>
          
          {/* Stats */}
          <div className="flex items-center justify-center space-x-8 text-purple-200 mb-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{showcaseContent.length}</div>
              <div className="text-sm">Featured Creations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {showcaseContent.reduce((sum, item) => sum + (item.views || 0), 0)}
              </div>
              <div className="text-sm">Total Views</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {showcaseContent.reduce((sum, item) => sum + (item.likes || 0), 0)}
              </div>
              <div className="text-sm">Total Likes</div>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            {/* Filter Buttons */}
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-purple-400" />
              <div className="flex space-x-2">
                {['all', 'image', 'video', 'audio'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      filterType === type
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/10 text-purple-200 hover:bg-white/20'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort and View Controls */}
            <div className="flex items-center space-x-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="views" className="bg-gray-800">Most Viewed</option>
                <option value="likes" className="bg-gray-800">Most Liked</option>
                <option value="created_at" className="bg-gray-800">Newest</option>
              </select>
              
              <button
                onClick={fetchShowcasedGenerations}
                className="text-purple-400 hover:text-purple-300 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        {filteredContent.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-12 h-12 text-purple-300" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">No Showcased Content</h3>
            <p className="text-purple-200 max-w-md mx-auto">
              Amazing user creations will appear here once they're featured by our team.
            </p>
          </div>
        ) : (
          <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
            {filteredContent.map((creation) => (
              <div
                key={creation.id}
                className="group relative bg-white/10 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden cursor-pointer break-inside-avoid mb-6 border border-white/20"
                onClick={() => handleMediaClick(creation)}
              >
                {/* Media Thumbnail */}
                <div className="relative overflow-hidden">
                  {creation.type === 'video' ? (
                    <div className="relative">
                      <video
                        src={toCdnUrl(creation.videoUrl)}
                        poster={getThumbnailUrl(creation.originalData) || toCdnUrl(creation.videoUrl)}
                        className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                        muted
                        preload="metadata"
                        playsInline
                        onError={(e) => {
                          // Fallback to thumbnail image if video fails to load
                          const thumbnailUrl = getThumbnailUrl(creation.originalData);
                          if (thumbnailUrl && e.target.poster !== thumbnailUrl) {
                            e.target.poster = thumbnailUrl;
                          }
                        }}
                      />
                      {/* Fallback thumbnail overlay for mobile */}
                      {getThumbnailUrl(creation.originalData) && (
                        <img
                          src={getThumbnailUrl(creation.originalData)}
                          alt={creation.title}
                          className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
                          loading="lazy"
                          onLoad={(e) => {
                            // Show thumbnail if video poster fails on mobile
                            const video = e.target.parentElement.querySelector('video');
                            if (video && !video.poster) {
                              e.target.style.opacity = '1';
                            }
                          }}
                        />
                      )}
                    </div>
                  ) : creation.type === 'audio' ? (
                    <div className="w-full aspect-square bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                      <div className="w-24 h-24 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center">
                        <Volume2 className="w-12 h-12 text-white" />
                      </div>
                    </div>
                  ) : (
                    <img
                      src={getThumbnailUrl(creation.originalData) || toCdnUrl(creation.thumbnailUrl)}
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

                {/* Content Info */}
                <div className="p-6">
                  <h3 className="font-bold text-white mb-2 group-hover:text-purple-300 transition-colors line-clamp-2">
                    {creation.title}
                  </h3>
                  
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center overflow-hidden">
                      {creation.avatar ? (
                        <img 
                          src={toCdnUrl(creation.avatar)} 
                          alt={creation.creator}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <User className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{creation.creator}</p>
                      <p className="text-xs text-purple-300">{creation.tool}</p>
                    </div>
                  </div>

                  {/* Creation Date */}
                  <p className="text-xs text-purple-400">
                    {new Date(creation.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Media Viewer Modal */}
      {showViewer && selectedMedia && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative max-w-6xl w-full max-h-[90vh] bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden border border-white/20">
            {/* Close Button */}
            <button
              onClick={() => setShowViewer(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Media Content */}
            <div className="relative">
              {selectedMedia.type === 'video' ? (
                <video
                  src={toCdnUrl(selectedMedia.videoUrl)}
                  poster={getThumbnailUrl(selectedMedia.originalData) || toCdnUrl(selectedMedia.videoUrl)}
                  controls
                  autoPlay
                  className="w-full max-h-[70vh] object-contain bg-black"
                  playsInline
                  preload="metadata"
                  onError={(e) => {
                    // Fallback to thumbnail if video fails
                    const thumbnailUrl = getThumbnailUrl(selectedMedia.originalData);
                    if (thumbnailUrl && e.target.poster !== thumbnailUrl) {
                      e.target.poster = thumbnailUrl;
                    }
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              ) : selectedMedia.type === 'audio' ? (
                <div className="w-full h-96 bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-32 h-32 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Volume2 className="w-16 h-16 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">{selectedMedia.title}</h3>
                    <audio
                      src={toCdnUrl(selectedMedia.videoUrl)}
                      controls
                      autoPlay
                      preload="metadata"
                      className="w-full max-w-md"
                    />
                  </div>
                </div>
              ) : (
                <img
                  src={getThumbnailUrl(selectedMedia.originalData) || toCdnUrl(selectedMedia.thumbnailUrl)}
                  alt={selectedMedia.title}
                  className="w-full max-h-[70vh] object-contain bg-black"
                  loading="lazy"
                />
              )}
            </div>

            {/* Media Info */}
            <div className="p-6 bg-white/5 backdrop-blur-md">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedMedia.title}</h2>
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center overflow-hidden">
                      {selectedMedia.avatar ? (
                        <img 
                          src={toCdnUrl(selectedMedia.avatar)} 
                          alt={selectedMedia.creator}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <User className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{selectedMedia.creator}</p>
                      <p className="text-sm text-purple-300">{selectedMedia.tool}</p>
                    </div>
                  </div>
                </div>

                {/* Stats and Actions */}
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1 text-purple-200">
                    <Eye className="w-4 h-4" />
                    <span>{selectedMedia.views || 0}</span>
                  </div>
                  <button
                    onClick={(e) => handleLikeToggle(e, selectedMedia.id)}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-full transition-all duration-200 ${
                      userLikes.has(selectedMedia.id) 
                        ? 'bg-red-500 text-white' 
                        : 'bg-white/10 text-purple-200 hover:bg-red-500/20 hover:text-red-300'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${userLikes.has(selectedMedia.id) ? 'fill-current' : ''}`} />
                    <span>{selectedMedia.likes || 0}</span>
                  </button>
                  <button
                    onClick={() => handleDownload(selectedMedia.videoUrl, selectedMedia.title)}
                    className="flex items-center space-x-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              {/* Social Links */}
              {selectedMedia.socialLinks && (selectedMedia.socialLinks.twitter || selectedMedia.socialLinks.instagram || selectedMedia.socialLinks.youtube || selectedMedia.socialLinks.github) && (
                <div className="flex items-center space-x-3 pt-3 border-t border-white/20">
                  <span className="text-sm text-purple-300">Follow the creator:</span>
                  {selectedMedia.socialLinks.twitter && (
                    <a 
                      href={`https://twitter.com/${selectedMedia.socialLinks.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-300 hover:text-blue-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                    </a>
                  )}
                  {selectedMedia.socialLinks.instagram && (
                    <a 
                      href={`https://instagram.com/${selectedMedia.socialLinks.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-300 hover:text-pink-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987s11.987-5.367 11.987-11.987C24.004 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.611-3.132-1.551-.684-.94-.684-2.126 0-3.066.684-.94 1.835-1.551 3.132-1.551s2.448.611 3.132 1.551c.684.94.684 2.126 0 3.066-.684.94-1.835 1.551-3.132 1.551zm7.718 0c-1.297 0-2.448-.611-3.132-1.551-.684-.94-.684-2.126 0-3.066.684-.94 1.835-1.551 3.132-1.551s2.448.611 3.132 1.551c.684.94.684 2.126 0 3.066-.684.94-1.835 1.551-3.132 1.551z"/></svg>
                    </a>
                  )}
                  {selectedMedia.socialLinks.youtube && (
                    <a 
                      href={`https://youtube.com/${selectedMedia.socialLinks.youtube}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-300 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    </a>
                  )}
                  {selectedMedia.socialLinks.github && (
                    <a 
                      href={`https://github.com/${selectedMedia.socialLinks.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-300 hover:text-gray-400 transition-colors"
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
    </div>
  );
};

export default Showcase;
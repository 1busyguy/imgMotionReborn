import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { toCdnUrl, getThumbnailUrl } from '../utils/cdnHelpers';
import { 
  ArrowLeft, 
  Zap, 
  Upload, 
  Download, 
  Trash2, 
  RefreshCw,
  Search,
  Filter,
  Grid,
  List,
  Play,
  Image as ImageIcon,
  Video,
  Music,
  X,
  Calendar,
  Clock,
  User,
  Eye,
  Volume2,
  Copy,
  ExternalLink
} from 'lucide-react';

const Gallery = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [generations, setGenerations] = useState([]);
  const [filteredGenerations, setFilteredGenerations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTool, setFilterTool] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [showViewer, setShowViewer] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription for user's generations
      const subscription = supabase
        .channel('user_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Real-time update received:', payload);
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

      console.log('Real-time subscription set up for user generations');
      return () => subscription.unsubscribe();
    }
  }, [user]);

  // Filter and search effect
  useEffect(() => {
    let filtered = [...generations];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(gen => 
        gen.generation_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gen.tool_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (gen.input_data?.prompt && gen.input_data.prompt.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(gen => gen.status === filterStatus);
    }

    // Apply tool filter
    if (filterTool !== 'all') {
      filtered = filtered.filter(gen => gen.tool_type === filterTool);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'name':
          return a.generation_name.localeCompare(b.generation_name);
        case 'tokens':
          return (b.tokens_used || 0) - (a.tokens_used || 0);
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    setFilteredGenerations(filtered);
  }, [generations, searchTerm, filterStatus, filterTool, sortBy]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchGenerations = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_generations')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGenerations(data || []);
    } catch (error) {
      console.error('Error fetching generations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRealtimeUpdate = (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    setGenerations(current => {
      switch (eventType) {
        case 'INSERT':
          return [newRecord, ...current];
        case 'UPDATE':
          return current.map(item => 
            item.id === newRecord.id ? newRecord : item
          );
        case 'DELETE':
          return current.filter(item => item.id !== oldRecord.id);
        default:
          return current;
      }
    });
  };

  const handleDelete = async (generationId) => {
    if (!confirm('Are you sure you want to remove this generation? It will be hidden from your account.')) return;

    try {
      const { data, error } = await supabase.rpc('soft_delete_generation', {
        generation_id: generationId,
        user_id: user.id
      });

      if (error) throw error;
      
      if (!data) {
        throw new Error('Generation not found or already removed');
      }
    } catch (error) {
      console.error('Error deleting generation:', error);
      alert('Error removing generation. Please try again.');
    }
  };

  const handleDownload = async (generation) => {
    try {
      const url = getContentUrl(generation);
      const response = await fetch(toCdnUrl(url));
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Determine file extension based on content type
      const isVideo = getMediaType(generation.tool_type) === 'video';
      const isAudio = getMediaType(generation.tool_type) === 'audio';
      const extension = isVideo ? 'mp4' : isAudio ? 'mp3' : 'png';
      
      link.download = `${generation.generation_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link
      const url = getContentUrl(generation);
      const link = document.createElement('a');
      link.href = toCdnUrl(url);
      link.download = `${generation.generation_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const copyPrompt = (prompt) => {
    navigator.clipboard.writeText(prompt);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'processing':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
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

  const getContentUrl = (generation) => {
    // Check if user should see watermarked content
    const needsWatermark = !profile || 
                          profile.subscription_status === 'free' || 
                          profile.subscription_tier === 'free';
    
    // If watermarked version exists and user should see it
    if (needsWatermark && generation.metadata?.watermarked_url) {
      return generation.metadata.watermarked_url;
    }
    
    // Otherwise return original content
    return generation.output_file_url;
  };

  const getToolIcon = (toolType) => {
    const mediaType = getMediaType(toolType);
    switch (mediaType) {
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'audio':
        return <Music className="w-4 h-4" />;
      default:
        return <ImageIcon className="w-4 h-4" />;
    }
  };

  const getUniqueTools = () => {
    const tools = [...new Set(generations.map(g => g.tool_type))];
    return tools.sort();
  };

  const handleMediaClick = (generation) => {
    setSelectedGeneration(generation);
    setShowViewer(true);
  };

  const closeViewer = () => {
    setShowViewer(false);
    setSelectedGeneration(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading gallery...</div>
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
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 text-purple-200 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Dashboard</span>
              </button>
              <div className="h-6 w-px bg-white/20"></div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white">My Gallery</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
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
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Search */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-300 w-4 h-4" />
              <input
                type="text"
                placeholder="Search generations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all" className="bg-gray-800">All Status</option>
                <option value="completed" className="bg-gray-800">Completed</option>
                <option value="processing" className="bg-gray-800">Processing</option>
                <option value="failed" className="bg-gray-800">Failed</option>
              </select>

              <select
                value={filterTool}
                onChange={(e) => setFilterTool(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all" className="bg-gray-800">All Tools</option>
                {getUniqueTools().map(tool => (
                  <option key={tool} value={tool} className="bg-gray-800">
                    {tool.replace('fal_', '').replace(/_/g, ' ')}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="newest" className="bg-gray-800">Newest First</option>
                <option value="oldest" className="bg-gray-800">Oldest First</option>
                <option value="name" className="bg-gray-800">Name A-Z</option>
                <option value="tokens" className="bg-gray-800">Most Tokens</option>
              </select>

              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg p-2 text-white transition-colors"
              >
                {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
              </button>

              <button
                onClick={fetchGenerations}
                className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg p-2 text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 flex items-center space-x-6 text-sm text-purple-200">
            <span>Total: {generations.length}</span>
            <span>Showing: {filteredGenerations.length}</span>
            <span>Completed: {generations.filter(g => g.status === 'completed').length}</span>
            <span>Processing: {generations.filter(g => g.status === 'processing').length}</span>
          </div>
        </div>

        {/* Content */}
        {filteredGenerations.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Upload className="w-12 h-12 text-purple-300" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">
              {generations.length === 0 ? 'No Generations Yet' : 'No Results Found'}
            </h3>
            <p className="text-purple-200 max-w-md mx-auto">
              {generations.length === 0 
                ? 'Start creating amazing content with our AI tools to see your gallery come to life.'
                : 'Try adjusting your search or filter criteria to find what you\'re looking for.'
              }
            </p>
            {generations.length === 0 && (
              <button
                onClick={() => navigate('/dashboard')}
                className="mt-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
              >
                Start Creating
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredGenerations.map((generation) => {
              const mediaType = getMediaType(generation.tool_type);
              const contentUrl = getContentUrl(generation);
              
              return (
                <div
                  key={generation.id}
                  className="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
                  onClick={() => handleMediaClick(generation)}
                >
                  {/* Media Preview */}
                  <div className="relative aspect-video bg-gray-800">
                    {mediaType === 'video' && contentUrl ? (
                      <video
                        src={toCdnUrl(contentUrl)}
                        poster={getThumbnailUrl(generation) || toCdnUrl(contentUrl)}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                        playsInline
                      />
                    ) : mediaType === 'audio' ? (
                      <div className="w-full h-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                        <Volume2 className="w-12 h-12 text-pink-400" />
                      </div>
                    ) : contentUrl ? (
                      <img
                        src={getThumbnailUrl(generation) || toCdnUrl(contentUrl)}
                        alt={generation.generation_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                        <Upload className="w-8 h-8 text-gray-400" />
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(generation.status)}`}>
                      {generation.status}
                    </div>

                    {/* Media Type Icon */}
                    <div className="absolute top-2 left-2 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                      {getToolIcon(generation.tool_type)}
                    </div>

                    {/* Play Overlay for Videos */}
                    {mediaType === 'video' && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                          <Play className="w-6 h-6 text-white ml-1" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-white mb-2 truncate">
                      {generation.generation_name}
                    </h3>
                    
                    <div className="flex items-center justify-between text-sm text-purple-200 mb-2">
                      <span>{generation.tool_name}</span>
                      <span>{generation.tokens_used} tokens</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-purple-300">
                      <span>
                        {new Date(generation.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex space-x-1">
                        {generation.output_file_url && generation.status === 'completed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(generation);
                            }}
                            className="text-green-400 hover:text-green-300 transition-colors"
                            title="Download"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(generation.id);
                          }}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left py-4 px-6 text-purple-200 font-semibold">Name</th>
                    <th className="text-left py-4 px-6 text-purple-200 font-semibold">Tool</th>
                    <th className="text-left py-4 px-6 text-purple-200 font-semibold">Status</th>
                    <th className="text-left py-4 px-6 text-purple-200 font-semibold">Tokens</th>
                    <th className="text-left py-4 px-6 text-purple-200 font-semibold">Created</th>
                    <th className="text-left py-4 px-6 text-purple-200 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGenerations.map((generation) => (
                    <tr 
                      key={generation.id} 
                      className="border-b border-white/10 hover:bg-white/5 cursor-pointer"
                      onClick={() => handleMediaClick(generation)}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                            {getToolIcon(generation.tool_type)}
                          </div>
                          <div>
                            <p className="text-white font-medium">{generation.generation_name}</p>
                            {generation.input_data?.prompt && (
                              <p className="text-purple-300 text-xs truncate max-w-xs">
                                {generation.input_data.prompt}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-purple-200">{generation.tool_name}</td>
                      <td className="py-4 px-6">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(generation.status)}`}>
                          {generation.status}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-white">{generation.tokens_used}</td>
                      <td className="py-4 px-6 text-purple-200">
                        {new Date(generation.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex space-x-2">
                          {generation.output_file_url && generation.status === 'completed' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(generation);
                              }}
                              className="text-green-400 hover:text-green-300 transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(generation.id);
                            }}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Media Viewer Modal */}
      {showViewer && selectedGeneration && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative max-w-6xl w-full max-h-[90vh] bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden border border-white/20">
            {/* Close Button */}
            <button
              onClick={closeViewer}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Media Content */}
            <div className="relative">
              {getMediaType(selectedGeneration.tool_type) === 'video' ? (
                <video
                  src={toCdnUrl(getContentUrl(selectedGeneration))}
                  poster={getThumbnailUrl(selectedGeneration) || toCdnUrl(getContentUrl(selectedGeneration))}
                  controls
                  autoPlay
                  className="w-full max-h-[70vh] object-contain bg-black"
                  playsInline
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              ) : getMediaType(selectedGeneration.tool_type) === 'audio' ? (
                <div className="w-full h-96 bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-32 h-32 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Volume2 className="w-16 h-16 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">{selectedGeneration.generation_name}</h3>
                    <audio
                      src={toCdnUrl(getContentUrl(selectedGeneration))}
                      controls
                      autoPlay
                      preload="metadata"
                      className="w-full max-w-md"
                    />
                  </div>
                </div>
              ) : (
                <img
                  src={getThumbnailUrl(selectedGeneration) || toCdnUrl(getContentUrl(selectedGeneration))}
                  alt={selectedGeneration.generation_name}
                  className="w-full max-h-[70vh] object-contain bg-black"
                  loading="lazy"
                />
              )}
            </div>

            {/* Media Info */}
            <div className="p-6 bg-white/5 backdrop-blur-md">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedGeneration.generation_name}</h2>
                  <div className="flex items-center space-x-4 mb-3">
                    <div className="flex items-center space-x-2">
                      {getToolIcon(selectedGeneration.tool_type)}
                      <span className="text-purple-200">{selectedGeneration.tool_name}</span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedGeneration.status)}`}>
                      {selectedGeneration.status}
                    </div>
                  </div>
                  
                  {selectedGeneration.input_data?.prompt && (
                    <div className="mb-3">
                      <p className="text-purple-200 text-sm mb-1">Prompt:</p>
                      <p className="text-white bg-white/5 rounded-lg p-3 text-sm">
                        {selectedGeneration.input_data.prompt}
                      </p>
                    </div>
                  )}
                </div>

                {/* Stats and Actions */}
                <div className="flex flex-col items-end space-y-3 ml-6">
                  <div className="text-right">
                    <div className="text-purple-200 text-sm">Tokens Used</div>
                    <div className="text-white font-semibold">{selectedGeneration.tokens_used}</div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-purple-200 text-sm">Created</div>
                    <div className="text-white text-sm">
                      {new Date(selectedGeneration.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    {selectedGeneration.input_data?.prompt && (
                      <button
                        onClick={() => copyPrompt(selectedGeneration.input_data.prompt)}
                        className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg transition-colors"
                        title="Copy prompt"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    {selectedGeneration.output_file_url && selectedGeneration.status === 'completed' && (
                      <button
                        onClick={() => handleDownload(selectedGeneration)}
                        className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(selectedGeneration.id)}
                      className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Generation Details */}
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-purple-200">Tool Type:</span>
                  <p className="text-white">{selectedGeneration.tool_type}</p>
                </div>
                <div>
                  <span className="text-purple-200">Media Type:</span>
                  <p className="text-white capitalize">{getMediaType(selectedGeneration.tool_type)}</p>
                </div>
                {selectedGeneration.completed_at && (
                  <div>
                    <span className="text-purple-200">Completed:</span>
                    <p className="text-white">
                      {new Date(selectedGeneration.completed_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
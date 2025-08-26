import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { toCdnUrl, getThumbnailUrl, getContentUrl } from '../utils/cdnHelpers';
import OptimizedImage from '../components/OptimizedImage';
import OptimizedVideo from '../components/OptimizedVideo';
import { 
  ArrowLeft, 
  Zap, 
  Play, 
  Download, 
  Trash2, 
  RefreshCw,
  Filter,
  Grid,
  List,
  Calendar,
  Clock,
  User,
  Image as ImageIcon,
  Video,
  Music,
  X,
  Copy,
  Eye,
  Settings,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';

const Gallery = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [generations, setGenerations] = useState([]);
  const [filteredGenerations, setFilteredGenerations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTool, setFilterTool] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [generations, filterStatus, filterTool, sortBy, searchTerm]);

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

  const applyFilters = () => {
    let filtered = [...generations];

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(gen => gen.status === filterStatus);
    }

    // Filter by tool
    if (filterTool !== 'all') {
      filtered = filtered.filter(gen => gen.tool_type === filterTool);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(gen => 
        gen.generation_name?.toLowerCase().includes(term) ||
        gen.tool_name?.toLowerCase().includes(term) ||
        gen.input_data?.prompt?.toLowerCase().includes(term)
      );
    }

    // Sort
    switch (sortBy) {
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'name':
        filtered.sort((a, b) => (a.generation_name || '').localeCompare(b.generation_name || ''));
        break;
      case 'tokens':
        filtered.sort((a, b) => (b.tokens_used || 0) - (a.tokens_used || 0));
        break;
      default: // newest
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    setFilteredGenerations(filtered);
  };

  const getUniqueTools = () => {
    const tools = [...new Set(generations.map(gen => gen.tool_type))].filter(Boolean);
    return tools.sort();
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

  const getToolDisplayName = (toolType) => {
    const toolNames = {
      'fal_flux_redux': 'FLUX Redux Pro',
      'fal_flux_kontext': 'FLUX Kontext',
      'fal_flux_kontext_max_multi': 'FLUX Kontext Max Multi',
      'fal_minimax_hailuo': 'Minimax Hailuo Video',
      'wan22_pro': 'WAN 2.2 Professional',
      'fal_kling_pro': 'Kling Pro Video',
      'fal_ltxv': 'LTXV Video Creator',
      'fal_video_upscaler': 'FAL Video Upscaler',
      'fal_bria_bg_remove': 'BRIA Background Remover',
      'fal_veo3_fast': 'VEO3 Fast',
      'fal_veo3': 'VEO3 Standard',
      'fal_hidream_i1': 'HiDream I1 Dev',
      'fal_seedance_pro': 'Seedance Pro Video',
      'fal_wan_v22_a14b': 'WAN v2.2-a14b Video',
      'fal_cassetteai_music': 'CassetteAI Music',
      'fal_mmaudio_v2': 'MMAudio v2',
      'fal_mmaudio_video2': 'MMAudio Video2Audio',
      'fal_omnihuman': 'Omnihuman Talking Avatar',
      'fal_wan_v22_text2video_lora': 'WAN v2.2 Text2Video LoRA',
      'fal_wan_v22_img2video_lora': 'WAN v2.2 Img2Video LoRA',
      'fal_wan_v22_video2video': 'WAN v2.2 Video2Video',
      'fal_gemini_flash_image_edit': 'Gemini 2.5 Flash Image Edit',
      'ai_scene_gen': 'AI Scene Maker'
    };
    
    return toolNames[toolType] || toolType;
  };

  const handleDownload = async (generation) => {
    try {
      let downloadUrl = getContentUrl(generation, profile);
      
      // Handle multiple images
      if (downloadUrl.startsWith('[')) {
        const urls = JSON.parse(downloadUrl);
        downloadUrl = urls[0]; // Download first image
      }

      const response = await fetch(toCdnUrl(downloadUrl));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const mediaType = getMediaType(generation.tool_type);
      const extension = mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'mp3' : 'png';
      link.download = `${generation.generation_name?.replace(/[^a-z0-9]/gi, '_') || 'generation'}.${extension}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link
      let downloadUrl = getContentUrl(generation, profile);
      if (downloadUrl.startsWith('[')) {
        const urls = JSON.parse(downloadUrl);
        downloadUrl = urls[0];
      }
      
      const link = document.createElement('a');
      link.href = toCdnUrl(downloadUrl);
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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

      // Remove from local state
      setGenerations(current => current.filter(g => g.id !== generationId));
      
      // Close modal if this generation was selected
      if (selectedGeneration?.id === generationId) {
        setShowModal(false);
        setSelectedGeneration(null);
      }
    } catch (error) {
      console.error('Error deleting generation:', error);
      alert('Error removing generation. Please try again.');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
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

  const getMediaIcon = (toolType) => {
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

  // Helper function to extract filename from URL
  const extractFilename = (url) => {
    if (!url) return 'unknown_file';
    
    try {
      // Extract the filename from the URL path
      const urlPath = new URL(url).pathname;
      const filename = urlPath.split('/').pop() || 'unknown_file';
      
      // If it's a long generated filename, show a shortened version
      if (filename.length > 30) {
        const parts = filename.split('.');
        const extension = parts.pop();
        const name = parts.join('.');
        return `${name.substring(0, 20)}...${name.substring(name.length - 5)}.${extension}`;
      }
      
      return filename;
    } catch (e) {
      // Fallback for invalid URLs
      return url.split('/').pop()?.substring(0, 30) + '...' || 'unknown_file';
    }
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
                <span className="hidden sm:inline">Back to Dashboard</span>
              </button>
              <div className="h-6 w-px bg-white/20"></div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-white" />
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
          <div className="flex flex-col lg:flex-row items-center justify-between space-y-4 lg:space-y-0">
            {/* Search */}
            <div className="flex items-center space-x-4 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search generations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* View Mode and Refresh */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid' ? 'bg-purple-500 text-white' : 'text-purple-200 hover:text-white'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list' ? 'bg-purple-500 text-white' : 'text-purple-200 hover:text-white'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              
              <button
                onClick={fetchGenerations}
                className="text-purple-400 hover:text-purple-300 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Expandable Filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-white/20">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all" className="bg-gray-800">All Status</option>
                    <option value="completed" className="bg-gray-800">Completed</option>
                    <option value="processing" className="bg-gray-800">Processing</option>
                    <option value="failed" className="bg-gray-800">Failed</option>
                  </select>
                </div>

                {/* Tool Filter */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">Tool</label>
                  <select
                    value={filterTool}
                    onChange={(e) => setFilterTool(e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all" className="bg-gray-800">All Tools</option>
                    {getUniqueTools().map(tool => (
                      <option key={tool} value={tool} className="bg-gray-800">
                        {getToolDisplayName(tool)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Filter */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="newest" className="bg-gray-800">Newest First</option>
                    <option value="oldest" className="bg-gray-800">Oldest First</option>
                    <option value="name" className="bg-gray-800">Name A-Z</option>
                    <option value="tokens" className="bg-gray-800">Most Tokens</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{generations.length}</div>
            <div className="text-purple-200 text-sm">Total</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-400">
              {generations.filter(g => g.status === 'completed').length}
            </div>
            <div className="text-purple-200 text-sm">Completed</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {generations.filter(g => g.status === 'processing').length}
            </div>
            <div className="text-purple-200 text-sm">Processing</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-400">
              {generations.filter(g => g.status === 'failed').length}
            </div>
            <div className="text-purple-200 text-sm">Failed</div>
          </div>
        </div>

        {/* Gallery Content */}
        {filteredGenerations.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <ImageIcon className="w-12 h-12 text-purple-300" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">
              {searchTerm || filterStatus !== 'all' || filterTool !== 'all' 
                ? 'No matching generations' 
                : 'No generations yet'
              }
            </h3>
            <p className="text-purple-200 max-w-md mx-auto">
              {searchTerm || filterStatus !== 'all' || filterTool !== 'all'
                ? 'Try adjusting your filters or search terms.'
                : 'Start creating with our AI tools to see your generations here.'
              }
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredGenerations.map((generation) => {
              const mediaType = getMediaType(generation.tool_type);
              const contentUrl = getContentUrl(generation, profile);
              
              return (
                <div
                  key={generation.id}
                  className="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
                  onClick={() => {
                    setSelectedGeneration(generation);
                    setShowModal(true);
                  }}
                >
                  {/* Media Preview */}
                  <div className="relative aspect-square">
                    {mediaType === 'video' ? (
                      <OptimizedVideo
                        src={contentUrl}
                        poster={getThumbnailUrl(generation) || contentUrl}
                        className="w-full h-full object-cover"
                        controls={false}
                        muted
                        preloadProp="metadata"
                      />
                    ) : mediaType === 'audio' ? (
                      <div className="w-full h-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                        <Music className="w-16 h-16 text-pink-400" />
                      </div>
                    ) : (
                      <OptimizedImage
                        src={contentUrl.startsWith('[') ? JSON.parse(contentUrl)[0] : contentUrl}
                        alt={generation.generation_name}
                        className="w-full h-full object-cover"
                      />
                    )}
                    
                    {/* Status Badge */}
                    <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(generation.status)}`}>
                      {generation.status}
                    </div>

                    {/* Play Button for Videos */}
                    {mediaType === 'video' && generation.status === 'completed' && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                          <Play className="w-6 h-6 text-white ml-1" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content Info */}
                  <div className="p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white">
                        {getMediaIcon(generation.tool_type)}
                      </div>
                      <h3 className="font-semibold text-white text-sm truncate">
                        {generation.generation_name}
                      </h3>
                    </div>
                    
                    <p className="text-purple-200 text-xs mb-2">
                      {getToolDisplayName(generation.tool_type)}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-purple-300">
                      <span>{new Date(generation.created_at).toLocaleDateString()}</span>
                      <span>{generation.tokens_used} tokens</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="space-y-4">
            {filteredGenerations.map((generation) => {
              const mediaType = getMediaType(generation.tool_type);
              const contentUrl = getContentUrl(generation, profile);
              
              return (
                <div
                  key={generation.id}
                  className="bg-white/10 backdrop-blur-md rounded-2xl p-6 hover:bg-white/20 transition-all duration-300 cursor-pointer"
                  onClick={() => {
                    setSelectedGeneration(generation);
                    setShowModal(true);
                  }}
                >
                  <div className="flex items-center space-x-6">
                    {/* Thumbnail */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                      {mediaType === 'video' ? (
                        <OptimizedVideo
                          src={contentUrl}
                          poster={getThumbnailUrl(generation) || contentUrl}
                          className="w-full h-full object-cover"
                          controls={false}
                          muted
                          preloadProp="metadata"
                        />
                      ) : mediaType === 'audio' ? (
                        <div className="w-full h-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                          <Music className="w-8 h-8 text-pink-400" />
                        </div>
                      ) : (
                        <OptimizedImage
                          src={contentUrl.startsWith('[') ? JSON.parse(contentUrl)[0] : contentUrl}
                          alt={generation.generation_name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-white truncate">
                          {generation.generation_name}
                        </h3>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(generation.status)}`}>
                          {generation.status}
                        </div>
                      </div>
                      
                      <p className="text-purple-200 text-sm mb-2">
                        {getToolDisplayName(generation.tool_type)}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-xs text-purple-300">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(generation.created_at).toLocaleDateString()}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Zap className="w-3 h-3" />
                          <span>{generation.tokens_used} tokens</span>
                        </span>
                        {generation.completed_at && (
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              {Math.round((new Date(generation.completed_at) - new Date(generation.created_at)) / 1000)}s
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      {generation.status === 'completed' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(generation);
                          }}
                          className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors"
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
                        className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Generation Detail Modal */}
      {showModal && selectedGeneration && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">{selectedGeneration.generation_name}</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Media Display */}
              {selectedGeneration.output_file_url && selectedGeneration.status === 'completed' && (
                <div className="mb-6">
                  {(() => {
                    const mediaType = getMediaType(selectedGeneration.tool_type);
                    const contentUrl = getContentUrl(selectedGeneration, profile);
                    
                    if (mediaType === 'video') {
                      return (
                        <OptimizedVideo
                          src={contentUrl}
                          poster={getThumbnailUrl(selectedGeneration) || contentUrl}
                          className="w-full max-h-96 rounded-lg"
                          controls
                          preloadProp="metadata"
                        />
                      );
                    } else if (mediaType === 'audio') {
                      return (
                        <div className="w-full h-64 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <Music className="w-16 h-16 text-pink-400 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-4">{selectedGeneration.generation_name}</h3>
                            <audio
                              src={toCdnUrl(contentUrl)}
                              controls
                              className="w-full max-w-md"
                              preload="metadata"
                            />
                          </div>
                        </div>
                      );
                    } else {
                      // Handle multiple images
                      let imageUrls = [];
                      try {
                        if (contentUrl.startsWith('[')) {
                          imageUrls = JSON.parse(contentUrl);
                        } else {
                          imageUrls = [contentUrl];
                        }
                      } catch (e) {
                        imageUrls = [contentUrl];
                      }

                      return (
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-4">
                            Generated Images ({imageUrls.length})
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            {imageUrls.map((imageUrl, index) => (
                              <OptimizedImage
                                key={index}
                                src={imageUrl}
                                alt={`Generated ${index + 1}`}
                                className="w-full rounded-lg"
                              />
                            ))}
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}

              {/* Generation Details */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left Column - Generation Info */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Generation Details</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-purple-200">Status:</span>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedGeneration.status)}`}>
                        {selectedGeneration.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Tool:</span>
                      <span className="text-white">{getToolDisplayName(selectedGeneration.tool_type)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Tokens Used:</span>
                      <span className="text-white">{selectedGeneration.tokens_used}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Created:</span>
                      <span className="text-white">
                        {new Date(selectedGeneration.created_at).toLocaleString()}
                      </span>
                    </div>
                    {selectedGeneration.completed_at && (
                      <div className="flex justify-between">
                        <span className="text-purple-200">Completed:</span>
                        <span className="text-white">
                          {new Date(selectedGeneration.completed_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedGeneration.metadata?.processing_time && (
                      <div className="flex justify-between">
                        <span className="text-purple-200">Processing Time:</span>
                        <span className="text-white">{selectedGeneration.metadata.processing_time}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Configuration */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Configuration</h3>
                  <div className="space-y-3 text-sm">
                    {selectedGeneration.input_data?.prompt && (
                      <div>
                        <span className="text-purple-200">Prompt:</span>
                        <div className="mt-1 p-3 bg-white/5 rounded-lg">
                          <p className="text-white text-sm">{selectedGeneration.input_data.prompt}</p>
                          <button
                            onClick={() => copyToClipboard(selectedGeneration.input_data.prompt)}
                            className="mt-2 text-purple-400 hover:text-purple-300 transition-colors text-xs flex items-center space-x-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy prompt</span>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {selectedGeneration.input_data?.imageUrls && (
                      <div>
                        <span className="text-purple-200">Source Images:</span>
                        <div className="mt-1 p-3 bg-white/5 rounded-lg">
                          <div className="space-y-1">
                            {selectedGeneration.input_data.imageUrls.map((url, index) => (
                              <div key={index} className="text-white text-xs font-mono">
                                {index + 1}. {extractFilename(url)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {selectedGeneration.input_data?.numImages && (
                      <div className="flex justify-between">
                        <span className="text-purple-200">Num Images:</span>
                        <span className="text-white">{selectedGeneration.input_data.numImages}</span>
                      </div>
                    )}
                    
                    {selectedGeneration.metadata?.fal_request_id && (
                      <div>
                        <span className="text-purple-200">FAL Request ID:</span>
                        <div className="mt-1 p-2 bg-white/5 rounded text-xs font-mono text-white break-all">
                          {selectedGeneration.metadata.fal_request_id}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-4 mt-6">
                {selectedGeneration.status === 'completed' && (
                  <button
                    onClick={() => handleDownload(selectedGeneration)}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                )}
                <button
                  onClick={() => handleDelete(selectedGeneration.id)}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
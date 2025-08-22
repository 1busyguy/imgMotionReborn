import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { toCdnUrl, getThumbnailUrl, getContentUrl } from '../utils/cdnHelpers';
import OptimizedImage from '../components/OptimizedImage';
import OptimizedVideo from '../components/OptimizedVideo';
import { 
  ArrowLeft, 
  Zap, 
  Search, 
  Filter, 
  Grid3X3, 
  List, 
  Download, 
  Trash2, 
  RefreshCw,
  Play,
  Music,
  Image as ImageIcon,
  Video,
  Calendar,
  Clock,
  Eye,
  X,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';

const Gallery = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [generations, setGenerations] = useState([]);
  const [filteredGenerations, setFilteredGenerations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [showViewer, setShowViewer] = useState(false);

  // Get filter from URL on component mount
  const urlFilter = searchParams.get('filter');

  // Tool type mapping for display names
  const toolTypeMap = {
    'fal_flux_redux': 'FLUX Redux Pro',
    'fal_flux_kontext': 'FLUX Kontext',
    'fal_flux_kontext_lora': 'FLUX Kontext LoRA',
    'fal_minimax_hailuo': 'Minimax Hailuo Video',
    'fal_wan_pro': 'WAN Pro Video',
    'fal_wan_v22_a14b': 'WAN v2.2-a14b Video',
    'fal_wan_v22_video2video': 'WAN v2.2 Video2Video',
    'fal_wan_v22_img2video_lora': 'WAN v2.2 Img2Video LoRA',
    'fal_wan_v22_text2video_lora': 'WAN v2.2 Text2Video LoRA',
    'fal_kling_pro': 'Kling Pro Video',
    'fal_veo2': 'VEO2 Video Creator',
    'fal_veo3_fast': 'VEO3 Fast',
    'fal_ltxv': 'LTXV Video Creator',
    'fal_seedance_pro': 'Seedance Pro Video',
    'fal_video_upscaler': 'FAL Video Upscaler',
    'fal_bria_bg_remove': 'BRIA Background Remover',
    'fal_hidream_i1': 'HiDream I1 Dev',
    'fal_cassetteai_music': 'CassetteAI Music Generator',
    'fal_mmaudio_v2': 'MMAudio v2',
    'fal_mmaudio_video2': 'MMAudio Video2Audio',
    'fal_omnihuman': 'Omnihuman Talking Avatar',
    'fal_flux_kontext_max_multi': 'FLUX Kontext Max Multi',
    'ai_scene_gen': 'AI Scene Maker'
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
    }
  }, [user]);

  // Set filter from URL when component mounts or URL changes
  useEffect(() => {
    if (urlFilter && toolTypeMap[urlFilter]) {
      setFilterType(urlFilter);
      console.log('🔍 Applied URL filter:', urlFilter, '→', toolTypeMap[urlFilter]);
    }
  }, [urlFilter]);

  // Apply filters whenever dependencies change
  useEffect(() => {
    applyFilters();
  }, [generations, searchTerm, filterType, filterStatus]);

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

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(gen => 
        gen.generation_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gen.tool_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gen.input_data?.prompt?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(gen => gen.tool_type === filterType);
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(gen => gen.status === filterStatus);
    }

    setFilteredGenerations(filtered);
  };

  const clearFilter = () => {
    setFilterType('all');
    setSearchParams({}); // Clear URL parameters
  };

  const getMediaType = (generation) => {
    const toolType = generation.tool_type?.toLowerCase() || '';
    
    if (toolType.includes('video') || toolType.includes('kling') || toolType.includes('wan') || 
        toolType.includes('minimax') || toolType.includes('veo') || toolType.includes('ltxv') || 
        toolType.includes('seedance') || toolType === 'ai_scene_gen' || toolType.includes('omnihuman')) {
      return 'video';
    } else if (toolType.includes('music') || toolType.includes('cassetteai') || toolType.includes('mmaudio')) {
      return 'audio';
    } else {
      return 'image';
    }
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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getMediaIcon = (type) => {
    switch (type) {
      case 'video':
        return <Video className="w-5 h-5" />;
      case 'audio':
        return <Music className="w-5 h-5" />;
      default:
        return <ImageIcon className="w-5 h-5" />;
    }
  };

  const handleDownload = async (generation) => {
    if (!generation.output_file_url) return;

    try {
      const mediaType = getMediaType(generation);
      const contentUrl = getContentUrl(generation, profile);
      
      const response = await fetch(toCdnUrl(contentUrl));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const extension = mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'mp3' : 'png';
      link.download = `${generation.generation_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link
      const link = document.createElement('a');
      link.href = toCdnUrl(getContentUrl(generation, profile));
      link.download = `${generation.generation_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
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
    } catch (error) {
      console.error('Error deleting generation:', error);
      alert('Error removing generation. Please try again.');
    }
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
        <div className="text-white text-xl">Loading...</div>
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
                  <Grid3X3 className="w-5 h-5 text-white" />
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
        {/* Filter Banner - Show when filtering by specific tool */}
        {filterType !== 'all' && (
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Filter className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-blue-200 font-semibold">
                    Filtered by: {toolTypeMap[filterType] || filterType}
                  </h3>
                  <p className="text-blue-300 text-sm">
                    Showing {filteredGenerations.length} generations from this tool
                  </p>
                </div>
              </div>
              <button
                onClick={clearFilter}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>Show All</span>
              </button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search generations..."
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4">
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  if (e.target.value === 'all') {
                    setSearchParams({});
                  } else {
                    setSearchParams({ filter: e.target.value });
                  }
                }}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all" className="bg-gray-800">All Types</option>
                <optgroup label="Image Generation" className="bg-gray-800">
                  <option value="fal_flux_redux" className="bg-gray-800">FLUX Redux Pro</option>
                  <option value="fal_flux_kontext" className="bg-gray-800">FLUX Kontext</option>
                  <option value="fal_flux_kontext_lora" className="bg-gray-800">FLUX Kontext LoRA</option>
                  <option value="fal_hidream_i1" className="bg-gray-800">HiDream I1 Dev</option>
                  <option value="fal_bria_bg_remove" className="bg-gray-800">Background Remover</option>
                </optgroup>
                <optgroup label="Video Generation" className="bg-gray-800">
                  <option value="fal_minimax_hailuo" className="bg-gray-800">Minimax Hailuo</option>
                  <option value="fal_wan_pro" className="bg-gray-800">WAN Pro</option>
                  <option value="fal_wan_v22_a14b" className="bg-gray-800">WAN v2.2-a14b</option>
                  <option value="fal_wan_v22_video2video" className="bg-gray-800">WAN v2.2 Video2Video</option>
                  <option value="fal_wan_v22_img2video_lora" className="bg-gray-800">WAN v2.2 Img2Video LoRA</option>
                  <option value="fal_wan_v22_text2video_lora" className="bg-gray-800">WAN v2.2 Text2Video LoRA</option>
                  <option value="fal_kling_pro" className="bg-gray-800">Kling Pro</option>
                  <option value="fal_veo2" className="bg-gray-800">VEO2</option>
                  <option value="fal_veo3_fast" className="bg-gray-800">VEO3 Fast</option>
                  <option value="fal_ltxv" className="bg-gray-800">LTXV</option>
                  <option value="fal_seedance_pro" className="bg-gray-800">Seedance Pro</option>
                  <option value="fal_omnihuman" className="bg-gray-800">Omnihuman</option>
                  <option value="ai_scene_gen" className="bg-gray-800">AI Scene Maker</option>
                </optgroup>
                <optgroup label="Audio Generation" className="bg-gray-800">
                  <option value="fal_cassetteai_music" className="bg-gray-800">CassetteAI Music</option>
                  <option value="fal_mmaudio_v2" className="bg-gray-800">MMAudio v2</option>
                  <option value="fal_mmaudio_video2" className="bg-gray-800">MMAudio Video2Audio</option>
                </optgroup>
                <optgroup label="Enhancement" className="bg-gray-800">
                  <option value="fal_video_upscaler" className="bg-gray-800">Video Upscaler</option>
                </optgroup>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all" className="bg-gray-800">All Status</option>
                <option value="completed" className="bg-gray-800">Completed</option>
                <option value="processing" className="bg-gray-800">Processing</option>
                <option value="failed" className="bg-gray-800">Failed</option>
              </select>

              <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid' ? 'bg-purple-500 text-white' : 'text-purple-200 hover:text-white'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
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
                className="text-purple-400 hover:text-purple-300 transition-colors p-2"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Grid3X3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{filteredGenerations.length}</div>
                <div className="text-blue-300 text-sm">
                  {filterType !== 'all' ? 'Filtered' : 'Total'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {filteredGenerations.filter(g => g.status === 'completed').length}
                </div>
                <div className="text-green-300 text-sm">Completed</div>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {filteredGenerations.filter(g => g.status === 'processing').length}
                </div>
                <div className="text-yellow-300 text-sm">Processing</div>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {filteredGenerations.filter(g => g.status === 'failed').length}
                </div>
                <div className="text-red-300 text-sm">Failed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
          {filteredGenerations.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Grid3X3 className="w-12 h-12 text-purple-300" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">
                {filterType !== 'all' ? 'No generations found for this filter' : 'No generations yet'}
              </h3>
              <p className="text-purple-200 max-w-md mx-auto">
                {filterType !== 'all' 
                  ? `You haven't created any ${toolTypeMap[filterType]} generations yet.`
                  : 'Start creating amazing content with our AI tools to see your generations here.'
                }
              </p>
              {filterType !== 'all' && (
                <button
                  onClick={clearFilter}
                  className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  View All Generations
                </button>
              )}
            </div>
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredGenerations.map((generation) => {
                    const mediaType = getMediaType(generation);
                    const contentUrl = getContentUrl(generation, profile);
                    const thumbnailUrl = getThumbnailUrl(generation);
                    
                    return (
                      <div
                        key={generation.id}
                        className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-all duration-200 cursor-pointer group"
                        onClick={() => handleMediaClick(generation)}
                      >
                        {/* Media Thumbnail */}
                        <div className="relative aspect-square">
                          {mediaType === 'video' ? (
                            <div className="relative w-full h-full">
                              {thumbnailUrl ? (
                                <OptimizedImage
                                  src={thumbnailUrl}
                                  alt={generation.generation_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                  <Video className="w-12 h-12 text-purple-300" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                                  <Play className="w-6 h-6 text-white ml-1" />
                                </div>
                              </div>
                            </div>
                          ) : mediaType === 'audio' ? (
                            <div className="w-full h-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                              <div className="text-center">
                                <Music className="w-12 h-12 text-pink-400 mx-auto mb-2" />
                                <p className="text-pink-300 text-sm">Audio Track</p>
                              </div>
                            </div>
                          ) : (
                            <OptimizedImage
                              src={contentUrl}
                              alt={generation.generation_name}
                              className="w-full h-full object-cover"
                            />
                          )}
                          
                          {/* Status Badge */}
                          <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium border flex items-center space-x-1 ${getStatusColor(generation.status)}`}>
                            {getStatusIcon(generation.status)}
                            <span>{generation.status}</span>
                          </div>

                          {/* Media Type Badge */}
                          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                            {getMediaIcon(mediaType)}
                            <span className="capitalize">{mediaType}</span>
                          </div>
                        </div>

                        {/* Content Info */}
                        <div className="p-4">
                          <h3 className="font-semibold text-white mb-2 truncate">
                            {generation.generation_name}
                          </h3>
                          <p className="text-purple-200 text-sm mb-2">
                            {toolTypeMap[generation.tool_type] || generation.tool_name}
                          </p>
                          <div className="flex items-center justify-between text-xs text-purple-300">
                            <span>{generation.tokens_used} tokens</span>
                            <span>{new Date(generation.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredGenerations.map((generation) => {
                    const mediaType = getMediaType(generation);
                    const contentUrl = getContentUrl(generation, profile);
                    const thumbnailUrl = getThumbnailUrl(generation);
                    
                    return (
                      <div
                        key={generation.id}
                        className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-all duration-200"
                      >
                        <div className="flex items-center space-x-4">
                          {/* Thumbnail */}
                          <div 
                            className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                            onClick={() => handleMediaClick(generation)}
                          >
                            {mediaType === 'video' ? (
                              thumbnailUrl ? (
                                <OptimizedImage
                                  src={thumbnailUrl}
                                  alt={generation.generation_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                  <Video className="w-8 h-8 text-purple-300" />
                                </div>
                              )
                            ) : mediaType === 'audio' ? (
                              <div className="w-full h-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                                <Music className="w-8 h-8 text-pink-400" />
                              </div>
                            ) : (
                              <OptimizedImage
                                src={contentUrl}
                                alt={generation.generation_name}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="font-semibold text-white truncate">
                                {generation.generation_name}
                              </h3>
                              <div className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center space-x-1 ${getStatusColor(generation.status)}`}>
                                {getStatusIcon(generation.status)}
                                <span>{generation.status}</span>
                              </div>
                            </div>
                            
                            <p className="text-purple-200 text-sm mb-2">
                              {toolTypeMap[generation.tool_type] || generation.tool_name}
                            </p>
                            
                            <div className="flex items-center space-x-4 text-xs text-purple-300">
                              <span className="flex items-center space-x-1">
                                <Zap className="w-3 h-3" />
                                <span>{generation.tokens_used} tokens</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(generation.created_at).toLocaleDateString()}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(generation.created_at).toLocaleTimeString()}</span>
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center space-x-2">
                            {generation.output_file_url && generation.status === 'completed' && (
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
            </>
          )}
        </div>
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
              {getMediaType(selectedGeneration) === 'video' ? (
                <OptimizedVideo
                  src={getContentUrl(selectedGeneration, profile)}
                  poster={getThumbnailUrl(selectedGeneration)}
                  controls
                  className="w-full max-h-[70vh] object-contain bg-black"
                />
              ) : getMediaType(selectedGeneration) === 'audio' ? (
                <div className="w-full h-96 bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-32 h-32 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Music className="w-16 h-16 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">{selectedGeneration.generation_name}</h3>
                    <audio
                      src={toCdnUrl(getContentUrl(selectedGeneration, profile))}
                      controls
                      className="mx-auto"
                      autoPlay
                    />
                  </div>
                </div>
              ) : (
                <OptimizedImage
                  src={getContentUrl(selectedGeneration, profile)}
                  alt={selectedGeneration.generation_name}
                  className="w-full max-h-[70vh] object-contain bg-black"
                />
              )}
            </div>

            {/* Media Info */}
            <div className="p-6 bg-white/10">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedGeneration.generation_name}</h2>
                  <p className="text-purple-200 mb-3">
                    {toolTypeMap[selectedGeneration.tool_type] || selectedGeneration.tool_name}
                  </p>
                  
                  {selectedGeneration.input_data?.prompt && (
                    <div className="bg-white/5 rounded-lg p-3 mb-3">
                      <p className="text-purple-200 text-sm">
                        <strong>Prompt:</strong> {selectedGeneration.input_data.prompt}
                      </p>
                    </div>
                  )}
                </div>

                {/* Stats and Actions */}
                <div className="flex items-center space-x-4 ml-6">
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">{selectedGeneration.tokens_used}</div>
                    <div className="text-purple-300 text-xs">Tokens Used</div>
                  </div>
                  
                  <div className="flex space-x-2">
                    {selectedGeneration.output_file_url && selectedGeneration.status === 'completed' && (
                      <button
                        onClick={() => handleDownload(selectedGeneration)}
                        className="bg-green-500 hover:bg-green-600 text-white p-3 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Generation Details */}
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-purple-300">Created:</span>
                  <p className="text-white">{new Date(selectedGeneration.created_at).toLocaleString()}</p>
                </div>
                {selectedGeneration.completed_at && (
                  <div>
                    <span className="text-purple-300">Completed:</span>
                    <p className="text-white">{new Date(selectedGeneration.completed_at).toLocaleString()}</p>
                  </div>
                )}
                <div>
                  <span className="text-purple-300">Status:</span>
                  <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border mt-1 ${getStatusColor(selectedGeneration.status)}`}>
                    {getStatusIcon(selectedGeneration.status)}
                    <span>{selectedGeneration.status}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
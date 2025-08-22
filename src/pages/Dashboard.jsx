import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useRealtimeActivity } from '../hooks/useRealtimeActivity';
import { toCdnUrl, getThumbnailUrl, getContentUrl } from '../utils/cdnHelpers';
import { falTools } from '../data/falTools';
import OptimizedVideo from '../components/OptimizedVideo';
import OptimizedImage from '../components/OptimizedImage';
import { 
  Zap, 
  Settings, 
  User, 
  Video, 
  Image as ImageIcon, 
  Music, 
  Clock, 
  Play, 
  Download, 
  ExternalLink,
  RefreshCw,
  Plus,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Calendar,
  Activity,
  BarChart3,
  Crown,
  Gift
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentGenerations, setRecentGenerations] = useState([]);
  const [stats, setStats] = useState({
    totalGenerations: 0,
    thisMonth: 0,
    tokensUsed: 0
  });

  const { recentActivity, loading: activityLoading } = useRealtimeActivity(user?.id);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchRecentGenerations();
      fetchStats();
    }
  }, [user]);

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
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentGenerations = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_generations')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      setRecentGenerations(data || []);
    } catch (error) {
      console.error('Error fetching recent generations:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_generations')
        .select('tokens_used, created_at')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (error) throw error;

      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const totalGenerations = data?.length || 0;
      const thisMonthCount = data?.filter(g => new Date(g.created_at) >= thisMonth).length || 0;
      const tokensUsed = data?.reduce((sum, g) => sum + (g.tokens_used || 0), 0) || 0;

      setStats({
        totalGenerations,
        thisMonth: thisMonthCount,
        tokensUsed
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getToolIcon = (toolType) => {
    if (toolType?.includes('video') || toolType?.includes('wan') || toolType?.includes('kling') || 
        toolType?.includes('minimax') || toolType?.includes('ltxv') || toolType?.includes('seedance') ||
        toolType === 'ai_scene_gen') {
      return <Video className="w-4 h-4" />;
    } else if (toolType?.includes('music') || toolType?.includes('audio')) {
      return <Music className="w-4 h-4" />;
    } else {
      return <ImageIcon className="w-4 h-4" />;
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

  const handleDownload = async (url, filename) => {
    try {
      const response = await fetch(toCdnUrl(url));
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link
      const link = document.createElement('a');
      link.href = toCdnUrl(url);
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Dashboard</h1>
                  <p className="text-purple-200 text-sm">Welcome back, {user?.email}</p>
                </div>
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
              
              <button
                onClick={() => navigate('/settings')}
                className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold text-sm hover:from-purple-500 hover:to-pink-500 transition-all duration-200"
                title="Account Settings"
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
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-purple-200 text-sm">Available Tokens</p>
                <p className="text-2xl font-bold text-white">
                  {(profile?.tokens || 0) + (profile?.purchased_tokens || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-purple-200 text-sm">Total Generations</p>
                <p className="text-2xl font-bold text-white">{stats.totalGenerations}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-purple-200 text-sm">This Month</p>
                <p className="text-2xl font-bold text-white">{stats.thisMonth}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <p className="text-purple-200 text-sm">Tokens Used</p>
                <p className="text-2xl font-bold text-white">{stats.tokensUsed}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-6 flex items-center">
                <Plus className="w-5 h-5 mr-2" />
                Quick Actions
              </h2>
              
              <div className="space-y-3">
                {falTools.slice(0, 6).map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => navigate(tool.route)}
                    className="w-full flex items-center space-x-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-200 text-left"
                  >
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                      {getToolIcon(tool.toolType)}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">{tool.name}</p>
                      <p className="text-purple-300 text-xs">{tool.tokensRequired} tokens</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-purple-400" />
                  </button>
                ))}
                
                <button
                  onClick={() => navigate('/gallery')}
                  className="w-full flex items-center justify-center space-x-2 p-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg transition-all duration-200 text-white font-medium"
                >
                  <span>View All Tools</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Recent Generations
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={fetchRecentGenerations}
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigate('/gallery')}
                    className="text-purple-400 hover:text-purple-300 transition-colors text-sm"
                  >
                    View All
                  </button>
                </div>
              </div>

              {recentGenerations.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-purple-300" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Start Creating</h3>
                  <p className="text-purple-200 mb-6">
                    You haven't created anything yet. Choose an AI tool to get started!
                  </p>
                  <button
                    onClick={() => navigate('/flux-kontext')}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
                  >
                    Try FLUX Kontext
                  </button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {recentGenerations.map((generation) => {
                    const thumbnailUrl = getThumbnailUrl(generation);
                    const contentUrl = getContentUrl(generation, profile);
                    const isVideo = generation.tool_type?.includes('video') || 
                                   generation.tool_type?.includes('wan') || 
                                   generation.tool_type?.includes('kling') || 
                                   generation.tool_type?.includes('minimax') ||
                                   generation.tool_type === 'ai_scene_gen';
                    const isAudio = generation.tool_type?.includes('audio') || 
                                   generation.tool_type?.includes('music');

                    return (
                      <div
                        key={generation.id}
                        className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-all duration-200 cursor-pointer"
                        onClick={() => navigate('/gallery')}
                      >
                        <div className="relative">
                          {isVideo ? (
                            <OptimizedVideo
                              src={contentUrl}
                              poster={thumbnailUrl}
                              className="w-full h-32 object-cover"
                              controls={false}
                              muted
                              preloadProp="metadata"
                            />
                          ) : isAudio ? (
                            <div className="w-full h-32 bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                              <Music className="w-12 h-12 text-pink-400" />
                            </div>
                          ) : (
                            <OptimizedImage
                              src={contentUrl}
                              alt={generation.generation_name}
                              className="w-full h-32 object-cover"
                            />
                          )}
                          
                          <div className="absolute top-2 right-2 flex space-x-1">
                            <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(generation.status)}`}>
                              {generation.status}
                            </div>
                          </div>
                          
                          {isVideo && (
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <Play className="w-8 h-8 text-white" />
                            </div>
                          )}
                        </div>
                        
                        <div className="p-4">
                          <h3 className="font-medium text-white mb-1 truncate">
                            {generation.generation_name}
                          </h3>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-purple-200">{generation.tool_name}</span>
                            <span className="text-purple-300">{generation.tokens_used} tokens</span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-purple-300 text-xs">
                              {new Date(generation.created_at).toLocaleDateString()}
                            </span>
                            {generation.output_file_url && generation.status === 'completed' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(
                                    contentUrl, 
                                    `${generation.generation_name.replace(/[^a-z0-9]/gi, '_')}.${isVideo ? 'mp4' : isAudio ? 'mp3' : 'png'}`
                                  );
                                }}
                                className="text-purple-400 hover:text-purple-300 transition-colors"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subscription Status */}
        {profile?.subscription_status === 'free' && (
          <div className="mt-8 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Upgrade to Pro</h3>
                  <p className="text-purple-200">
                    Get 3,000 tokens monthly, no watermarks, and access to premium tools
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/settings?tab=billing')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
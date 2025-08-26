import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useRealtimeActivity } from '../hooks/useRealtimeActivity';
import AIToolModal from '../components/AIToolModal';
import { allTools } from '../data/data';
import EmailVerificationBanner from '../components/EmailVerificationBanner';
import { 
  Zap, 
  User, 
  LogOut, 
  CreditCard, 
  Upload, 
  Download, 
  Settings,
  Image,
  Video,
  Wand2,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Music
} from 'lucide-react';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [creationsCount, setCreationsCount] = useState(0);
  const [creationsStats, setCreationsStats] = useState({
    total: 0,
    images: 0,
    videos: 0,
    audio: 0
  });
  const [loading, setLoading] = useState(true);
  const [currentToolPage, setCurrentToolPage] = useState(0);
  const [selectedTool, setSelectedTool] = useState(null);
  const [showToolModal, setShowToolModal] = useState(false);
  const navigate = useNavigate();

  // Use real-time activity hook
  const { recentActivity, loading: activityLoading } = useRealtimeActivity(user?.id);

  const toolsPerPage = 4;
  const totalPages = Math.ceil(allTools.length / toolsPerPage);

  useEffect(() => {
    getUser();
    
    // Clean up URL hash after OAuth callback to prevent reload issues
    if (window.location.hash.includes('access_token')) {
      console.log('OAuth callback detected, cleaning URL...');
      // Clean the URL hash without triggering a reload
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  // Separate effect for IP capture to avoid infinite loops
  useEffect(() => {
    if (!user) return;
    
    // Only capture IP once per session
    const ipCaptured = sessionStorage.getItem('ip_captured');
    if (ipCaptured) return;
    
    // Check if this is an OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const isOAuthCallback = urlParams.get('type') === 'signup' || 
                           window.location.href.includes('access_token') ||
                           document.referrer.includes('accounts.google.com');
    
    if (isOAuthCallback) {
      console.log('Capturing IP for OAuth user...');
      
      const captureIP = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capture-signup-ip`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ signupType: 'oauth' })
            });
            
            // Mark as captured to prevent repeated calls
            sessionStorage.setItem('ip_captured', 'true');
            console.log('✅ OAuth IP capture completed');
          }
        } catch (ipError) {
          console.warn('OAuth IP capture failed (non-critical):', ipError);
          // Still mark as attempted to prevent infinite retries
          sessionStorage.setItem('ip_captured', 'true');
        }
      };
      
      // Small delay to ensure auth is fully processed
      setTimeout(captureIP, 1000);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchCreationsCount();
      fetchCreationsStats();
    }
  }, [user]);
  
  const getUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      setUser(user);

      // Get user profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        if (error.code === 'PGRST116') {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
              tokens: 250,
              subscription_status: 'free'
            })
            .select()
            .single();
          
          if (createError) {
            console.error('Error creating profile:', createError);
          } else {
            setProfile(newProfile);
          }
        }
      } else if (profile) {
        setProfile(profile);
      }
    } catch (error) {
      console.error('Error getting user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCreationsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('ai_generations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .eq('status', 'completed');

      if (error) {
        console.error('Error fetching creations count:', error);
      } else {
        setCreationsCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching creations count:', error);
    }
  };
  
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const fetchCreationsStats = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_generations')
        .select('tool_type')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .eq('status', 'completed');

      if (error) {
        console.error('Error fetching creations stats:', error);
        return;
      }

      const stats = { total: 0, images: 0, videos: 0, audio: 0 };
      
      data?.forEach(generation => {
        stats.total++;
        
        const toolType = generation.tool_type;
        if (toolType?.includes('video') || toolType?.includes('kling') || toolType?.includes('wan') || 
            toolType?.includes('minimax') || toolType?.includes('veo') || toolType?.includes('ltxv') || 
            toolType?.includes('seedance') || toolType === 'ai_scene_gen') {
          stats.videos++;
        } else if (toolType?.includes('music') || toolType?.includes('cassetteai')) {
          stats.audio++;
        } else {
          stats.images++;
        }
      });
      
      setCreationsStats(stats);
    } catch (error) {
      console.error('Error fetching creations stats:', error);
    }
  };

  const handleToolClick = (tool) => {
    setSelectedTool(tool);
    setShowToolModal(true);
  };

  const handleToolSuccess = (result) => {
    // Refresh profile to update token count
    getUser();
    // Refresh creations count
    fetchCreationsCount();
    // Close modal
    setShowToolModal(false);
    setSelectedTool(null);
  };

  const getCurrentTools = () => {
    const startIndex = currentToolPage * toolsPerPage;
    return allTools.slice(startIndex, startIndex + toolsPerPage);
  };

  const downloadGenerationsCSV = async () => {
    try {
      console.log('📥 Downloading generations CSV...');
      
      // Fetch all user generations
      const { data: allGenerations, error } = await supabase
        .from('ai_generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching generations:', error);
        alert('Error fetching generations data');
        return;
      }

      if (!allGenerations || allGenerations.length === 0) {
        alert('No generations found to export');
        return;
      }

      console.log(`📊 Exporting ${allGenerations.length} generations to CSV`);

      // Prepare CSV data
      const csvHeaders = [
        'Generation Name',
        'Tool Type',
        'Tool Name', 
        'Status',
        'Tokens Used',
        'Created Date',
        'Completed Date',
        'Processing Time',
        'Prompt/Description',
        'Output URL',
        'Model Used',
        'Resolution',
        'Duration',
        'Seed',
        'Request ID'
      ];

      const csvRows = allGenerations.map(gen => {
        // Extract metadata safely
        const metadata = gen.metadata || {};
        const inputData = gen.input_data || {};
        
        // Format dates
        const createdDate = new Date(gen.created_at).toLocaleString();
        const completedDate = gen.completed_at ? new Date(gen.completed_at).toLocaleString() : '';
        
        // Extract prompt/description from various possible fields
        const prompt = inputData.prompt || 
                     inputData.positivePrompt || 
                     inputData.actionDirection || 
                     inputData.action_direction || 
                     gen.generation_name || 
                     '';
        
        // Clean and escape CSV values
        const cleanValue = (value) => {
          if (value === null || value === undefined) return '';
          const str = String(value);
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        return [
          cleanValue(gen.generation_name),
          cleanValue(gen.tool_type),
          cleanValue(gen.tool_name),
          cleanValue(gen.status),
          cleanValue(gen.tokens_used),
          cleanValue(createdDate),
          cleanValue(completedDate),
          cleanValue(metadata.processing_time || ''),
          cleanValue(prompt),
          cleanValue(gen.output_file_url || ''),
          cleanValue(metadata.model || ''),
          cleanValue(inputData.resolution || metadata.resolution || ''),
          cleanValue(inputData.duration || metadata.duration || ''),
          cleanValue(metadata.seed || inputData.seed || ''),
          cleanValue(metadata.fal_request_id || metadata.request_id || '')
        ].join(',');
      });

      // Combine headers and rows
      const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `imgMotionMagic-generations-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ CSV download completed');
      
    } catch (error) {
      console.error('Error downloading CSV:', error);
      alert('Error downloading CSV file. Please try again.');
    }
  };

  const getToolIcon = (category) => {
    switch (category) {
      case 'image':
        return <Image className="w-5 h-5" />;
      case 'motion':
        return <Video className="w-5 h-5" />;
      case 'video':
        return <Video className="w-5 h-5" />;
      case 'ai':
        return <Wand2 className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
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
              <Link to="/" className="flex items-center space-x-4 hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white">imgMotion</h1>
              </Link>
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
              >
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Email Verification Banner */}
        {user && !user.email_confirmed_at && (
          <EmailVerificationBanner user={user} />
        )}

        {/* AI Generation Tools - 4 in a row */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {getCurrentTools().map((tool) => (
              <div
                key={tool.id}
                className="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-1 flex flex-col"
              >
                <div className="relative">
                  <img
                    src={tool.image}
                    alt={tool.name}
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center space-x-1">
                    <Zap className="w-3 h-3 text-purple-500" />
                    <span className="text-xs font-medium text-gray-700">{tool.tokensRequired} tokens</span>
                  </div>
                </div>
                
                <div className="p-4 flex flex-col flex-grow">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white">
                      {getToolIcon(tool.category)}
                    </div>
                    <h3 className="font-bold text-white text-sm">{tool.name}</h3>
                  </div>
                  <p className="text-purple-200 text-xs mb-3 line-clamp-2 flex-grow">{tool.description}</p>
                  
                  <button 
                    onClick={() => {
                      if (tool.comingSoon) {
                        return;
                      } else if (tool.route) {
                        navigate(tool.route);
                      } else {
                        handleToolClick(tool);
                      }
                    }}
                    className={`font-semibold py-2 px-4 rounded-lg transition-all duration-300 text-sm ${
                      tool.comingSoon 
                        ? 'bg-gray-500 text-gray-300 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                    }`}
                    disabled={tool.comingSoon}
                  >
                    {tool.comingSoon ? 'Coming Soon' : 'Try Now'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Dots */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6 space-x-2">
              {Array.from({ length: totalPages }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentToolPage(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentToolPage
                      ? 'bg-green-400'
                      : 'bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Stats Bar - My Creations */}
        <div className="mb-8">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">My Creations</h3>
              <button
                onClick={fetchCreationsStats}
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            
            {/* Stats Row */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="w-full lg:w-1/2 flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 lg:gap-6">
                {/* Total */}
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-white">{creationsStats.total}</div>
                    <div className="text-green-300 text-sm">Total</div>
                  </div>
                </div>

                {/* Videos */}
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-blue-400">{creationsStats.videos}</div>
                    <div className="text-blue-300 text-sm">Videos</div>
                  </div>
                </div>

                {/* Images */}
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <Image className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-purple-400">{creationsStats.images}</div>
                    <div className="text-purple-300 text-sm">Images</div>
                  </div>
                </div>

                {/* Audio */}
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl flex items-center justify-center">
                    <Music className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-pink-400">{creationsStats.audio}</div>
                    <div className="text-pink-300 text-sm">Audio</div>
                  </div>
                </div>
              </div>

              {/* Enter Gallery Button */}
              <div className="w-full lg:w-1/2 lg:pl-6 flex justify-center lg:justify-end">
                <button 
                  onClick={() => navigate('/gallery')}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center space-x-3 w-full max-w-xs justify-center text-lg"
                >
                  <Upload className="w-5 h-5" />
                  <span>Enter Gallery</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - Recent Activity & Quick Actions */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Recent Activity */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {!activityLoading && recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div key={activity.id} className="flex items-center space-x-4 py-3 border-b border-white/10 last:border-b-0">
                    <button 
                      onClick={() => navigate('/gallery')}
                      className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center hover:from-purple-600 hover:to-pink-600 transition-all duration-200 cursor-pointer"
                    >
                      <Upload className="w-5 h-5 text-white" />
                    </button>
                    <div className="flex-1">
                      <p className="text-white font-medium">{activity.generation_name}</p>
                      <p className="text-purple-200 text-sm">
                        {new Date(activity.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })} • {activity.tokens_used} tokens used • {activity.tool_name}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      activity.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      activity.status === 'processing' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {activity.status}
                    </div>
                  </div>
                ))
              ) : activityLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-purple-200">Loading activity...</div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-8 h-8 text-purple-300" />
                    </div>
                    <p className="text-purple-200 text-lg font-medium opacity-50">No recent activity</p>
                    <p className="text-purple-300 text-sm opacity-50">Start creating to see your activity here</p>
                  </div>
                </div>
              )}
            </div>

            {/* Download CSV Button */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <button
                onClick={downloadGenerationsCSV}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download All Generations (CSV)</span>
              </button>
            </div>
          </div>

          {/* Right Column - Available Tokens, Upgrade CTA, Quick Actions */}
          <div className="space-y-6">
            {/* Available Tokens */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-2">Available Tokens</h3>
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <Zap className="w-8 h-8 text-purple-400" />
                  <span className="text-4xl font-bold text-white">
                    {(profile?.tokens || 0) + (profile?.purchased_tokens || 0)}
                  </span>
                </div>
                <div className="text-sm text-purple-300 space-y-1">
                  <div>Subscription: {profile?.tokens || 0}</div>
                  <div>Purchased: {profile?.purchased_tokens || 0}</div>
                </div>
              </div>
            </div>

            {/* Upgrade Call-to-Action */}
            <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 backdrop-blur-md rounded-2xl p-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Need More Tokens?</h3>
                <p className="text-orange-200 text-sm mb-4">
                  Upgrade to Pro or Business for unlimited creativity with thousands of tokens monthly
                </p>
                <button
                  onClick={() => navigate('/settings?tab=billing')}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
                >
                  Upgrade Now
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => navigate('/flux-kontext')}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 text-sm"
                >
                  Create AI Image
                </button>
                <button 
                  onClick={() => navigate('/kling-pro')}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 text-sm"
                >
                  Create Img2Videos
                </button>
                <button 
                  onClick={() => navigate('/ltxv-video')}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 text-sm"
                >
                  Advanced Video Creator
                </button>
                <button 
                  onClick={() => navigate('/cassetteai-music')}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 text-sm"
                >
                  Retro Music Maker
                </button>
                <button 
                  onClick={() => navigate('/mmaudio-v2')}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 text-sm flex items-center justify-center space-x-2"
                >
                  <span>MMAudio v2 - Advanced</span>
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">NEW</span>
                </button>
                <button 
                  onClick={() => navigate('/mmaudio-video2')}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 text-sm flex items-center justify-center space-x-2"
                >
                  <span>Sync Audio for Video - NEW</span>
                  <span className="bg-cyan-500 text-white text-xs px-2 py-0.5 rounded-full">NEW</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* AI Tool Modal */}
      <AIToolModal
        tool={selectedTool}
        isOpen={showToolModal}
        onClose={() => {
          setShowToolModal(false);
          setSelectedTool(null);
        }}
        user={user}
        profile={profile}
        onSuccess={handleToolSuccess}
      />
    </div>
  );
};

export default Dashboard;
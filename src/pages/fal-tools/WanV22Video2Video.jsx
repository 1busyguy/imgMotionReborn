import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { createAIGeneration, updateTokenCount, uploadFile } from '../../utils/storageHelpers';
import { isNSFWError, parseNSFWError } from '../../utils/errorHandlers';
import { toCdnUrl } from '../../utils/cdnHelpers';
import { performSafetyAnalysis, shouldShowWarning, getSafetyWarningMessage, logSafetyAnalysis } from '../../utils/safescan';
import NSFWAlert from '../../components/NSFWAlert';
import SafetyWarningModal from '../../components/SafetyWarningModal';
import ThemedAlert from '../../components/ThemedAlert';
import { 
  ArrowLeft, 
  Zap, 
  Video, 
  Upload, 
  Download, 
  Trash2, 
  RefreshCw,
  Settings,
  Copy,
  X,
  Play,
  Clock,
  Film,
  Wand2,
  Monitor,
  Smartphone,
  Square,
  Sliders,
  Dice6,
  Layers
} from 'lucide-react';

const WanV22Video2Video = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state - based on WAN v2.2-a14b Video2Video API
  const [config, setConfig] = useState({
    videoUrl: '',
    prompt: '',
    negativePrompt: '',
    strength: 1,
    numFrames: 121,
    framesPerSecond: 24,
    resolution: '720p',
    aspectRatio: 'auto',
    numInferenceSteps: 30,
    enableSafetyChecker: false,
    enablePromptExpansion: true,
    acceleration: 'none',
    guidanceScale: 10,
    guidanceScale2: 10,
    shift: 10,
    interpolatorModel: 'film',
    numInterpolatedFrames: 4,
    adjustFpsForInterpolation: true,
    resampleFps: true,
    seed: -1
  });
  
  // Generation state
  const [generations, setGenerations] = useState([]);
  const [activeGenerations, setActiveGenerations] = useState([]);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [showNSFWAlert, setShowNSFWAlert] = useState(false);
  const [nsfwError, setNsfwError] = useState(null);
  const [videoAnalysis, setVideoAnalysis] = useState(null);
  const [analyzingVideo, setAnalyzingVideo] = useState(false);
  const [showSafetyWarning, setShowSafetyWarning] = useState(false);
  const [safetyWarningData, setSafetyWarningData] = useState(null);
  const [bypassSafetyCheck, setBypassSafetyCheck] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    show: false,
    type: 'error',
    title: '',
    message: ''
  });

  // Resolution options
  const resolutionOptions = [
    { label: '720p (HD)', value: '720p' },
    { label: '1080p (Full HD)', value: '1080p' }
  ];

  // Aspect ratio options
  const aspectRatioOptions = [
    { label: 'Auto (Keep Original)', value: 'auto' },
    { label: 'Landscape (16:9)', value: '16:9' },
    { label: 'Portrait (9:16)', value: '9:16' },
    { label: 'Square (1:1)', value: '1:1' }
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription for this specific tool type
      const subscription = supabase
        .channel('wan_v22_video2video_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id},tool_type=eq.fal_wan_v22_video2video`
          },
          (payload) => {
            console.log('Real-time update received:', payload);
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

      console.log('Real-time subscription set up for WAN v2.2 Video2Video');
      return () => subscription.unsubscribe();
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

  const fetchGenerations = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_generations')
        .select('*')
        .eq('user_id', user.id)
        .eq('tool_type', 'fal_wan_v22_video2video')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setGenerations(data || []);
      setActiveGenerations(data?.filter(g => g.status === 'processing') || []);
    } catch (error) {
      console.error('Error fetching generations:', error);
    }
  };

  const handleRealtimeUpdate = (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    console.log('Processing real-time update:', { eventType, newRecord, oldRecord });

    setGenerations(current => {
      switch (eventType) {
        case 'INSERT':
          console.log('Adding new generation to list');
          return [newRecord, ...current];
        case 'UPDATE':
          console.log('Updating existing generation');
          return current.map(item => 
            item.id === newRecord.id ? newRecord : item
          );
        case 'DELETE':
          console.log('Removing generation from list');
          return current.filter(item => item.id !== oldRecord.id);
        default:
          return current;
      }
    });

    // Update active generations
    if (newRecord?.status === 'processing') {
      console.log('Adding to active generations');
      setActiveGenerations(current => {
        const exists = current.find(g => g.id === newRecord.id);
        return exists ? current.map(g => g.id === newRecord.id ? newRecord : g) : [newRecord, ...current];
      });
    } else if (newRecord?.status === 'completed' || newRecord?.status === 'failed') {
      console.log('Removing from active generations');
      setActiveGenerations(current => current.filter(g => g.id !== newRecord?.id));
    }
  };

  // Show themed alert
  const showAlert = (type, title, message, autoClose = true) => {
    setAlertConfig({
      show: true,
      type,
      title,
      message
    });
    
    if (autoClose) {
      setTimeout(() => {
        setAlertConfig(prev => ({ ...prev, show: false }));
      }, 5000);
    }
  };

  // Close alert
  const closeAlert = () => {
    setAlertConfig(prev => ({ ...prev, show: false }));
  };

  // Analyze video to get basic info
  const analyzeVideo = (file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        const width = video.videoWidth;
        const height = video.videoHeight;
        const duration = video.duration;
        
        resolve({
          width,
          height,
          duration,
          resolution: `${width}x${height}`,
          aspectRatio: width > height ? 'landscape' : height > width ? 'portrait' : 'square'
        });
        
        // Clean up
        URL.revokeObjectURL(video.src);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Failed to analyze video'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  const handleVideoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      alert('File size must be less than 100MB');
      return;
    }

    setUploadingVideo(true);
    setAnalyzingVideo(true);
    try {
      // First analyze the video
      const analysis = await analyzeVideo(file);
      console.log('Video analysis:', analysis);
      setVideoAnalysis(analysis);
      
      // Then upload to storage
      const { url } = await uploadFile(file, 'wan-v22-video2video-input');
      setConfig(prev => ({ ...prev, videoUrl: url }));
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Error uploading video. Please try again.');
    } finally {
      setAnalyzingVideo(false);
      setUploadingVideo(false);
    }
  };

  const calculateTokenCost = () => {
    // Base cost calculation for video transformation
    let baseCost = 25;
    
    // Adjust based on resolution
    if (config.resolution === '1080p') {
      baseCost *= 1.5;
    }
    
    // Adjust based on number of frames
    if (config.numFrames > 81) {
      baseCost *= 1.2;
    }
    
    return Math.ceil(baseCost);
  };

  const handleGenerate = async () => {
    if (!config.videoUrl) {
      alert('Please upload a video');
      return;
    }

    if (!config.prompt.trim()) {
      alert('Please enter a transformation prompt');
      return;
    }

    // --- SAFETY SCAN INTEGRATION ---
    if (!bypassSafetyCheck) {
      try {
        const analysisResult = await performSafetyAnalysis(
          null, // No image analysis for video input
          config.prompt,
          'fal_wan_v22_video2video'
        );

        logSafetyAnalysis(analysisResult, 'pre_generation_check');

        if (shouldShowWarning(analysisResult)) {
          setSafetyWarningData(getSafetyWarningMessage(analysisResult));
          setShowSafetyWarning(true);
          return;
        }
      } catch (safetyError) {
        console.warn('Safety analysis failed, proceeding with generation:', safetyError);
      }
    }

    setBypassSafetyCheck(false);

    const tokenCost = calculateTokenCost();
    const totalTokens = (profile.tokens || 0) + (profile.purchased_tokens || 0);
    if (totalTokens < tokenCost) {
      alert('Insufficient tokens. Please upgrade your plan.');
      return;
    }

    setGenerating(true);
    try {
      console.log('🎬 Starting WAN v2.2 Video2Video generation...');
      
      // Create generation record
      const generation = await createAIGeneration(
        'fal_wan_v22_video2video',
        `Video Transform: ${config.prompt.substring(0, 30)}...`,
        config,
        tokenCost
      );

      console.log('📝 Generation record created:', generation.id);

      // Add to local state immediately
      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      // Deduct tokens
      await updateTokenCount(user.id, tokenCost);
      
      // Refresh profile
      await fetchProfile();

      console.log('💰 Tokens deducted, calling Edge Function...');

      // Call Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-wan-v22-video2video`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationId: generation.id,
          ...config
        })
      });

      console.log('Edge Function response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Edge Function error:', errorData);
        throw new Error(errorData.error || 'Video transformation failed');
      }

      const result = await response.json();
      console.log('Edge Function result:', result);

      // Clear prompt after successful generation
      setConfig(prev => ({ ...prev, prompt: '' }));

      console.log('🎉 Video transformation request completed successfully');

    } catch (error) {
      console.error('❌ Error generating:', error);
      
      // Check if it's an NSFW content error
      if (isNSFWError(error.message)) {
        const nsfwDetails = parseNSFWError(error.message);
        setNsfwError(nsfwDetails);
        setShowNSFWAlert(true);
      } else {
        showAlert('error', 'Generation Failed', `WAN v2.2 Video2Video generation failed: ${error.message}`);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (videoUrl) => {
    try {
      const response = await fetch(toCdnUrl(videoUrl));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wan-v22-video2video-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link
      const link = document.createElement('a');
      link.href = toCdnUrl(videoUrl);
      link.download = `wan-v22-video2video-${Date.now()}.mp4`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDelete = async (generationId) => {
    if (!confirm('Are you sure you want to remove this generation? It will be hidden from your account.')) return;

    try {
      // Use soft delete function instead of hard delete
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
                <span className="hidden sm:inline">Back to Dashboard</span>
              </button>
              <div className="h-6 w-px bg-white/20"></div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">WAN v2.2 Video2Video</h1>
                  <p className="text-purple-200 text-sm">Transform existing videos with advanced AI - change style, content, and motion</p>
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
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Themed Alert */}
        <ThemedAlert
          type={alertConfig.type}
          title={alertConfig.title}
          message={alertConfig.message}
          isOpen={alertConfig.show}
          onClose={closeAlert}
        />
        
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Configuration Panel - Left Side */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sticky top-8">
              <div className="flex items-center space-x-2 mb-6">
                <Settings className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">Video Transformation</h2>
              </div>

              <div className="space-y-6">
                {/* Video Upload */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Video className="w-4 h-4 inline mr-1" />
                    Source Video *
                  </label>
                  <div 
                    className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center transition-colors hover:border-white/50"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('border-indigo-400', 'bg-indigo-500/10');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-500/10');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-500/10');
                      const files = e.dataTransfer.files;
                      if (files.length > 0) {
                        const event = { target: { files } };
                        handleVideoUpload(event);
                      }
                    }}
                  >
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                      id="video-upload"
                      disabled={uploadingVideo}
                    />
                    <label htmlFor="video-upload" className="cursor-pointer">
                      {config.videoUrl ? (
                        <div className="space-y-2">
                          <video 
                            src={config.videoUrl} 
                            className="w-full h-32 object-cover rounded-lg bg-black/20"
                            muted
                            preload="metadata"
                          />
                          <p className="text-purple-200 text-sm">
                            {analyzingVideo ? 'Analyzing video...' : 'Click to change'}
                          </p>
                          {videoAnalysis && (
                            <div className="text-xs text-green-300 bg-green-500/10 rounded p-2">
                              <p>Resolution: {videoAnalysis.resolution}</p>
                              <p>Duration: {Math.round(videoAnalysis.duration)}s</p>
                              <p>Aspect: {videoAnalysis.aspectRatio}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                          <p className="text-purple-200">
                            {uploadingVideo ? 'Uploading...' : 
                             analyzingVideo ? 'Analyzing...' : 
                             'Upload or drag & drop video'}
                          </p>
                          <p className="text-purple-300 text-xs mt-1">
                            Transform existing videos with AI • Drag & drop supported
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Transformation Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Wand2 className="w-4 h-4 inline mr-1" />
                    Transformation Prompt *
                  </label>
                  <textarea
                    value={config.prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Describe how you want to transform the video..."
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={3}
                  />
                  <p className="text-purple-300 text-xs mt-1">
                    Describe style changes, content modifications, or motion adjustments
                  </p>
                </div>

                {/* Negative Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Negative Prompt (Optional)
                  </label>
                  <textarea
                    value={config.negativePrompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, negativePrompt: e.target.value }))}
                    placeholder="What you don't want in the transformed video..."
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={2}
                  />
                </div>

                {/* Transformation Strength */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Sliders className="w-4 h-4 inline mr-1" />
                    Transformation Strength: {config.strength}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.strength}
                    onChange={(e) => setConfig(prev => ({ ...prev, strength: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>Subtle</span>
                    <span>Balanced</span>
                    <span>Strong</span>
                  </div>
                </div>

                {/* Resolution */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Monitor className="w-4 h-4 inline mr-1" />
                    Output Resolution
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {resolutionOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setConfig(prev => ({ ...prev, resolution: option.value }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          config.resolution === option.value
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Aspect Ratio
                  </label>
                  <select
                    value={config.aspectRatio}
                    onChange={(e) => setConfig(prev => ({ ...prev, aspectRatio: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {aspectRatioOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-gray-800">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Advanced Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Advanced Settings</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Guidance Scale: {config.guidanceScale}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="0.5"
                      value={config.guidanceScale}
                      onChange={(e) => setConfig(prev => ({ ...prev, guidanceScale: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Inference Steps: {config.numInferenceSteps}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={config.numInferenceSteps}
                      onChange={(e) => setConfig(prev => ({ ...prev, numInferenceSteps: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      <Dice6 className="w-4 h-4 inline mr-1" />
                      Seed (-1 for random)
                    </label>
                    <input
                      type="number"
                      value={config.seed}
                      onChange={(e) => setConfig(prev => ({ ...prev, seed: parseInt(e.target.value) }))}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm">Safety Checker</label>
                    <input
                      type="checkbox"
                      checked={config.enableSafetyChecker}
                      onChange={(e) => setConfig(prev => ({ ...prev, enableSafetyChecker: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 bg-white/10 border-white/20 rounded focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm">Prompt Expansion</label>
                    <input
                      type="checkbox"
                      checked={config.enablePromptExpansion}
                      onChange={(e) => setConfig(prev => ({ ...prev, enablePromptExpansion: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 bg-white/10 border-white/20 rounded focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.videoUrl || !config.prompt.trim()}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Transforming Video...</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      <span>Transform Video ({calculateTokenCost()} tokens)</span>
                    </>
                  )}
                </button>

                {/* Processing Note */}
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3">
                  <p className="text-indigo-200 text-xs">
                    <Film className="w-3 h-3 inline mr-1" />
                    Video transformation may take 3-8 minutes. Cost varies by resolution and complexity.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Generations Panel - Right Side */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {/* Active Generations */}
              {activeGenerations.length > 0 && (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin" />
                    <h3 className="text-lg font-semibold text-white">Transforming Videos ({activeGenerations.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {activeGenerations.map((generation) => (
                      <div key={generation.id} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{generation.generation_name}</p>
                            <p className="text-purple-200 text-sm">
                              Started: {new Date(generation.created_at).toLocaleTimeString()}
                            </p>
                            <p className="text-purple-300 text-xs mt-1">
                              Video transformation typically takes 3-8 minutes
                            </p>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse animation-delay-200"></div>
                              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse animation-delay-400"></div>
                            </div>
                            <span className="text-yellow-400 text-sm">Processing</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Generations */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Transformed Videos</h3>
                  <button
                    onClick={fetchGenerations}
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {generations.length === 0 ? (
                  <div className="text-center py-12">
                    <Layers className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                    <p className="text-purple-200 text-lg">No videos transformed yet</p>
                    <p className="text-purple-300 text-sm">Upload a video and describe how you want to transform it</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {generations.map((generation) => (
                      <div
                        key={generation.id}
                        className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-all duration-200"
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-medium text-white">
                                {generation.generation_name}
                              </h4>
                              <p className="text-purple-200 text-sm">
                                {new Date(generation.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(generation.status)}`}>
                              {generation.status}
                            </div>
                          </div>

                          {generation.output_file_url && generation.status === 'completed' && (
                            <div className="mb-4">
                              <video
                                src={toCdnUrl(generation.output_file_url)}
                                controls
                                className="w-full rounded-lg max-h-96"
                                preload="metadata"
                              >
                                Your browser does not support the video tag.
                              </video>
                            </div>
                          )}

                          {generation.status === 'processing' && (
                            <div className="mb-4 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-lg p-8 text-center">
                              <RefreshCw className="w-12 h-12 text-indigo-300 animate-spin mx-auto mb-2" />
                              <p className="text-indigo-200">Transforming video...</p>
                              <p className="text-indigo-300 text-sm">This may take 3-8 minutes</p>
                            </div>
                          )}

                          {generation.status === 'failed' && (
                            <div className="mb-4 bg-red-500/20 rounded-lg p-4 text-center">
                              <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                              <p className="text-red-400 text-sm">Transformation failed</p>
                            </div>
                          )}

                          <div className="space-y-2 text-sm text-purple-300">
                            <p>
                              <strong>Transformation:</strong> {generation.input_data?.prompt}
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                              <span>
                                <strong>Strength:</strong> {generation.input_data?.strength}
                              </span>
                              <span>
                                <strong>Resolution:</strong> {generation.input_data?.resolution}
                              </span>
                              <span>
                                <strong>Frames:</strong> {generation.input_data?.numFrames}
                              </span>
                              <span>
                                <strong>Tokens:</strong> {generation.tokens_used}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center space-x-4">
                              {generation.input_data?.prompt && (
                                <button
                                  onClick={() => copyPrompt(generation.input_data.prompt)}
                                  className="text-purple-400 hover:text-purple-300 transition-colors"
                                  title="Copy prompt"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              {generation.output_file_url && generation.status === 'completed' && (
                                <button
                                  onClick={() => handleDownload(generation.output_file_url)}
                                  className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors"
                                  title="Download video"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(generation.id)}
                                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                                title="Delete generation"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NSFW Alert Modal */}
      <NSFWAlert
        isOpen={showNSFWAlert}
        onClose={() => {
          setShowNSFWAlert(false);
          setNsfwError(null);
        }}
        toolName="WAN v2.2 Video2Video"
        details={nsfwError?.technical}
      />

      {/* Safety Warning Modal */}
      <SafetyWarningModal
        isOpen={showSafetyWarning}
        onClose={() => {
          setShowSafetyWarning(false);
          setSafetyWarningData(null);
        }}
        onContinue={() => {
          setBypassSafetyCheck(true);
          setShowSafetyWarning(false);
          setSafetyWarningData(null);
          setTimeout(() => handleGenerate(), 100);
        }}
        onModify={() => {
          setShowSafetyWarning(false);
          setSafetyWarningData(null);
        }}
        warningData={safetyWarningData}
        toolName="WAN v2.2 Video2Video"
      />

      {/* Custom Styles */}
      <style>{`
        .animation-delay-200 {
          animation-delay: 200ms;
        }
        .animation-delay-400 {
          animation-delay: 400ms;
        }
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #6366F1, #8B5CF6);
          cursor: pointer;
          border: 2px solid white;
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #6366F1, #8B5CF6);
          cursor: pointer;
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
};

export default WanV22Video2Video;
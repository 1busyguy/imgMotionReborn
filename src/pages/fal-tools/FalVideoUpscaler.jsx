import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { createAIGeneration, updateTokenCount, uploadFile } from '../../utils/storageHelpers';
import { isNSFWError, parseNSFWError } from '../../utils/errorHandlers';
import { toCdnUrl } from '../../utils/cdnHelpers';
import { performSafetyAnalysis, shouldShowWarning, getSafetyWarningMessage, logSafetyAnalysis } from '../../utils/safescan';
import NSFWAlert from '../../components/NSFWAlert';
import ThemedAlert from '../../components/ThemedAlert';
import SafetyWarningModal from '../../components/SafetyWarningModal';
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
  TrendingUp,
  Film,
  Monitor,
  Smartphone,
  Square,
  Maximize2
} from 'lucide-react';

const FalVideoUpscaler = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state - based on FAL Video Upscaler API
  const [config, setConfig] = useState({
    videoUrl: '',
    scale: 2
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

  // Scale options
  const scaleOptions = [
    { label: '2x Upscale', value: 2, description: 'Double the resolution' },
    { label: '4x Upscale', value: 4, description: 'Quadruple the resolution' }
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription for this specific tool type
      const subscription = supabase
        .channel('fal_video_upscaler_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id},tool_type=eq.fal_video_upscaler`
          },
          (payload) => {
            console.log('🔄 FAL Video Upscaler Real-time update received:', payload);
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

      console.log('Real-time subscription set up for FAL Video Upscaler');
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
        .eq('tool_type', 'fal_video_upscaler')
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
    
    console.log('🔄 Processing real-time update:', { eventType, newRecord, oldRecord });

    setGenerations(current => {
      switch (eventType) {
        case 'INSERT':
          console.log('➕ Adding new generation to list');
          return [newRecord, ...current];
        case 'UPDATE':
          console.log('🔄 Updating existing generation');
          const updated = current.map(item => 
            item.id === newRecord.id ? newRecord : item
          );
          
          // Debug the update
          if (newRecord.status === 'completed') {
            console.log('✅ Generation completed! Output URL:', newRecord.output_file_url);
          }
          
          return updated;
        case 'DELETE':
          console.log('🗑️ Removing generation from list');
          return current.filter(item => item.id !== oldRecord.id);
        default:
          return current;
      }
    });

    // Update active generations
    if (newRecord?.status === 'processing') {
      console.log('⏳ Adding to active generations');
      setActiveGenerations(current => {
        const exists = current.find(g => g.id === newRecord.id);
        return exists ? current.map(g => g.id === newRecord.id ? newRecord : g) : [newRecord, ...current];
      });
    } else if (newRecord?.status === 'completed' || newRecord?.status === 'failed') {
      console.log('✅ Removing from active generations - Status:', newRecord.status);
      setActiveGenerations(current => current.filter(g => g.id !== newRecord?.id));
      
      if (newRecord?.status === 'completed' && newRecord?.output_file_url) {
        console.log('🎉 Video upscaling completed successfully! Has output:', !!newRecord.output_file_url);
      }
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

  // Analyze video to get dimensions and calculate megapixels
  const analyzeVideo = (file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        const width = video.videoWidth;
        const height = video.videoHeight;
        const duration = video.duration;
        const frameRate = 30; // Standard frame rate for calculation
        const totalFrames = Math.round(duration * frameRate);
        
        // Calculate megapixels for original video
        const megapixels = (width * height) / 1000000;
        
        resolve({
          width,
          height,
          duration,
          frameRate,
          totalFrames,
          megapixels,
          resolution: `${width}x${height}`
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
      showAlert('error', 'Invalid File Type', 'Please select a video file (MP4, MOV, AVI, etc.)');
      return;
    }

    if (file.size > 100 * 1024 * 1024) { // 50MB limit for videos
      showAlert('error', 'File Too Large', 'Video file size must be less than 100MB. Please compress your video or select a smaller file.');
      return;
    }

    setUploadingVideo(true);
    setAnalyzingVideo(true);
    try {
      // First analyze the video locally
      const analysis = await analyzeVideo(file);
      console.log('Video analysis:', analysis);
      
      // Check frame limit (1000 frames max)
      if (analysis.totalFrames > 1000) {
        showAlert(
          'error', 
          'Video Too Long', 
          `Your video has ${analysis.totalFrames} frames, but the maximum allowed is 1000 frames. Please upload a shorter video or reduce the frame rate.`,
          false // Don't auto-close this important error
        );
        return;
      }
      
      setVideoAnalysis(analysis);
      
      // Then upload to storage
      const { url } = await uploadFile(file, 'video-upscaler-input');
      setConfig(prev => ({ ...prev, videoUrl: url }));
    } catch (error) {
      console.error('Error uploading video:', error);
      showAlert('error', 'Upload Failed', `Error uploading video: ${error.message}. Please try again.`);
    } finally {
      setAnalyzingVideo(false);
    }
    
    try {
      // Continue with upload process
    } finally {
      setUploadingVideo(false);
    }
  };

  const calculateTokenCost = () => {
    if (!videoAnalysis) {
      return 5; // Fallback to minimum cost if no analysis
    }
    
    const { width, height, totalFrames, duration, frameRate } = videoAnalysis;
    
    // Calculate upscaled dimensions
    const upscaledWidth = width * config.scale;
    const upscaledHeight = height * config.scale;
    
    // Calculate megapixels per frame for upscaled video
    const megapixels = (upscaledWidth * upscaledHeight) / 1000000; // Convert to megapixels
    
    // Multiply by total frames (duration × fps)
    const totalMegapixels = megapixels * totalFrames;
    
    // Cost calculation: $0.001333 per megapixel × total frames, $0.01 per token
    const costPerMegapixel = 0.001333;
    const costPerToken = 0.01;
    const totalCostUSD = totalMegapixels * costPerMegapixel;
    const totalTokens = Math.ceil(totalCostUSD / costPerToken);
    
    // Minimum cost of 5 tokens
    return Math.max(5, totalTokens);
  };

  const handleGenerate = async () => {
    if (!config.videoUrl) {
      showAlert('warning', 'No Video Selected', 'Please upload a video file before starting the upscaling process.');
      return;
    }

    // --- SAFETY SCAN INTEGRATION ---
    if (!bypassSafetyCheck) {
      try {
        const analysisResult = await performSafetyAnalysis(
          null, // No image analysis for video input
          null, // No prompt for video upscaling
          'fal_video_upscaler'
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
      showAlert(
        'error', 
        'Insufficient Tokens', 
        `You need ${tokenCost} tokens but only have ${totalTokens}. Please purchase more tokens or upgrade your plan.`
      );
      return;
    }

    setGenerating(true);
    try {
      console.log('🚀 Starting FAL Video Upscaler generation...');
      
      // Create generation record
      const generation = await createAIGeneration(
        'fal_video_upscaler',
        `Video Upscale ${config.scale}x`,
        config,
        tokenCost
      );

      console.log('📝 Generation record created:', generation.id);

      // Immediately add to local state for instant UI feedback
      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      // Deduct tokens
      await updateTokenCount(user.id, tokenCost);
      
      // Refresh profile to get accurate token counts from database
      await fetchProfile();

      console.log('💰 Tokens deducted, calling Edge Function...');

      // Call Edge Function using direct fetch (same pattern as MinimaxHailuo, WanPro, etc.)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-video-upscaler`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationId: generation.id,
          ...config,
          videoAnalysis: videoAnalysis
        })
      });

      console.log('Edge Function response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Edge Function error:', errorData);
        throw new Error(errorData.error || 'Video upscaling failed');
      }

      const result = await response.json();
      console.log('Edge Function result:', result);

      console.log('🎉 Video upscaling request completed successfully');

    } catch (error) {
      console.error('❌ Error generating:', error);
      
      // Check if it's an NSFW content error
      if (isNSFWError(error.message)) {
        const nsfwDetails = parseNSFWError(error.message);
        setNsfwError(nsfwDetails);
        setShowNSFWAlert(true);
      } else {
        showAlert('error', 'Generation Failed', `Video upscaling failed: ${error.message}`);
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
      link.download = `upscaled-video-${config.scale}x-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link
      const link = document.createElement('a');
      link.href = toCdnUrl(videoUrl);
      link.download = `upscaled-video-${config.scale}x-${Date.now()}.mp4`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDelete = async (generationId) => {
    if (!window.confirm('Are you sure you want to remove this generation? It will be hidden from your account.')) return;

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
      showAlert('error', 'Remove Failed', 'Error removing generation. Please try again.');
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
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">FAL Video Upscaler</h1>
                  <p className="text-purple-200 text-sm">Enhance video quality with AI-powered upscaling</p>
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
                <h2 className="text-lg font-semibold text-white">Upscaling Configuration</h2>
              </div>

              <div className="space-y-6">
                {/* Video Upload */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Video className="w-4 h-4 inline mr-1" />
                    Source Video * (1000 frames limit)
                  </label>
                  <div 
                    className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center transition-colors hover:border-white/50"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('border-green-400', 'bg-green-500/10');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-green-400', 'bg-green-500/10');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-green-400', 'bg-green-500/10');
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
                            loading="lazy"
                          />
                          <p className="text-purple-200 text-sm">
                            {analyzingVideo ? 'Analyzing video...' : 'Click to change'}
                          </p>
                          {videoAnalysis && (
                            <div className="text-xs text-purple-300 space-y-1">
                              <p>Resolution: {videoAnalysis.resolution}</p>
                              <p>Duration: {Math.round(videoAnalysis.duration)}s</p>
                              <p>Frames: {videoAnalysis.totalFrames}</p>
                              <p>Total Pixels: {(videoAnalysis.totalPixels / 1000000).toFixed(1)}M</p>
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
                            MP4, MOV, AVI • Max 100MB • Max 1000 frames • Drag & drop supported
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Scale Factor */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <TrendingUp className="w-4 h-4 inline mr-1" />
                    Upscaling Factor
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {scaleOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setConfig(prev => ({ ...prev, scale: option.value }))}
                        className={`px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${
                          config.scale === option.value
                            ? 'bg-green-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{option.label}</span>
                          {videoAnalysis && (
                            <span className="text-xs opacity-75">
                              {calculateTokenCost()} tokens
                            </span>
                          )}
                        </div>
                        <p className="text-xs opacity-75 mt-1">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cost Breakdown */}
                {videoAnalysis && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <h3 className="text-green-200 font-medium mb-2 flex items-center">
                      <Zap className="w-4 h-4 mr-2" />
                      Cost Calculation
                    </h3>
                    <div className="text-green-300 text-sm space-y-1">
                      <p>Original: {videoAnalysis.width} × {videoAnalysis.height}</p>
                      <p>Upscaled: {videoAnalysis.width * config.scale} × {videoAnalysis.height * config.scale}</p>
                      <p>Upscaled MP: {((videoAnalysis.width * config.scale * videoAnalysis.height * config.scale) / 1000000).toFixed(2)}MP per frame</p>
                      <p>Duration: {Math.round(videoAnalysis.duration)}s × {videoAnalysis.frameRate} fps</p>
                      <p>Total Frames: {videoAnalysis.totalFrames}</p>
                      <p>Total MP: {((videoAnalysis.width * config.scale * videoAnalysis.height * config.scale * videoAnalysis.totalFrames) / 1000000).toFixed(1)}MP</p>
                      <p>Formula: {((videoAnalysis.width * config.scale * videoAnalysis.height * config.scale) / 1000000).toFixed(2)}MP × {videoAnalysis.totalFrames} frames</p>
                      <p>Cost: ${((videoAnalysis.width * config.scale * videoAnalysis.height * config.scale * videoAnalysis.totalFrames) / 1000000 * 0.001333).toFixed(4)} USD</p>
                      <p className="font-medium">Total: {calculateTokenCost()} tokens</p>
                    </div>
                  </div>
                )}

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.videoUrl || analyzingVideo}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Upscaling Video...</span>
                    </>
                  ) : analyzingVideo ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analyzing Video...</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4" />
                      <span>Upscale Video ({calculateTokenCost()} tokens)</span>
                    </>
                  )}
                </button>

                {/* Processing Note */}
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-green-200 text-xs">
                    <Film className="w-3 h-3 inline mr-1" />
                    Video upscaling may take 3-8 minutes. Cost: $0.001333 per megapixel of upscaled video.
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
                    <h3 className="text-lg font-semibold text-white">Processing Videos ({activeGenerations.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {activeGenerations.map((generation) => (
                      <div key={generation.id} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{generation.generation_name}</p>
                            <p className="text-purple-200 text-sm">
                              Scale: {generation.input_data?.scale}x • 
                              Started: {new Date(generation.created_at).toLocaleTimeString()}
                            </p>
                            <p className="text-purple-300 text-xs mt-1">
                              Video upscaling typically takes 3-8 minutes
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
                  <h3 className="text-lg font-semibold text-white">Upscaled Videos</h3>
                  <button
                    onClick={fetchGenerations}
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {generations.length === 0 ? (
                  <div className="text-center py-12">
                    <TrendingUp className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                    <p className="text-purple-200 text-lg">No videos upscaled yet</p>
                    <p className="text-purple-300 text-sm">Upload a video to enhance its quality with AI upscaling</p>
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
                            <div className="mb-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg p-8 text-center">
                              <RefreshCw className="w-12 h-12 text-green-300 animate-spin mx-auto mb-2" />
                              <p className="text-green-200">Upscaling video quality...</p>
                              <p className="text-green-300 text-sm">This may take 3-8 minutes</p>
                            </div>
                          )}

                          {generation.status === 'failed' && (
                            <div className="mb-4 bg-red-500/20 rounded-lg p-4 text-center">
                              <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                              <p className="text-red-400 text-sm">Upscaling failed</p>
                            </div>
                          )}

                          <div className="space-y-2 text-sm text-purple-300">
                            <div className="flex items-center justify-between">
                              <span>
                                <strong>Scale Factor:</strong> {generation.input_data?.scale}x
                              </span>
                              <span>
                                <strong>Tokens Used:</strong> {generation.tokens_used}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end mt-4 space-x-2">
                            {generation.output_file_url && generation.status === 'completed' && (
                              <button
                                onClick={() => handleDownload(generation.output_file_url)}
                                className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors"
                                title="Download upscaled video"
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
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generation Detail Modal */}
      {selectedGeneration && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">{selectedGeneration.generation_name}</h3>
                <button
                  onClick={() => setSelectedGeneration(null)}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {selectedGeneration.output_file_url && (
                <div className="mb-6">
                  <video
                    src={toCdnUrl(selectedGeneration.output_file_url)}
                    controls
                    className="w-full max-h-96 rounded-lg"
                    preload="metadata"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Generation Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-purple-200">Status:</span>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedGeneration.status)}`}>
                        {selectedGeneration.status}
                      </span>
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
                    {selectedGeneration.metadata?.fal_request_id && (
                      <div className="flex justify-between">
                        <span className="text-purple-200">FAL Request ID:</span>
                        <span className="text-white text-xs">{selectedGeneration.metadata.fal_request_id}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Configuration</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-purple-200">Scale Factor:</span>
                      <span className="text-white">{selectedGeneration.input_data?.scale}x</span>
                    </div>
                    {selectedGeneration.metadata?.processing_time && (
                      <div className="flex justify-between">
                        <span className="text-purple-200">Processing Time:</span>
                        <span className="text-white">{selectedGeneration.metadata.processing_time}</span>
                      </div>
                    )}
                    {selectedGeneration.metadata?.original_resolution && (
                      <div className="flex justify-between">
                        <span className="text-purple-200">Original Resolution:</span>
                        <span className="text-white">{selectedGeneration.metadata.original_resolution}</span>
                      </div>
                    )}
                    {selectedGeneration.metadata?.upscaled_resolution && (
                      <div className="flex justify-between">
                        <span className="text-purple-200">Upscaled Resolution:</span>
                        <span className="text-white">{selectedGeneration.metadata.upscaled_resolution}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                {selectedGeneration.output_file_url && (
                  <button
                    onClick={() => handleDownload(selectedGeneration.output_file_url)}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Upscaled Video</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedGeneration(null)}
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NSFW Alert Modal */}
      <NSFWAlert
        isOpen={showNSFWAlert}
        onClose={() => {
          setShowNSFWAlert(false);
          setNsfwError(null);
        }}
        toolName="FAL Video Upscaler"
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
        toolName="FAL Video Upscaler"
      />

      {/* Custom Styles */}
      <style>{`
        .animation-delay-200 {
          animation-delay: 200ms;
        }
        .animation-delay-400 {
          animation-delay: 400ms;
        }
      `}</style>
    </div>
  );
};

export default FalVideoUpscaler;
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { createAIGeneration, updateTokenCount, uploadFile } from '../../utils/storageHelpers';
import { isContentPolicyError, parseContentPolicyError } from '../../utils/falErrorHandler';
import { toCdnUrl } from '../../utils/cdnHelpers';
import NSFWAlert from '../../components/NSFWAlert';
import SafetyWarningModal from '../../components/SafetyWarningModal';
import { performSafetyAnalysis, getSafetyWarningMessage, shouldShowWarning, logSafetyAnalysis } from '../../utils/safescan';
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
  Film,
  Wand2,
  Shield,
  Dice6,
  Sparkles,
  Clock,
  Monitor,
  CheckCircle,
  AlertTriangle,
  Sliders,
  Hash,
  Gauge
} from 'lucide-react';

const WanV22Video2Video = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state - based on WAN v2.2-a14b Video-to-Video API
  const [config, setConfig] = useState({
    videoUrl: '',
    prompt: '',
    negativePrompt: '',
    strength: .5,
    numFrames: 81,
    framesPerSecond: 16,
    resolution: '720p',
    aspectRatio: 'auto',
    numInferenceSteps: 30,
    enableSafetyChecker: true,
    enablePromptExpansion: false,
    acceleration: 'none',
    guidanceScale: 4.5,
    guidanceScale2: 4.5,
    shift: 5,
    interpolatorModel: 'film',
    numInterpolatedFrames: 2,
    adjustFpsForInterpolation: false,
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
  const [analyzingVideo, setAnalyzingVideo] = useState(false);
  
  // Safety scanning state
  const [showSafetyWarning, setShowSafetyWarning] = useState(false);
  const [safetyAnalysis, setSafetyAnalysis] = useState(null);
  const [bypassSafetyCheck, setBypassSafetyCheck] = useState(false);
  const [safetyWarningData, setSafetyWarningData] = useState(null);
  const [performingSafetyCheck, setPerformingSafetyCheck] = useState(false);
  const [videoAnalysis, setVideoAnalysis] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState(null);
  
  // Resolution options
  const resolutionOptions = [
    { label: '480p', value: '480p' },
    { label: '580p', value: '580p' },
    { label: '720p', value: '720p' }
  ];

  // Aspect ratio options
  const aspectRatioOptions = [
    { label: 'Auto', value: 'auto', icon: <Monitor className="w-4 h-4" /> },
    { label: 'Landscape (16:9)', value: '16:9', icon: <Monitor className="w-4 h-4" /> },
    { label: 'Square (1:1)', value: '1:1', icon: <div className="w-4 h-4 border border-current" /> },
    { label: 'Vertical (9:21)', value: '9:21', icon: <div className="w-2 h-4 border border-current" /> }
  ];

  // Acceleration options
  const accelerationOptions = [
    { label: 'None', value: 'none' },
    { label: 'Regular', value: 'regular' }
  ];

  // Interpolator model options
  const interpolatorOptions = [
    { label: 'None', value: 'none' },
    { label: 'FILM', value: 'film' },
    { label: 'RIFE', value: 'rife' }
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription
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

    if (newRecord?.status === 'processing') {
      setActiveGenerations(current => {
        const exists = current.find(g => g.id === newRecord.id);
        return exists ? current.map(g => g.id === newRecord.id ? newRecord : g) : [newRecord, ...current];
      });
    } else if (newRecord?.status === 'completed' || newRecord?.status === 'failed') {
      setActiveGenerations(current => current.filter(g => g.id !== newRecord?.id));
    }
  };

  // Analyze video to get dimensions
  const analyzeVideoDimensions = (file) => {
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
          aspectRatio: `${width}:${height}`,
          formattedDuration: `${Math.round(duration)}s`
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
      // First analyze the video to get dimensions
      const analysis = await analyzeVideoDimensions(file);
      console.log('Video analysis:', analysis);
      setVideoAnalysis(analysis);
      setVideoDimensions(analysis);
      
      // Upload to storage
      const { url } = await uploadFile(file, 'wan-v22-video2video-input');
      setConfig(prev => ({ ...prev, videoUrl: url }));
      
    } catch (error) {
      console.error('Error uploading video:', error);
      alert(`Error uploading video: ${error.message}`);
    } finally {
      setAnalyzingVideo(false);
      setUploadingVideo(false);
    }
  };

  const handleAspectRatioChange = (newAspectRatio) => {
    // Always use the exact string value - FAL.ai API expects these specific strings
    setConfig(prev => ({ ...prev, aspectRatio: newAspectRatio }));
  };

  const calculateTokenCost = () => {
    // Base cost calculation based on resolution and frames
    let baseCost;
    
    switch (config.resolution) {
      case '480p':
        baseCost = 25;
        break;
      case '580p':
        baseCost = 35;
        break;
      case '720p':
        baseCost = 50;
        break;
      default:
        baseCost = 50;
    }
    
    // Multiply by frame complexity factor
    const frameMultiplier = config.numFrames / 81; // Base 81 frames
    const finalCost = Math.ceil(baseCost * frameMultiplier);
    
    return Math.max(25, finalCost); // Minimum 25 tokens
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

    // STEP 1: Perform safety analysis BEFORE any FAL.ai request
    setPerformingSafetyCheck(true);
    try {
      console.log('🛡️ Starting safety analysis before FAL.ai request...');
      
      const analysis = await performSafetyAnalysis(
        config.videoUrl, 
        config.prompt,
        'fal_wan_v22_video2video'
      );
      
      setSafetyAnalysis(analysis);
      
      // Check if we should show warning
      if (shouldShowWarning(analysis)) {
        const warningData = getSafetyWarningMessage(analysis);
        setSafetyWarningData(warningData);
        setShowSafetyWarning(true);
        setPerformingSafetyCheck(false);
        
        console.log('⚠️ Safety warning triggered, showing modal to user');
        return; // Stop here and show warning
      }
      
      console.log('✅ Safety analysis passed, proceeding with generation');
      
    } catch (safetyError) {
      console.error('❌ Safety analysis failed:', safetyError);
      // If safety analysis fails, continue but log the error
      console.log('⚠️ Safety analysis failed, proceeding without check');
    } finally {
      setPerformingSafetyCheck(false);
    }
    
    // STEP 2: Proceed with actual generation (safety check passed or failed)
    await proceedWithGeneration();
  };
  
  // Separated generation logic for reuse after safety warning
  const proceedWithGeneration = async () => {
    // Step 1: Perform safety analysis before proceeding
    if (!bypassSafetyCheck) {
      setPerformingSafetyCheck(true);
      try {
        console.log('🛡️ Performing safety analysis before generation...');
        
        const analysis = await performSafetyAnalysis(
          config.videoUrl, // Analyze the video as if it were an image
          config.prompt,
          'fal_wan_v22_video2video'
        );
        
        setSafetyAnalysis(analysis);
        
        // Check if we should show warning
        if (shouldShowWarning(analysis)) {
          const warningData = getSafetyWarningMessage(analysis);
          setSafetyWarningData(warningData);
          setShowSafetyWarning(true);
          setPerformingSafetyCheck(false);
          
          // Log the analysis
          await logSafetyAnalysis(analysis, 'warning_shown');
          
          return; // Stop here and show warning
        } else {
          console.log('✅ Safety analysis passed, proceeding with generation');
          await logSafetyAnalysis(analysis, 'passed');
        }
      } catch (safetyError) {
        console.error('❌ Safety analysis failed:', safetyError);
        // If safety analysis fails, proceed anyway (don't block user)
      } finally {
        setPerformingSafetyCheck(false);
      }
    }

    // Reset bypass flag after use
    setBypassSafetyCheck(false);

    const tokenCost = calculateTokenCost();
    const totalTokens = (profile.tokens || 0) + (profile.purchased_tokens || 0);
    if (totalTokens < tokenCost) {
      alert('Insufficient tokens. Please upgrade your plan.');
      return;
    }

    setGenerating(true);
    let generation = null;
    
    try {
      console.log('🚀 Starting WAN v2.2 Video2Video generation...');
      
      generation = await createAIGeneration(
        'fal_wan_v22_video2video',
        {
          ...config,
          safety_analysis: safetyAnalysis // Include safety analysis in metadata
        },
        {
          ...config,
          // Use actual video dimensions if auto is selected
          aspectRatio: config.aspectRatio === 'auto' && videoDimensions 
            ? videoDimensions.aspectRatio 
            : config.aspectRatio
        },
        tokenCost
      );

      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      await updateTokenCount(user.id, tokenCost);
      await fetchProfile();

      console.log('💰 Tokens deducted, calling Edge Function...');

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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      setConfig(prev => ({ ...prev, prompt: '', negativePrompt: '' }));
      
      // Log successful safety analysis result
      if (safetyAnalysis) {
        await logSafetyAnalysis(safetyAnalysis, 'proceeded_with_generation');
      }
      console.log('✅ WAN v2.2 Video2Video generation request submitted successfully');

    } catch (error) {
      console.error('❌ Error generating:', error);
      
      if (generation) {
        setGenerations(current => current.filter(g => g.id !== generation.id));
        setActiveGenerations(current => current.filter(g => g.id !== generation.id));
      }
      
      if (isContentPolicyError(error.message)) {
        const policyDetails = parseContentPolicyError(error.message);
        setNsfwError(policyDetails);
        setShowNSFWAlert(true);
      } else {
        alert(`Error: ${error.message}`);
      }
    } finally {
      setGenerating(false);
    }
  };
  
  // Handle safety warning modal actions
  const handleSafetyWarningContinue = async () => {
    setShowSafetyWarning(false);
    
    // Log that user chose to continue despite warning
    if (safetyAnalysis) {
      await logSafetyAnalysis(safetyAnalysis, 'continued_despite_warning');
    }
    
    // Set bypass flag and trigger generation
    setBypassSafetyCheck(true);
    
    // Small delay to ensure state is updated, then trigger generation
    setTimeout(() => {
      proceedWithGeneration();
    }, 100);
  };
  
  const handleSafetyWarningModify = () => {
    setShowSafetyWarning(false);
    
    // Log that user chose to modify content
    if (safetyAnalysis) {
      logSafetyAnalysis(safetyAnalysis, 'chose_to_modify');
    }
    
    // User stays on the page to modify content
    // Next time they click generate, safety check will run again
  };
  
  const handleSafetyWarningClose = () => {
    setShowSafetyWarning(false);
    
    // Log that user dismissed warning
    if (safetyAnalysis) {
      logSafetyAnalysis(safetyAnalysis, 'dismissed_warning');
    }
  };

  // Handle safety warning responses
  const handleSafetyContinue = async () => {
    console.log('⚠️ User chose to continue despite safety warning');
    await logSafetyAnalysis(safetyAnalysis, 'user_continued');
    
    setShowSafetyWarning(false);
    setBypassSafetyCheck(true); // Skip safety check on next generation attempt
    
    // Automatically trigger generation
    setTimeout(() => {
      proceedWithGeneration();
    }, 100);
  };

  const handleSafetyModify = async () => {
    console.log('✅ User chose to modify content');
    await logSafetyAnalysis(safetyAnalysis, 'user_modified');
    
    setShowSafetyWarning(false);
    setSafetyAnalysis(null);
    setBypassSafetyCheck(false);
    setSafetyWarningData(null);
    // User can now modify their content and try again
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

  // ---------- NEW: Safe title normalization helper ----------
  // Some rows store generation_name as JSON (object or JSON string). This ensures we always display a human-readable title.
  const getGenerationTitle = (g) => {
    const name = g?.generation_name;
    const fallback = `Video Transformation ${new Date(g?.created_at).toLocaleDateString()}`;

    if (!name) return fallback;

    // If it's a JSON string, parse it
    if (typeof name === 'string') {
      try {
        const parsed = JSON.parse(name);
        if (parsed && typeof parsed === 'object') {
          return parsed.title || parsed.name || parsed.text || fallback;
        }
        return name;
      } catch {
        return name; // plain string
      }
    }

    // If it's already an object (json/jsonb from Supabase), pick common title fields
    if (typeof name === 'object') {
      return name.title || name.name || name.text || fallback;
    }

    return String(name);
  };
  // ---------------------------------------------------------

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
                <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">WAN v2.2 Video2Video</h1>
                  <p className="text-purple-200 text-sm">Transform videos with advanced AI - change style, content, and motion</p>
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
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 w-full min-w-0">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sticky top-8">
              <div className="flex items-center space-x-2 mb-6">
                <Settings className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">Video Configuration</h2>
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
                      e.currentTarget.classList.add('border-violet-400', 'bg-violet-500/10');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-violet-400', 'bg-violet-500/10');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-violet-400', 'bg-violet-500/10');
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
                            src={toCdnUrl(config.videoUrl)} 
                            className="w-full h-32 object-contain rounded-lg bg-black/20"
                            muted
                            preload="metadata"
                          />
                          <p className="text-purple-200 text-sm">
                            {analyzingVideo ? 'Analyzing video...' : 'Click to change'}
                          </p>
                          {videoAnalysis && (
                            <div className="text-xs text-green-300 bg-green-500/10 rounded p-2">
                              <p>Dimensions: {videoAnalysis.width}×{videoAnalysis.height}</p>
                              <p>Duration: {videoAnalysis.formattedDuration}</p>
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
                            MP4, MOV, AVI • Max 100MB • Drag & drop supported
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
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={4}
                    maxLength={800}
                  />
                  <p className="text-purple-300 text-xs mt-1">
                    {config.prompt.length}/800 characters • Describe style, content, or motion changes
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
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={2}
                  />
                </div>

                {/* Strength */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Gauge className="w-4 h-4 inline mr-1" />
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
                    <span>Subtle (0.0)</span>
                    <span>Balanced (0.5)</span>
                    <span>Strong (1.0)</span>
                  </div>
                </div>

                {/* Resolution */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Monitor className="w-4 h-4 inline mr-1" />
                    Output Resolution
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {resolutionOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setConfig(prev => ({ ...prev, resolution: option.value }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          config.resolution === option.value
                            ? 'bg-violet-500 text-white'
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
                  <div className="grid grid-cols-2 gap-2">
                    {aspectRatioOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleAspectRatioChange(option.value)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                          (config.aspectRatio === option.value || 
                           (option.value === 'auto' && config.aspectRatio === videoDimensions?.aspectRatio))
                            ? 'bg-violet-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {option.icon}
                        <span className="truncate">
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frame Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      <Hash className="w-4 h-4 inline mr-1" />
                      Frames: {config.numFrames}
                    </label>
                    <input
                      type="range"
                      min="81"
                      max="121"
                      value={config.numFrames}
                      onChange={(e) => setConfig(prev => ({ ...prev, numFrames: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-purple-300 mt-1">
                      <span>81</span>
                      <span>121</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      FPS: {config.framesPerSecond}
                    </label>
                    <input
                      type="range"
                      min="4"
                      max="60"
                      value={config.framesPerSecond}
                      onChange={(e) => setConfig(prev => ({ ...prev, framesPerSecond: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-purple-300 mt-1">
                      <span>4</span>
                      <span>60</span>
                    </div>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Advanced Settings</h3>
                  
                  {/* Guidance Scales */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        Guidance Scale: {config.guidanceScale}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="0.5"
                        value={config.guidanceScale}
                        onChange={(e) => setConfig(prev => ({ ...prev, guidanceScale: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>

                    <div>
                      <label className="block text sm font-medium text-purple-200 mb-2">
                        Guidance Scale 2: {config.guidanceScale2}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="0.5"
                        value={config.guidanceScale2}
                        onChange={(e) => setConfig(prev => ({ ...prev, guidanceScale2: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                  </div>

                  {/* Steps and Shift */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        Steps: {config.numInferenceSteps}
                      </label>
                      <input
                        type="range"
                        min="2"
                        max="40"
                        value={config.numInferenceSteps}
                        onChange={(e) => setConfig(prev => ({ ...prev, numInferenceSteps: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        Shift: {config.shift}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={config.shift}
                        onChange={(e) => setConfig(prev => ({ ...prev, shift: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                  </div>

                  {/* Interpolator Settings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        Interpolator Model
                      </label>
                      <select
                        value={config.interpolatorModel}
                        onChange={(e) => setConfig(prev => ({ ...prev, interpolatorModel: e.target.value }))}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {interpolatorOptions.map((option) => (
                          <option key={option.value} value={option.value} className="bg-gray-800 text-white">
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        Interpolated Frames: {config.numInterpolatedFrames}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        value={config.numInterpolatedFrames}
                        onChange={(e) => setConfig(prev => ({ ...prev, numInterpolatedFrames: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                  </div>

                  {/* Acceleration */}
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Acceleration
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {accelerationOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setConfig(prev => ({ ...prev, acceleration: option.value }))}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            config.acceleration === option.value
                              ? 'bg-violet-500 text-white'
                              : 'bg-white/10 text-purple-200 hover:bg-white/20'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggle Options */}
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={config.enableSafetyChecker}
                        onChange={(e) => setConfig(prev => ({ ...prev, enableSafetyChecker: e.target.checked }))}
                        className="w-4 h-4 text-violet-600 bg-white/10 border-white/20 rounded focus:ring-violet-500"
                      />
                      <div>
                        <span className="text-white font-medium flex items-center">
                          <Shield className="w-4 h-4 mr-1" />
                          Safety Checker
                        </span>
                        <p className="text-purple-300 text-xs">Filter inappropriate content</p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={config.enablePromptExpansion}
                        onChange={(e) => setConfig(prev => ({ ...prev, enablePromptExpansion: e.target.checked }))}
                        className="w-4 h-4 text-violet-600 bg-white/10 border-white/20 rounded focus:ring-violet-500"
                      />
                      <div>
                        <span className="text-white font-medium flex items-center">
                          <Sparkles className="w-4 h-4 mr-1" />
                          Prompt Expansion
                        </span>
                        <p className="text-purple-300 text-xs">AI enhances your prompt</p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={config.adjustFpsForInterpolation}
                        onChange={(e) => setConfig(prev => ({ ...prev, adjustFpsForInterpolation: e.target.checked }))}
                        className="w-4 h-4 text-violet-600 bg-white/10 border-white/20 rounded focus:ring-violet-500"
                      />
                      <div>
                        <span className="text-white font-medium">Adjust FPS for Interpolation</span>
                        <p className="text-purple-300 text-xs">Optimize frame rate for interpolation</p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={config.resampleFps}
                        onChange={(e) => setConfig(prev => ({ ...prev, resampleFps: e.target.checked }))}
                        className="w-4 h-4 text-violet-600 bg-white/10 border-white/20 rounded focus:ring-violet-500"
                      />
                      <div>
                        <span className="text-white font-medium">Resample FPS</span>
                        <p className="text-purple-300 text-xs">Resample frame rate for consistency</p>
                      </div>
                    </label>
                  </div>

                  {/* Seed */}
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
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || performingSafetyCheck || !config.videoUrl || !config.prompt.trim()}
                  className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {performingSafetyCheck ? (
                    <>
                      <Shield className="w-4 h-4 animate-pulse" />
                      <span>Checking Content Safety...</span>
                    </>
                  ) : generating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Transforming...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      <span>Transform Video ({calculateTokenCost()} tokens)</span>
                    </>
                  )}
                </button>

                {/* Processing Note */}
                <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-3">
                  <p className="text-violet-200 text-xs">
                    <Film className="w-3 h-3 inline mr-1" />
                    Video transformation may take 2-5 minutes. Cost varies by resolution and frame count.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 w-full min-w-0">
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
                            {/* Title now normalized to string even if JSON is stored */}
                            <p className="text-white font-medium">
                              {getGenerationTitle(generation)}
                            </p>
                            <p className="text-purple-200 text-sm">
                              {generation.input_data?.strength ? `Strength: ${generation.input_data.strength} • ` : ''}
                              {generation.input_data?.resolution ? `Resolution: ${generation.input_data.resolution} • ` : ''}
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
                  {/* Guarded: only show download button if a selected generation exists */}
                  {selectedGeneration?.output_file_url && (
                    <button
                      onClick={() => handleDownload(toCdnUrl(selectedGeneration.output_file_url))}
                      className="text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {generations.length === 0 ? (
                  <div className="text-center py-12">
                    <Video className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                    <p className="text-purple-200 text-lg">No videos transformed yet</p>
                    <p className="text-purple-300 text-sm">Upload a video and describe how to transform it</p>
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
                              {/* Title now normalized to string even if JSON is stored */}
                              <h4 className="font-medium text-white">
                                {getGenerationTitle(generation)}
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
                            <div className="mb-4 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-lg p-8 text-center">
                              <RefreshCw className="w-12 h-12 text-violet-300 animate-spin mx-auto mb-2" />
                              <p className="text-violet-200">Transforming video...</p>
                              <p className="text-violet-300 text-sm">This typically takes 2-5 minutes</p>
                            </div>
                          )}

                          {generation.status === 'failed' && (
                            <div className="mb-4 bg-red-500/20 rounded-lg p-4 text-center">
                              <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                              <p className="text-red-400 text-sm">Transformation failed</p>
                              {generation.error_message && (
                                <p className="text-red-300 text-xs mt-2">{generation.error_message}</p>
                              )}
                            </div>
                          )}

                          <div className="space-y-2 text-sm text-purple-300">
                            <p>
                              <strong>Prompt:</strong> {generation.input_data?.prompt || 'No prompt available'}
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                              {/* Removed duplicate "Resolution" line; keep a single clean entry */}
                              <span>
                                <strong>Resolution:</strong> {generation.input_data?.resolution || 'N/A'}
                              </span>
                              <span>
                                <strong>Frames:</strong> {generation.input_data?.numFrames || 'N/A'}
                              </span>
                              <span>
                                <strong>Aspect:</strong> {generation.input_data?.aspectRatio || 'N/A'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center space-x-4">
                              <span className="text-purple-300 text-sm">
                                {generation.tokens_used} tokens used
                              </span>
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
                                  onClick={() => handleDownload(toCdnUrl(generation.output_file_url))}
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
        onClose={handleSafetyWarningClose}
        onContinue={handleSafetyWarningContinue}
        onModify={handleSafetyWarningModify}
        warningData={safetyWarningData}
        toolName="WAN v2.2 Video2Video"
      />

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
          background: linear-gradient(to right, #8B5CF6, #A855F7);
          cursor: pointer;
          border: 2px solid white;
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #8B5CF6, #A855F7);
          cursor: pointer;
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
};

export default WanV22Video2Video;
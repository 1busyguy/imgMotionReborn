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
  Image as ImageIcon,
  Monitor,
  Smartphone,
  Square,
  Maximize2,
  Shield,
  Dice6,
  Sparkles,
  Sliders
} from 'lucide-react';

const WanV22A14b = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state - based on WAN v2.2-a14b API parameters
  const [config, setConfig] = useState({
    imageUrl: '',
    prompt: '',
    negativePrompt: '',    
    framesPerSecond: 16,
    aspectRatio: 'auto',
    numFrames: 81,
    numInferenceSteps: 30,
    enableSafetyChecker: true,
    enablePromptExpansion: false,
    guidanceScale: 3.5,
    guidanceScale2: 3.5,
    shift: 5,
    interpolatorModel: 'film',
    numInterpolatedFrames: 1,
    adjustFpsForInterpolation: false,
    promptexpand:false,
    seed: -1
    
  });
  
  // Generation state
  const [generations, setGenerations] = useState([]);
  const [activeGenerations, setActiveGenerations] = useState([]);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showNSFWAlert, setShowNSFWAlert] = useState(false);
  const [nsfwError, setNsfwError] = useState(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [imageAnalysis, setImageAnalysis] = useState(null);
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
    { label: '480p (SD)', value: '480p', multiplier: 1 },
    { label: '580p (Enhanced)', value: '580p', multiplier: 2 },
    { label: '720p (HD)', value: '720p', multiplier: 4 }
  ];

  // Aspect ratio options
  const aspectRatioOptions = [
    { label: 'Landscape (16:9)', value: '16:9', icon: <Monitor className="w-4 h-4" /> },
    { label: 'Portrait (9:16)', value: '9:16', icon: <Smartphone className="w-4 h-4" /> },
    { label: 'Square (1:1)', value: '1:1', icon: <Square className="w-4 h-4" /> }
  ];

  // Interpolator model options
  const interpolatorOptions = [
    { label: 'FILM', value: 'film' },
    { label: 'RIFE', value: 'rife' }
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription for this specific tool type
      const subscription = supabase
        .channel('wan_v22_a14b_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id},tool_type=eq.fal_wan_v22_a14b`
          },
          (payload) => {
            console.log('Real-time update received:', payload);
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

      console.log('Real-time subscription set up for WAN v2.2-a14b');
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
        .eq('tool_type', 'fal_wan_v22_a14b')
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
    
    // Show success notification for completed generations
    if (newRecord?.status === 'completed') {
      console.log('Video generation completed successfully!');
    }
  };

  const analyzeImageWithOpenAI = async (imageUrl) => {
    setAnalyzingImage(true);
    try {
      console.log('🔍 Analyzing image with OpenAI Vision...');
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image-openai`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          imageUrl,
          toolType: 'ltxv',
          analysisType: 'motion-prompt'
        })
      });

      if (response.ok) {
        const analysis = await response.json();
        console.log('✅ OpenAI Vision analysis result:', analysis);
        
        if (analysis.success && analysis.motionPrompt) {
          setImageAnalysis(analysis);
          setConfig(prev => ({
            ...prev,
            prompt: analysis.motionPrompt
          }));
          
          // Show success message
          console.log('🎯 Motion prompt suggested:', analysis.motionPrompt);
        }
      } else {
        console.warn('⚠️ Image analysis failed:', response.status);
      }
    } catch (error) {
      console.error('❌ Error analyzing image:', error);
    } finally {
      setAnalyzingImage(false);
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

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setUploadingImage(true);
    try {
      const { url } = await uploadFile(file, 'wan-v22-a14b-images');
      setConfig(prev => ({ ...prev, imageUrl: url }));
      
      // Auto-analyze the image with OpenAI Vision
      await analyzeImageWithOpenAI(url);
      
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Please try again.');
    } finally {
      setUploadingImage(false);
      console.log('✅ WAN v2.2-a14b Image uploaded to Cloudinary:', cloudinaryResult.url);
      console.log('✅ WAN v2.2-a14b Image also saved to Supabase:', supabaseUrl);
    }
  };

  const calculateTokenCost = () => {
    // Base cost calculation based on frames and resolution
    let baseCost = 20; // Base cost for WAN v2.2-a14b
    
    // Cost multiplier based on resolution
    const resolutionOption = resolutionOptions.find(opt => opt.value === config.resolution);
    const multiplier = resolutionOption ? resolutionOption.multiplier : 4; // Default to 720p multiplier
    
    baseCost *= multiplier;
    
    // Additional cost for more frames
    if (config.numFrames > 81) {
      baseCost += Math.floor((config.numFrames - 81) / 10) * 5;
    }
    
    // Additional cost for interpolation
    if (config.numInterpolatedFrames > 2) {
      baseCost += (config.numInterpolatedFrames - 2) * 5;
    }
    
    return baseCost;
  };

  const handleGenerate = async () => {
    if (!config.imageUrl) {
      alert('Please upload an image');
      return;
    }

    if (!config.prompt.trim()) {
      alert('Please enter a motion prompt');
      return;
    }

    // --- SAFETY SCAN INTEGRATION ---
    if (!bypassSafetyCheck) {
      try {
        const analysisResult = await performSafetyAnalysis(
          config.imageUrl,
          config.prompt,
          'fal_wan_v22_a14b'
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
      // Create generation record
      console.log('📸 Image URL being sent:', config.imageUrl);
      const generation = await createAIGeneration(
        'fal_wan_v22_a14b',
        config.prompt.substring(0, 50) + '...',
        config,
        tokenCost
      );

      console.log('Generation record created:', generation.id);

      // Immediately add to local state for instant UI feedback
      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      // Deduct tokens
      await updateTokenCount(user.id, tokenCost);
      
      // Update profile state
      setProfile(prev => ({
        ...prev,
        tokens: Math.max(0, (prev.tokens || 0) - tokenCost)
      }));

      // Call Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-wan-v22-a14b`, {
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
        throw new Error(errorData.error || 'Generation failed');
      }

      const result = await response.json();
      console.log('Edge Function result:', result);

      // Clear prompt after successful generation
      setConfig(prev => ({ ...prev, prompt: '' }));

      console.log('Generation request completed successfully');
    } catch (error) {
      console.error('Generation error:', error);
      if (isNSFWError(error.message)) {
        const nsfwDetails = parseNSFWError(error.message);
        setNsfwError(nsfwDetails);
        setShowNSFWAlert(true);
      } else {
        showAlert('error', 'Generation Failed', `WAN 2.2 generation failed: ${error.message}`);
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
      link.download = `wan-v22-a14b-video-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link
      const link = document.createElement('a');
      link.href = toCdnUrl(videoUrl);
      link.download = `wan-v22-a14b-video-${Date.now()}.mp4`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDelete = async (generationId) => {
    if (!confirm('Are you sure you want to delete this generation?')) return;

    try {
      const { error } = await supabase
        .from('ai_generations')
        .delete()
        .eq('id', generationId)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting generation:', error);
      alert('Error deleting generation. Please try again.');
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
                <span>Back to Dashboard</span>
              </button>
              <div className="h-6 w-px bg-white/20"></div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">WAN v2.2-a14b Video</h1>
                  <p className="text-purple-200 text-sm">Advanced image-to-video generation with WAN v2.2-a14b model and interpolation</p>
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
                <h2 className="text-lg font-semibold text-white">Video Configuration</h2>
              </div>

              <div className="space-y-6">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <ImageIcon className="w-4 h-4 inline mr-1" />
                    Source Image *
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
                        handleImageUpload(event);
                      }
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                      disabled={uploadingImage}
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      {config.imageUrl ? (
                        <div className="space-y-2">
                          <img 
                            src={config.imageUrl} 
                            alt="Source" 
                            className="w-full h-32 object-contain rounded-lg bg-black/20"
                            loading="lazy"
                          />
                          <p className="text-purple-200 text-sm">
                            {analyzingImage ? 'Analyzing with AI...' : 'Click to change'}
                          </p>
                          {imageAnalysis && (
                            <div className="text-xs text-green-300 bg-green-500/10 rounded p-2">
                              <p className="font-medium">✨ AI Analysis Complete</p>
                              <p>Subject: {imageAnalysis.subject}</p>
                              <p>Scene: {imageAnalysis.scene}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                          <p className="text-purple-200">
                            {uploadingImage ? 'Uploading...' : 
                             analyzingImage ? 'Analyzing...' : 
                             'Upload or drag & drop image'}
                          </p>
                          <p className="text-purple-300 text-xs mt-1">
                            AI will analyze and suggest motion prompts
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Motion Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Film className="w-4 h-4 inline mr-1" />
                    Motion Prompt *
                  </label>
                  <textarea
                    value={config.prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder={imageAnalysis ? "AI suggested prompt loaded above..." : "Describe the motion and animation you want..."}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={4}
                    maxLength={800}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-purple-300 text-xs">
                      {config.prompt.length}/800 characters
                    </p>
                    {imageAnalysis && (
                      <button
                        onClick={() => analyzeImageWithOpenAI(config.imageUrl)}
                        disabled={analyzingImage}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                      >
                        {analyzingImage ? 'Analyzing...' : '🔄 Re-analyze'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Negative Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Negative Prompt (Optional)
                  </label>
                  <textarea
                    value={config.negativePrompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, negativePrompt: e.target.value }))}
                    placeholder="What you don't want to see in the video..."
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={2}
                  />
                </div>

                {/* Resolution */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Monitor className="w-4 h-4 inline mr-1" />
                    Output Resolution
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, resolution: '480p' }))}
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        config.resolution === '480p'
                          ? 'bg-purple-500/30 border-purple-400 text-white'
                          : 'bg-white/5 border-white/20 text-purple-200 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-medium">480p</div>
                      <div className="text-xs opacity-70">50 tokens</div>
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, resolution: '580p' }))}
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        config.resolution === '580p'
                          ? 'bg-purple-500/30 border-purple-400 text-white'
                          : 'bg-white/5 border-white/20 text-purple-200 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-medium">580p</div>
                      <div className="text-xs opacity-70">50 tokens</div>
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, resolution: '720p' }))}
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        config.resolution === '720p'
                          ? 'bg-purple-500/30 border-purple-400 text-white'
                          : 'bg-white/5 border-white/20 text-purple-200 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-medium">720p</div>
                      <div className="text-xs opacity-70">100 tokens</div>
                    </button>
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, aspectRatio: 'auto' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.aspectRatio === 'auto'
                          ? 'bg-purple-500/30 border border-purple-400 text-white'
                          : 'bg-white/5 border border-white/20 text-purple-200 hover:bg-white/10'
                      }`}
                    >
                      Auto
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, aspectRatio: '16:9' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.aspectRatio === '16:9'
                          ? 'bg-purple-500/30 border border-purple-400 text-white'
                          : 'bg-white/5 border border-white/20 text-purple-200 hover:bg-white/10'
                      }`}
                    >
                      16:9
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, aspectRatio: '9:16' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.aspectRatio === '9:16'
                          ? 'bg-purple-500/30 border border-purple-400 text-white'
                          : 'bg-white/5 border border-white/20 text-purple-200 hover:bg-white/10'
                      }`}
                    >
                      9:16
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, aspectRatio: '1:1' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.aspectRatio === '1:1'
                          ? 'bg-purple-500/30 border border-purple-400 text-white'
                          : 'bg-white/5 border border-white/20 text-purple-200 hover:bg-white/10'
                      }`}
                    >
                      1:1
                    </button>
                  </div>
                </div>

                {/* Frame Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Frame Settings</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Number of Frames: {config.numFrames}
                    </label>
                    <input
                      type="range"
                      min="81"
                      max="121"
                      step="5"
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
                      Frames Per Second: {config.framesPerSecond}
                    </label>
                    <input
                      type="range"
                      min="4"
                      max="60"
                      step="1"
                      value={config.framesPerSecond}
                      onChange={(e) => setConfig(prev => ({ ...prev, framesPerSecond: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-purple-300 mt-1">
                      <span>4 fps</span>
                      <span>60 fps</span>
                    </div>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Advanced Settings</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Inference Steps: {config.numInferenceSteps}
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="40"
                      value={config.numInferenceSteps}
                      onChange={(e) => setConfig(prev => ({ ...prev, numInferenceSteps: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-purple-300 mt-1">
                      <span>Fast</span>
                      <span>Quality</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Guidance Scale: {config.guidanceScale}
                    </label>
                    <input
                      type="range"
                      min="1.0"
                      max="10.0"
                      step="0.1"
                      value={config.guidanceScale}
                      onChange={(e) => setConfig(prev => ({ ...prev, guidanceScale: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Guidance Scale 2: {config.guidanceScale2}
                    </label>
                    <input
                      type="range"
                      min="1.0"
                      max="10.0"
                      step="0.1"
                      value={config.guidanceScale2}
                      onChange={(e) => setConfig(prev => ({ ...prev, guidanceScale2: parseFloat(e.target.value) }))}
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
                      step="0.1"
                      value={config.shift}
                      onChange={(e) => setConfig(prev => ({ ...prev, shift: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>
                </div>

                {/* Interpolation Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Interpolation Settings</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Interpolator Model
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, interpolatorModel: 'film' }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          config.interpolatorModel === 'film'
                            ? 'bg-purple-500/30 border border-purple-400 text-white'
                            : 'bg-white/5 border border-white/20 text-purple-200 hover:bg-white/10'
                        }`}
                      >
                        FILM
                      </button>
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, interpolatorModel: 'rife' }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          config.interpolatorModel === 'rife'
                            ? 'bg-purple-500/30 border border-purple-400 text-white'
                            : 'bg-white/5 border border-white/20 text-purple-200 hover:bg-white/10'
                        }`}
                      >
                        RIFE
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Interpolated Frames: {config.numInterpolatedFrames}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="4"
                      value={config.numInterpolatedFrames}
                      onChange={(e) => setConfig(prev => ({ ...prev, numInterpolatedFrames: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>
                </div>

                {/* Toggle Options */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Options</h3>
                  
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={config.enableSafetyChecker}
                      onChange={(e) => setConfig(prev => ({ ...prev, enableSafetyChecker: e.target.checked }))}
                      className="w-4 h-4 text-purple-600 bg-white/10 border-white/20 rounded focus:ring-purple-500"
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
                      checked={config.adjustFpsForInterpolation}
                      onChange={(e) => setConfig(prev => ({ ...prev, adjustFpsForInterpolation: e.target.checked }))}
                      className="w-4 h-4 text-purple-600 bg-white/10 border-white/20 rounded focus:ring-purple-500"
                    />
                    <div>
                      <span className="text-white font-medium">Adjust FPS for Interpolation</span>
                      <p className="text-purple-300 text-xs">Automatically adjust frame rate</p>
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
                  <p className="text-purple-300 text-xs mt-1">
                    Use same seed for reproducible results
                  </p>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.imageUrl || !config.prompt.trim()}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Video...</span>
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4" />
                      <span>Generate Video ({calculateTokenCost()} tokens)</span>
                    </>
                  )}
                </button>

                {/* Processing Note */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-amber-200 text-xs">
                    <Film className="w-3 h-3 inline mr-1" />
                    WAN v2.2-a14b generation may take 3-8 minutes. Advanced interpolation and frame control available.
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
                              Frames: {generation.input_data?.numFrames} • 
                              FPS: {generation.input_data?.framesPerSecond} • 
                              Started: {new Date(generation.created_at).toLocaleTimeString()}
                            </p>
                            <p className="text-purple-300 text-xs mt-1">
                              WAN v2.2-a14b generation typically takes 3-8 minutes
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
                  <h3 className="text-lg font-semibold text-white">Generated Videos</h3>
                  <button
                    onClick={fetchGenerations}
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {generations.length === 0 ? (
                  <div className="text-center py-12">
                    <Video className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                    <p className="text-purple-200 text-lg">No videos generated yet</p>
                    <p className="text-purple-300 text-sm">Upload an image and describe motion to create advanced videos</p>
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
                                poster={toCdnUrl(generation.input_data?.imageUrl)}
                                preload="metadata"
                              >
                                Your browser does not support the video tag.
                              </video>
                            </div>
                          )}

                          {generation.status === 'processing' && (
                            <div className="mb-4 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg p-8 text-center">
                              <RefreshCw className="w-12 h-12 text-amber-300 animate-spin mx-auto mb-2" />
                              <p className="text-amber-200">Generating advanced video...</p>
                              <p className="text-amber-300 text-sm">This may take 3-8 minutes</p>
                            </div>
                          )}

                          {generation.status === 'failed' && (
                            <div className="mb-4 bg-red-500/20 rounded-lg p-4 text-center">
                              <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                              <p className="text-red-400 text-sm">Generation failed</p>
                            </div>
                          )}

                          <div className="space-y-2 text-sm text-purple-300">
                            <p>
                              <strong>Motion:</strong> {generation.input_data?.prompt}
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                              <span>
                                <strong>Frames:</strong> {generation.input_data?.numFrames}
                              </span>
                              <span>
                                <strong>FPS:</strong> {generation.input_data?.framesPerSecond}
                              </span>
                              <span>
                                <strong>Resolution:</strong> {generation.input_data?.resolution}
                              </span>
                              <span>
                                <strong>Aspect:</strong> {generation.input_data?.aspectRatio}
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
                    poster={toCdnUrl(selectedGeneration.input_data?.imageUrl)}
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
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Configuration</h4>
                  <div className="space-y-2 text-sm">
                    {selectedGeneration.input_data?.prompt && (
                      <div>
                        <span className="text-purple-200">Motion Prompt:</span>
                        <p className="text-white mt-1 p-2 bg-white/5 rounded">
                          {selectedGeneration.input_data.prompt}
                        </p>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-purple-200">Frames:</span>
                      <span className="text-white">{selectedGeneration.input_data?.numFrames}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">FPS:</span>
                      <span className="text-white">{selectedGeneration.input_data?.framesPerSecond}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Resolution:</span>
                      <span className="text-white">{selectedGeneration.input_data?.resolution}</span>
                    </div>
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
                    <span>Download Video</span>
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
        toolName="WAN v2.2-a14b Video"
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
        toolName="WAN 2.2 Professional"
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
          background: linear-gradient(to right, #F59E0B, #EA580C);
          cursor: pointer;
          border: 2px solid white;
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #F59E0B, #EA580C);
          cursor: pointer;
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
};

export default WanV22A14b;
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
  Sliders,
  RotateCcw,
  Shield,
  Layers
} from 'lucide-react';

const LTXVVideo = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state - based on LTXV API parameters
  const [config, setConfig] = useState({
    imageUrl: '',
    prompt: '',
    negativePrompt: '',
    loras: [],
    resolution: "720p",
    aspectRatio: "auto",
    numFrames: 120,
    firstPassNumInferenceSteps: 8,
    secondPassNumInferenceSteps: 8,
    secondPassSkipInitialSteps: 5,
    frameRate: 24,
    expandPrompt: false,
    reverseVideo: false,
    enableSafetyChecker: true,
    enableDetailPass: false,
    temporalAdainFactor: 0.5,
    toneMapCompressionRatio: 0,
    constantRateFactor: 29,
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

  // Resolution options
  const resolutionOptions = [
    { label: '480p (SD)', value: '480p' },
    { label: '720p (HD)', value: '720p' }
  ];

  // Aspect ratio options (exact API values)
  const aspectRatioOptions = [
    { label: 'Portrait (9:16)', value: '9:16', icon: <Smartphone className="w-4 h-4" /> },
    { label: 'Square (1:1)', value: '1:1', icon: <Square className="w-4 h-4" /> },
    { label: 'Landscape (16:9)', value: '16:9', icon: <Monitor className="w-4 h-4" /> },
    { label: 'Auto', value: 'auto', icon: <Maximize2 className="w-4 h-4" /> }
  ];

  // Frame count presets
  const framePresets = [
    { label: '1 second (24 frames)', value: 24 },
    { label: '2 seconds (48 frames)', value: 48 },
    { label: '3 seconds (72 frames)', value: 72 },
    { label: '5 seconds (120 frames)', value: 120 },
    { label: '10 seconds (240 frames)', value: 240 },
    { label: '20 seconds (480 frames)', value: 480 },
    { label: '30 seconds (720 frames)', value: 720 }
  ];

  // Frame rate options
  const frameRateOptions = [
    { label: '24 FPS (Cinematic)', value: 24 },
    { label: '30 FPS (Standard)', value: 30 },
    { label: '60 FPS (Smooth)', value: 60 }
  ];

  // LoRA management
  const [newLoraUrl, setNewLoraUrl] = useState('');
  const [newLoraScale, setNewLoraScale] = useState(1.0);

  const addLora = () => {
    if (newLoraUrl.trim()) {
      setConfig(prev => ({
        ...prev,
        loras: [...prev.loras, { url: newLoraUrl.trim(), scale: newLoraScale }]
      }));
      setNewLoraUrl('');
      setNewLoraScale(1.0);
    }
  };

  const removeLora = (index) => {
    setConfig(prev => ({
      ...prev,
      loras: prev.loras.filter((_, i) => i !== index)
    }));
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription for this specific tool type
      const subscription = supabase
        .channel('ltxv_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id},tool_type=eq.fal_ltxv`
          },
          (payload) => {
            console.log('Real-time update received:', payload);
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

      console.log('Real-time subscription set up for LTXV');
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
        .eq('tool_type', 'fal_ltxv')
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
      const { url } = await uploadFile(file, 'ltxv-images');
      setConfig(prev => ({ ...prev, imageUrl: url }));
      
      // Auto-analyze the image with OpenAI Vision
      await analyzeImageWithOpenAI(url);
      
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const calculateTokenCost = () => {
    let baseCost = 25; // Base cost for LTXV
    
    // Additional cost for more frames
    if (config.numFrames > 120) {
      baseCost += Math.floor((config.numFrames - 120) / 24) * 3;
    }
    
    // Additional cost for higher frame rate
    if (config.frameRate === 30) {
      baseCost += 8;
    } else if (config.frameRate === 60) {
      baseCost += 12;
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
          'fal_ltxv'
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
      console.log('Starting LTXV generation...');
      
      // Create generation record
      const generation = await createAIGeneration(
        'fal_ltxv',
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
      
      // Refresh profile to get accurate token counts from database
      await fetchProfile();

      console.log('Tokens deducted, calling Edge Function...');

      // Call Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-ltxv`, {
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
      setConfig(prev => ({ ...prev, prompt: '', negativePrompt: '' }));

      console.log('Generation request completed successfully');

    } catch (error) {
      console.error('Error generating:', error);
      
      // Check if it's an NSFW content error
      if (isNSFWError(error.message)) {
        const nsfwDetails = parseNSFWError(error.message);
        setNsfwError(nsfwDetails);
        setShowNSFWAlert(true);
      } else {
        alert(`Error: ${error.message}`);
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
      link.download = `ltxv-video-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link
      const link = document.createElement('a');
      link.href = toCdnUrl(videoUrl);
      link.download = `ltxv-video-${Date.now()}.mp4`;
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
                <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">LTXV Video Creator</h1>
                  <p className="text-purple-200 text-sm">Advanced image-to-video generation with extensive customization</p>
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
          {/* Configuration Panel - Left Side */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sticky top-8 max-h-[90vh] overflow-y">
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
                      e.currentTarget.classList.add('border-emerald-400', 'bg-emerald-500/10');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-emerald-400', 'bg-emerald-500/10');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-emerald-400', 'bg-emerald-500/10');
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
                            {uploadingImage ? 'Uploading...' : 'Upload or drag & drop image'}
                          </p>
                          <p className="text-purple-300 text-xs mt-1">
                            Advanced image-to-video generation • Drag & drop supported
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Motion Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Wand2 className="w-4 h-4 inline mr-1" />
                    Motion Prompt *
                  </label>
                  <textarea
                    value={config.prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder={imageAnalysis ? "AI suggested prompt loaded above..." : "Describe the motion you want to see..."}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={3}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-purple-300 text-xs">
                      {imageAnalysis ? "✨ AI-generated motion prompt" : "Example: A person walking through a bustling city street"}
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
                  <p className="text-purple-300 text-xs mt-1">
                    Example: "The astronaut gets up and walks away"
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
                    placeholder="What to avoid in the video..."
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={2}
                  />
                  <p className="text-purple-300 text-xs mt-1">
                    Example: "worst quality, inconsistent motion, blurry, jittery"
                  </p>
                </div>

                {/* Resolution */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Monitor className="w-4 h-4 inline mr-1" />
                    Resolution
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {resolutionOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setConfig(prev => ({ ...prev, resolution: option.value }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          config.resolution === option.value
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {option.label} {option.value === "1080p" && "(+12 tokens)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {aspectRatioOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setConfig(prev => ({ ...prev, aspectRatio: option.value }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                          config.aspectRatio === option.value
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {option.icon}
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frame Count */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Film className="w-4 h-4 inline mr-1" />
                    Duration (Frames)
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {framePresets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setConfig(prev => ({ ...prev, numFrames: preset.value }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          config.numFrames === preset.value
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {preset.label} {preset.value > 121 && "(+" + Math.floor((preset.value - 121) / 24) * 5 + " tokens)"}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2">
                    <input
                      type="range"
                      min="9"
                      max="720"
                      step="1"
                      value={config.numFrames}
                      onChange={(e) => setConfig(prev => ({ ...prev, numFrames: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-purple-300 mt-1">
                      <span>9 frames</span>
                      <span>Custom: {config.numFrames}</span>
                      <span>720 frames</span>
                    </div>
                  </div>
                </div>

                {/* Frame Rate */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Frame Rate
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {frameRateOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setConfig(prev => ({ ...prev, frameRate: option.value }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          config.frameRate === option.value
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {option.label} {option.value === 30 && "(+8 tokens)"}
                        {option.value === 60 && "(+12 tokens)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="border-t border-white/20 pt-6">
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center">
                    <Sliders className="w-4 h-4 mr-2" />
                    Advanced Settings
                  </h3>

                  {/* Inference Steps */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        1st Pass Steps: {config.firstPassNumInferenceSteps}
                      </label>
                      <input
                        type="range"
                        min="2"
                        max="12"
                        value={config.firstPassNumInferenceSteps}
                        onChange={(e) => setConfig(prev => ({ ...prev, firstPassNumInferenceSteps: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        2nd Pass Steps: {config.secondPassNumInferenceSteps}
                      </label>
                      <input
                        type="range"
                        min="2"
                        max="12"
                        value={config.secondPassNumInferenceSteps}
                        onChange={(e) => setConfig(prev => ({ ...prev, secondPassNumInferenceSteps: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                  </div>

                  {/* Second Pass Skip Steps */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Second Pass Skip Steps: {config.secondPassSkipInitialSteps} (1-11)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="11"
                      value={config.secondPassSkipInitialSteps}
                      onChange={(e) => setConfig(prev => ({ ...prev, secondPassSkipInitialSteps: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>

                  {/* Temporal AdaIN Factor */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Temporal AdaIN Factor: {config.temporalAdainFactor} (0-1)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.temporalAdainFactor}
                      onChange={(e) => setConfig(prev => ({ ...prev, temporalAdainFactor: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-purple-300 mt-1">
                      <span>Less Temporal</span>
                      <span>More Temporal</span>
                    </div>
                  </div>

                  {/* Tone Map Compression Ratio */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Tone Map Compression: {config.toneMapCompressionRatio} (0-1)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.toneMapCompressionRatio}
                      onChange={(e) => setConfig(prev => ({ ...prev, toneMapCompressionRatio: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-purple-300 mt-1">
                      <span>No Compression</span>
                      <span>Max Compression</span>
                    </div>
                  </div>

                  {/* Constant Rate Factor */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Quality (CRF): {config.constantRateFactor} (1-51)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="51"
                      value={config.constantRateFactor}
                      onChange={(e) => setConfig(prev => ({ ...prev, constantRateFactor: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-purple-300 mt-1">
                      <span>Best Quality</span>
                      <span>Balanced</span>
                      <span>Fastest</span>
                    </div>
                  </div>

                  {/* LoRA Management */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      <Layers className="w-4 h-4 inline mr-1" />
                      LoRA Models
                    </label>
                    
                    {/* Current LoRAs */}
                    {config.loras.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {config.loras.map((lora, index) => (
                          <div key={index} className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm truncate">{lora.url}</p>
                              <p className="text-purple-300 text-xs">Scale: {lora.scale}</p>
                            </div>
                            <button
                              onClick={() => removeLora(index)}
                              className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Add LoRA */}
                    <div className="space-y-2">
                      <input
                        type="url"
                        value={newLoraUrl}
                        onChange={(e) => setNewLoraUrl(e.target.value)}
                        placeholder="LoRA URL..."
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                      />
                      <div className="flex items-center space-x-2">
                        <label className="text-xs text-purple-300">Scale:</label>
                        <input
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={newLoraScale}
                          onChange={(e) => setNewLoraScale(parseFloat(e.target.value))}
                          className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                        />
                        <button
                          onClick={addLora}
                          disabled={!newLoraUrl.trim()}
                          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Toggle Options */}
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={config.expandPrompt}
                        onChange={(e) => setConfig(prev => ({ ...prev, expandPrompt: e.target.checked }))}
                        className="w-4 h-4 text-emerald-600 bg-white/10 border-white/20 rounded focus:ring-emerald-500"
                      />
                      <div>
                        <span className="text-white font-medium">Expand Prompt</span>
                        <p className="text-purple-300 text-xs">Automatically enhance prompt for better results</p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={config.reverseVideo}
                        onChange={(e) => setConfig(prev => ({ ...prev, reverseVideo: e.target.checked }))}
                        className="w-4 h-4 text-emerald-600 bg-white/10 border-white/20 rounded focus:ring-emerald-500"
                      />
                      <div>
                        <span className="text-white font-medium flex items-center">
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Reverse Video
                        </span>
                        <p className="text-purple-300 text-xs">Play the generated video in reverse</p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={config.enableSafetyChecker}
                        onChange={(e) => setConfig(prev => ({ ...prev, enableSafetyChecker: e.target.checked }))}
                        className="w-4 h-4 text-emerald-600 bg-white/10 border-white/20 rounded focus:ring-emerald-500"
                      />
                      <div>
                        <span className="text-white font-medium flex items-center">
                          <Shield className="w-4 h-4 mr-1" />
                          Safety Checker
                        </span>
                        <p className="text-purple-300 text-xs">Filter inappropriate content (recommended)</p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={config.enableDetailPass}
                        onChange={(e) => setConfig(prev => ({ ...prev, enableDetailPass: e.target.checked }))}
                        className="w-4 h-4 text-emerald-600 bg-white/10 border-white/20 rounded focus:ring-emerald-500"
                      />
                      <div>
                        <span className="text-white font-medium">Enable Detail Pass</span>
                        <p className="text-purple-300 text-xs">Additional processing pass for enhanced detail</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.imageUrl || !config.prompt.trim()}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
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
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                  <p className="text-emerald-200 text-xs">
                    <Film className="w-3 h-3 inline mr-1" />
                    LTXV video generation may take 5-12 minutes depending on settings. You can navigate away and check your Gallery later.
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
                    {generations.slice(0, window.innerWidth >= 1024 ? 4 : generations.length).map((generation) => (
                      <div key={generation.id} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{generation.generation_name}</p>
                            <p className="text-purple-200 text-sm">
                              {config.numFrames} frames • {config.resolution} • {config.frameRate}fps • 
                              Started: {new Date(generation.created_at).toLocaleTimeString()}
                            </p>
                            <p className="text-purple-300 text-xs mt-1">
                              LTXV generation typically takes 5-12 minutes
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
                            <div className="mb-4 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-lg p-8 text-center">
                              <RefreshCw className="w-12 h-12 text-emerald-300 animate-spin mx-auto mb-2" />
                              <p className="text-emerald-200">Generating advanced video...</p>
                              <p className="text-emerald-300 text-sm">This may take 5-12 minutes</p>
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
                                <strong>Resolution:</strong> {generation.input_data?.resolution}
                              </span>
                              <span>
                                <strong>Aspect:</strong> {generation.input_data?.aspectRatio}
                              </span>
                              <span>
                                <strong>Frames:</strong> {generation.input_data?.numFrames}
                              </span>
                              <span>
                                <strong>FPS:</strong> {generation.input_data?.frameRate}
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
                    {selectedGeneration.input_data?.prompt && (
                      <div>
                        <span className="text-purple-200">Motion Prompt:</span>
                        <p className="text-white mt-1 p-2 bg-white/5 rounded">
                          {selectedGeneration.input_data.prompt}
                        </p>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-purple-200">Resolution:</span>
                      <span className="text-white">{selectedGeneration.input_data?.resolution}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Aspect Ratio:</span>
                      <span className="text-white">{selectedGeneration.input_data?.aspectRatio}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Frames:</span>
                      <span className="text-white">{selectedGeneration.input_data?.numFrames}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Frame Rate:</span>
                      <span className="text-white">{selectedGeneration.input_data?.frameRate} fps</span>
                    </div>
                    {selectedGeneration.metadata?.processing_time && (
                      <div className="flex justify-between">
                        <span className="text-purple-200">Processing Time:</span>
                        <span className="text-white">{selectedGeneration.metadata.processing_time}</span>
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
        toolName="LTXV Video Creator"
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
        toolName="LTXV Video Creator"
      />

      {/* Custom Styles */}
      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #10B981, #14B8A6);
          cursor: pointer;
          border: 2px solid white;
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #10B981, #14B8A6);
          cursor: pointer;
          border: 2px solid white;
        }
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

export default LTXVVideo;
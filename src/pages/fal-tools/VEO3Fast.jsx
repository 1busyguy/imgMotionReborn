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
  Volume2,
  VolumeX
} from 'lucide-react';

const VEO3Fast = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state - based on VEO3 Fast API parameters
  const [config, setConfig] = useState({
    imageUrl: '',
    prompt: '',
    duration: "8s",
    generateAudio: true,
    resolution: "720p"
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

  // Duration options (API expects string with 's' suffix)
  const durationOptions = [
    { label: '8 seconds', value: "8s", cost: 64 },
  ];

  // Resolution options
  const resolutionOptions = [
    { label: '720p (HD)', value: '720p' },
    { label: '1080p (Full HD)', value: '1080p' }
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription for this specific tool type
      const subscription = supabase
        .channel('veo3_fast_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id},tool_type=eq.fal_veo3_fast`
          },
          (payload) => {
            console.log('🎬 VEO3 Fast Real-time update received:', payload);
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

      console.log('Real-time subscription set up for VEO3 Fast');
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
        .eq('tool_type', 'fal_veo3_fast')
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
      
      // Show failure notification with 1-second delay
      if (newRecord?.status === 'failed') {
        setTimeout(() => {
          const errorMessage = newRecord.error_message || 'Generation failed';
          showAlert('error', 'Generation Failed', `VEO3 Fast generation failed: ${errorMessage}`);
        }, 1000);
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
          toolType: 'veo3-fast',
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
      const { url } = await uploadFile(file, 'veo3-fast-images');
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
    // VEO3 Fast token costs based on audio and resolution
    let baseCost;
    if (config.generateAudio) {
      baseCost = 427; // Audio ON
    } else {
      baseCost = 288; // Audio OFF
    }
    
    // Double cost for 1080p resolution
    if (config.resolution === '1080p') {
      baseCost = baseCost * 2;
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
          'fal_veo3_fast'
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
    let generation = null;
    
    try {
      console.log('🚀 Starting VEO3 Fast generation...');
      
      generation = await createAIGeneration(
        'fal_veo3_fast',
        config.prompt.substring(0, 50) + '...',
        config,
        tokenCost
      );

      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      await updateTokenCount(user.id, tokenCost);
      await fetchProfile();

      console.log('💰 Tokens deducted, calling Edge Function...');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-veo3-fast`, {
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

      setConfig(prev => ({ ...prev, prompt: '' }));
      console.log('✅ VEO3 Fast generation request submitted successfully');

    } catch (error) {
      console.error('❌ Error generating:', error);
      
      if (generation) {
        setGenerations(current => current.filter(g => g.id !== generation.id));
        setActiveGenerations(current => current.filter(g => g.id !== generation.id));
      }
      
      if (isNSFWError(error.message)) {
        const nsfwDetails = parseNSFWError(error.message);
        setNsfwError(nsfwDetails);
        setShowNSFWAlert(true);
      } else {
        showAlert('error', 'Generation Failed', `VEO3 Fast generation failed: ${error.message}`);
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
      link.download = `veo3-fast-video-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      const link = document.createElement('a');
      link.href = toCdnUrl(videoUrl);
      link.download = `veo3-fast-video-${Date.now()}.mp4`;
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
                <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">VEO3 Fast</h1>
                  <p className="text-purple-200 text-sm">Fast image-to-video generation with Google's VEO3 model</p>
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
                      e.currentTarget.classList.add('border-red-400', 'bg-red-500/10');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-red-400', 'bg-red-500/10');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-red-400', 'bg-red-500/10');
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
                            AI will analyze and suggest motion prompts • Drag & drop supported
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
                    placeholder={imageAnalysis ? "AI suggested prompt loaded above..." : "Describe the motion and animation you want..."}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={4}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-purple-300 text-xs">
                      {imageAnalysis ? "✨ AI-generated motion prompt" : "Be specific about the motion, camera movement, and scene dynamics"}
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

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Duration: {config.duration}
                  </label>
                  <div className="bg-white/10 border border-white/20 rounded-lg p-3 text-center">
                    <span className="text-white font-medium">8 seconds</span>
                    <p className="text-purple-300 text-xs mt-1">Fixed duration for VEO3 Fast</p>
                  </div>
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
                            ? 'bg-red-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Audio */}
                <div>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={config.generateAudio}
                      onChange={(e) => setConfig(prev => ({ ...prev, generateAudio: e.target.checked }))}
                      className="w-4 h-4 text-red-600 bg-white/10 border-white/20 rounded focus:ring-red-500"
                    />
                    <div>
                      <span className="text-white font-medium flex items-center">
                        {config.generateAudio ? <Volume2 className="w-4 h-4 mr-1" /> : <VolumeX className="w-4 h-4 mr-1" />}
                        Generate Audio
                      </span>
                      <p className="text-purple-300 text-xs">
                        Add AI-generated audio to match the video
                      </p>
                    </div>
                  </label>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.imageUrl || !config.prompt.trim()}
                  className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
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
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-200 text-xs">
                    <Film className="w-3 h-3 inline mr-1" />
                    VEO3 Fast generation may take 2-8 minutes. Cost varies by audio and resolution settings.
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
                              Duration: {generation.input_data?.duration} • 
                              Started: {new Date(generation.created_at).toLocaleTimeString()}
                            </p>
                            <p className="text-purple-300 text-xs mt-1">
                              VEO3 Fast generation typically takes 2-5 minutes
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
                    <p className="text-purple-300 text-sm">Upload an image and describe motion to create fast videos with VEO3</p>
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
                            <div className="mb-4 bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-lg p-8 text-center">
                              <RefreshCw className="w-12 h-12 text-red-300 animate-spin mx-auto mb-2" />
                              <p className="text-red-200">Generating fast video...</p>
                              <p className="text-red-300 text-sm">This may take 2-5 minutes</p>
                            </div>
                          )}

                          {generation.status === 'failed' && (
                            <div className="mb-4 bg-red-500/20 rounded-lg p-4 text-center">
                              <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                              <p className="text-red-400 text-sm">Generation failed</p>
                              {generation.error_message && (
                                <p className="text-red-300 text-xs mt-2">{generation.error_message}</p>
                              )}
                            </div>
                          )}

                          <div className="space-y-2 text-sm text-purple-300">
                            <p>
                              <strong>Motion:</strong> {generation.input_data?.prompt}
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                              <span>
                                <strong>Duration:</strong> {generation.input_data?.duration}
                              </span>
                              <span>
                                <strong>Resolution:</strong> {generation.input_data?.resolution}
                              </span>
                              <span>
                                <strong>Audio:</strong> {generation.input_data?.generateAudio ? 'Yes' : 'No'}
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
        toolName="VEO3 Fast"
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
        toolName="VEO3 Fast"
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

export default VEO3Fast;
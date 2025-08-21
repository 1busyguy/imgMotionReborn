import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { createAIGeneration, updateTokenCount, uploadFile } from '../../utils/storageHelpers';
import { isContentPolicyError, parseContentPolicyError } from '../../utils/errorHandlers';
import { toCdnUrl } from '../../utils/cdnHelpers';
import { performSafetyAnalysis, shouldShowWarning, getSafetyWarningMessage, logSafetyAnalysis } from '../../utils/safescan';
import NSFWAlert from '../../components/NSFWAlert';
import SafetyWarningModal from '../../components/SafetyWarningModal';
import PresetLoraSelector from '../../components/PresetLoraSelector';
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
  Film,
  Wand2,
  Image as ImageIcon,
  Shield,
  ArrowRight,
  Dice6,
  Sparkles,
  Clock,
  Monitor,
  Layers
} from 'lucide-react';

const WanV22Img2VideoLora = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state - based on WAN v2.2-a14b Image-to-Video LoRA API
  const [config, setConfig] = useState({
    imageUrl: '',
    prompt: '',
    negativePrompt: '',
    resolution: '720p',
    numFrames: 81,
    framesPerSecond: 16,
    aspectRatio: '16:9',
    numInferenceSteps: 27,
    enableSafetyChecker: true,
    enablePromptExpansion: false,
    acceleration: 'none',
    guidanceScale: 3.5,
    guidanceScale2: 4,
    shift: 5,
    interpolatorModel: 'film',
    numInterpolatedFrames: 1,
    adjustFpsForInterpolation: true,
    promptExtend: true,
    seed: -1,
    loras: []
  });
  
  // Generation state
  const [generations, setGenerations] = useState([]);
  const [activeGenerations, setActiveGenerations] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showNSFWAlert, setShowNSFWAlert] = useState(false);
  const [nsfwError, setNsfwError] = useState(null);
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
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [imageDimensions, setImageDimensions] = useState(null);
     
   // LoRA management state
  const [showLoraForm, setShowLoraForm] = useState(false);
  const [newLora, setNewLora] = useState({
    path: '',
    weight_name: '',
    scale: 1.0,
    transformer: 'high'
  });

  const transformerOptions = [
    { label: 'High', value: 'high' },
    { label: 'Low', value: 'low' },
    { label: 'Both', value: 'both' }
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      const subscription = supabase
        .channel('wan_v22_img2video_lora_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id},tool_type=eq.fal_wan_v22_img2video_lora`
          },
          (payload) => handleRealtimeUpdate(payload)
        )
        .subscribe();

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
        .eq('tool_type', 'fal_wan_v22_img2video_lora')
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
          return current.map(item => item.id === newRecord.id ? newRecord : item);
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
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image-openai`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          imageUrl,
          toolType: 'wan-v22-img2video-lora',
          analysisType: 'motion-prompt'
        })
      });

      if (response.ok) {
        const analysis = await response.json();
        if (analysis.success && analysis.motionPrompt) {
          setImageAnalysis(analysis);
          setConfig(prev => ({ ...prev, prompt: analysis.motionPrompt }));
        }
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
    } finally {
      setAnalyzingImage(false);
    }
  };

  // Analyze image to get dimensions
  const analyzeImageDimensions = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const dimensions = {
          width: img.width,
          height: img.height,
          aspectRatio: img.width / img.height
        };
        resolve(dimensions);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to analyze image dimensions'));
      };
      img.src = URL.createObjectURL(file);
    });
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
      // Analyze image dimensions first
      const dimensions = await analyzeImageDimensions(file);
      setImageDimensions(dimensions);
      console.log('📐 Image dimensions:', dimensions);
      
      const { url } = await uploadFile(file, 'wan22-img2video-lora-images');
      setConfig(prev => ({ ...prev, imageUrl: url }));
      await analyzeImageWithOpenAI(url);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert(`Error uploading image: ${error.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const calculateTokenCost = () => {
    let baseCost = 30;
    if (config.resolution === '720p') baseCost = 100;
    else if (config.resolution === '580p') baseCost = 75;
    else baseCost = 50;
    const frameMultiplier = config.numFrames / 81;
    baseCost = Math.ceil(baseCost * frameMultiplier);
    return Math.max(30, baseCost);
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
          'fal_wan_v22_img2video_lora'
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
    const totalTokens = (profile?.tokens || 0) + (profile?.purchased_tokens || 0);
    if (totalTokens < tokenCost) {
      alert('Insufficient tokens. Please upgrade your plan.');
      return;
    }

    setGenerating(true);
    let generation = null;
    
    try {
      generation = await createAIGeneration(
        'fal_wan_v22_img2video_lora',
        config.prompt.substring(0, 50) + '...',
        config,
        tokenCost
      );

      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      await updateTokenCount(user.id, tokenCost);
      await fetchProfile();

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-wan-v22-img2video-lora`, {
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
    } catch (error) {
      if (generation) {
        setGenerations(current => current.filter(g => g.id !== generation.id));
        setActiveGenerations(current => current.filter(g => g.id !== generation.id));
      }
      if (isContentPolicyError(error.message)) {
        const policyDetails = parseContentPolicyError(error.message);
        setNsfwError(policyDetails);
        setShowNSFWAlert(true);
      } else {
        showAlert('error', 'Generation Failed', `WAN v2.2 Img2Video LoRA generation failed: ${error.message}`);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (videoUrl) => {
    if (!videoUrl) return;
    try {
      const response = await fetch(toCdnUrl(videoUrl));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wan-v22-img2video-lora-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      const link = document.createElement('a');
      link.href = toCdnUrl(videoUrl);
      link.download = `wan-v22-img2video-lora-${Date.now()}.mp4`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDelete = async (generationId) => {
    if (!generationId) return;
    if (!confirm('Are you sure you want to remove this generation? It will be hidden from your account.')) return;

    try {
      const { data, error } = await supabase.rpc('soft_delete_generation', {
        generation_id: generationId,
        user_id: user.id
      });

      if (error) throw error;
      if (!data) throw new Error('Generation not found or already removed');
    } catch (error) {
      console.error('Error deleting generation:', error);
      alert('Error removing generation. Please try again.');
    }
  };

  const copyPrompt = (prompt) => {
    if (prompt) navigator.clipboard.writeText(prompt);
  };

  const addLora = () => {
    if (!newLora.path.trim() || !newLora.weight_name.trim()) {
      alert('Please fill in both Path and Weight Name');
      return;
    }

    if (config.loras.length >= 2) {
      alert('Maximum 2 LoRAs allowed');
      return;
    }

    const loraToAdd = {
      path: newLora.path.trim(),
      weight_name: newLora.weight_name.trim(),
      scale: newLora.scale,
      transformer: newLora.transformer
    };
    setConfig(prev => ({ ...prev, loras: [...prev.loras, loraToAdd] }));
    setNewLora({ path: '', weight_name: '', scale: 1.0, transformer: 'high' });
    setShowLoraForm(false);
  };

  const removeLora = (index) => {
    setConfig(prev => ({ ...prev, loras: prev.loras.filter((_, i) => i !== index) }));
  };

  const updateLoraScale = (index, newScale) => {
    setConfig(prev => ({
      ...prev,
      loras: prev.loras.map((lora, i) => i === index ? { ...lora, scale: newScale } : lora)
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'processing': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 overflow-x-hidden">
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
              <div className="h-6 w-px bg-white/20" />
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-white truncate">WAN v2.2 Img2Video LoRA</h1>
                  <p className="text-purple-200 text-sm truncate">Advanced image-to-video generation with WAN v2.2-a14b model and LoRA fine-tuning</p>
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
          {/* Configuration Panel */}
          <div className="lg:col-span-1 w-full min-w-0">
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
                    className="border-2 border-dashed border-white/30 rounded-lg p-3 lg:p-4 text-center transition-colors hover:border-white/50"
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
                            className="w-full h-24 lg:h-32 object-contain rounded-lg bg-black/20"
                            loading="lazy"
                          />
                          <p className="text-purple-200 text-sm">Click to change</p>
                          {imageAnalysis && (
                            <div className="mb-4 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-lg p-6 lg:p-8 text-center">
                              <p className="font-medium">✨ AI Analysis Complete</p>
                              <p className="text-sm">Subject: <span className="break-words">{imageAnalysis.subject}</span></p>
                              <p className="text-sm">Scene: <span className="break-words">{imageAnalysis.scene}</span></p>
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
                    <Film className="w-4 h-4 inline mr-1" />
                    Motion Prompt *
                  </label>
                  <textarea
                    value={config.prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder={imageAnalysis ? "AI suggested prompt loaded above..." : "Describe the motion and animation you want..."}
                    className="w-full px-3 lg:px-4 py-2 lg:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm lg:text-base break-words"
                    rows={4}
                    maxLength={3000}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-purple-300 text-xs">
                      {config.prompt.length}/3000 characters
                    </p>
                    {imageAnalysis && (
                      <button
                        disabled={analyzingImage}
                        onClick={() => {
                          if (option.value === 'auto' && imageDimensions) {
                            // Use actual image dimensions for auto
                            const { width, height } = imageDimensions;
                            setConfig(prev => ({ 
                              ...prev, 
                              aspectRatio: `${width}:${height}`,
                              customWidth: width,
                              customHeight: height
                            }));
                          } else {
                            setConfig(prev => ({ ...prev, aspectRatio: option.value }));
                          }
                        }}
                      >
                        <span>✨</span>
                        <span className="truncate">{option.label}</span>
                        {option.value === 'auto' && imageDimensions && (
                          <span className="text-xs opacity-75">
                            ({imageDimensions.width}×{imageDimensions.height})
                          </span>
                        )}
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
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none break-words"
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
                          ? 'bg-violet-500/30 border-violet-400 text-white'
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
                          ? 'bg-violet-500/30 border-violet-400 text-white'
                          : 'bg-white/5 border-white/20 text-purple-200 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-medium">580p</div>
                      <div className="text-xs opacity-70">75 tokens</div>
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, resolution: '720p' }))}
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        config.resolution === '720p'
                          ? 'bg-violet-500/30 border-violet-400 text-white'
                          : 'bg-white/5 border-white/20 text-purple-200 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-medium">720p</div>
                      <div className="text-xs opacity-70">100 tokens</div>
                    </button>
                  </div>
                </div>

                {/* LoRA Configuration */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-purple-200">
                      <Layers className="w-4 h-4 inline mr-1" />
                      LoRAs ({config.loras.length}/2)
                    </label>
                    <button
                      onClick={() => setShowLoraForm(true)}
                      disabled={config.loras.length >= 2}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        config.loras.length >= 2
                          ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                          : 'bg-violet-500 hover:bg-violet-600 text-white'
                      }`}
                    >
                      + Add LoRA
                    </button>
                  </div>

                    {/* Add Preset LoRA Selector */}
                    <PresetLoraSelector
                      toolType="i2v" // or "t2v" for text2video component
                      userTier={profile?.subscription_tier || 'free'}
                      currentLoras={config.loras}
                      onAddLora={(lora) => {
                        setConfig(prev => ({
                          ...prev,
                          loras: [...prev.loras, lora]
                        }));
                      }}
                      maxLoras={2}
                    />

                  {/* Existing LoRAs */}
                  {config.loras.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {config.loras.map((lora, index) => (
                        <div key={index} className="bg-white/5 rounded-lg p-3 border border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium text-sm truncate">{lora.weight_name}</p>
                              {/* URL hidden for security */}
                            </div>
                            <button
                              onClick={() => removeLora(index)}
                              className="bg-red-500 hover:bg-red-600 text-white p-1 rounded transition-colors ml-2"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-purple-300 mb-1">Scale: {lora.scale}</label>
                              <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={lora.scale}
                                onChange={(e) => updateLoraScale(index, parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-purple-300 mb-1">Transformer</label>
                              <select
                                value={lora.transformer}
                                onChange={(e) => {
                                  setConfig(prev => ({
                                    ...prev,
                                    loras: prev.loras.map((l, i) => i === index ? { ...l, transformer: e.target.value } : l)
                                  }));
                                }}
                                className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                              >
                                {transformerOptions.map(option => (
                                  <option key={option.value} value={option.value} className="bg-gray-800">
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add LoRA Form */}
                  {showLoraForm && config.loras.length < 2 && (
                    <div className="bg-white/5 rounded-lg p-4 border border-violet-500/30 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-white font-medium">Add New LoRA</h4>
                        <button
                          onClick={() => setShowLoraForm(false)}
                          className="text-purple-400 hover:text-purple-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs text-purple-300 mb-1">Path *</label>
                        <input
                          type="url"
                          value={newLora.path}
                          onChange={(e) => setNewLora(prev => ({ ...prev, path: e.target.value }))}
                          placeholder="https://civitai.com/api/download/models/..."
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-violet-500 break-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-purple-300 mb-1">Weight Name *</label>
                        <input
                          type="text"
                          value={newLora.weight_name}
                          onChange={(e) => setNewLora(prev => ({ ...prev, weight_name: e.target.value }))}
                          placeholder="Wan 2.2 Lightning LoRAs"
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-purple-300 mb-1">Scale: {newLora.scale}</label>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={newLora.scale}
                            onChange={(e) => setNewLora(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                            className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                          />
                          <div className="flex justify-between text-xs text-purple-400 mt-1">
                            <span>0.0</span><span>1.0</span><span>2.0</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-purple-300 mb-1">Transformer</label>
                          <select
                            value={newLora.transformer}
                            onChange={(e) => setNewLora(prev => ({ ...prev, transformer: e.target.value }))}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          >
                            {transformerOptions.map(option => (
                              <option key={option.value} value={option.value} className="bg-gray-800">
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex space-x-3">
                        <button
                          onClick={addLora}
                          disabled={!newLora.path.trim() || !newLora.weight_name.trim()}
                          className="flex-1 bg-violet-500 hover:bg-violet-600 disabled:bg-violet-700 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                        >
                          Add LoRA
                        </button>
                        <button
                          onClick={() => setShowLoraForm(false)}
                          className="bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {config.loras.length === 0 && !showLoraForm && (
                    <div className="text-center py-4 text-purple-300 text-sm">
                      No LoRAs added. Click "Add LoRA" to enhance your generation (max 2).
                    </div>
                  )}

                  {config.loras.length >= 2 && (
                    <div className="text-center py-2 text-yellow-400 text-xs">
                      Maximum LoRA limit reached (2/2)
                    </div>
                  )}
                </div>

                {/* Number of Frames */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Film className="w-4 h-4 inline mr-1" />
                    Number of Frames: {config.numFrames}
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
                    <span>81 (standard)</span><span>121</span>
                  </div>
                </div>

                {/* Frames Per Second */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Frames Per Second: {config.framesPerSecond}
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
                    <span>4</span><span>16 (default)</span><span>60</span>
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, aspectRatio: 'auto' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.aspectRatio === 'auto'
                          ? 'bg-violet-500 text-white'
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      auto
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, aspectRatio: '16:9' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.aspectRatio === '16:9'
                          ? 'bg-violet-500 text-white'
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      16:9
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, aspectRatio: '9:16' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.aspectRatio === '9:16'
                          ? 'bg-violet-500 text-white'
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      9:16
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, aspectRatio: '1:1' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.aspectRatio === '1:1'
                          ? 'bg-violet-500 text-white'
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      1:1
                    </button>
                  </div>
                </div>

                {/* Inference Steps */}
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
                    <span>2 (fast)</span><span>27 (default)</span><span>40 (quality)</span>
                  </div>
                </div>

                {/* Guidance Scales */}
                <div className="grid grid-cols-2 gap-4">
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
                </div>

                {/* Shift */}
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
                    onChange={(e) => setConfig(prev => ({ ...prev, shift: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>1</span><span>5 (default)</span><span>10</span>
                  </div>
                </div>

                {/* Interpolator Model */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Interpolator Model
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, interpolatorModel: 'film' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.interpolatorModel === 'film'
                          ? 'bg-violet-500 text-white'
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      FILM
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, interpolatorModel: 'rife' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.interpolatorModel === 'rife'
                          ? 'bg-violet-500 text-white'
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      RIFE
                    </button>
                  </div>
                </div>

                {/* Interpolated Frames */}
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
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>0</span><span>1 (default)</span><span>4</span>
                  </div>
                </div>

                {/* Acceleration */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Acceleration
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, acceleration: 'none' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.acceleration === 'none'
                          ? 'bg-violet-500 text-white'
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      None
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, acceleration: 'regular' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.acceleration === 'regular'
                          ? 'bg-violet-500 text-white'
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      Regular
                    </button>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-4">
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
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.imageUrl || !config.prompt.trim()}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-3 lg:py-4 px-4 lg:px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2 text-sm lg:text-base"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      <span>Generate Video ({calculateTokenCost()} tokens)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 w-full min-w-0">
            <div className="space-y-4 lg:space-y-6">
              {/* Active Generations */}
              {activeGenerations.length > 0 && (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 lg:p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin" />
                    <h3 className="text-lg font-semibold text-white">Processing Videos ({activeGenerations.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {activeGenerations.map((generation) => (
                      <div key={generation.id} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-white font-medium truncate">{generation.generation_name}</p>
                            <p className="text-purple-200 text-sm truncate">
                              Started: {new Date(generation.created_at).toLocaleTimeString()}
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
                    
                    {/* View More Link - Desktop Only */}
                    {window.innerWidth >= 1024 && generations.length > 2 && (
                      <div className="text-center pt-4">
                        <button
                          onClick={() => navigate('/gallery')}
                          className="inline-flex items-center space-x-2 text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          <span>View all {generations.length} videos in Gallery</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Completed Generations */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 lg:p-6">
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
                  <div className="text-center py-8 lg:py-12">
                    <Video className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                    <p className="text-purple-200 text-lg">No videos generated yet</p>
                    <p className="text-purple-300 text-sm">
                      Upload an image and describe motion to create professional videos with LoRA fine-tuning
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 lg:space-y-6">
                    {generations.slice(0, window.innerWidth >= 1024 ? 3 : generations.length).map((generation) => (
                      <>
                        <div
                          key={generation.id}
                          className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-all duration-200"
                        >
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="min-w-0">
                                <h4 className="font-medium text-white truncate">
                                  {generation.generation_name}
                                </h4>
                                <p className="text-purple-200 text-sm truncate">
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
                                  className="w-full rounded-lg max-h-64 lg:max-h-96"
                                  poster={generation.input_data?.imageUrl ? toCdnUrl(generation.input_data.imageUrl) : undefined}
                                  preload="metadata"
                                  playsInline
                                >
                                  Your browser does not support the video tag.
                                </video>
                              </div>
                            )}

                            {generation.status === 'processing' && (
                              <div className="mb-4 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-lg p-8 text-center">
                                <RefreshCw className="w-12 h-12 text-violet-300 animate-spin mx-auto mb-2" />
                                <p className="text-violet-200">Generating professional video...</p>
                                <p className="text-violet-300 text-sm">This typically takes 1-2 minutes</p>
                              </div>
                            )}

                            {generation.status === 'failed' && (
                              <div className="mb-4 bg-red-500/20 rounded-lg p-4 text-center">
                                <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                                <p className="text-red-400 text-sm">Generation failed</p>
                                {generation.error_message && (
                                  <p className="text-red-300 text-xs mt-2 break-words">{generation.error_message}</p>
                                )}
                              </div>
                            )}

                            <div className="space-y-2 text-sm text-purple-300">
                              <p className="break-words">
                                <strong>Motion:</strong> {generation.input_data?.prompt}
                              </p>
                              <div className="flex flex-wrap items-center gap-3">
                                <span><strong>Resolution:</strong> {generation.input_data?.resolution || '720p'}</span>
                                <span><strong>Tokens:</strong> {generation.tokens_used}</span>
                                <span><strong>Frames:</strong> {generation.input_data?.numFrames || 81}</span>
                                <span><strong>FPS:</strong> {generation.input_data?.framesPerSecond || 16}</span>
                                <span><strong>Aspect:</strong> {generation.input_data?.aspectRatio || '16:9'}</span>
                                <span><strong>Steps:</strong> {generation.input_data?.numInferenceSteps || 27}</span>
                                <span><strong>Guidance:</strong> {generation.input_data?.guidanceScale || 3.5}</span>
                                <span><strong>Shift:</strong> {generation.input_data?.shift || 5}</span>
                                {generation.input_data?.loras && generation.input_data.loras.length > 0 && (
                                  <span className="basis-full">
                                    <strong>LoRAs:</strong> {generation.input_data.loras.length} applied
                                  </span>
                                )}
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
                      </>
                    ))}
                
                    {/* View More Link for Desktop */}
                    {generations.length > 2 && window.innerWidth >= 1024 && (
                      <div className="text-center pt-4">
                        <button
                          onClick={() => navigate('/gallery')}
                          className="text-purple-400 hover:text-purple-300 transition-colors text-sm flex items-center justify-center space-x-1"
                        >
                          <span>View More in Gallery</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
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
        toolName="WAN v2.2 Img2Video LoRA"
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
        toolName="WAN v2.2 Img2Video LoRA"
      />

      <style>{`
        .animation-delay-200 { animation-delay: 200ms; }
        .animation-delay-400 { animation-delay: 400ms; }
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

export default WanV22Img2VideoLora;
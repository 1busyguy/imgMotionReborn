import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { createAIGeneration, updateTokenCount } from '../../utils/storageHelpers';
import { isNSFWError, parseNSFWError } from '../../utils/errorHandlers';
import { toCdnUrl } from '../../utils/cdnHelpers';
import { performSafetyAnalysis, shouldShowWarning, getSafetyWarningMessage, logSafetyAnalysis } from '../../utils/safescan';
import NSFWAlert from '../../components/NSFWAlert';
import SafetyWarningModal from '../../components/SafetyWarningModal';
import ThemedAlert from '../../components/ThemedAlert';
import PresetLoraSelector from '../../components/PresetLoraSelector';
import { 
  ArrowLeft, 
  Zap, 
  Image as ImageIcon, 
  Download, 
  Trash2, 
  RefreshCw,
  Settings,
  Copy,
  X,
  Wand2,
  Sparkles,
  Dice6,
  Monitor,
  Smartphone,
  Square,
  Sliders,
  Hash,
  ZoomIn
} from 'lucide-react';

const QwenImage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state - based on Qwen Image API (text-to-image only)
  const [config, setConfig] = useState({
    prompt: '',
    negative_prompt: '',
    image_size: 'square_hd',
    num_inference_steps: 102,
    guidance_scale: 5.5,
    num_images: 2,
    enable_safety_checker: true,
    output_format: 'jpeg',
    acceleration: 'regular',
    seed: -1,
    loras: []
  });
  
  // Generation state
  const [generations, setGenerations] = useState([]);
  const [activeGenerations, setActiveGenerations] = useState([]);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [showNSFWAlert, setShowNSFWAlert] = useState(false);
  const [nsfwError, setNsfwError] = useState(null);
  const [showSafetyWarning, setShowSafetyWarning] = useState(false);
  const [safetyWarningData, setSafetyWarningData] = useState(null);
  const [bypassSafetyCheck, setBypassSafetyCheck] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    show: false,
    type: 'error',
    title: '',
    message: ''
  });

  // ============ STATE FOR DESKTOP LIMIT & MODALS ============
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [expandedImageIndex, setExpandedImageIndex] = useState(null);
  const [showExpandedImage, setShowExpandedImage] = useState(false);
  // ===========================================================

  // Image size options
  const imageSizeOptions = [
    { label: 'Square HD', value: 'square_hd', icon: <Square className="w-4 h-4" /> },
    { label: 'Square', value: 'square', icon: <Square className="w-4 h-4" /> },
    { label: 'Portrait 4:3', value: 'portrait_4_3', icon: <Smartphone className="w-4 h-4" /> },
    { label: 'Portrait 16:9', value: 'portrait_16_9', icon: <Smartphone className="w-4 h-4" /> },
    { label: 'Landscape 4:3', value: 'landscape_4_3', icon: <Monitor className="w-4 h-4" /> },
    { label: 'Landscape 16:9', value: 'landscape_16_9', icon: <Monitor className="w-4 h-4" /> }
  ];

  // Acceleration options
  const accelerationOptions = [
    { label: 'None', value: 'none' },
    { label: 'Regular', value: 'regular' },
    { label: 'High', value: 'high' }
  ];

  // Creative prompts for inspiration
  const promptSuggestions = [
    "Mount Fuji with cherry blossoms in the foreground, clear sky, peaceful spring day",
    "Cyberpunk cityscape at night with neon lights and flying cars",
    "Majestic dragon soaring through cloudy mountains at sunset",
    "Cozy coffee shop interior with warm lighting and vintage furniture",
    "Underwater coral reef scene with colorful fish and marine life",
    "Medieval castle on a hilltop surrounded by misty forests",
    "Space station orbiting Earth with stars in the background",
    "Enchanted forest with glowing mushrooms and fairy lights"
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription
      const subscription = supabase
        .channel('qwen_image_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id},tool_type=eq.fal_qwen_image`
          },
          (payload) => {
            console.log('🎨 Qwen Image Real-time update received:', payload);
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

      console.log('Real-time subscription set up for Qwen Image');
      return () => subscription.unsubscribe();
    }
  }, [user, isDesktop]); // Added isDesktop to dependencies

  // ============ HANDLE WINDOW RESIZE ============
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // ==============================================

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

  // ============ RESPONSIVE FETCH GENERATIONS ============
  const fetchGenerations = async () => {
    try {
      // Desktop: 2 items, Mobile/Tablet: 10 items
      const limit = isDesktop ? 2 : 10;
      
      const { data, error } = await supabase
        .from('ai_generations')
        .select('*')
        .eq('user_id', user.id)
        .eq('tool_type', 'fal_qwen_image')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setGenerations(data || []);
      setActiveGenerations(data?.filter(g => g.status === 'processing') || []);
    } catch (error) {
      console.error('Error fetching generations:', error);
    }
  };
  // ======================================================

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
      
      if (newRecord?.status === 'failed') {
        setTimeout(() => {
          const errorMessage = newRecord.error_message || 'Generation failed';
          showAlert('error', 'Generation Failed', `Qwen Image generation failed: ${errorMessage}`);
        }, 1000);
      }
    }
  };

  // ============ HELPER FUNCTION FOR IMAGE URLS ============
  const getAllImageUrls = (url) => {
    if (!url) return [];
    
    // Handle JSON array format (multiple images)
    if (typeof url === 'string' && url.startsWith('[')) {
      try {
        const urlArray = JSON.parse(url);
        return Array.isArray(urlArray) ? urlArray : [url];
      } catch (error) {
        console.warn('Failed to parse image URL array:', error);
        return [url];
      }
    }
    
    return [url];
  };
  // =========================================================

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

  const addLora = (lora) => {
    if (config.loras.length >= 5) {
      showAlert('warning', 'LoRA Limit Reached', 'Maximum 5 LoRAs allowed per generation');
      return;
    }
    setConfig(prev => ({
      ...prev,
      loras: [...prev.loras, lora]
    }));
  };

  const removeLora = (index) => {
    setConfig(prev => ({
      ...prev,
      loras: prev.loras.filter((_, i) => i !== index)
    }));
  };

  const updateLora = (index, field, value) => {
    setConfig(prev => ({
      ...prev,
      loras: prev.loras.map((lora, i) => 
        i === index ? { ...lora, [field]: value } : lora
      )
    }));
  };

  const calculateTokenCost = () => {
    // Base cost: 8 tokens per image for text-to-image
    return config.num_images * 8;
  };

  const handleGenerate = async () => {
    if (!config.prompt.trim()) {
      alert('Please enter a text prompt');
      return;
    }

    // --- SAFETY SCAN INTEGRATION ---
    if (!bypassSafetyCheck) {
      try {
        const analysisResult = await performSafetyAnalysis(
          null, // No image for text-to-image
          config.prompt,
          'fal_qwen_image'
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
      console.log('🎨 Starting Qwen Image generation...');
      
      generation = await createAIGeneration(
        'fal_qwen_image',
        config.prompt.substring(0, 50) + '...',
        config,
        tokenCost
      );

      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      await updateTokenCount(user.id, tokenCost);
      await fetchProfile();

      console.log('💰 Tokens deducted, calling Edge Function...');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-qwen-image`, {
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
      console.log('✅ Qwen Image generation request submitted successfully');

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
        showAlert('error', 'Generation Failed', `Qwen Image generation failed: ${error.message}`);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (imageUrl) => {
    try {
      const response = await fetch(toCdnUrl(imageUrl));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qwen-image-${Date.now()}.${config.output_format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      const link = document.createElement('a');
      link.href = toCdnUrl(imageUrl);
      link.download = `qwen-image-${Date.now()}.${config.output_format}`;
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
                <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Qwen Image Generator</h1>
                  <p className="text-purple-200 text-sm">Advanced text-to-image generation with Qwen's powerful AI model</p>
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
                <h2 className="text-lg font-semibold text-white">Image Generation</h2>
              </div>

              <div className="space-y-6">
                {/* Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Wand2 className="w-4 h-4 inline mr-1" />
                    Image Prompt *
                  </label>
                  <textarea
                    value={config.prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Describe the image you want to create..."
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={4}
                  />
                  <p className="text-purple-300 text-xs mt-1">
                    Be detailed about style, composition, lighting, and mood
                  </p>
                </div>

                {/* Negative Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Negative Prompt (Optional)
                  </label>
                  <textarea
                    value={config.negative_prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, negative_prompt: e.target.value }))}
                    placeholder="What you don't want to see..."
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={2}
                  />
                </div>

                {/* Prompt Suggestions */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Sparkles className="w-4 h-4 inline mr-1" />
                    Prompt Inspiration
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                    {promptSuggestions.slice(0, 4).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => setConfig(prev => ({ ...prev, prompt: suggestion }))}
                        className="text-left px-3 py-2 bg-white/5 hover:bg-white/10 text-purple-200 rounded-lg text-xs transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preset LoRA Library */}
                <PresetLoraSelector
                  toolType="Qi"
                  userTier={profile?.subscription_status || 'free'}
                  currentLoras={config.loras}
                  onAddLora={addLora}
                  maxLoras={5}
                />

                {/* Active LoRAs */}
                {config.loras.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      Active LoRAs ({config.loras.length}/5)
                    </label>
                    <div className="space-y-3">
                      {config.loras.map((lora, index) => (
                        <div key={index} className="bg-white/5 rounded-lg p-3 border border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium text-sm">{lora.weight_name}</span>
                            <button
                              onClick={() => removeLora(index)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                              title="Remove LoRA"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-purple-300 mb-1">Scale</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="3"
                                value={lora.scale}
                                onChange={(e) => updateLora(index, 'scale', parseFloat(e.target.value))}
                                className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-purple-300 mb-1">Transformer</label>
                              <select
                                value={lora.transformer || 'high'}
                                onChange={(e) => updateLora(index, 'transformer', e.target.value)}
                                className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              >
                                <option value="high" className="bg-gray-800">High</option>
                                <option value="low" className="bg-gray-800">Low</option>
                                <option value="both" className="bg-gray-800">Both</option>
                              </select>
                            </div>
                          </div>
                          
                          {/* Trigger Words Display */}
                          {lora.trigger_words && lora.trigger_words.length > 0 && (
                            <div className="mt-2">
                              <label className="block text-xs text-purple-300 mb-1">Trigger Words</label>
                              <div className="flex flex-wrap gap-1">
                                {lora.trigger_words.map((word, wordIndex) => (
                                  <span 
                                    key={wordIndex}
                                    className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs rounded cursor-pointer hover:bg-emerald-500/30 transition-colors"
                                    onClick={() => {
                                      const currentPrompt = config.prompt;
                                      const newPrompt = currentPrompt ? `${currentPrompt}, ${word}` : word;
                                      setConfig(prev => ({ ...prev, prompt: newPrompt }));
                                    }}
                                    title="Click to add to prompt"
                                  >
                                    {word}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Image Size */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Monitor className="w-4 h-4 inline mr-1" />
                    Output Size
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {imageSizeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setConfig(prev => ({ ...prev, image_size: option.value }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                          config.image_size === option.value
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

                {/* Number of Images */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Images to Generate: {config.num_images}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={config.num_images}
                    onChange={(e) => setConfig(prev => ({ ...prev, num_images: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                  </div>
                </div>

                {/* Guidance Scale */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Sliders className="w-4 h-4 inline mr-1" />
                    Guidance Scale: {config.guidance_scale}
                  </label>
                  <input
                    type="range"
                    min="1.0"
                    max="20.0"
                    step="0.5"
                    value={config.guidance_scale}
                    onChange={(e) => setConfig(prev => ({ ...prev, guidance_scale: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>Creative</span>
                    <span>Balanced</span>
                    <span>Precise</span>
                  </div>
                </div>

                {/* Inference Steps */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Hash className="w-4 h-4 inline mr-1" />
                    Inference Steps: {config.num_inference_steps}
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="250"
                    value={config.num_inference_steps}
                    onChange={(e) => setConfig(prev => ({ ...prev, num_inference_steps: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>Fast</span>
                    <span>Quality</span>
                  </div>
                </div>

                {/* Acceleration */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Acceleration
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {accelerationOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setConfig(prev => ({ ...prev, acceleration: option.value }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          config.acceleration === option.value
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Output Format */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Output Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, output_format: 'png' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.output_format === 'png'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      PNG
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, output_format: 'jpeg' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.output_format === 'jpeg'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      JPEG
                    </button>
                  </div>
                </div>

                {/* Safety Checker */}
                <div>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={config.enable_safety_checker}
                      onChange={(e) => setConfig(prev => ({ ...prev, enable_safety_checker: e.target.checked }))}
                      className="w-4 h-4 text-emerald-600 bg-white/10 border-white/20 rounded focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-white font-medium">Enable Safety Checker</span>
                      <p className="text-purple-300 text-xs">
                        Filter inappropriate content during generation
                      </p>
                    </div>
                  </label>
                </div>

                {/* Seed */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Dice6 className="w-4 h-4 inline mr-1" />
                    Seed (-1 for random)
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={config.seed}
                      onChange={(e) => setConfig(prev => ({ ...prev, seed: parseInt(e.target.value) || -1 }))}
                      className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, seed: Math.floor(Math.random() * 1000000) }))}
                      className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                      title="Random seed"
                    >
                      <Dice6 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Cost Display */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <h3 className="text-emerald-200 font-medium mb-2 flex items-center">
                    <Zap className="w-4 h-4 mr-2" />
                    Cost Calculation
                  </h3>
                  <div className="text-emerald-300 text-sm space-y-1">
                    <p>Images: {config.num_images}</p>
                    <p>Rate: 8 tokens per image</p>
                    <p className="font-medium text-emerald-200">Total: {calculateTokenCost()} tokens</p>
                  </div>
                </div>
                
                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.prompt.trim()}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Images...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4" />
                      <span>Generate Images ({calculateTokenCost()} tokens)</span>
                    </>
                  )}
                </button>

                {/* Processing Note */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                  <p className="text-emerald-200 text-xs">
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    Qwen image generation typically takes 30-60 seconds. Cost: 8 tokens per image.
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
                    <h3 className="text-lg font-semibold text-white">Processing Images ({activeGenerations.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {activeGenerations.map((generation) => (
                      <div key={generation.id} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{generation.generation_name}</p>
                            <p className="text-purple-200 text-sm">
                              Images: {generation.input_data?.num_images} • 
                              Started: {new Date(generation.created_at).toLocaleTimeString()}
                            </p>
                            <p className="text-purple-300 text-xs mt-1">
                              Image generation typically takes 30-60 seconds
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
                  <h3 className="text-lg font-semibold text-white">
                    Generated Images {isDesktop && generations.length > 0 && `(Showing latest 2)`}
                  </h3>
                  <button
                    onClick={fetchGenerations}
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {generations.length === 0 ? (
                  <div className="text-center py-12">
                    <ImageIcon className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                    <p className="text-purple-200 text-lg">No images generated yet</p>
                    <p className="text-purple-300 text-sm">Enter a prompt to create your first AI-generated image</p>
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

                          {/* ============ CLICKABLE IMAGES ============ */}
                          {generation.output_file_url && generation.status === 'completed' && (
                            <div className="mb-4">
                              {(() => {
                                const imageUrls = getAllImageUrls(generation.output_file_url);
                                return (
                                  <div className="grid grid-cols-2 gap-4">
                                    {imageUrls.map((imageUrl, imgIndex) => (
                                      <div 
                                        key={imgIndex} 
                                        className="relative group cursor-pointer"
                                        onClick={() => {
                                          setSelectedGeneration(generation);
                                          setShowDetailModal(true);
                                        }}
                                      >
                                        <img
                                          src={toCdnUrl(imageUrl)}
                                          alt={`Generated ${imgIndex + 1}`}
                                          className="w-full rounded-lg hover:opacity-90 transition-opacity"
                                          loading="lazy"
                                        />
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDownload(imageUrl);
                                          }}
                                          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                          title="Download image"
                                        >
                                          <Download className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                          {/* =========================================== */}

                          {generation.status === 'processing' && (
                            <div className="mb-4 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-lg p-8 text-center">
                              <RefreshCw className="w-12 h-12 text-emerald-300 animate-spin mx-auto mb-2" />
                              <p className="text-emerald-200">Generating images with Qwen AI...</p>
                              <p className="text-emerald-300 text-sm">This may take 30-60 seconds</p>
                            </div>
                          )}

                          {generation.status === 'failed' && (
                            <div className="mb-4 bg-red-500/20 rounded-lg p-4 text-center">
                              <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                              <p className="text-red-400 text-sm">Image generation failed</p>
                              {generation.error_message && (
                                <p className="text-red-300 text-xs mt-2">{generation.error_message}</p>
                              )}
                            </div>
                          )}

                          <div className="space-y-2 text-sm text-purple-300">
                            <p>
                              <strong>Prompt:</strong> {generation.input_data?.prompt}
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                              <span>
                                <strong>Size:</strong> {generation.input_data?.image_size}
                              </span>
                              <span>
                                <strong>Images:</strong> {generation.input_data?.num_images}
                              </span>
                              <span>
                                <strong>Steps:</strong> {generation.input_data?.num_inference_steps}
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
                                  title="Download images"
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

                    {/* ============ VIEW ALL LINK FOR DESKTOP ============ */}
                    {isDesktop && generations.length >= 2 && (
                      <div className="mt-4 text-center">
                        <button
                          onClick={() => navigate('/gallery')}
                          className="text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium"
                        >
                          View all generated images in Gallery →
                        </button>
                      </div>
                    )}
                    {/* ==================================================== */}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ GENERATION DETAIL MODAL ============ */}
      {showDetailModal && selectedGeneration && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">{selectedGeneration.generation_name}</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Images Display - CLICKABLE */}
              {selectedGeneration.output_file_url && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-white mb-3">
                    Generated Images ({getAllImageUrls(selectedGeneration.output_file_url).length})
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {getAllImageUrls(selectedGeneration.output_file_url).map((url, index) => (
                      <div
                        key={index}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          setExpandedImageIndex(index);
                          setShowExpandedImage(true);
                        }}
                      >
                        <img
                          src={toCdnUrl(url)}
                          alt={`${selectedGeneration.generation_name} - Image ${index + 1}`}
                          className="w-full rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generation Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Details Card */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">Generation Details</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-purple-200">Status:</span>
                      <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(selectedGeneration.status)}`}>
                        {selectedGeneration.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Tool:</span>
                      <span className="text-white">Qwen Image</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Tokens Used:</span>
                      <span className="text-white">{selectedGeneration.tokens_used}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Created:</span>
                      <span className="text-white text-right">
                        {new Date(selectedGeneration.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Configuration Card */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">Configuration</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-purple-200">Prompt:</span>
                      <p className="text-white mt-1 bg-black/20 rounded p-2">
                        {selectedGeneration.input_data?.prompt}
                      </p>
                    </div>
                    {selectedGeneration.input_data?.negative_prompt && (
                      <div>
                        <span className="text-purple-200">Negative Prompt:</span>
                        <p className="text-white mt-1 bg-black/20 rounded p-2">
                          {selectedGeneration.input_data.negative_prompt}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-purple-200">Size:</span>
                        <p className="text-white">{selectedGeneration.input_data?.image_size}</p>
                      </div>
                      <div>
                        <span className="text-purple-200">Images:</span>
                        <p className="text-white">{selectedGeneration.input_data?.num_images}</p>
                      </div>
                      <div>
                        <span className="text-purple-200">Steps:</span>
                        <p className="text-white">{selectedGeneration.input_data?.num_inference_steps}</p>
                      </div>
                      <div>
                        <span className="text-purple-200">Guidance:</span>
                        <p className="text-white">{selectedGeneration.input_data?.guidance_scale}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                {selectedGeneration.output_file_url && (
                  <button
                    onClick={() => {
                      const imageUrls = getAllImageUrls(selectedGeneration.output_file_url);
                      if (imageUrls.length > 1) {
                        imageUrls.forEach((url, index) => {
                          setTimeout(() => handleDownload(url), index * 500);
                        });
                      } else {
                        handleDownload(selectedGeneration.output_file_url);
                      }
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download All</span>
                  </button>
                )}
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ================================================== */}

      {/* ============ FULLSCREEN IMAGE VIEWER ============ */}
      {showExpandedImage && selectedGeneration && expandedImageIndex !== null && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="relative max-w-7xl w-full max-h-[95vh] flex items-center justify-center">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowExpandedImage(false);
                setExpandedImageIndex(null);
              }}
              className="absolute top-4 right-4 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Download Button */}
            <button
              onClick={() => {
                const imageUrls = getAllImageUrls(selectedGeneration.output_file_url);
                handleDownload(imageUrls[expandedImageIndex]);
              }}
              className="absolute top-4 left-4 z-10 bg-green-500/80 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Download className="w-5 h-5" />
              <span>Download</span>
            </button>

            {/* Navigation Arrows */}
            {getAllImageUrls(selectedGeneration.output_file_url).length > 1 && (
              <>
                <button
                  onClick={() => {
                    const imageUrls = getAllImageUrls(selectedGeneration.output_file_url);
                    setExpandedImageIndex((expandedImageIndex - 1 + imageUrls.length) % imageUrls.length);
                  }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                
                <button
                  onClick={() => {
                    const imageUrls = getAllImageUrls(selectedGeneration.output_file_url);
                    setExpandedImageIndex((expandedImageIndex + 1) % imageUrls.length);
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-6 h-6 rotate-180" />
                </button>
              </>
            )}

            {/* Expanded Image */}
            <img
              src={toCdnUrl(getAllImageUrls(selectedGeneration.output_file_url)[expandedImageIndex])}
              alt={`${selectedGeneration.generation_name} - Image ${expandedImageIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg"
            />

            {/* Bottom Navigation with Arrows */}
            {getAllImageUrls(selectedGeneration.output_file_url).length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 bg-black/70 px-3 py-2 rounded-full">
                <button
                  onClick={() => {
                    const imageUrls = getAllImageUrls(selectedGeneration.output_file_url);
                    setExpandedImageIndex((expandedImageIndex - 1 + imageUrls.length) % imageUrls.length);
                  }}
                  className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                
                <span className="text-white text-sm font-medium px-2">
                  {expandedImageIndex + 1} of {getAllImageUrls(selectedGeneration.output_file_url).length}
                </span>
                
                <button
                  onClick={() => {
                    const imageUrls = getAllImageUrls(selectedGeneration.output_file_url);
                    setExpandedImageIndex((expandedImageIndex + 1) % imageUrls.length);
                  }}
                  className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ================================================= */}

      {/* NSFW Alert Modal */}
      <NSFWAlert
        isOpen={showNSFWAlert}
        onClose={() => {
          setShowNSFWAlert(false);
          setNsfwError(null);
        }}
        toolName="Qwen Image Generator"
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
        toolName="Qwen Image Generator"
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
      `}</style>
    </div>
  );
};

export default QwenImage;
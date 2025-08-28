import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { createAIGeneration, updateTokenCount, uploadFile } from '../../utils/storageHelpers';
import { isNSFWError, parseNSFWError } from '../../utils/falErrorHandler';
import NSFWAlert from '../../components/NSFWAlert';
import { performSafetyAnalysis, shouldShowWarning, getSafetyWarningMessage, logSafetyAnalysis } from '../../utils/safescan';
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
  Camera,
  Clapperboard,
  Palette,
  Eye,
  Target,
  Monitor,
  Smartphone,
  Square,
  Maximize2,
  Volume2,
  VolumeX,
  Sparkles,
  Shield,
  RotateCcw,
  Layers
} from 'lucide-react';

const AISceneGen = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state - based on Railway model configurations
  const [config, setConfig] = useState({
    imageUrl: '',
    theme: '',
    background: '',
    mainSubject: '',
    toneAndColor: '',
    actionDirection: '',
    sceneVision: '',
    resolution: "720p",
    aspectRatio: "16:9",
    inferenceSteps: 40,
    safetyChecker: false,
    promptExpansion: true,
    numChains: 3,
    autoChains: false,
    modelType: "WAN (Default)", // Ensure this has a default value
    pixverseDuration: "5", // New duration option for Pixverse
    // Model-specific parameters
    modelParams: {
      // VEO3 specific
      generateAudio: false,
      enhancePrompt: true,
      negativePrompt: '',
      duration: "8s",
      // Pixverse specific
      style: "realistic",
      // LUMA specific
      loop: false
    }
  });
  
  // Generation state
  const [generations, setGenerations] = useState([]);
  const [activeGenerations, setActiveGenerations] = useState([]);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [updatingSceneVision, setUpdatingSceneVision] = useState(false);
  const [showNSFWAlert, setShowNSFWAlert] = useState(false);
  const [nsfwError, setNsfwError] = useState(null);

  // Model options - based on Railway supported models
  const [showSafetyWarning, setShowSafetyWarning] = useState(false);
  const [safetyWarningData, setSafetyWarningData] = useState(null);
  const [bypassSafetyCheck, setBypassSafetyCheck] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    show: false,
    type: 'error',
    title: '',
    message: ''
  });
  const modelOptions = [
    { label: 'WAN (Default)', value: "WAN (Default)", description: "Basic image-to-video generation" },
    { label: 'WAN Pro', value: "WAN Pro", description: "Professional quality generation" },
    { label: 'Pixverse v3.5', value: "Pixverse v3.5", description: "Fast generation with style options" },
    { label: 'LUMA Ray2', value: "LUMA Ray2", description: "High quality with video gen" }
  ];

  // Resolution options based on Railway model configs
  const resolutionOptions = {
    "wan": ["480p", "720p"],
    "wan-pro": ["1080p"],
    "pixverse": ["360p", "540p", "720p", "1080p"],
    "luma": ["540p", "720p", "1080p"]
  };

  // Aspect ratio options - based on Railway support
  const aspectRatioOptions = [
    { label: 'Landscape (16:9)', value: '16:9', icon: <Monitor className="w-4 h-4" /> },
    { label: 'Portrait (9:16)', value: '9:16', icon: <Smartphone className="w-4 h-4" /> },
    { label: 'Square (1:1)', value: '1:1', icon: <Square className="w-4 h-4" /> },
    { label: 'Cinematic (21:9)', value: '21:9', icon: <Maximize2 className="w-4 h-4" /> }
  ];

  // Pixverse style options - based on Railway
  const pixverseStyles = [
    { label: '3D Animation', value: '3d_animation' },
    { label: 'Anime', value: 'anime' },
    { label: 'Comic', value: 'comic' },
    { label: 'Cyberpunk', value: 'cyberpunk' },
    { label: 'Clay', value: 'clay' }
  ];

  // VEO3 duration options - based on Railway
  const veo3DurationOptions = [
    { label: '8 seconds', value: "8s" }
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription
      const subscription = supabase
        .channel('ai_scene_gen_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id},tool_type=eq.ai_scene_gen`
          },
          (payload) => {
            console.log('Real-time update received:', payload);
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

      console.log('Real-time subscription set up for AI Scene Gen');
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
        .eq('tool_type', 'ai_scene_gen')
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
    
    if (newRecord?.status === 'completed') {
      console.log('Scene generation completed successfully!');
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
      const { url } = await uploadFile(file, 'scene-gen-images');
      setConfig(prev => ({ ...prev, imageUrl: url }));
      
      // Auto-analyze the image
      await analyzeUploadedImage(url);
      
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const analyzeUploadedImage = async (imageUrl) => {
    setAnalyzingImage(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageUrl })
      });

      if (response.ok) {
        const analysis = await response.json();
        setConfig(prev => ({
          ...prev,
          theme: analysis.theme || '',
          background: analysis.background || '',
          mainSubject: analysis.main_subject || '',
          toneAndColor: analysis.tone_and_color || '',
          actionDirection: analysis.action_direction || '',
          sceneVision: analysis.scene_vision || ''
        }));
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
    } finally {
      setAnalyzingImage(false);
    }
  };

  const handleUpdateSceneVision = async () => {
    if (!config.imageUrl) {
      alert('Please upload an image first');
      return;
    }

    setUpdatingSceneVision(true);
    try {
      // Prepare the data for scene vision generation
      const sceneData = {
        imageUrl: config.imageUrl,
        theme: config.theme || '',
        background: config.background || '',
        mainSubject: config.mainSubject || '',
        toneAndColor: config.toneAndColor || '',
        actionDirection: config.actionDirection || ''
      };

      // Call the scene vision generation endpoint
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-scene-vision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sceneData)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.scene_vision) {
          setConfig(prev => ({
            ...prev,
            sceneVision: result.scene_vision
          }));
        }
      } else {
        // Fallback: Generate scene vision locally based on available data
        const generatedVision = generateSceneVisionFromFields(sceneData);
        setConfig(prev => ({
          ...prev,
          sceneVision: generatedVision
        }));
      }
    } catch (error) {
      console.error('Error updating scene vision:', error);
      
      // Fallback: Generate scene vision locally
      const sceneData = {
        theme: config.theme || '',
        background: config.background || '',
        mainSubject: config.mainSubject || '',
        toneAndColor: config.toneAndColor || '',
        actionDirection: config.actionDirection || ''
      };
      
      const generatedVision = generateSceneVisionFromFields(sceneData);
      setConfig(prev => ({
        ...prev,
        sceneVision: generatedVision
      }));
    } finally {
      setUpdatingSceneVision(false);
    }
  };

  // Fallback function to generate scene vision from fields
  const generateSceneVisionFromFields = (data) => {
    const parts = [];
    
    if (data.theme) parts.push(`Theme: ${data.theme}`);
    if (data.background) parts.push(`Background: ${data.background}`);
    if (data.mainSubject) parts.push(`Subject: ${data.mainSubject}`);
    if (data.toneAndColor) parts.push(`Tone: ${data.toneAndColor}`);
    if (data.actionDirection) parts.push(`Action: ${data.actionDirection}`);
    
    if (parts.length === 0) {
      return "A cinematic scene with dynamic movement and engaging visual storytelling.";
    }
    
    return `Create a cinematic scene where ${parts.join(', ')}.`;
  };

  // Calculate token cost based on Railway model configurations
  const calculateTokenCost = () => {
    // Ensure modelType has a default value
    const modelType = config.modelType || "WAN (Default)";
    
    let baseCost = 50; // Base cost for AI Scene Gen
    
    // Get model key for duration checks
    const modelKey = config.modelType.toLowerCase().replace(/[^a-z]/g, '');
    
    // Special pricing for LUMA Ray2
    if (modelType === "LUMA Ray2") {
      let lumaBaseCost;
      switch (config.resolution || "720p") {
        case "540p":
          lumaBaseCost = 100;
          break;
        case "720p":
          lumaBaseCost = 200;
          break;
        case "1080p":
          lumaBaseCost = 400;
          break;
        default:
          lumaBaseCost = 200; // Default to 720p pricing
      }
      
      const chains = config.autoChains ? 3 : (config.numChains || 3);
      return lumaBaseCost * chains;
    }
    
    // Special pricing for WAN Pro
    if (config.modelType === "WAN Pro") {
      const chains = config.autoChains ? 3 : config.numChains;
      return 160 * chains;
    }
    
    // Special pricing for Pixverse v3.5
    if (config.modelType === "Pixverse v3.5") {
      let pixverseBaseCost = 50; // Base cost
      
      // Resolution multiplier
      if (config.resolution === "1080p") {
        pixverseBaseCost += 20;
      } else if (config.resolution === "720p") {
        pixverseBaseCost += 10;
      }
      
      // Chain multiplier
      const chains = config.autoChains ? 3 : (config.numChains || 3);
      if (chains > 3) {
        pixverseBaseCost += (chains - 3) * 15;
      }
      
      let totalCost = pixverseBaseCost * chains;
      
      // Duration multiplier for 9 seconds
      if ((config.pixverseDuration || "5") === "9") {
        totalCost = Math.round(totalCost * 1.75);
      }
      
      return totalCost;
    }
    
    // Additional cost based on model
    switch (modelType) {
      case "WAN Pro":
        baseCost += 30;
        break;
      case "Pixverse v3.5":
        baseCost += 20;
        // Pixverse resolution multipliers
        if (config.resolution === "720p") {
          baseCost *= 2; // 2x cost for 720p
        } else if (config.resolution === "1080p") {
          baseCost *= 4; // 4x cost for 1080p
        }
        // 360p and 540p use base cost (no multiplier)
        // Add 40% more tokens for 8 seconds duration
        if (config.modelParams?.duration === 8 || config.modelParams?.duration === "8") {
          baseCost = Math.round(baseCost * 1.4); // 40% increase
        }
        break;
      default: // WAN
        baseCost += 10;
        // LUMA resolution multipliers
        if (config.resolution === "720p") {
          baseCost *= 2; // 2x cost for 720p
        }
        // LUMA duration multiplier
        if (config.modelParams?.duration === 9 || config.modelParams?.duration === "9") {
          baseCost = Math.round(baseCost * 1.5); // 1.5x for 9 seconds
        }
        // Add 75% more tokens for 9 seconds duration
        if (config.modelParams?.duration === 9 || config.modelParams?.duration === "9") {
          baseCost = Math.round(baseCost * 1.75); // 75% increase
        }
    }
    
    // Additional cost for higher resolution
    if ((config.resolution || "720p") === "1080p") {
      baseCost += 20;
    } else if ((config.resolution || "720p") === "720p") {
      baseCost += 10;
    }
    
    // Additional cost for more chains
    const numChains = config.numChains || 3;
    if (numChains > 3) {
      baseCost += (numChains - 3) * 15;
    }
    // Additional cost for Pixverse 8-second duration
    // Multiply base cost by number of chains
    return baseCost * numChains;
  };

  const handleGenerate = async () => {
    if (!config.imageUrl) {
      alert('Please upload an image');
      return;
    }

    if (!config.actionDirection.trim()) {
      alert('Please enter an action direction');
      return;
    }

    // --- SAFETY SCAN INTEGRATION ---
    if (!bypassSafetyCheck) {
      try {
        const analysisResult = await performSafetyAnalysis(
          config.imageUrl,
          config.actionDirection,
          'ai_scene_gen'
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
      console.log('Starting AI Scene Generation...');
      
      // Create generation record
      const generation = await createAIGeneration(
        'ai_scene_gen',
        config.actionDirection.substring(0, 50) + '...',
        config,
        tokenCost
      );

      console.log('Generation record created:', generation.id);

      // Add to local state immediately
      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      // Deduct tokens
      await updateTokenCount(user.id, tokenCost);
      
      // Refresh profile
      await fetchProfile();

      // Call Edge Function with Railway-compatible parameters
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-scene-gen`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationId: generation.id,
          imageUrl: config.imageUrl,
          theme: config.theme,
          background: config.background,
          mainSubject: config.mainSubject,
          toneAndColor: config.toneAndColor,
          actionDirection: config.actionDirection,
          sceneVision: config.sceneVision,
          resolution: config.resolution,
          aspectRatio: config.aspectRatio,
          inferenceSteps: config.inferenceSteps,
          safetyChecker: config.safetyChecker,
          promptExpansion: config.promptExpansion,
          numChains: config.autoChains ? -1 : config.numChains,
          seed: config.seed === -1 ? null : config.seed,
          modelType: config.modelType,
          modelParams: config.modelParams
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Edge Function error:', errorData);
        throw new Error(errorData.error || 'Generation failed');
      }

      const result = await response.json();
      console.log('Edge Function result:', result);

      // Clear action direction after successful generation
      setConfig(prev => ({ 
        ...prev, 
        actionDirection: '',
        sceneVision: ''
      }));

      console.log('Generation request completed successfully');

    } catch (error) {
      console.error('Error generating:', error);
      
      if (isNSFWError(error.message)) {
        const nsfwDetails = parseNSFWError(error.message);
        setNsfwError(nsfwDetails);
        setShowNSFWAlert(true);
      } else {
        showAlert('error', 'Generation Failed', `AI Scene generation failed: ${error.message}`);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (videoUrl) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-scene-gen-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `ai-scene-gen-${Date.now()}.mp4`;
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

  const getAvailableResolutions = () => {
    const modelKey = config.modelType.toLowerCase().replace(/[^a-z]/g, '-');
    const modelType = (config.modelType || "WAN (Default)").toLowerCase();
    const availableResolutions = resolutionOptions[modelKey] || resolutionOptions["wan"];
    
    // Set default resolution for WAN Pro to 1080p
    if (config.modelType === "WAN Pro" && config.resolution !== "1080p") {
      setConfig(prev => ({ ...prev, resolution: "1080p" }));
    }
    
    return availableResolutions;
    if (modelType.includes('luma')) {
      return resolutionOptions["luma"];
    } else if (modelType.includes('wan pro')) {
      return resolutionOptions["wan-pro"];
    } else if (modelType.includes('pixverse')) {
      return resolutionOptions["pixverse"];
    } else {
      return resolutionOptions["wan"];
    }
  };

  const getModelKey = (modelType) => {
    const mapping = {
      "WAN (Default)": "wan",
      "WAN Pro": "wan-pro", 
      "Pixverse v3.5": "pixverse",
      "LUMA Ray2": "luma",
      "VEO3": "veo3",
      "VEO3 Fast": "veo3-fast"
    };
    return mapping[modelType] || "wan";
  };

  const getProgressPercentage = (generation) => {
    return generation.metadata?.progress || 0;
  };

  const getCurrentMessage = (generation) => {
    return generation.metadata?.current_message || 'Processing...';
  };

  // Check if current model supports specific features
  const isVEO3Model = () => config.modelType === "VEO3" || config.modelType === "VEO3 Fast";
  const isPixverseModel = () => config.modelType === "Pixverse v3.5";
  const isLUMAModel = () => config.modelType === "LUMA Ray2";

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
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Clapperboard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">AI Scene Maker</h1>
                  <p className="text-purple-200 text-sm">Transform images into cinematic video sequences</p>
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
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sticky top-8">
              <div className="flex items-center space-x-2 mb-6">
                <Settings className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">Scene Configuration</h2>
              </div>

              <div className="space-y-6">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <ImageIcon className="w-4 h-4 inline mr-1" />
                    Source Image *
                  </label>
                  <div className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                      disabled={uploadingImage || analyzingImage}
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      {config.imageUrl ? (
                        <div className="space-y-2">
                          <img 
                            src={config.imageUrl} 
                            alt="Source" 
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <p className="text-purple-200 text-sm">
                            {analyzingImage ? 'Analyzing...' : 'Click to change'}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                          <p className="text-purple-200">
                            {uploadingImage ? 'Uploading...' : 'Upload source image'}
                          </p>
                          <p className="text-purple-300 text-xs mt-1">
                            AI will analyze and break down your image
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Image Analysis Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      <Target className="w-4 h-4 inline mr-1" />
                      Theme
                    </label>
                    <input
                      type="text"
                      value={config.theme}
                      onChange={(e) => setConfig(prev => ({ ...prev, theme: e.target.value }))}
                      placeholder="Overall theme of the image..."
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      <Camera className="w-4 h-4 inline mr-1" />
                      Background
                    </label>
                    <textarea
                      value={config.background}
                      onChange={(e) => setConfig(prev => ({ ...prev, background: e.target.value }))}
                      placeholder="Description of background elements..."
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      <Eye className="w-4 h-4 inline mr-1" />
                      Main Subject
                    </label>
                    <textarea
                      value={config.mainSubject}
                      onChange={(e) => setConfig(prev => ({ ...prev, mainSubject: e.target.value }))}
                      placeholder="Description of the main subject..."
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      <Palette className="w-4 h-4 inline mr-1" />
                      Tone & Color
                    </label>
                    <textarea
                      value={config.toneAndColor}
                      onChange={(e) => setConfig(prev => ({ ...prev, toneAndColor: e.target.value }))}
                      placeholder="Mood, tone, and color palette..."
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      <Film className="w-4 h-4 inline mr-1" />
                      Action Direction *
                    </label>
                    <textarea
                      value={config.actionDirection}
                      onChange={(e) => setConfig(prev => ({ ...prev, actionDirection: e.target.value }))}
                      placeholder="Describe the action or movement you want to see..."
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      rows={3}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-purple-200">
                        <Wand2 className="w-4 h-4 inline mr-1" />
                        Scene Vision
                      </label>
                      <button
                        onClick={handleUpdateSceneVision}
                        disabled={updatingSceneVision || !config.imageUrl}
                        className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium py-1 px-3 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center space-x-1 text-xs"
                      >
                        {updatingSceneVision ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Updating...</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-3 h-3" />
                            <span>Update Scene Vision</span>
                          </>
                        )}
                      </button>
                    </div>
                    <textarea
                      value={config.sceneVision}
                      onChange={(e) => setConfig(prev => ({ ...prev, sceneVision: e.target.value }))}
                      placeholder="Overall vision for the scene (auto-generated if empty)..."
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      rows={3}
                    />
                    <p className="text-purple-300 text-xs mt-1">
                      Click "Update Scene Vision" to regenerate based on your field changes
                    </p>
                  </div>
                </div>

                {/* Model Selection */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Film className="w-4 h-4 inline mr-1" />
                    AI Model
                  </label>
                  <div className="space-y-2">
                    {modelOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setConfig(prev => ({ ...prev, modelType: option.value }))}
                        className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                          config.modelType === option.value
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs opacity-75">{option.description}</div>
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
                        onClick={() => setConfig(prev => ({ ...prev, aspectRatio: option.value }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                          config.aspectRatio === option.value
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {option.icon}
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resolution */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">Resolution</label>
                  <div className="grid grid-cols-2 gap-2">
                    {getAvailableResolutions().map(res => (
                      <button
                        key={res}
                        onClick={() => setConfig(prev => ({ ...prev, resolution: res }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          config.resolution === res
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>

                {/* VEO3 & VEO3 Fast Duration */}
                {((config.modelType || "").includes("Pixverse")) && (
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Pixverse Duration (8s = +40% tokens)
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, pixverseDuration: "5" }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          (config.pixverseDuration || "5") === "5"
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        5 seconds (Standard)
                      </button>
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, pixverseDuration: "8" }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          (config.pixverseDuration || "5") === "8"
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        8 seconds (+40%)
                      </button>
                    </div>
                  </div>
                )}

                {/* LUMA Duration Option */}
                {(config.modelType || "").includes("LUMA") && (
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      LUMA Duration (9s = +75% tokens)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, lumaDuration: "5s" }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          (config.lumaDuration || "5s") === "5s"
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        5 seconds
                      </button>
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, lumaDuration: "9s" }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          (config.lumaDuration || "5s") === "9s"
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        9 seconds (+75%)
                      </button>
                    </div>
                  </div>
                )}

                {/* VEO3 Specific Controls */}
                {isVEO3Model() && (
                  <div className="border border-blue-500/30 rounded-lg p-4 bg-blue-500/10">
                    <h3 className="text-blue-200 font-medium mb-3 flex items-center">
                      <Sparkles className="w-4 h-4 mr-2" />
                      VEO3 Settings
                    </h3>
                    
                    {/* Negative Prompt */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-blue-200 mb-2">
                        Negative Prompt (Optional)
                      </label>
                      <textarea
                        value={config.modelParams.negativePrompt}
                        onChange={(e) => setConfig(prev => ({ 
                          ...prev, 
                          modelParams: { ...prev.modelParams, negativePrompt: e.target.value }
                        }))}
                        placeholder="What to avoid in the video..."
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        rows={2}
                      />
                    </div>

                    {/* VEO3 Toggles */}
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={config.modelParams.generateAudio}
                          onChange={(e) => setConfig(prev => ({ 
                            ...prev, 
                            modelParams: { ...prev.modelParams, generateAudio: e.target.checked }
                          }))}
                          className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-white font-medium flex items-center">
                            {config.modelParams.generateAudio ? <Volume2 className="w-4 h-4 mr-1" /> : <VolumeX className="w-4 h-4 mr-1" />}
                            Generate Audio
                          </span>
                          <p className="text-blue-300 text-xs">Add AI-generated audio to the video</p>
                        </div>
                      </label>

                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={config.modelParams.enhancePrompt}
                          onChange={(e) => setConfig(prev => ({ 
                            ...prev, 
                            modelParams: { ...prev.modelParams, enhancePrompt: e.target.checked }
                          }))}
                          className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-white font-medium">Enhance Prompt</span>
                          <p className="text-blue-300 text-xs">Automatically improve prompt quality</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Pixverse Specific Controls */}
                {isPixverseModel() && (
                  <div className="border border-green-500/30 rounded-lg p-4 bg-green-500/10">
                    <h3 className="text-green-200 font-medium mb-3 flex items-center">
                      <Layers className="w-4 h-4 mr-2" />
                      Pixverse Settings
                    </h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-green-200 mb-2">Style</label>
                      <div className="grid grid-cols-2 gap-2">
                        {["540p", "720p", "1080p"].map((res) => (
                          <button
                            key={res}
                            onClick={() => setConfig(prev => ({ 
                              ...prev, 
                              resolution: res,
                              modelParams: { ...prev.modelParams, resolution: res }
                            }))}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                              (config.modelParams?.resolution || config.resolution) === res
                                ? 'bg-purple-500 text-white'
                                : 'bg-white/10 text-purple-200 hover:bg-white/20'
                            }`}
                          >
                            {res}{res === "720p" ? " (2x)" : res === "1080p" ? " (4x)" : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* LUMA Specific Controls */}
              {/*  {isLUMAModel() && (
                  <div className="border border-orange-500/30 rounded-lg p-4 bg-orange-500/10">
                    <h3 className="text-orange-200 font-medium mb-3 flex items-center">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      LUMA Settings
                    </h3>
                    
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={config.modelParams.loop}
                        onChange={(e) => setConfig(prev => ({ 
                          ...prev, 
                          modelParams: { ...prev.modelParams, loop: e.target.checked }
                        }))}
                        className="w-4 h-4 text-orange-600 bg-white/10 border-white/20 rounded focus:ring-orange-500"
                      />
                     <div>
                        <span className="text-white font-medium">Loop Video</span>
                        <p className="text-orange-300 text-xs">Create seamless looping video</p>
                      </div> 
                    </label>
                  </div>
                )}*/}

                {/* Chain Configuration */}
                {!config.modelType.toLowerCase().includes('veo3') && (
                  <div>
                    <label className="flex items-center space-x-3 mb-2">
                      <input
                        type="checkbox"
                        checked={config.autoChains}
                        onChange={(e) => setConfig(prev => ({ ...prev, autoChains: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                      />
                      <span className="text-white font-medium">Auto-determine Chain Count</span>
                    </label>
                    
                    {!config.autoChains && (
                      <div>
                        <label className="block text-sm font-medium text-purple-200 mb-2">
                          <Clock className="w-4 h-4 inline mr-1" />
                          Number of Chains: {config.numChains}
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={config.numChains}
                          onChange={(e) => setConfig(prev => ({ ...prev, numChains: parseInt(e.target.value) }))}
                          className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                        />
                        <div className="flex justify-between text-xs text-purple-300 mt-1">
                          <span>1</span>
                          <span>10</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Advanced Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm flex items-center">
                      <Shield className="w-4 h-4 mr-1" />
                      Safety Filter
                    </label>
                    <input
                      type="checkbox"
                      checked={config.safetyChecker}
                      onChange={(e) => setConfig(prev => ({ ...prev, safetyChecker: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm flex items-center">
                      <Sparkles className="w-4 h-4 mr-1" />
                      Prompt Expansion
                    </label>
                    <input
                      type="checkbox"
                      checked={config.promptExpansion}
                      onChange={(e) => setConfig(prev => ({ ...prev, promptExpansion: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.imageUrl || !config.actionDirection.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating Scene...</span>
                    </>
                  ) : (
                    <>
                      <Clapperboard className="w-4 h-4" />
                      <span>Generate Scene ({calculateTokenCost()} tokens)</span>
                    </>
                  )}
                </button>

                {/* Processing Note */}
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                  <p className="text-purple-200 text-xs">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Scene generation may take 5-15 minutes depending on model and chain count. You can leave this page and check your Gallery later.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Generations Panel */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {/* Active Generations */}
              {activeGenerations.length > 0 && (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin" />
                    <h3 className="text-lg font-semibold text-white">Processing Scenes ({activeGenerations.length})</h3>
                  </div>
                  <div className="space-y-4">
                    {activeGenerations.map((generation) => (
                      <div key={generation.id} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-white font-medium">{generation.generation_name}</p>
                            <p className="text-purple-200 text-sm">
                              Chains: {generation.input_data?.numChains || 'Auto'} • 
                              Model: {generation.input_data?.modelType} • 
                              Started: {new Date(generation.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-yellow-400 text-sm font-medium">
                              {getProgressPercentage(generation).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                          <div 
                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                           style={{ width: `${getProgressPercentage(generation)}%` }}
                          ></div>
                        </div>
                        
                        <p className="text-purple-300 text-xs">
                          {getCurrentMessage(generation)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Completed Generations */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Generated Scenes</h3>
                  <button
                    onClick={fetchGenerations}
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {generations.length === 0 ? (
                  <div className="text-center py-12">
                    <Clapperboard className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                    <p className="text-purple-200 text-lg">No scenes generated yet</p>
                    <p className="text-purple-300 text-sm">Upload an image and describe an action to create cinematic scenes</p>
                  </div>
                ) : (
                   <div className="space-y-4">
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
                                src={generation.output_file_url}
                                controls
                                className="w-full rounded-lg max-h-96"
                                poster={generation.input_data?.imageUrl}
                              >
                                Your browser does not support the video tag.
                              </video>
                            </div>
                          )}

                          {generation.status === 'processing' && (
                            <div className="mb-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg p-8 text-center">
                              <RefreshCw className="w-12 h-12 text-purple-300 animate-spin mx-auto mb-2" />
                              <p className="text-purple-200">Generating scene...</p>
                              <p className="text-purple-300 text-sm">
                                {getCurrentMessage(generation)}
                              </p>
                              <div className="w-full bg-white/10 rounded-full h-2 mt-3">
                                <div 
                                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${getProgressPercentage(generation)}%` }}
                                ></div>
                              </div>
                            </div>
                          )}

                          {generation.status === 'failed' && (
                            <div className="mb-4 bg-red-500/20 rounded-lg p-4 text-center">
                              <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                              <p className="text-red-400 text-sm">Generation failed</p>
                              {generation.error_message && (
                                <p className="text-red-300 text-xs mt-1">{generation.error_message}</p>
                              )}
                            </div>
                          )}

                          <div className="space-y-2 text-sm text-purple-300">
                            <p>
                              <strong>Action:</strong> {generation.input_data?.actionDirection}
                            </p>
                            <div className="flex items-center justify-between">
                              <span>
                                <strong>Model:</strong> {generation.input_data?.modelType || 'WAN'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>
                                <strong>Resolution:</strong> {generation.input_data?.resolution || '720p'}
                              </span>
                              {generation.input_data?.modelType === "LUMA Ray2" && (
                                <span>
                                  <strong>Cost:</strong> {
                                    generation.input_data?.resolution === "1080p" ? "400" :
                                    generation.input_data?.resolution === "720p" ? "200" : "100"
                                  } tokens
                                </span>
                              )}
                              <span>
                                <strong>Aspect:</strong> {generation.input_data?.aspectRatio || '16:9'}
                              </span>
                            </div>
                            {generation.input_data?.modelParams?.generateAudio && (
                              <p className="text-blue-300">
                                <Volume2 className="w-3 h-3 inline mr-1" />
                                Audio Generated
                              </p>
                            )}
                            {generation.metadata?.processing_time && (
                              <p>
                                <strong>Processing Time:</strong> {generation.metadata.processing_time}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center space-x-4">
                              <span className="text-purple-300 text-sm">
                                {generation.tokens_used} tokens used
                              </span>
                              {generation.input_data?.actionDirection && (
                                <button
                                  onClick={() => copyPrompt(generation.input_data.actionDirection)}
                                  className="text-purple-400 hover:text-purple-300 transition-colors"
                                  title="Copy action direction"
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
        toolName="AI Scene Maker"
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
        toolName="AI Scene Maker"
      />

      {/* Custom Styles */}
      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #8b5cf6;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #8b5cf6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
};

export default AISceneGen;
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
  Layers,
  Sparkles,
  Hash,
  Palette,
  Link
} from 'lucide-react';

const FluxKontextLora = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state
  const [config, setConfig] = useState({
    prompt: '',
    negativePrompt: '',
    numImages: 1,
    guidanceScale: 7.5,
    steps: 30,
    seed: -1,
    enableSafetyChecker: true,
    outputFormat: "jpeg",
    outputQuality: 95,
    imageSize: "square_hd",
    loraScale: 1.0,
    loraUrl: '',
    expandPrompt: true,
    format: "jpeg",
    customWidth: 512,
    customHeight: 512
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

  // Image size options with proper dimensions
  const imageSizeOptions = [
    { label: 'Square HD (1024×1024)', value: 'square_hd', width: 1024, height: 1024 },
    { label: 'Square (512×512)', value: 'square', width: 512, height: 512 },
    { label: 'Portrait 4:3 (768×1024)', value: 'portrait_4_3', width: 768, height: 1024 },
    { label: 'Portrait 16:9 (576×1024)', value: 'portrait_16_9', width: 576, height: 1024 },
    { label: 'Landscape 4:3 (1024×768)', value: 'landscape_4_3', width: 1024, height: 768 },
    { label: 'Landscape 16:9 (1024×576)', value: 'landscape_16_9', width: 1024, height: 576 },
    { label: 'Custom Dimensions', value: 'custom', width: null, height: null }
  ];

  // Get dimensions from image size
  const getDimensionsFromImageSize = (imageSize) => {
    if (imageSize === 'custom') {
      return { 
        width: config.customWidth || 512, 
        height: config.customHeight || 512 
      };
    }
    const sizeOption = imageSizeOptions.find(option => option.value === imageSize);
    return sizeOption ? { width: sizeOption.width, height: sizeOption.height } : { width: 1024, height: 1024 };
  };

  // Calculate token cost based on megapixels
  const calculateTokenCost = () => {
    try {
      const dimensions = getDimensionsFromImageSize(config.imageSize);
      if (!dimensions || !dimensions.width || !dimensions.height) {
        return 5; // Fallback cost
      }
      
      const megapixels = (dimensions.width * dimensions.height) / 1000000;
      const numImages = config.numImages || 1;
      const baseCostPerMP = 5; // 5 tokens per megapixel
      const totalCost = Math.ceil(megapixels * baseCostPerMP * numImages);
      
      return Math.max(1, totalCost); // Minimum 1 token
    } catch (error) {
      console.error('Error calculating token cost:', error);
      return 5; // Fallback cost
    }
  };

  // Get megapixels for display
  const getMegapixels = () => {
    try {
      const dimensions = getDimensionsFromImageSize(config.imageSize);
      if (!dimensions || !dimensions.width || !dimensions.height) {
        return 0;
      }
      return (dimensions.width * dimensions.height) / 1000000;
    } catch (error) {
      console.error('Error calculating megapixels:', error);
      return 0;
    }
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription
      const subscription = supabase
        .channel('flux_kontext_lora_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id},tool_type=eq.fal_flux_kontext_lora`
          },
          (payload) => {
            console.log('Real-time update received:', payload);
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

      console.log('Real-time subscription set up for FLUX Kontext LoRA');
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
        .eq('tool_type', 'fal_flux_kontext_lora')
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

  const handleGenerate = async () => {
    if (!config.prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    // --- SAFETY SCAN INTEGRATION ---
    if (!bypassSafetyCheck) {
      try {
        const analysisResult = await performSafetyAnalysis(
          null, // No image input for text-to-image
          config.prompt,
          'fal_flux_kontext_lora'
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
      console.log('Starting FLUX Kontext LoRA generation...');
      
      // Create generation record
      const generation = await createAIGeneration(
        'fal_flux_kontext_lora',
        config.prompt.substring(0, 50) + '...',
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

      console.log('Tokens deducted, calling Edge Function...');

      // Call Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-flux-kontext-lora`, {
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
      console.error('Error generating:', error);
      
      // Check if it's an NSFW content error
      if (isNSFWError(error.message)) {
        const nsfwDetails = parseNSFWError(error.message);
        setNsfwError(nsfwDetails);
        setShowNSFWAlert(true);
      } else {
        showAlert('error', 'Generation Failed', `FLUX Kontext LoRA generation failed: ${error.message}`);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (imageUrls) => {
    try {
      if (Array.isArray(imageUrls)) {
        // Multiple images
        for (let i = 0; i < imageUrls.length; i++) {
          await downloadSingleImage(imageUrls[i], `flux-kontext-lora-${Date.now()}-${i + 1}`);
          if (i < imageUrls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } else {
        // Single image
        await downloadSingleImage(imageUrls, `flux-kontext-lora-${Date.now()}`);
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
    }
  };

  const downloadSingleImage = async (imageUrl, filename) => {
    try {
      const response = await fetch(toCdnUrl(imageUrl));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.${config.outputFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Single image download failed:', error);
      const link = document.createElement('a');
      link.href = toCdnUrl(imageUrl);
      link.download = `${filename}.${config.outputFormat}`;
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

  const getAllImageUrls = (generation) => {
    if (!generation.output_file_url) return [];
    
    try {
      const parsed = JSON.parse(generation.output_file_url);
      return Array.isArray(parsed) ? parsed : [generation.output_file_url];
    } catch {
      return [generation.output_file_url];
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
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">FLUX Kontext LoRA</h1>
                  <p className="text-purple-200 text-sm">Advanced text-to-image with LoRA fine-tuning and context awareness</p>
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
                <h2 className="text-lg font-semibold text-white">Image Configuration</h2>
              </div>

              <div className="space-y-6">
                {/* Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Wand2 className="w-4 h-4 inline mr-1" />
                    Prompt *
                  </label>
                  <textarea
                    value={config.prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Describe the image you want to generate..."
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={4}
                  />
                </div>

                {/* Negative Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Negative Prompt (Optional)
                  </label>
                  <textarea
                    value={config.negativePrompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, negativePrompt: e.target.value }))}
                    placeholder="What you don't want in the image..."
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={2}
                  />
                </div>

                {/* LoRA URL */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Link className="w-4 h-4 inline mr-1" />
                    LoRA URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={config.loraUrl}
                    onChange={(e) => setConfig(prev => ({ ...prev, loraUrl: e.target.value }))}
                    placeholder="https://example.com/lora-model.safetensors"
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-purple-300 text-xs mt-1">
                    URL to a LoRA model for fine-tuning
                  </p>
                </div>

                {/* LoRA Scale (only show if LoRA URL is provided) */}
                {config.loraUrl && (
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      LoRA Scale: {config.loraScale}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={config.loraScale}
                      onChange={(e) => setConfig(prev => ({ ...prev, loraScale: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-purple-300 mt-1">
                      <span>0.0</span>
                      <span>1.0</span>
                      <span>2.0</span>
                    </div>
                  </div>
                )}

                {/* Output Format */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Palette className="w-4 h-4 inline mr-1" />
                    Output Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['jpeg', 'png'].map((format) => (
                      <button
                        key={format}
                        onClick={() => setConfig(prev => ({ ...prev, outputFormat: format, format: format }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          config.outputFormat === format
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {format.toUpperCase()}
                        {format === 'jpeg' && <span className="block text-xs opacity-75">Smaller file size</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Number of Images */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Number of Images: {config.numImages}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={config.numImages}
                    onChange={(e) => setConfig(prev => ({ ...prev, numImages: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                  </div>
                </div>

                {/* Image Size */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Image Size
                  </label>
                  <select
                    value={config.imageSize}
                    onChange={(e) => setConfig(prev => ({ ...prev, imageSize: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {imageSizeOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-gray-800 text-white">
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {config.imageSize === 'custom' ? (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-purple-300 mb-1">Width</label>
                          <input
                            type="number"
                            min="256"
                            max="2048"
                            step="64"
                            value={config.customWidth}
                            onChange={(e) => setConfig(prev => ({ ...prev, customWidth: parseInt(e.target.value) || 512 }))}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="512"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-purple-300 mb-1">Height</label>
                          <input
                            type="number"
                            min="256"
                            max="2048"
                            step="64"
                            value={config.customHeight}
                            onChange={(e) => setConfig(prev => ({ ...prev, customHeight: parseInt(e.target.value) || 512 }))}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="512"
                          />
                        </div>
                      </div>
                      <p className="text-purple-300 text-xs">
                        {config.customWidth} × {config.customHeight} ({getMegapixels().toFixed(2)}MP)
                      </p>
                    </div>
                  ) : (
                    <p className="text-purple-300 text-xs mt-1">
                      {getDimensionsFromImageSize(config.imageSize).width} × {getDimensionsFromImageSize(config.imageSize).height} ({getMegapixels().toFixed(2)}MP)
                    </p>
                  )}
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
                      Steps: {config.steps}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={config.steps}
                      onChange={(e) => setConfig(prev => ({ ...prev, steps: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
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
                      className="w-4 h-4 text-purple-600 bg-white/10 border-white/20 rounded focus:ring-purple-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm">Expand Prompt</label>
                    <input
                      type="checkbox"
                      checked={config.expandPrompt}
                      onChange={(e) => setConfig(prev => ({ ...prev, expandPrompt: e.target.checked }))}
                      className="w-4 h-4 text-purple-600 bg-white/10 border-white/20 rounded focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Cost Display */}
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <h3 className="text-purple-200 font-medium mb-2 flex items-center">
                    <Zap className="w-4 h-4 mr-2" />
                    Cost Calculation
                  </h3>
                  <div className="text-purple-300 text-sm space-y-1">
                    <p>Images: {config.numImages}</p>
                    <p>Size: {getDimensionsFromImageSize(config.imageSize).width} × {getDimensionsFromImageSize(config.imageSize).height}</p>
                    <p>Megapixels: {getMegapixels().toFixed(2)}MP per image</p>
                    <p>Total MP: {(getMegapixels() * config.numImages).toFixed(2)}MP</p>
                    <p>Rate: 5 tokens per MP</p>
                    <p className="font-medium text-purple-200">Total: {calculateTokenCost()} tokens</p>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.prompt.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Images ({calculateTokenCost()} tokens)</span>
                    </>
                  )}
                </button>
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
                              Started: {new Date(generation.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
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
                  <h3 className="text-lg font-semibold text-white">Generated Images</h3>
                  <button
                    onClick={fetchGenerations}
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {generations.length === 0 ? (
                  <div className="text-center py-12">
                    <Sparkles className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                    <p className="text-purple-200 text-lg">No images generated yet</p>
                    <p className="text-purple-300 text-sm">Enter a prompt to create images with FLUX Kontext LoRA</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {generations.map((generation) => {
                      const imageUrls = getAllImageUrls(generation);
                      const primaryUrl = imageUrls[0];
                      
                      return (
                        <div
                          key={generation.id}
                          className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-all duration-200 cursor-pointer"
                          onClick={() => setSelectedGeneration(generation)}
                        >
                          {primaryUrl ? (
                            <div className="relative">
                              <img
                                src={toCdnUrl(primaryUrl)}
                                alt={generation.generation_name}
                                className="w-full h-48 object-cover"
                                loading="lazy"
                              />
                              {imageUrls.length > 1 && (
                                <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded-lg text-xs font-medium">
                                  +{imageUrls.length - 1} more
                                </div>
                              )}
                              <div className="absolute top-2 right-2 flex space-x-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(imageUrls);
                                  }}
                                  className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg transition-colors"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(generation.id);
                                  }}
                                  className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="h-48 bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                              <Sparkles className="w-12 h-12 text-purple-300" />
                            </div>
                          )}
                          
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-white truncate">
                                {generation.generation_name}
                              </h4>
                              <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(generation.status)}`}>
                                {generation.status}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-sm text-purple-200">
                              <span>{generation.tokens_used} tokens</span>
                              <span>
                                {new Date(generation.created_at).toLocaleDateString()}
                              </span>
                            </div>

                            {generation.input_data?.prompt && (
                              <div className="mt-2 flex items-center space-x-2">
                                <p className="text-purple-300 text-xs truncate flex-1">
                                  {generation.input_data.prompt}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyPrompt(generation.input_data.prompt);
                                  }}
                                  className="text-purple-400 hover:text-purple-300 transition-colors"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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

              {getAllImageUrls(selectedGeneration).length > 0 && (
                <div className="mb-6">
                  {getAllImageUrls(selectedGeneration).length === 1 ? (
                    <img
                      src={toCdnUrl(getAllImageUrls(selectedGeneration)[0])}
                      alt={selectedGeneration.generation_name}
                      className="w-full max-h-96 object-contain rounded-lg"
                      loading="lazy"
                    />
                  ) : (
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-3">
                        Generated Images ({getAllImageUrls(selectedGeneration).length})
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        {getAllImageUrls(selectedGeneration).map((url, index) => (
                          <img
                            key={index}
                            src={toCdnUrl(url)}
                            alt={`${selectedGeneration.generation_name} - Image ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg"
                            loading="lazy"
                          />
                        ))}
                      </div>
                    </div>
                  )}
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
                        <span className="text-purple-200">Prompt:</span>
                        <p className="text-white mt-1 p-2 bg-white/5 rounded">
                          {selectedGeneration.input_data.prompt}
                        </p>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-purple-200">Images:</span>
                      <span className="text-white">{selectedGeneration.input_data?.numImages || 1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Image Size:</span>
                      <span className="text-white">{selectedGeneration.input_data?.imageSize || 'square_hd'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Steps:</span>
                      <span className="text-white">{selectedGeneration.input_data?.steps || 30}</span>
                    </div>
                    {selectedGeneration.input_data?.loraUrl && (
                      <div>
                        <span className="text-purple-200">LoRA Used:</span>
                        <p className="text-white text-xs mt-1 break-all">
                          {selectedGeneration.input_data.loraUrl}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                {getAllImageUrls(selectedGeneration).length > 0 && (
                  <button
                    onClick={() => handleDownload(getAllImageUrls(selectedGeneration))}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {getAllImageUrls(selectedGeneration).length === 1 ? 'Download' : `Download All (${getAllImageUrls(selectedGeneration).length})`}
                    </span>
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
        toolName="FLUX Kontext LoRA"
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
        toolName="FLUX Kontext LoRA"
      />

      {/* Custom Slider Styles */}
      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #8B5CF6, #EC4899);
          cursor: pointer;
          border: 2px solid white;
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #8B5CF6, #EC4899);
          cursor: pointer;
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
};

export default FluxKontextLora;
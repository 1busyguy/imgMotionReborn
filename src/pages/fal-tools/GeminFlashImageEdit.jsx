import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { createAIGeneration, updateTokenCount, uploadFile } from '../../utils/storageHelpers';
import { 
  // New functions
  parseFalError,
  formatErrorDisplay,
  handleRetryGeneration,
  getErrorBadgeClasses, 
  // Backward compatibility functions
  isNSFWError,
  parseNSFWError,
  isContentPolicyError,
  parseContentPolicyError
} from '../../utils/falErrorHandler';
import GenerationError from '../../components/GenerationError';  
import { toCdnUrl } from '../../utils/cdnHelpers';
import { performSafetyAnalysis, shouldShowWarning, getSafetyWarningMessage, logSafetyAnalysis } from '../../utils/safescan';
import NSFWAlert from '../../components/NSFWAlert';
import SafetyWarningModal from '../../components/SafetyWarningModal';
import ThemedAlert from '../../components/ThemedAlert';
import { 
  ArrowLeft, 
  Zap, 
  Image as ImageIcon, 
  Upload, 
  Download, 
  Trash2, 
  RefreshCw,
  Settings,
  Copy,
  X,
  Plus,
  Minus,
  Wand2,
  Sparkles,
  Brain
} from 'lucide-react';

const GeminFlashImageEdit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state - based on Gemini 2.5 Flash Image Edit API
  const [config, setConfig] = useState({
    prompt: '',
    imageUrls: [],
    numImages: 1
  });
  
  // Generation state
  const [generations, setGenerations] = useState([]);
  const [activeGenerations, setActiveGenerations] = useState([]);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [uploadingImages, setUploadingImages] = useState([]);
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

  // Edit suggestions for different types of edits
  const editSuggestions = [
    "Change the background to a sunset beach scene",
    "Add dramatic lighting and shadows",
    "Transform into a cyberpunk style with neon colors",
    "Make it look like a vintage photograph from the 1950s",
    "Add snow falling and winter atmosphere",
    "Change the time of day to golden hour",
    "Add magical sparkles and fantasy elements",
    "Transform into an oil painting style",
    "Add motion blur for dynamic movement",
    "Change the weather to stormy with dark clouds"
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      console.log('🔗 Setting up real-time subscription for user:', user.id);
      
      // Set up real-time subscription for this specific tool type
      const subscription = supabase
        .channel('gemini_flash_edit_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📡 Raw real-time payload received:', {
              event: payload.eventType,
              table: payload.table,
              schema: payload.schema,
              new: payload.new ? { 
                id: payload.new.id, 
                tool_type: payload.new.tool_type, 
                status: payload.new.status,
                error_message: payload.new.error_message?.substring(0, 50)
              } : null,
              old: payload.old ? { id: payload.old.id } : null
            });
            
            // Only process updates for this tool type
            const record = payload.new || payload.old;
            if (record && record.tool_type === 'fal_gemini_flash_image_edit') {
              console.log('✅ Processing update for Gemini Flash tool');
              handleRealtimeUpdate(payload);
            } else {
              console.log('⏭️ Skipping update for different tool:', record?.tool_type);
            }
          }
        )
        .subscribe();

      console.log('✅ Real-time subscription set up for Gemini Flash Image Edit');
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
        .eq('tool_type', 'fal_gemini_flash_image_edit')
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
    
    console.log('✨ Processing Gemini Flash real-time update:', { 
      eventType, 
      generationId: newRecord?.id || oldRecord?.id,
      newStatus: newRecord?.status,
      oldStatus: oldRecord?.status,
      hasErrorMessage: !!newRecord?.error_message,
      errorMessage: newRecord?.error_message?.substring(0, 100)
    });

    setGenerations(current => {
      switch (eventType) {
        case 'INSERT':
          console.log('➕ Adding new generation to list');
          return [newRecord, ...current];
        case 'UPDATE':
          console.log('🔄 Updating existing generation:', {
            id: newRecord.id,
            oldStatus: current.find(g => g.id === newRecord.id)?.status,
            newStatus: newRecord.status,
            hasOutput: !!newRecord.output_file_url,
            hasError: !!newRecord.error_message
          });
          return current.map(item => 
            item.id === newRecord.id ? newRecord : item
          );
        case 'DELETE':
          console.log('🗑️ Removing generation from list');
          return current.filter(item => item.id !== oldRecord.id);
        default:
          console.log('❓ Unknown event type:', eventType);
          return current;
      }
    });

    if (newRecord?.status === 'processing') {
      setActiveGenerations(current => {
        const exists = current.find(g => g.id === newRecord.id);
        return exists ? current.map(g => g.id === newRecord.id ? newRecord : g) : [newRecord, ...current];
      });
    } else if (newRecord?.status === 'completed' || newRecord?.status === 'failed') {
      console.log(`🎯 Generation ${newRecord.status}:`, {
        id: newRecord.id,
        status: newRecord.status,
        hasOutput: !!newRecord.output_file_url,
        errorMessage: newRecord.error_message
      });
      
      setActiveGenerations(current => current.filter(g => g.id !== newRecord?.id));
      
      // Show failure notification with 1-second delay
      if (newRecord?.status === 'failed') {
        console.log('🚨 Showing failure notification for:', newRecord.id);
        setTimeout(() => {
          const errorMessage = newRecord.error_message || 'Generation failed';
          showAlert('error', 'Generation Failed', `Gemini Flash Image Edit failed: ${errorMessage}`);
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

  const handleImageUpload = async (event, index) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showAlert('error', 'Invalid File Type', 'Please select a JPG or PNG image file only.');
      return;
    }

    // Only allow JPG and PNG files
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      showAlert('error', 'Unsupported File Format', 'Please upload only JPG or PNG images. Other formats are not supported by Gemini Flash Image Edit.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showAlert('error', 'File Too Large', 'Image file size must be less than 10MB. Please compress your image or select a smaller file.');
      return;
    }

    // Set uploading state for this specific image slot
    setUploadingImages(prev => {
      const newState = [...prev];
      newState[index] = true;
      return newState;
    });

    try {
      const { url } = await uploadFile(file, 'gemini-flash-edit-images');
      
      setConfig(prev => {
        const newImageUrls = [...prev.imageUrls];
        newImageUrls[index] = url;
        return { ...prev, imageUrls: newImageUrls };
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Please try again.');
    } finally {
      setUploadingImages(prev => {
        const newState = [...prev];
        newState[index] = false;
        return newState;
      });
    }
  };

  const addImageSlot = () => {
    if (config.imageUrls.length < 10) {
      setConfig(prev => ({
        ...prev,
        imageUrls: [...prev.imageUrls, '']
      }));
    }
  };

  const removeImageSlot = (index) => {
    setConfig(prev => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index)
    }));
  };

  const calculateTokenCost = () => {
    // Base cost: 8 tokens per image generated
    return config.numImages * 8;
  };

  const handleGenerate = async () => {
    const validImageUrls = config.imageUrls.filter(url => url.trim());
    
    if (validImageUrls.length === 0) {
      alert('Please upload at least one image');
      return;
    }

    if (!config.prompt.trim()) {
      alert('Please enter an edit prompt');
      return;
    }

    // --- SAFETY SCAN INTEGRATION ---
    if (!bypassSafetyCheck) {
      try {
        // Analyze the first image and prompt
        const analysisResult = await performSafetyAnalysis(
          validImageUrls[0],
          config.prompt,
          'fal_gemini_flash_image_edit'
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
      console.log('✨ Starting Gemini Flash Image Edit generation...');
      
      generation = await createAIGeneration(
        'fal_gemini_flash_image_edit',
        config.prompt.substring(0, 50) + '...',
        { ...config, imageUrls: validImageUrls },
        tokenCost
      );

      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      await updateTokenCount(user.id, tokenCost);
      await fetchProfile();

      console.log('💰 Tokens deducted, calling Edge Function...');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-gemini-flash-image-edit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationId: generation.id,
          prompt: config.prompt,
          imageUrls: validImageUrls,
          numImages: config.numImages
        })
      });

      if (!response.ok) {
          const errorData = await response.json();
          console.error('Edge Function error:', errorData);
  
          // The edge function already categorized the error
          if (generation) {
            // Remove from local state since it failed
            setGenerations(current => current.filter(g => g.id !== generation.id));
            setActiveGenerations(current => current.filter(g => g.id !== generation.id));
          }
  
          // Check if it's a content violation to show the right alert
          const errorMessage = errorData.error || errorData.message || 'Generation failed';
  
          // Check for content violations (422 errors)
          if (response.status === 422 || 
              errorMessage.toLowerCase().includes('content') || 
              errorMessage.toLowerCase().includes('policy')) {
    
            if (isContentPolicyError(errorMessage)) {
              const errorDetails = parseContentPolicyError(errorMessage);
              setNsfwError(errorDetails);
              setShowNSFWAlert(true);
            } else {
              showAlert('error', 'Content Policy Violation', errorMessage);
            }
          } else {
            // For other errors, show the alert
            showAlert('error', 'Generation Failed', errorMessage);
          }
  
          return; // Don't throw, just return
        }

  const handleDownload = async (imageUrl) => {
    try {
      const response = await fetch(toCdnUrl(imageUrl));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gemini-flash-edit-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      const link = document.createElement('a');
      link.href = toCdnUrl(imageUrl);
      link.download = `gemini-flash-edit-${Date.now()}.png`;
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

  // 👇 ADD IT HERE - WITH YOUR OTHER HANDLERS 👇
  const onRetryGeneration = (failedGeneration) => {
    handleRetryGeneration(failedGeneration, setConfig, handleGenerate);
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
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Gemini 2.5 Flash Image Edit</h1>
                  <p className="text-purple-200 text-sm">Advanced AI image editing with Google's Gemini 2.5 Flash model</p>
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
                <h2 className="text-lg font-semibold text-white">Edit Configuration</h2>
              </div>

              <div className="space-y-6">
                {/* Edit Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Wand2 className="w-4 h-4 inline mr-1" />
                    Edit Prompt *
                  </label>
                  <textarea
                    value={config.prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Describe how you want to edit the images..."
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={4}
                  />
                  <p className="text-purple-300 text-xs mt-1">
                    Be specific about changes: style, lighting, background, colors, effects
                  </p>
                </div>

                {/* Edit Suggestions */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Sparkles className="w-4 h-4 inline mr-1" />
                    Edit Inspiration
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                    {editSuggestions.slice(0, 4).map((suggestion, index) => (
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

                {/* Image Upload Slots */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <ImageIcon className="w-4 h-4 inline mr-1" />
                    Source Images * (Max 10)
                  </label>
                  
                  <div className="space-y-3">
                    {Array.from({ length: Math.max(1, config.imageUrls.length + 1) }).map((_, index) => (
                      <div key={index} className="relative">
                        <div 
                          className="border-2 border-dashed border-white/30 rounded-lg p-3 text-center transition-colors hover:border-white/50"
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.add('border-blue-400', 'bg-blue-500/10');
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('border-blue-400', 'bg-blue-500/10');
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('border-blue-400', 'bg-blue-500/10');
                            const files = e.dataTransfer.files;
                            if (files.length > 0) {
                              const event = { target: { files } };
                              handleImageUpload(event, index);
                            }
                          }}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, index)}
                            className="hidden"
                            id={`image-upload-${index}`}
                            disabled={uploadingImages[index]}
                          />
                          <label htmlFor={`image-upload-${index}`} className="cursor-pointer">
                            {config.imageUrls[index] ? (
                              <div className="space-y-2">
                                <img 
                                  src={config.imageUrls[index]} 
                                  alt={`Source ${index + 1}`} 
                                  className="w-full h-20 object-contain rounded-lg bg-black/20"
                                  loading="lazy"
                                />
                                <p className="text-purple-200 text-xs">Image {index + 1} - Click to change</p>
                              </div>
                            ) : (
                              <div>
                                <Upload className="w-6 h-6 text-purple-300 mx-auto mb-1" />
                                <p className="text-purple-200 text-xs">
                                  {uploadingImages[index] ? 'Uploading...' : `Upload Image ${index + 1}`}
                                </p>
                              </div>
                            )}
                          </label>
                          
                          {/* Remove button for additional slots */}
                          {index > 0 && config.imageUrls[index] && (
                            <button
                              onClick={() => removeImageSlot(index)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Add Image Button */}
                    {config.imageUrls.length < 10 && (
                      <button
                        onClick={addImageSlot}
                        className="w-full border-2 border-dashed border-purple-400/50 rounded-lg p-3 text-center hover:border-purple-400 hover:bg-purple-500/10 transition-colors"
                      >
                        <Plus className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                        <p className="text-purple-300 text-xs">Add Another Image</p>
                      </button>
                    )}
                  </div>
                  <p className="text-purple-300 text-xs mt-1">
                    JPG and PNG only • Max 10MB • Drag & drop supported
                  </p>
                </div>

                {/* Number of Images to Generate */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Images to Generate: {config.numImages}
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

                {/* Cost Display */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <h3 className="text-blue-200 font-medium mb-2 flex items-center">
                    <Zap className="w-4 h-4 mr-2" />
                    Cost Calculation
                  </h3>
                  <div className="text-blue-300 text-sm space-y-1">
                    <p>Images to generate: {config.numImages}</p>
                    <p>Rate: 8 tokens per image</p>
                    <p className="font-medium text-blue-200">Total: {calculateTokenCost()} tokens</p>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.prompt.trim() || config.imageUrls.filter(url => url.trim()).length === 0}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Editing Images...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      <span>Edit Images ({calculateTokenCost()} tokens)</span>
                    </>
                  )}
                </button>

                {/* Processing Note */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-blue-200 text-xs">
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    Gemini Flash image editing typically takes 30-60 seconds. Cost: 8 tokens per generated image.
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
                              Images: {generation.input_data?.numImages} • 
                              Started: {new Date(generation.created_at).toLocaleTimeString()}
                            </p>
                            <p className="text-purple-300 text-xs mt-1">
                              Gemini Flash editing typically takes 30-60 seconds
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
                  <h3 className="text-lg font-semibold text-white">Edited Images</h3>
                  <button
                    onClick={fetchGenerations}
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {generations.length === 0 ? (
                  <div className="text-center py-12">
                    <Brain className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                    <p className="text-purple-200 text-lg">No images edited yet</p>
                    <p className="text-purple-300 text-sm">Upload images and describe edits to transform them with AI</p>
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
                              {/* Handle multiple images */}
                              {(() => {
                                let imageUrls = [];
                                try {
                                  // Check if output_file_url is a JSON array
                                  if (generation.output_file_url.startsWith('[')) {
                                    imageUrls = JSON.parse(generation.output_file_url);
                                  } else {
                                    imageUrls = [generation.output_file_url];
                                  }
                                } catch (e) {
                                  imageUrls = [generation.output_file_url];
                                }

                                return (
                                  <div className="grid grid-cols-2 gap-4">
                                    {imageUrls.map((imageUrl, imgIndex) => (
                                      <div key={imgIndex} className="relative group">
                                        <img
                                          src={toCdnUrl(imageUrl)}
                                          alt={`Edited ${imgIndex + 1}`}
                                          className="w-full rounded-lg"
                                          loading="lazy"
                                        />
                                        <button
                                          onClick={() => handleDownload(imageUrl)}
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

                          {generation.status === 'processing' && (
                            <div className="mb-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg p-8 text-center">
                              <RefreshCw className="w-12 h-12 text-blue-300 animate-spin mx-auto mb-2" />
                              <p className="text-blue-200">Editing images with Gemini Flash...</p>
                              <p className="text-blue-300 text-sm">This may take 30-60 seconds</p>
                            </div>
                          )}

                          // Replace the old error display with:
                            {generation.status === 'failed' && (
                              <GenerationError 
                                generation={generation} 
                                onRetry={onRetryGeneration}
                                canRetry={true}
                              />
                            )}}

                          <div className="space-y-2 text-sm text-purple-300">
                            <p>
                              <strong>Edit Prompt:</strong> {generation.input_data?.prompt}
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                              <span>
                                <strong>Source Images:</strong> {generation.input_data?.imageUrls?.length || 0}
                              </span>
                              <span>
                                <strong>Generated:</strong> {generation.input_data?.numImages}
                              </span>
                              <span>
                                <strong>Tokens:</strong> {generation.tokens_used}
                              </span>
                              <span>
                                <strong>Model:</strong> Gemini 2.5 Flash
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
        toolName="Gemini 2.5 Flash Image Edit"
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
        toolName="Gemini 2.5 Flash Image Edit"
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
          background: linear-gradient(to right, #3B82F6, #8B5CF6);
          cursor: pointer;
          border: 2px solid white;
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #3B82F6, #8B5CF6);
          cursor: pointer;
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
};

export default GeminFlashImageEdit;
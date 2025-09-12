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
  Palette,
  ZoomIn,
  Shuffle
} from 'lucide-react';

const SeedDreamImageEdit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state - based on SeedDream v4 Edit API
  const [config, setConfig] = useState({
    prompt: '',
    imageUrls: [],
    imageSize: {
      width: 1024,
      height: 1024
    },
    numImages: 3,
    enableSafetyChecker: true,
    seed: Math.floor(Math.random() * 100000000)
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

  // State for desktop limit & modals
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [expandedImageIndex, setExpandedImageIndex] = useState(null);
  const [showExpandedImage, setShowExpandedImage] = useState(false);

  // Edit suggestions for fashion/clothing edits
  const editSuggestions = [
    "Dress the model in elegant evening wear",
    "Put the model in casual streetwear outfit",
    "Add a professional business suit",
    "Dress in vintage 1950s fashion",
    "Apply modern athleisure clothing",
    "Add traditional cultural attire",
    "Put in futuristic cyberpunk outfit",
    "Dress in beach summer clothing",
    "Add formal wedding attire",
    "Apply cozy winter clothing"
  ];

  // Predefined size options
  const sizeOptions = [
    { label: 'Square (1:1)', width: 1024, height: 1024 },
    { label: 'Portrait (3:4)', width: 768, height: 1024 },
    { label: 'Landscape (4:3)', width: 1024, height: 768 },
    { label: 'Wide (16:9)', width: 1024, height: 576 },
    { label: 'Tall (9:16)', width: 576, height: 1024 }
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      console.log('🔗 Setting up real-time subscription for user:', user.id);
      
      // Set up real-time subscription for this specific tool type
      const subscription = supabase
        .channel('seedream_edit_generations')
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
            if (record && record.tool_type === 'fal_seedream_v4_edit') {
              console.log('✅ Processing update for SeedDream tool');
              handleRealtimeUpdate(payload);
            } else {
              console.log('⏭️ Skipping update for different tool:', record?.tool_type);
            }
          }
        )
        .subscribe();

      console.log('✅ Real-time subscription set up for SeedDream v4 Edit');
      return () => subscription.unsubscribe();
    }
  }, [user, isDesktop]);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      // Desktop: 2 items, Mobile/Tablet: 10 items
      const limit = isDesktop ? 2 : 10;
      
      const { data, error } = await supabase
        .from('ai_generations')
        .select('*')
        .eq('user_id', user.id)
        .eq('tool_type', 'fal_seedream_v4_edit')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setGenerations(data || []);
      setActiveGenerations(data?.filter(g => g.status === 'processing') || []);
    } catch (error) {
      console.error('Error fetching generations:', error);
    }
  };

  const handleRealtimeUpdate = (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    console.log('✨ Processing SeedDream real-time update:', { 
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
          showAlert('error', 'Generation Failed', `SeedDream Edit failed: ${errorMessage}`);
        }, 1000);
      }
    }
  };

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
      showAlert('error', 'Unsupported File Format', 'Please upload only JPG or PNG images. Other formats are not supported by SeedDream Edit.');
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
      const { url } = await uploadFile(file, 'seedream-edit-images');
      
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
    const validImageCount = config.imageUrls.filter(url => url.trim()).length;
    if (validImageCount < 4 && config.imageUrls.length < 4) {
      setConfig(prev => ({
        ...prev,
        imageUrls: [...prev.imageUrls, '']
      }));
    } else if (validImageCount >= 4) {
      showAlert('warning', 'Image Limit Reached', 'SeedDream Edit requires exactly 4 images: 1 model + 3 clothing references');
    }
  };

  const removeImageSlot = (index) => {
    setConfig(prev => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index)
    }));
  };

  const calculateTokenCost = () => {
    // Base cost: 10 tokens per image generated
    return config.numImages * 10;
  };

  const handleGenerate = async () => {
    const validImageUrls = config.imageUrls.filter(url => url.trim());
    
    if (validImageUrls.length !== 4) {
      showAlert('error', 'Incorrect Number of Images', 'Please upload exactly 4 images: 1 model image and 3 clothing reference images');
      return;
    }

    if (!config.prompt.trim()) {
      alert('Please enter a dressing prompt');
      return;
    }

    // Safety scan integration
    if (!bypassSafetyCheck) {
      try {
        // Analyze the first image and prompt
        const analysisResult = await performSafetyAnalysis(
          validImageUrls[0],
          config.prompt,
          'fal_seedream_v4_edit'
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
      console.log('✨ Starting SeedDream v4 Edit generation...');
      
      generation = await createAIGeneration(
        'fal_seedream_v4_edit',
        config.prompt.substring(0, 50) + '...',
        { ...config, imageUrls: validImageUrls },
        tokenCost
      );

      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      await updateTokenCount(user.id, tokenCost);
      await fetchProfile();

      console.log('💰 Tokens deducted, calling Edge Function...');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-seedream-edit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationId: generation.id,
          prompt: config.prompt,
          imageUrls: validImageUrls,
          imageSize: config.imageSize,
          numImages: config.numImages,
          enableSafetyChecker: config.enableSafetyChecker,
          seed: config.seed
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      setConfig(prev => ({ 
        ...prev, 
        prompt: '',
        seed: Math.floor(Math.random() * 100000000) // Generate new seed for next run
      }));
      console.log('✅ SeeDream v4 Edit generation request submitted successfully');

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
        showAlert('error', 'Generation Failed', `SeedDream Edit failed: ${error.message}`);
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
      link.download = `seedream-edit-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      const link = document.createElement('a');
      link.href = toCdnUrl(imageUrl);
      link.download = `seedream-edit-${Date.now()}.png`;
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

  const imageLabels = ['Model (Person)', 'Clothing Item 1', 'Clothing Item 2', 'Shoes/Accessories'];

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
                <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <Palette className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">SeedDream v4 Edit</h1>
                  <p className="text-purple-200 text-sm">AI-powered virtual fashion & clothing transfer</p>
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
                <h2 className="text-lg font-semibold text-white">Fashion Configuration</h2>
              </div>

              <div className="space-y-6">
                {/* Dressing Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Wand2 className="w-4 h-4 inline mr-1" />
                    Dressing Instructions *
                  </label>
                  <textarea
                    value={config.prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Describe how to dress the model with the provided clothing..."
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={3}
                  />
                  <p className="text-purple-300 text-xs mt-1">
                    E.g., "Dress the model in the clothes and shoes"
                  </p>
                </div>

                {/* Dressing Suggestions */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Sparkles className="w-4 h-4 inline mr-1" />
                    Quick Suggestions
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

                {/* Image Upload Slots - Exactly 4 Required */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <ImageIcon className="w-4 h-4 inline mr-1" />
                    Images Required * (Exactly 4)
                  </label>
                  
                  <div className="space-y-3">
                    {[0, 1, 2, 3].map((index) => (
                      <div key={index} className="relative">
                        <div className="text-xs text-purple-300 mb-1">{imageLabels[index]}</div>
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
                                  alt={imageLabels[index]} 
                                  className="w-full h-20 object-contain rounded-lg bg-black/20"
                                  loading="lazy"
                                />
                                <p className="text-purple-200 text-xs">Click to change</p>
                              </div>
                            ) : (
                              <div>
                                <Upload className="w-6 h-6 text-purple-300 mx-auto mb-1" />
                                <p className="text-purple-200 text-xs">
                                  {uploadingImages[index] ? 'Uploading...' : `Upload ${imageLabels[index]}`}
                                </p>
                              </div>
                            )}
                          </label>
                          
                          {/* Clear button for filled slots */}
                          {config.imageUrls[index] && (
                            <button
                              onClick={() => {
                                setConfig(prev => {
                                  const newUrls = [...prev.imageUrls];
                                  newUrls[index] = '';
                                  return { ...prev, imageUrls: newUrls };
                                });
                              }}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-purple-300 text-xs mt-2">
                    Upload 1 model photo + 3 clothing/accessory images
                  </p>
                </div>

                {/* Image Size Selection */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Output Size
                  </label>
                  <select
                    value={`${config.imageSize.width}x${config.imageSize.height}`}
                    onChange={(e) => {
                      const option = sizeOptions.find(opt => 
                        `${opt.width}x${opt.height}` === e.target.value
                      );
                      if (option) {
                        setConfig(prev => ({
                          ...prev,
                          imageSize: { width: option.width, height: option.height }
                        }));
                      }
                    }}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {sizeOptions.map((option) => (
                      <option 
                        key={`${option.width}x${option.height}`} 
                        value={`${option.width}x${option.height}`}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Number of Images to Generate */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Variations to Generate: {config.numImages}
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

                {/* Seed Control */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Shuffle className="w-4 h-4 inline mr-1" />
                    Seed (for reproducibility)
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={config.seed}
                      onChange={(e) => setConfig(prev => ({ ...prev, seed: parseInt(e.target.value) || 0 }))}
                      className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, seed: Math.floor(Math.random() * 100000000) }))}
                      className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                      title="Generate random seed"
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Safety Checker Toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-purple-200">
                    Safety Checker
                  </label>
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, enableSafetyChecker: !prev.enableSafetyChecker }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.enableSafetyChecker ? 'bg-purple-500' : 'bg-gray-600'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.enableSafetyChecker ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Cost Display */}
                <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4">
                  <h3 className="text-pink-200 font-medium mb-2 flex items-center">
                    <Zap className="w-4 h-4 mr-2" />
                    Cost Calculation
                  </h3>
                  <div className="text-pink-300 text-sm space-y-1">
                    <p>Variations: {config.numImages}</p>
                    <p>Rate: 10 tokens per image</p>
                    <p className="font-medium text-pink-200">Total: {calculateTokenCost()} tokens</p>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.prompt.trim() || config.imageUrls.filter(url => url.trim()).length !== 4}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Fashion...</span>
                    </>
                  ) : (
                    <>
                      <Palette className="w-4 h-4" />
                      <span>Generate ({calculateTokenCost()} tokens)</span>
                    </>
                  )}
                </button>

                {/* Processing Note */}
                <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-3">
                  <p className="text-pink-200 text-xs">
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    SeedDream fashion generation typically takes 15-30 seconds. Cost: 10 tokens per image.
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
                    <h3 className="text-lg font-semibold text-white">Processing Fashion ({activeGenerations.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {activeGenerations.map((generation) => (
                      <div key={generation.id} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{generation.generation_name}</p>
                            <p className="text-purple-200 text-sm">
                              Variations: {generation.input_data?.numImages} • 
                              Started: {new Date(generation.created_at).toLocaleTimeString()}
                            </p>
                            <p className="text-purple-300 text-xs mt-1">
                              SeedDream fashion generation typically takes 15-30 seconds
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
                    Fashion Generations {isDesktop && generations.length > 0 && `(Showing latest 2)`}
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
                    <Palette className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                    <p className="text-purple-200 text-lg">No fashion generated yet</p>
                    <p className="text-purple-300 text-sm">Upload images and describe how to dress the model</p>
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

                          {/* Clickable Images */}
                          {generation.output_file_url && generation.status === 'completed' && (
                            <div className="mb-4">
                              {(() => {
                                let imageUrls = [];
                                try {
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
                                          alt={`Fashion ${imgIndex + 1}`}
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

                          {generation.status === 'processing' && (
                            <div className="mb-4 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-lg p-8 text-center">
                              <RefreshCw className="w-12 h-12 text-pink-300 animate-spin mx-auto mb-2" />
                              <p className="text-pink-200">Generating fashion with SeedDream...</p>
                              <p className="text-pink-300 text-sm">This may take 15-30 seconds</p>
                            </div>
                          )}

                          {generation.status === 'failed' && (
                            <div className="mb-4 bg-red-500/20 rounded-lg p-4 text-center">
                              <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                              <p className="text-red-400 text-sm">Fashion generation failed</p>
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
                                <strong>Images Used:</strong> 4
                              </span>
                              <span>
                                <strong>Generated:</strong> {generation.input_data?.numImages}
                              </span>
                              <span>
                                <strong>Tokens:</strong> {generation.tokens_used}
                              </span>
                              <span>
                                <strong>Model:</strong> SeedDream v4
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

                    {/* View all link for desktop */}
                    {isDesktop && generations.length >= 2 && (
                      <div className="mt-4 text-center">
                        <button
                          onClick={() => navigate('/gallery')}
                          className="text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium"
                        >
                          View all fashion generations in Gallery →
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

      {/* Generation Detail Modal */}
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

              {/* Images Display - Clickable */}
              {selectedGeneration.output_file_url && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-white mb-3">
                    Generated Fashion ({getAllImageUrls(selectedGeneration.output_file_url).length})
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
                          alt={`${selectedGeneration.generation_name} - Fashion ${index + 1}`}
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
                      <span className="text-white">SeedDream v4</span>
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
                    <div className="flex justify-between">
                      <span className="text-purple-200">Seed:</span>
                      <span className="text-white">{selectedGeneration.input_data?.seed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Generated:</span>
                      <span className="text-white">{selectedGeneration.input_data?.numImages}</span>
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

      {/* Fullscreen Image Viewer */}
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
              alt={`${selectedGeneration.generation_name} - Fashion ${expandedImageIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg"
            />

            {/* Bottom Navigation */}
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

      {/* NSFW Alert Modal */}
      <NSFWAlert
        isOpen={showNSFWAlert}
        onClose={() => {
          setShowNSFWAlert(false);
          setNsfwError(null);
        }}
        toolName="SeedDream v4 Edit"
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
        toolName="SeedDream v4 Edit"
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
          background: linear-gradient(to right, #EC4899, #8B5CF6);
          cursor: pointer;
          border: 2px solid white;
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #EC4899, #8B5CF6);
          cursor: pointer;
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
};

export default SeedDreamImageEdit;
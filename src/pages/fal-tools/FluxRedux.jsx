import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { createAIGeneration, updateTokenCount, uploadFile } from '../../utils/storageHelpers';
import { isNSFWError, parseNSFWError } from '../../utils/errorHandlers';
import { toCdnUrl } from '../../utils/cdnHelpers';
import NSFWAlert from '../../components/NSFWAlert';
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
  Layers,
  Wand2,
  Monitor,
  Smartphone,
  Square,
  Maximize2,
  Dice6
} from 'lucide-react';

const FluxRedux = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state - based on FLUX Redux API parameters
  const [config, setConfig] = useState({
    guideImageUrl: '',
    prompt: '',
    guidanceScale: 7.5,
    numImages: 1,
    width: 1024,
    height: 768,
    ipAdapterWeight: 0.5,
    steps: 30,
    seed: -1,
    outputFormat: "png",
    safetyTolerance: "2",
    enableSafetyChecker: true
  });
  
  // Generation state
  const [generations, setGenerations] = useState([]);
  const [activeGenerations, setActiveGenerations] = useState([]);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showNSFWAlert, setShowNSFWAlert] = useState(false);
  const [nsfwError, setNsfwError] = useState(null);
  const [enlargedImageIndex, setEnlargedImageIndex] = useState(null);

  // Image size presets
  const imageSizeOptions = [
    { label: 'Square (1024×1024)', value: { width: 1024, height: 1024 }, icon: <Square className="w-4 h-4" /> },
    { label: 'Portrait (768×1024)', value: { width: 768, height: 1024 }, icon: <Smartphone className="w-4 h-4" /> },
    { label: 'Landscape (1024×768)', value: { width: 1024, height: 768 }, icon: <Monitor className="w-4 h-4" /> },
    { label: 'Wide (1536×1024)', value: { width: 1536, height: 1024 }, icon: <Maximize2 className="w-4 h-4" /> },
    { label: 'Custom', value: { width: 'custom', height: 'custom' }, icon: <Settings className="w-4 h-4" /> }
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription for this specific tool type
      const subscription = supabase
        .channel('flux_redux_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id},tool_type=eq.fal_flux_redux`
          },
          (payload) => {
            console.log('🔄 FLUX Redux Real-time update received:', payload);
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

      console.log('✅ Real-time subscription set up for FLUX Redux');
      return () => {
        console.log('🔌 Unsubscribing from FLUX Redux real-time updates');
        subscription.unsubscribe();
      };
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
        .eq('tool_type', 'fal_flux_redux')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      console.log('📊 Fetched FLUX Redux generations:', data?.length || 0);
      setGenerations(data || []);
      setActiveGenerations(data?.filter(g => g.status === 'processing') || []);
    } catch (error) {
      console.error('Error fetching generations:', error);
    }
  };

  const handleRealtimeUpdate = (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    console.log('🔄 Processing FLUX Redux real-time update:', { 
      eventType, 
      newRecord: newRecord ? { id: newRecord.id, status: newRecord.status } : null,
      oldRecord: oldRecord ? { id: oldRecord.id } : null
    });

    setGenerations(current => {
      let updated;
      switch (eventType) {
        case 'INSERT':
          console.log('➕ Adding new FLUX Redux generation to list');
          updated = [newRecord, ...current];
          break;
        case 'UPDATE':
          console.log('🔄 Updating existing FLUX Redux generation');
          updated = current.map(item => 
            item.id === newRecord.id ? newRecord : item
          );
          
          // Debug the update
          if (newRecord.status === 'completed') {
            console.log('✅ FLUX Redux generation completed! Output URL:', newRecord.output_file_url);
          }
          break;
        case 'DELETE':
          console.log('🗑️ Removing FLUX Redux generation from list');
          updated = current.filter(item => item.id !== oldRecord.id);
          break;
        default:
          updated = current;
      }
      
      console.log('📊 Updated generations count:', updated.length);
      return updated;
    });

    // Update active generations
    if (newRecord?.status === 'processing') {
      console.log('⏳ Adding to active FLUX Redux generations');
      setActiveGenerations(current => {
        const exists = current.find(g => g.id === newRecord.id);
        const updated = exists ? current.map(g => g.id === newRecord.id ? newRecord : g) : [newRecord, ...current];
        console.log('📊 Active generations count:', updated.length);
        return updated;
      });
    } else if (newRecord?.status === 'completed' || newRecord?.status === 'failed') {
      console.log('✅ Removing from active FLUX Redux generations - Status:', newRecord.status);
      setActiveGenerations(current => {
        const updated = current.filter(g => g.id !== newRecord?.id);
        console.log('📊 Active generations count after removal:', updated.length);
        return updated;
      });
      
      if (newRecord?.status === 'completed' && newRecord?.output_file_url) {
        console.log('🎉 FLUX Redux generation completed successfully! Has output:', !!newRecord.output_file_url);
      }
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
      const { url } = await uploadFile(file, 'flux-redux-images');
      setConfig(prev => ({ ...prev, guideImageUrl: url }));
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const calculateTokenCost = () => {
    let baseCost = 10; // Base cost for FLUX Redux
    
    // Additional cost based on steps
    if (config.steps >= 21 && config.steps <= 35) {
      baseCost += 10;
    } else if (config.steps >= 36 && config.steps <= 50) {
      baseCost += 20;
    }
    
    // Additional cost for multiple images
    if (config.numImages > 1) {
      baseCost += (config.numImages - 1) * baseCost; // Multiply base cost per additional image
    }
    
    return baseCost;
  };

  const handleGenerate = async () => {
    if (!config.guideImageUrl) {
      alert('Please upload a guide image');
      return;
    }

    if (!config.prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    const tokenCost = calculateTokenCost();
    const totalTokens = (profile.tokens || 0) + (profile.purchased_tokens || 0);
    if (totalTokens < tokenCost) {
      alert('Insufficient tokens. Please upgrade your plan.');
      return;
    }

    setGenerating(true);
    try {
      console.log('🚀 Starting FLUX Redux generation...');
      
      // Create generation record
      const generation = await createAIGeneration(
        'fal_flux_redux',
        config.prompt.substring(0, 50) + '...',
        config,
        tokenCost
      );

      console.log('📝 FLUX Redux generation record created:', generation.id);

      // Immediately add to local state for instant UI feedback
      setGenerations(current => {
        console.log('➕ Adding generation to local state immediately');
        return [generation, ...current];
      });
      setActiveGenerations(current => {
        console.log('⏳ Adding generation to active list immediately');
        return [generation, ...current];
      });
      
      // Deduct tokens
      await updateTokenCount(user.id, tokenCost);
      
      // Refresh profile to get accurate token counts from database
      await fetchProfile();

      console.log('💰 Tokens deducted, calling Edge Function...');

      // Call Edge Function with extended timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-flux-redux`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            generationId: generation.id,
            ...config
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log('📡 Edge Function response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Edge Function error:', response.status, errorText);
          
          let errorMessage = `Edge Function error: ${response.status}`;
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            errorMessage = errorText || errorMessage;
          }
          
          throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('✅ Edge Function result:', result);

        // Clear prompt after successful generation
        setConfig(prev => ({ ...prev, prompt: '' }));

        console.log('🎉 FLUX Redux generation request completed successfully');

      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.log('⏰ Request timed out, but generation may still be processing');
          alert('Request timed out, but your generation may still be processing. Check your Gallery in a few minutes.');
          return; // Don't throw error, let it process in background
        }
        
        throw fetchError;
      }

    } catch (error) {
      console.error('❌ Error generating:', error);
      
      // Remove from local state if there was an error
      setGenerations(current => current.filter(g => g.id !== generation?.id));
      setActiveGenerations(current => current.filter(g => g.id !== generation?.id));
      
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

  const handleDownload = async (imageUrls) => {
    try {
      // Handle both single URL and array of URLs
      const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
      
      for (let i = 0; i < urls.length; i++) {
        const response = await fetch(urls[i]);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `flux-redux-${Date.now()}-${i + 1}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        // Small delay between downloads
        if (i < urls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link
      const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
      urls.forEach((url, i) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `flux-redux-${Date.now()}-${i + 1}.jpg`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
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

  // Helper function to get image URLs from generation
  const getImageUrls = (generation) => {
    if (!generation.output_file_url) return [];
    
    try {
      const parsed = JSON.parse(generation.output_file_url);
      return Array.isArray(parsed) ? parsed : [generation.output_file_url];
    } catch {
      return [generation.output_file_url];
    }
  };

  // Helper function to get primary image URL
  const getPrimaryImageUrl = (generation) => {
    const urls = getImageUrls(generation);
    return urls[0] || null;
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
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">FLUX Redux Pro</h1>
                  <p className="text-purple-200 text-sm">Create image variations with advanced IP-Adapter control for style preservation</p>
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
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sticky top-8">
              <div className="flex items-center space-x-2 mb-6">
                <Settings className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">Redux Configuration</h2>
              </div>

              <div className="space-y-6">
                {/* Guide Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <ImageIcon className="w-4 h-4 inline mr-1" />
                    Guide Image *
                  </label>
                  <div 
                    className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center transition-colors hover:border-white/50"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('border-purple-400', 'bg-purple-500/10');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-purple-400', 'bg-purple-500/10');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-purple-400', 'bg-purple-500/10');
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
                      {config.guideImageUrl ? (
                        <div className="space-y-2">
                          <img 
                            src={toCdnUrl(config.guideImageUrl)} 
                            alt="Guide" 
                            className="w-full h-32 object-contain rounded-lg bg-black/20"
                            loading="lazy"
                          />
                          <p className="text-purple-200 text-sm">Click to change</p>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                          <p className="text-purple-200">
                            {uploadingImage ? 'Uploading...' : 'Upload or drag & drop image'}
                          </p>
                          <p className="text-purple-300 text-xs mt-1">
                            For image variations and style transfer • Drag & drop supported
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Variation Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Wand2 className="w-4 h-4 inline mr-1" />
                    Variation Prompt *
                  </label>
                  <textarea
                    value={config.prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Describe the style or changes you want..."
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={3}
                  />
                  <p className="text-purple-300 text-xs mt-1">
                    Example: "in the style of a watercolor painting"
                  </p>
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
                    <span>1 image</span>
                    <span>4 images (+{(config.numImages - 1) * 8} tokens)</span>
                  </div>
                </div>

                {/* Image Size */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Image Size
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {imageSizeOptions.map((option) => (
                      <button
                        key={`${option.value.width}x${option.value.height}`}
                        onClick={() => setConfig(prev => ({ ...prev, width: option.value.width, height: option.value.height }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                          (option.value.width === 'custom' ? 
                            !imageSizeOptions.slice(0, -1).some(preset => preset.value.width === config.width && preset.value.height === config.height) :
                            config.width === option.value.width && config.height === option.value.height)
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

                {/* Custom Dimensions */}
                {!imageSizeOptions.slice(0, -1).some(preset => preset.value.width === config.width && preset.value.height === config.height) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        Width (px)
                      </label>
                      <input
                        type="number"
                        min="256"
                        max="2048"
                        step="64"
                        value={config.width}
                        onChange={(e) => setConfig(prev => ({ ...prev, width: parseInt(e.target.value) || 1024 }))}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        Height (px)
                      </label>
                      <input
                        type="number"
                        min="256"
                        max="2048"
                        step="64"
                        value={config.height}
                        onChange={(e) => setConfig(prev => ({ ...prev, height: parseInt(e.target.value) || 768 }))}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                )}

                {/* Output Format */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Output Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, outputFormat: 'jpeg' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.outputFormat === 'jpeg'
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      JPEG (Smaller)
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, outputFormat: 'png' }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.outputFormat === 'png'
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      PNG (Lossless)
                    </button>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="border-t border-white/20 pt-4">
                  <h3 className="text-sm font-semibold text-white mb-4">Advanced Settings</h3>
                  
                  <div className="space-y-4">
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
                        IP-Adapter Weight: {config.ipAdapterWeight}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={config.ipAdapterWeight}
                        onChange={(e) => setConfig(prev => ({ ...prev, ipAdapterWeight: parseFloat(e.target.value) }))}
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
                        Safety Tolerance: {config.safetyTolerance}
                      </label>
                      <div className="grid grid-cols-6 gap-1">
                        {['1', '2', '3', '4', '5', '6'].map((level) => (
                          <button
                            key={level}
                            onClick={() => setConfig(prev => ({ ...prev, safetyTolerance: level }))}
                            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                              config.safetyTolerance === level
                                ? 'bg-purple-500 text-white'
                                : 'bg-white/10 text-purple-200 hover:bg-white/20'
                            }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                      <p className="text-purple-300 text-xs mt-1">
                        1 = Strict, 6 = Permissive
                      </p>
                    </div>

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

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={config.enableSafetyChecker}
                        onChange={(e) => setConfig(prev => ({ ...prev, enableSafetyChecker: e.target.checked }))}
                        className="w-4 h-4 text-purple-600 bg-white/10 border-white/20 rounded focus:ring-purple-500"
                      />
                      <span className="text-white font-medium">Safety Checker</span>
                    </label>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.guideImageUrl || !config.prompt.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      <span>Generate Variations ({calculateTokenCost()} tokens)</span>
                    </>
                  )}
                </button>

                {/* Processing Note */}
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                  <p className="text-purple-200 text-xs">
                    <Layers className="w-3 h-3 inline mr-1" />
                    FLUX Redux generation typically takes 1-3 minutes. You can navigate away and check your Gallery later.
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
                    <h3 className="text-lg font-semibold text-white">Processing ({activeGenerations.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {generations.slice(0, window.innerWidth >= 1024 ? 3 : generations.length).map((generation) => (
                      <div key={generation.id} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{generation.generation_name}</p>
                            <p className="text-purple-200 text-sm">
                              Images: {generation.input_data?.numImages} • 
                              Started: {new Date(generation.created_at).toLocaleTimeString()}
                            </p>
                            <p className="text-purple-300 text-xs mt-1">
                              FLUX Redux generation typically takes 1-3 minutes
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
                  <h3 className="text-lg font-semibold text-white">Generated Variations</h3>
                  <button
                    onClick={fetchGenerations}
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {generations.length === 0 ? (
                  <div className="text-center py-12">
                    <Layers className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                    <p className="text-purple-200 text-lg">No variations generated yet</p>
                    <p className="text-purple-300 text-sm">Upload a guide image and describe variations to create FLUX Redux images</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {generations.map((generation) => (
                      <div
                        key={generation.id}
                        className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-all duration-200 cursor-pointer"
                        onClick={() => setSelectedGeneration(generation)}
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

                          {getPrimaryImageUrl(generation) && generation.status === 'completed' && (
                            <div className="mb-4">
                              {getImageUrls(generation).length === 1 ? (
                                <img
                                  src={getPrimaryImageUrl(generation)}
                                  alt={generation.generation_name}
                                  className="w-full rounded-lg max-h-96 object-contain"
                                />
                              ) : (
                                <div className="grid grid-cols-2 gap-2">
                                  {getImageUrls(generation).slice(0, 4).map((url, index) => (
                                    <img
                                      key={index}
                                      src={url}
                                      alt={`${generation.generation_name} - ${index + 1}`}
                                      className="w-full rounded-lg h-48 object-cover"
                                    />
                                  ))}
                                  {getImageUrls(generation).length > 4 && (
                                    <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                                      +{getImageUrls(generation).length - 4} more
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {generation.status === 'processing' && (
                            <div className="mb-4 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-lg p-8 text-center">
                              <RefreshCw className="w-12 h-12 text-purple-300 animate-spin mx-auto mb-2" />
                              <p className="text-purple-200">Generating variations...</p>
                              <p className="text-purple-300 text-sm">This may take 1-3 minutes</p>
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
                              <strong>Prompt:</strong> {generation.input_data?.prompt}
                            </p>
                            <div className="flex items-center justify-between">
                              <span>
                                <strong>Images:</strong> {generation.input_data?.numImages}
                              </span>
                              <span>
                                <strong>Size:</strong> {generation.input_data?.width}×{generation.input_data?.height} ({generation.input_data?.outputFormat?.toUpperCase()})
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyPrompt(generation.input_data.prompt);
                                  }}
                                  className="text-purple-400 hover:text-purple-300 transition-colors"
                                  title="Copy prompt"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              {getPrimaryImageUrl(generation) && generation.status === 'completed' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(getImageUrls(generation));
                                  }}
                                  className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors"
                                  title={getImageUrls(generation).length > 1 ? `Download all ${getImageUrls(generation).length} images` : 'Download image'}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(generation.id);
                                }}
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
      {selectedGeneration && !enlargedImageIndex && (
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

              {getPrimaryImageUrl(selectedGeneration) && (
                <div className="mb-6">
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-3">
                      Generated Images ({getImageUrls(selectedGeneration).length})
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {getImageUrls(selectedGeneration).map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`${selectedGeneration.generation_name} - Image ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setEnlargedImageIndex(index)}
                          />
                          <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
                            {index + 1}
                          </div>
                          <div 
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center cursor-pointer"
                            onClick={() => setEnlargedImageIndex(index)}
                          >
                            <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-white text-sm">Click to enlarge</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
                    {selectedGeneration.input_data?.width && selectedGeneration.input_data?.height && (
                      <div className="flex justify-between">
                        <span className="text-purple-200">Dimensions:</span>
                        <span className="text-white">
                          {selectedGeneration.input_data.width} × {selectedGeneration.input_data.height}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-purple-200">Output Format:</span>
                      <span className="text-white">{selectedGeneration.input_data?.outputFormat?.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Guidance Scale:</span>
                      <span className="text-white">{selectedGeneration.input_data?.guidanceScale}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Safety Tolerance:</span>
                      <span className="text-white">{selectedGeneration.input_data?.safetyTolerance}</span>
                    </div>
                    {selectedGeneration.metadata?.seed && selectedGeneration.metadata.seed !== 'random' && (
                      <div className="flex justify-between">
                        <span className="text-purple-200">Seed:</span>
                        <span className="text-white">{selectedGeneration.metadata.seed}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                {getPrimaryImageUrl(selectedGeneration) && (
                  <button
                    onClick={() => handleDownload(getImageUrls(selectedGeneration))}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      Download All ({getImageUrls(selectedGeneration).length})
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

      {/* Image Enlargement Modal */}
      {selectedGeneration && enlargedImageIndex !== null && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
            {/* Close button */}
            <button
              onClick={() => setEnlargedImageIndex(null)}
              className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Download button */}
            <button
              onClick={() => {
                const urls = getImageUrls(selectedGeneration);
                handleDownload([urls[enlargedImageIndex]]);
              }}
              className="absolute top-4 left-4 z-10 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
            >
              <Download className="w-6 h-6" />
            </button>

            {/* Previous button (only show if multiple images) */}
            {getImageUrls(selectedGeneration).length > 1 && enlargedImageIndex > 0 && (
              <button
                onClick={() => setEnlargedImageIndex(enlargedImageIndex - 1)}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Next button (only show if multiple images) */}
            {getImageUrls(selectedGeneration).length > 1 && enlargedImageIndex < getImageUrls(selectedGeneration).length - 1 && (
              <button
                onClick={() => setEnlargedImageIndex(enlargedImageIndex + 1)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Enlarged image */}
            <img
              src={getImageUrls(selectedGeneration)[enlargedImageIndex]}
              alt={`${selectedGeneration.generation_name} - Image ${enlargedImageIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />

            {/* Image counter (only show if multiple images) */}
            {getImageUrls(selectedGeneration).length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
                {enlargedImageIndex + 1} of {getImageUrls(selectedGeneration).length}
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
        toolName="FLUX Redux Pro"
        details={nsfwError?.technical}
      />

      {/* Custom Styles */}
      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #8B5CF6, #6366F1);
          cursor: pointer;
          border: 2px solid white;
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #8B5CF6, #6366F1);
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

export default FluxRedux;
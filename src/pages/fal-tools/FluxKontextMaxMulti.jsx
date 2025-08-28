import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { createAIGeneration, updateTokenCount, uploadFile } from '../../utils/storageHelpers';
import { isNSFWError, parseNSFWError } from '../../utils/falErrorHandler';
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
  Wand2,
  Layers,
  Sparkles,
  Hash,
  Palette,
  Plus,
  Minus,
  Monitor,
  Smartphone,
  Square,
  ArrowRight,
  Maximize2
} from 'lucide-react';

const FluxKontextMaxMulti = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state
  const [config, setConfig] = useState({
    prompt: '',
    imageUrls: [], // Array of image URLs
    guidanceScale: 10.5,
    numImages: 1,
    outputFormat: "png",
    safetyTolerance: "2",
    seed: -1,
    aspectRatio: "1:1"
  });
  
  // Generation state
  const [generations, setGenerations] = useState([]);
  const [activeGenerations, setActiveGenerations] = useState([]);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showNSFWAlert, setShowNSFWAlert] = useState(false);
  const [nsfwError, setNsfwError] = useState(null);
  const [imageViewer, setImageViewer] = useState({
    isOpen: false,
    images: [],
    currentIndex: 0
  });

  // Aspect ratio options
  const aspectRatioOptions = [
    { label: 'Ultra Wide (21:9)', value: '21:9', icon: <Maximize2 className="w-4 h-4" /> },
    { label: 'Landscape (16:9)', value: '16:9', icon: <Monitor className="w-4 h-4" /> },
    { label: 'Standard (4:3)', value: '4:3', icon: <Monitor className="w-4 h-4" /> },
    { label: 'Photo (3:2)', value: '3:2', icon: <Monitor className="w-4 h-4" /> },
    { label: 'Square (1:1)', value: '1:1', icon: <Square className="w-4 h-4" /> },
    { label: 'Photo Portrait (2:3)', value: '2:3', icon: <Smartphone className="w-4 h-4" /> },
    { label: 'Standard Portrait (3:4)', value: '3:4', icon: <Smartphone className="w-4 h-4" /> },
    { label: 'Portrait (9:16)', value: '9:16', icon: <Smartphone className="w-4 h-4" /> },
    { label: 'Ultra Portrait (9:21)', value: '9:21', icon: <Smartphone className="w-4 h-4" /> }
  ];

  // Safety tolerance options
  const safetyToleranceOptions = [
    { label: 'Very Strict (1)', value: "1" },
    { label: 'Strict (2)', value: "2" },
    { label: 'Moderate (3)', value: "3" },
    { label: 'Relaxed (4)', value: "4" },
    { label: 'Permissive (5)', value: "5" },
    { label: 'Very Permissive (6)', value: "6" }
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription
      const subscription = supabase
        .channel('flux_kontext_max_multi_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id},tool_type=eq.fal_flux_kontext_max_multi`
          },
          (payload) => {
            console.log('Real-time update received:', payload);
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

      console.log('Real-time subscription set up for FLUX Kontext Max Multi');
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
        .eq('tool_type', 'fal_flux_kontext_max_multi')
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

  const handleMultipleImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Validate files
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        alert('Please select only image files');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('Each file size must be less than 10MB');
        return;
      }
    }

    if (config.imageUrls.length + files.length > 10) {
      alert('Maximum 10 images allowed');
      return;
    }

    setUploadingImages(true);
    try {
      const uploadPromises = files.map(file => uploadFile(file, 'flux-kontext-max-multi-images'));
      const uploadResults = await Promise.all(uploadPromises);
      
      const newUrls = uploadResults.map(result => result.url);
      
      if (config.imageUrls.length < 4) {
        setConfig(prev => ({
          ...prev,
          imageUrls: [...prev.imageUrls, ...newUrls]
        }));
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Error uploading images. Please try again.');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index) => {
    setConfig(prev => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index)
    }));
  };

  const calculateTokenCost = () => {
    // Base cost: 15 tokens per image generated
    return config.numImages * 15;
  };

  const handleGenerate = async () => {
    if (!config.prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    if (config.imageUrls.length === 0) {
      alert('Please upload at least one image');
      return;
    }

    const validImageUrls = config.imageUrls.filter(url => url && url.trim() !== '');

    if (validImageUrls.length > 4) {
      alert('Maximum 4 images allowed');
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
      console.log('Starting FLUX Kontext Max Multi generation...');
      
      // Create generation record
      const generation = await createAIGeneration(
        'fal_flux_kontext_max_multi',
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
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-flux-kontext-max-multi`, {
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
        alert(`Error: ${error.message}`);
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
          await downloadSingleImage(imageUrls[i], `flux-kontext-max-multi-${Date.now()}-${i + 1}`);
          if (i < imageUrls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } else {
        // Single image
        await downloadSingleImage(imageUrls, `flux-kontext-max-multi-${Date.now()}`);
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

  const openImageViewer = (images, startIndex = 0) => {
    setImageViewer({
      isOpen: true,
      images: images.map(url => toCdnUrl(url)),
      currentIndex: startIndex
    });
  };

  const closeImageViewer = () => {
    setImageViewer({
      isOpen: false,
      images: [],
      currentIndex: 0
    });
  };

  const navigateImage = (direction) => {
    setImageViewer(prev => {
      const newIndex = direction === 'next' 
        ? (prev.currentIndex + 1) % prev.images.length
        : (prev.currentIndex - 1 + prev.images.length) % prev.images.length;
      
      return {
        ...prev,
        currentIndex: newIndex
      };
    });
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!imageViewer.isOpen) return;
      
      switch (e.key) {
        case 'Escape':
          closeImageViewer();
          break;
        case 'ArrowLeft':
          navigateImage('prev');
          break;
        case 'ArrowRight':
          navigateImage('next');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [imageViewer.isOpen]);

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
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">FLUX Kontext Max Multi</h1>
                  <p className="text-purple-200 text-sm">Advanced multi-image composition with FLUX Pro Kontext Max</p>
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
                <h2 className="text-lg font-semibold text-white">Multi-Image Configuration</h2>
              </div>

              <div className="space-y-6">
                {/* Multiple Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Layers className="w-4 h-4 inline mr-1" />
                    Source Images * (Max 10)
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
                        handleMultipleImageUpload(event);
                      }
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleMultipleImageUpload}
                      className="hidden"
                      id="images-upload"
                      disabled={uploadingImages}
                    />
                    <label htmlFor="images-upload" className="cursor-pointer">
                      <div>
                        <Upload className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                        <p className="text-purple-200">
                          {uploadingImages ? 'Uploading...' : 'Upload multiple images'}
                        </p>
                        <p className="text-purple-300 text-xs mt-1">
                          Select multiple images • Max 4 images • Drag & drop supported
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Display uploaded images */}
                  {config.imageUrls.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-purple-200 text-sm font-medium">
                          Uploaded Images ({config.imageUrls.length}/4)
                        </span>
                        <button
                          onClick={() => setConfig(prev => ({ ...prev, imageUrls: [] }))}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {config.imageUrls.map((url, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={url}
                              alt={`Upload ${index + 1}`}
                              className="w-full h-20 object-cover rounded-lg"
                              loading="lazy"
                            />
                            <button
                              onClick={() => removeImage(index)}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                              {index + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Wand2 className="w-4 h-4 inline mr-1" />
                    Composition Prompt *
                  </label>
                  <textarea
                    value={config.prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Describe how to combine the images... e.g., 'Put the little duckling on top of the woman's t-shirt'"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={4}
                  />
                  <p className="text-purple-300 text-xs mt-1">
                    Describe how to combine, position, or compose the uploaded images
                  </p>
                </div>

                {/* Number of Images to Generate */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Hash className="w-4 h-4 inline mr-1" />
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

                {/* Aspect Ratio */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Aspect Ratio
                  </label>
                  <select
                    value={config.aspectRatio}
                    onChange={(e) => setConfig(prev => ({ ...prev, aspectRatio: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {aspectRatioOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-gray-800 text-white">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Output Format */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Palette className="w-4 h-4 inline mr-1" />
                    Output Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['png', 'jpeg'].map((format) => (
                      <button
                        key={format}
                        onClick={() => setConfig(prev => ({ ...prev, outputFormat: format }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          config.outputFormat === format
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {format.toUpperCase()}
                        {format === 'png' && <span className="block text-xs opacity-75">Transparency</span>}
                        {format === 'jpeg' && <span className="block text-xs opacity-75">Smaller size</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Safety Tolerance */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Safety Tolerance: {config.safetyTolerance}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    value={config.safetyTolerance}
                    onChange={(e) => setConfig(prev => ({ ...prev, safetyTolerance: e.target.value }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>Very Strict</span>
                    <span>Moderate</span>
                    <span>Permissive</span>
                  </div>
                </div>

                {/* Guidance Scale */}
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
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>1.0</span>
                    <span>10.5 (default)</span>
                    <span>20.0</span>
                  </div>
                </div>

                {/* Seed */}
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

                {/* Cost Display */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <h3 className="text-emerald-200 font-medium mb-2 flex items-center">
                    <Zap className="w-4 h-4 mr-2" />
                    Cost Calculation
                  </h3>
                  <div className="text-emerald-300 text-sm space-y-1">
                    <p>Images to Generate: {config.numImages}</p>
                    <p>Rate: 15 tokens per image</p>
                    <p className="font-medium text-emerald-200">Total: {calculateTokenCost()} tokens</p>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.prompt.trim() || config.imageUrls.length === 0}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      <span>Generate Images ({calculateTokenCost()} tokens)</span>
                    </>
                  )}
                </button>

                {/* Processing Note */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                  <p className="text-emerald-200 text-xs">
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    Multi-image composition typically takes 30-60 seconds. Upload multiple images and describe how to combine them.
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
                    <Layers className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                    <p className="text-purple-200 text-lg">No compositions generated yet</p>
                    <p className="text-purple-300 text-sm">Upload multiple images and describe how to combine them</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {generations.slice(0, window.innerWidth >= 1024 ? 8 : generations.length).map((generation) => {
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
                            <div className="h-48 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                              <Layers className="w-12 h-12 text-emerald-300" />
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

                            {generation.input_data?.imageUrls && (
                              <div className="mt-2">
                                <p className="text-emerald-300 text-xs">
                                  <Layers className="w-3 h-3 inline mr-1" />
                                  {generation.input_data.imageUrls.length} source images used
                                </p>
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
                          <button
                            key={index}
                            onClick={() => openImageViewer(getAllImageUrls(selectedGeneration), index)}
                            className="w-full h-48 rounded-lg overflow-hidden hover:opacity-90 transition-opacity cursor-pointer group"
                          >
                            <img
                              src={toCdnUrl(url)}
                              alt={`${selectedGeneration.generation_name} - Image ${index + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          </button>
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
                      <span className="text-purple-200">Images Generated:</span>
                      <span className="text-white">{selectedGeneration.input_data?.numImages || 1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Source Images:</span>
                      <span className="text-white">{selectedGeneration.input_data?.imageUrls?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Aspect Ratio:</span>
                      <span className="text-white">{selectedGeneration.input_data?.aspectRatio}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-200">Safety Tolerance:</span>
                      <span className="text-white">{selectedGeneration.input_data?.safetyTolerance}</span>
                    </div>
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

      {/* Full-Screen Image Viewer */}
      {imageViewer.isOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={closeImageViewer}
            className="absolute top-4 right-4 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Image Counter */}
          <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-full">
            <span className="text-sm font-medium">
              {imageViewer.currentIndex + 1} of {imageViewer.images.length}
            </span>
          </div>

          {/* Navigation Arrows */}
          {imageViewer.images.length > 1 && (
            <>
              <button
                onClick={() => navigateImage('prev')}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => navigateImage('next')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
              >
                <ArrowRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Main Image */}
          <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
            <img
              src={imageViewer.images[imageViewer.currentIndex]}
              alt={`Image ${imageViewer.currentIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              loading="lazy"
            />
          </div>

          {/* Download Button */}
          <button
            onClick={() => {
              const link = document.createElement('a');
              link.href = imageViewer.images[imageViewer.currentIndex];
              link.download = `flux-kontext-max-multi-${imageViewer.currentIndex + 1}-${Date.now()}.png`;
              link.target = '_blank';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="absolute bottom-4 right-4 z-10 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full flex items-center space-x-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Download</span>
          </button>

          {/* Thumbnail Strip (for multiple images) */}
          {imageViewer.images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
              <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
                <div className="flex space-x-2">
                  {imageViewer.images.map((url, index) => (
                    <button
                      key={index}
                      onClick={() => setImageViewer(prev => ({ ...prev, currentIndex: index }))}
                      className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                        index === imageViewer.currentIndex
                          ? 'border-emerald-400 scale-110'
                          : 'border-white/30 hover:border-white/60'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="absolute bottom-4 left-4 z-10 bg-black/50 backdrop-blur-sm text-white px-3 py-2 rounded-lg">
            <p className="text-xs">
              {imageViewer.images.length > 1 ? 'Use ← → keys or click arrows to navigate • ' : ''}ESC to close
            </p>
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
        toolName="FLUX Kontext Max Multi"
        details={nsfwError?.technical}
      />

      {/* Custom Slider Styles */}
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

export default FluxKontextMaxMulti;
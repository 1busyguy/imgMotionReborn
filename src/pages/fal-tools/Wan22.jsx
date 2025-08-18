import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { createAIGeneration, updateTokenCount } from '../../utils/storageHelpers';
import { uploadFile } from '../../utils/storageHelpers';
import { isContentPolicyError, parseContentPolicyError } from '../../utils/errorHandlers';
import { toCdnUrl } from '../../utils/cdnHelpers';
import NSFWAlert from '../../components/NSFWAlert';
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
  Film,
  Wand2,
  Image as ImageIcon,
  Shield,
  Dice6,
  Sparkles,
  Clock,
  Monitor,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

const Wan22 = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state
  const [config, setConfig] = useState({
    imageUrl: '',
    prompt: '',
    resolution: '1080P',
    promptExtend: true,
    seed: -1
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

  // Cloudinary configuration
  const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'ml_default';
  const isCloudinaryConfigured = !!CLOUDINARY_CLOUD_NAME;

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription
      const subscription = supabase
        .channel('wan22_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id},tool_type=eq.wan22_pro`
          },
          (payload) => {
            console.log('Real-time update received:', payload);
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

      console.log('Real-time subscription set up for WAN 2.2');
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
        .eq('tool_type', 'wan22_pro')
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

  // Upload to Cloudinary ONLY
  const uploadToCloudinary = async (file) => {
    if (!isCloudinaryConfigured) {
      throw new Error('Cloudinary is not configured. Please add VITE_CLOUDINARY_CLOUD_NAME to your environment variables.');
    }
    
    const formData = new FormData();
    formData.append('file', file);
    // Try unsigned upload first, fallback to signed if needed
    formData.append('upload_preset', 'ml_default');
    formData.append('folder', 'wan22-images');
    formData.append('resource_type', 'image');
    
    try {
      console.log('🔄 Uploading to Cloudinary...');
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // If unsigned upload fails, try with auto upload preset
        if (errorData.error?.message?.includes('Upload preset must be whitelisted')) {
          console.log('🔄 Trying with auto upload preset...');
          
          const autoFormData = new FormData();
          autoFormData.append('file', file);
          autoFormData.append('upload_preset', 'auto');
          autoFormData.append('folder', 'wan22-images');
          
          const autoResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
            {
              method: 'POST',
              body: autoFormData
            }
          );
          
          if (!autoResponse.ok) {
            const autoErrorData = await autoResponse.json();
            throw new Error(`Cloudinary upload failed: ${autoErrorData.error?.message || 'Upload preset not configured'}. Please enable unsigned uploads in your Cloudinary settings.`);
          }
          
          const autoData = await autoResponse.json();
          console.log('✅ Image uploaded to Cloudinary with auto preset:', autoData.secure_url);
          
          return {
            url: autoData.secure_url,
            publicId: autoData.public_id,
            format: autoData.format,
            width: autoData.width,
            height: autoData.height
          };
        }
        
        throw new Error(`Cloudinary upload failed: ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Image uploaded to Cloudinary:', data.secure_url);
      
      return {
        url: data.secure_url,
        publicId: data.public_id,
        format: data.format,
        width: data.width,
        height: data.height
      };
    } catch (error) {
      console.error('❌ Cloudinary upload error:', error);
      throw error;
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
          toolType: 'seedance-pro',
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

    if (!isCloudinaryConfigured) {
      alert('Cloudinary is not configured. Please add VITE_CLOUDINARY_CLOUD_NAME to your Vercel environment variables and redeploy.');
      return;
    }

    setUploadingImage(true);
    try {
      // Upload to both Cloudinary (for DashScope) and Supabase (for user storage)
      const cloudinaryResult = await uploadToCloudinary(file);
      
      // Also save to Supabase user storage
      const { url: supabaseUrl } = await uploadFile(file, 'wan22-images');
      console.log('✅ Image also saved to Supabase:', supabaseUrl);
      
      setConfig(prev => ({ ...prev, imageUrl: cloudinaryResult.url }));
      
      // Auto-analyze the image
      await analyzeImageWithOpenAI(cloudinaryResult.url);
      
    } catch (error) {
      console.error('Error uploading image:', error);
      alert(`Error uploading image: ${error.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const calculateTokenCost = () => {
    return config.resolution === '1080P' ? 100 : 50;
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

    const tokenCost = calculateTokenCost();
    const totalTokens = (profile.tokens || 0) + (profile.purchased_tokens || 0);
    if (totalTokens < tokenCost) {
      alert('Insufficient tokens. Please upgrade your plan.');
      return;
    }

    setGenerating(true);
    let generation = null;
    
    try {
      console.log('🚀 Starting WAN 2.2 generation...');
      
      generation = await createAIGeneration(
        'wan22_pro',
        config.prompt.substring(0, 50) + '...',
        config,
        tokenCost
      );

      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      await updateTokenCount(user.id, tokenCost);
      await fetchProfile();

      console.log('💰 Tokens deducted, calling Edge Function...');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wan22-pro`, {
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
      console.log('✅ WAN 2.2 generation request submitted successfully');

    } catch (error) {
      console.error('❌ Error generating:', error);
      
      if (generation) {
        setGenerations(current => current.filter(g => g.id !== generation.id));
        setActiveGenerations(current => current.filter(g => g.id !== generation.id));
      }
      
      if (isContentPolicyError(error.message)) {
        const policyDetails = parseContentPolicyError(error.message);
        setNsfwError(policyDetails);
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
      link.download = `wan22-video-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      const link = document.createElement('a');
      link.href = toCdnUrl(videoUrl);
      link.download = `wan22-video-${Date.now()}.mp4`;
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
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">WAN 2.2 Professional</h1>
                  <p className="text-purple-200 text-sm">Latest model with 1080P support and improved motion stability</p>
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
        {/* Cloudinary Status Alert */}
        {!isCloudinaryConfigured && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-6 mb-8">
            <div className="flex items-start space-x-4">
              <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-red-200 font-semibold text-lg mb-2">Cloudinary Not Configured</h3>
                <p className="text-red-300 mb-4">
                  WAN 2.2 requires Cloudinary for stable image URLs. Without it, video generation will fail.
                </p>
                <div className="bg-red-500/10 rounded-lg p-4 mb-4">
                  <h4 className="text-red-200 font-medium mb-2">Quick Setup:</h4>
                  <ol className="text-red-300 text-sm space-y-1 list-decimal list-inside">
                    <li>Sign up at <a href="https://cloudinary.com" target="_blank" className="text-red-200 underline">cloudinary.com</a> (free)</li>
                    <li>Copy your Cloud Name from the dashboard</li>
                    <li>Add <code className="bg-red-500/20 px-1 rounded">VITE_CLOUDINARY_CLOUD_NAME</code> to Vercel environment variables</li>
                    <li>Redeploy your project</li>
                  </ol>
                </div>
                <p className="text-red-400 text-sm font-medium">
                  Current status: Cloud Name = {CLOUDINARY_CLOUD_NAME || 'NOT_SET'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Configuration Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sticky top-8">
              <div className="flex items-center space-x-2 mb-6">
                <Settings className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">Video Configuration</h2>
              </div>

              {/* Cloudinary Status */}
              <div className={`flex items-center space-x-2 mb-4 p-3 rounded-lg ${
                isCloudinaryConfigured 
                  ? 'bg-green-500/20 border border-green-500/30' 
                  : 'bg-red-500/20 border border-red-500/30'
              }`}>
                {isCloudinaryConfigured ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-200 font-medium">Cloudinary Ready</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <span className="text-red-200 font-medium">Cloudinary Required</span>
                  </>
                )}
              </div>

              <div className="space-y-6">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <ImageIcon className="w-4 h-4 inline mr-1" />
                    First Frame Image *
                  </label>
                  <div 
                    className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center transition-colors hover:border-white/50"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('border-indigo-400', 'bg-indigo-500/10');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-500/10');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-500/10');
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
                      disabled={uploadingImage || !isCloudinaryConfigured}
                    />
                    <label htmlFor="image-upload" className={`cursor-pointer ${!isCloudinaryConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {config.imageUrl ? (
                        <div className="space-y-2">
                          <img 
                            src={config.imageUrl} 
                            alt="Source" 
                            className="w-full h-32 object-contain rounded-lg bg-black/20"
                            loading="lazy"
                          />
                          <p className="text-purple-200 text-sm">Click to change</p>
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
                            {!isCloudinaryConfigured ? 'Configure Cloudinary first' :
                             uploadingImage ? 'Uploading to Cloudinary...' : 
                             analyzingImage ? 'Analyzing...' : 
                             'Upload or drag & drop to Cloudinary'}
                          </p>
                          <p className="text-purple-300 text-xs mt-1">
                            {isCloudinaryConfigured ? 'Stable URLs for reliable processing • Drag & drop supported' : 'Cloudinary required for WAN 2.2'}
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
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={4}
                    maxLength={800}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-purple-300 text-xs">
                      {config.prompt.length}/800 characters
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

                {/* Resolution */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Monitor className="w-4 h-4 inline mr-1" />
                    Output Resolution
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, resolution: '480P' }))}
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        config.resolution === '480P'
                          ? 'bg-purple-500/30 border-purple-400 text-white'
                          : 'bg-white/5 border-white/20 text-purple-200 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-medium">480P</div>
                      <div className="text-xs opacity-70">50 tokens</div>
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, resolution: '1080P' }))}
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        config.resolution === '1080P'
                          ? 'bg-purple-500/30 border-purple-400 text-white'
                          : 'bg-white/5 border-white/20 text-purple-200 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-medium">1080P</div>
                      <div className="text-xs opacity-70">100 tokens</div>
                    </button>
                  </div>
                </div>

                {/* Prompt Extension */}
                <div>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={config.promptExtend}
                      onChange={(e) => setConfig(prev => ({ ...prev, promptExtend: e.target.checked }))}
                      className="w-4 h-4 text-purple-600 bg-white/10 border-white/20 rounded focus:ring-purple-500"
                    />
                    <div>
                      <span className="text-white font-medium flex items-center">
                        <Sparkles className="w-4 h-4 mr-1" />
                        Prompt Enhancement
                      </span>
                      <p className="text-purple-300 text-xs">
                        AI rewrites prompt for better results
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
                  disabled={generating || !config.imageUrl || !config.prompt.trim() || !isCloudinaryConfigured}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
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
                    <p className="text-purple-300 text-sm">
                      {isCloudinaryConfigured 
                        ? 'Upload an image and describe motion to create professional videos'
                        : 'Configure Cloudinary first to start generating videos'
                      }
                    </p>
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
                            <div className="mb-4 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-lg p-8 text-center">
                              <RefreshCw className="w-12 h-12 text-indigo-300 animate-spin mx-auto mb-2" />
                              <p className="text-indigo-200">Generating professional video...</p>
                              <p className="text-indigo-300 text-sm">This typically takes 1-2 minutes</p>
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
                            <div className="flex items-center justify-between">
                              <span>
                                <strong>Resolution:</strong> {generation.input_data?.resolution || '1080P'}
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
        toolName="WAN 2.2 Professional"
        details={nsfwError?.technical}
      />

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

export default Wan22;
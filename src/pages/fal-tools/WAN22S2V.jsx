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
  Music,
  Mic,
  Monitor,
  Smartphone,
  Square,
  Hash,
  Sliders,
  Dice6
} from 'lucide-react';

const WAN22S2V = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state - based on WAN 22 S2V API
  const [config, setConfig] = useState({
    prompt: '',
    negative_prompt: '',
    image_url: '',
    audio_url: '',
    num_frames: 92,
    frames_per_second: 22,
    resolution: '480p',
    num_inference_steps: 30,
    enable_safety_checker: true,
    guidance_scale: 4.4,
    shift: 6,
    seed: -1
  });
  
  // Generation state
  const [generations, setGenerations] = useState([]);
  const [activeGenerations, setActiveGenerations] = useState([]);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [showNSFWAlert, setShowNSFWAlert] = useState(false);
  const [nsfwError, setNsfwError] = useState(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [analyzingAudio, setAnalyzingAudio] = useState(false);
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [audioAnalysis, setAudioAnalysis] = useState(null);
  const [showSafetyWarning, setShowSafetyWarning] = useState(false);
  const [safetyWarningData, setSafetyWarningData] = useState(null);
  const [bypassSafetyCheck, setBypassSafetyCheck] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    show: false,
    type: 'error',
    title: '',
    message: ''
  });

  // Resolution options
  const resolutionOptions = [
    { label: '480p (SD)', value: '480p' },
    { label: '580p (Enhanced SD)', value: '580p' },
    { label: '720p (HD)', value: '720p' }
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription for this specific tool type
      const subscription = supabase
        .channel('wan22_s2v_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id},tool_type=eq.fal_wan22_s2v`
          },
          (payload) => {
            console.log('🎬 WAN 22 S2V Real-time update received:', payload);
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

      console.log('Real-time subscription set up for WAN 22 S2V');
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
        .eq('tool_type', 'fal_wan22_s2v')
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
      
      if (newRecord?.status === 'failed') {
        setTimeout(() => {
          const errorMessage = newRecord.error_message || 'Generation failed';
          showAlert('error', 'Generation Failed', `WAN 22 S2V generation failed: ${errorMessage}`);
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
          toolType: 'wan-22-s2v',
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
      const { url } = await uploadFile(file, 'wan22-s2v-images');
      setConfig(prev => ({ ...prev, image_url: url }));
      
      // Auto-analyze the image with OpenAI Vision
      await analyzeImageWithOpenAI(url);
      
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Analyze audio to get duration
  const analyzeAudio = (file) => {
    return new Promise((resolve, reject) => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      
      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        
        resolve({
          duration,
          formattedDuration: `${Math.round(duration)}s`
        });
        
        // Clean up
        URL.revokeObjectURL(audio.src);
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(audio.src);
        reject(new Error('Failed to analyze audio'));
      };
      
      audio.src = URL.createObjectURL(file);
    });
  };

  const handleAudioUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('Audio file size must be less than 50MB');
      return;
    }

    setUploadingAudio(true);
    setAnalyzingAudio(true);
    try {
      // First analyze the audio to get duration
      const analysis = await analyzeAudio(file);
      console.log('Audio analysis:', analysis);
      setAudioAnalysis(analysis);
      
      // Then upload to storage
      const { url } = await uploadFile(file, 'wan22-s2v-audio');
      setConfig(prev => ({ ...prev, audio_url: url }));
    } catch (error) {
      console.error('Error uploading audio:', error);
      alert('Error uploading audio. Please try again.');
    } finally {
      setAnalyzingAudio(false);
      setUploadingAudio(false);
    }
  };

  const calculateTokenCost = () => {
    // Calculate video duration in seconds
    const durationInSeconds = config.num_frames / config.frames_per_second;
    
    // Cost per second based on resolution
    let costPerSecond;
    if (config.resolution === '720p') {
      costPerSecond = 0.20; // $0.20 per second for 720p
    } else if (config.resolution === '580p') {
      costPerSecond = 0.15; // $0.15 per second for 580p
    } else { // 480p
      costPerSecond = 0.10; // $0.10 per second for 480p
    }
    
    // Calculate total cost in USD, then convert to tokens (assuming $0.01 per token)
    const totalCostUSD = durationInSeconds * costPerSecond;
    const totalTokens = Math.ceil(totalCostUSD / 0.01);
    
    return Math.max(35, totalTokens); // Minimum 35 tokens
  };

  const handleGenerate = async () => {
    if (!config.image_url) {
      alert('Please upload an image');
      return;
    }

    if (!config.audio_url) {
      alert('Please upload an audio file');
      return;
    }

    if (!config.prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    // --- SAFETY SCAN INTEGRATION ---
    if (!bypassSafetyCheck) {
      try {
        const analysisResult = await performSafetyAnalysis(
          config.image_url,
          config.prompt,
          'fal_wan22_s2v'
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
      console.log('🎬 Starting WAN 22 S2V generation...');
      
      generation = await createAIGeneration(
        'wan22_s2v',
        config.prompt.substring(0, 50) + '...',
        config,
        tokenCost
      );

      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      await updateTokenCount(user.id, tokenCost);
      await fetchProfile();

      console.log('💰 Tokens deducted, calling Edge Function...');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-wan22-s2v`, {
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
      console.log('✅ WAN 22 S2V generation request submitted successfully');

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
        showAlert('error', 'Generation Failed', `WAN 22 S2V generation failed: ${error.message}`);
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
      link.download = `wan22-s2v-video-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      const link = document.createElement('a');
      link.href = toCdnUrl(videoUrl);
      link.download = `wan22-s2v-video-${Date.now()}.mp4`;
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
                <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">WAN 22 S2V</h1>
                  <p className="text-purple-200 text-sm">Speech-to-Video: Transform speech audio into dynamic videos</p>
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
                <h2 className="text-lg font-semibold text-white">S2V Configuration</h2>
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
                      e.currentTarget.classList.add('border-orange-400', 'bg-orange-500/10');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-orange-400', 'bg-orange-500/10');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-orange-400', 'bg-orange-500/10');
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
                      {config.image_url ? (
                        <div className="space-y-2">
                          <img 
                            src={config.image_url} 
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
                            AI will analyze and suggest prompts • Drag & drop supported
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Audio Upload */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Music className="w-4 h-4 inline mr-1" />
                    Speech Audio *
                  </label>
                  <div 
                    className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center transition-colors hover:border-white/50"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('border-orange-400', 'bg-orange-500/10');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-orange-400', 'bg-orange-500/10');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-orange-400', 'bg-orange-500/10');
                      const files = e.dataTransfer.files;
                      if (files.length > 0) {
                        const event = { target: { files } };
                        handleAudioUpload(event);
                      }
                    }}
                  >
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      className="hidden"
                      id="audio-upload"
                      disabled={uploadingAudio}
                    />
                    <label htmlFor="audio-upload" className="cursor-pointer">
                      {config.audio_url ? (
                        <div className="space-y-2">
                          <div className="w-full h-16 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg flex items-center justify-center">
                            <Music className="w-8 h-8 text-orange-400" />
                          </div>
                          <p className="text-purple-200 text-sm">Audio uploaded - Click to change</p>
                          <audio
                            src={config.audio_url}
                            controls
                            className="w-full"
                          />
                          {audioAnalysis && (
                            <div className="text-xs text-orange-300 bg-orange-500/10 rounded p-2 mt-2">
                              <p>Duration: {audioAnalysis.formattedDuration}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <Mic className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                          <p className="text-purple-200">
                            {uploadingAudio ? 'Uploading...' : 
                             analyzingAudio ? 'Analyzing audio...' : 
                             'Upload or drag & drop audio'}
                          </p>
                          <p className="text-purple-300 text-xs mt-1">
                            MP3, WAV, M4A • Max 50MB • Drag & drop supported
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Wand2 className="w-4 h-4 inline mr-1" />
                    Video Prompt *
                  </label>
                  <textarea
                    value={config.prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder={imageAnalysis ? "AI suggested prompt loaded above..." : "Describe the video style and scene you want..."}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={3}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-purple-300 text-xs">
                      {imageAnalysis ? "✨ AI-generated prompt" : "Describe the style, mood, and visual elements"}
                    </p>
                    {imageAnalysis && (
                      <button
                        onClick={() => analyzeImageWithOpenAI(config.image_url)}
                        disabled={analyzingImage}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                      >
                        {analyzingImage ? 'Analyzing...' : '🔄 Re-analyze'}
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
                    value={config.negative_prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, negative_prompt: e.target.value }))}
                    placeholder="What you don't want to see..."
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={2}
                  />
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
                            ? 'bg-orange-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frames */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Film className="w-4 h-4 inline mr-1" />
                    Frames: {config.num_frames}
                  </label>
                  <input
                    type="range"
                    min="40"
                    max="120"
                    value={config.num_frames}
                    onChange={(e) => setConfig(prev => ({ ...prev, num_frames: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>40</span>
                    <span>90</span>
                    <span>120</span>
                  </div>
                </div>

                {/* FPS */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    FPS: {config.frames_per_second}
                  </label>
                  <input
                    type="range"
                    min="4"
                    max="60"
                    value={config.frames_per_second}
                    onChange={(e) => setConfig(prev => ({ ...prev, frames_per_second: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>4</span>
                    <span>16</span>
                    <span>30</span>
                    <span>60</span>
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
                    max="10.0"
                    step="0.1"
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
                    Steps: {config.num_inference_steps}
                  </label>
                  <input
                    type="range"
                    min="2"
                    max="40"
                    value={config.num_inference_steps}
                    onChange={(e) => setConfig(prev => ({ ...prev, num_inference_steps: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>Fast</span>
                    <span>Quality</span>
                  </div>
                </div>

                {/* Safety Checker */}
                <div>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={config.enable_safety_checker}
                      onChange={(e) => setConfig(prev => ({ ...prev, enable_safety_checker: e.target.checked }))}
                      className="w-4 h-4 text-orange-600 bg-white/10 border-white/20 rounded focus:ring-orange-500"
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

                {/* Shift */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Sliders className="w-4 h-4 inline mr-1" />
                    Shift: {config.shift}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.01"
                    value={config.shift}
                    onChange={(e) => setConfig(prev => ({ ...prev, shift: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>1.0</span>
                    <span>5.5</span>
                    <span>10.0</span>
                  </div>
                  <p className="text-purple-300 text-xs mt-1">
                    Controls temporal consistency and motion smoothness
                  </p>
                </div>
                {/* Cost Display */}
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                  <h3 className="text-orange-200 font-medium mb-2 flex items-center">
                    <Zap className="w-4 h-4 mr-2" />
                    Cost Calculation
                  </h3>
                  <div className="text-orange-300 text-sm space-y-1">
                    <p>Frames: {config.num_frames} @ {config.frames_per_second} FPS</p>
                    <p>Duration: {(config.num_frames / config.frames_per_second).toFixed(1)}s</p>
                    <p>Resolution: {config.resolution} (${
                      config.resolution === '720p' ? '0.20' :
                      config.resolution === '580p' ? '0.15' : '0.10'
                    }/sec)</p>
                    <p className="font-medium text-orange-200">Total: {calculateTokenCost()} tokens</p>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.image_url || !config.audio_url || !config.prompt.trim()}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating Video...</span>
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4" />
                      <span>Create S2V Video ({calculateTokenCost()} tokens)</span>
                    </>
                  )}
                </button>

                {/* Processing Note */}
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                  <p className="text-orange-200 text-xs">
                    <Film className="w-3 h-3 inline mr-1" />
                    WAN 22 S2V generation may take 3-8 minutes. Syncs speech with visual animation.
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
                              Frames: {generation.input_data?.num_frames} • 
                              Resolution: {generation.input_data?.resolution} • 
                              Started: {new Date(generation.created_at).toLocaleTimeString()}
                            </p>
                            <p className="text-purple-300 text-xs mt-1">
                              WAN 22 S2V generation typically takes 3-8 minutes
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
                    <p className="text-purple-300 text-sm">Upload an image and audio to create speech-synchronized videos</p>
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
                                poster={toCdnUrl(generation.input_data?.image_url)}
                                preload="metadata"
                              >
                                Your browser does not support the video tag.
                              </video>
                            </div>
                          )}

                          {generation.status === 'processing' && (
                            <div className="mb-4 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg p-8 text-center">
                              <RefreshCw className="w-12 h-12 text-orange-300 animate-spin mx-auto mb-2" />
                              <p className="text-orange-200">Creating speech-synchronized video...</p>
                              <p className="text-orange-300 text-sm">This may take 3-8 minutes</p>
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
                              <strong>Prompt:</strong> {generation.input_data?.prompt}
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                              <span>
                                <strong>Frames:</strong> {generation.input_data?.num_frames}
                              </span>
                              <span>
                                <strong>FPS:</strong> {generation.input_data?.frames_per_second}
                              </span>
                              <span>
                                <strong>Resolution:</strong> {generation.input_data?.resolution}
                              </span>
                              <span>
                                <strong>Tokens:</strong> {generation.tokens_used}
                              </span>
                              <span>
                                <strong>Shift:</strong> {generation.input_data?.shift}
                              </span>
                              <span>
                                <strong>Steps:</strong> {generation.input_data?.num_inference_steps}
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
        toolName="WAN 22 S2V"
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
        toolName="WAN 22 S2V"
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
          background: linear-gradient(to right, #F97316, #EF4444);
          cursor: pointer;
          border: 2px solid white;
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #F97316, #EF4444);
          cursor: pointer;
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
};

export default WAN22S2V;
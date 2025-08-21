import React, { useState, useEffect, useRef } from 'react';
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
  Music, 
  Download, 
  Trash2, 
  RefreshCw,
  Settings,
  Copy,
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Clock,
  Headphones,
  Disc3,
  Radio,
  Waves
} from 'lucide-react';

const CassetteAIMusic = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state
  const [config, setConfig] = useState({
    prompt: '',
    duration: 30
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

  // Audio player state
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);

  // Duration options with token costs
  const durationOptions = [
    { label: '10 seconds', value: 10, cost: 5 },
    { label: '20 seconds', value: 20, cost: 10 },
    { label: '30 seconds', value: 30, cost: 15 },
    { label: '45 seconds', value: 45, cost: 23 },
    { label: '60 seconds', value: 60, cost: 30 },
    { label: '90 seconds', value: 90, cost: 45 },
    { label: '120 seconds', value: 120, cost: 60 },
    { label: '180 seconds', value: 180, cost: 90 }
  ];

  // Music genre suggestions
  const genreSuggestions = [
    "Chill lo-fi hip-hop with vinyl crackle and mellow piano",
    "Epic orchestral cinematic score with powerful brass and strings",
    "Smooth jazz with saxophone and soft piano melodies",
    "Upbeat electronic dance music with synthesizers and heavy bass",
    "Acoustic folk with guitar fingerpicking and warm vocals",
    "Dark ambient atmospheric soundscape with ethereal pads",
    "Funky disco with groovy basslines and rhythmic guitar",
    "Classical piano composition in the style of Chopin",
    "Reggae with laid-back drums and melodic guitar riffs",
    "Heavy metal with distorted guitars and powerful drums"
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription
      const subscription = supabase
        .channel('cassetteai_music_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id},tool_type=eq.fal_cassetteai_music`
          },
          (payload) => {
            console.log('🎵 CassetteAI Music Real-time update received:', payload);
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

      console.log('Real-time subscription set up for CassetteAI Music');
      return () => subscription.unsubscribe();
    }
  }, [user]);

  // Audio player effects
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentlyPlaying]);

  // Update audio volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

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
        .eq('tool_type', 'fal_cassetteai_music')
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

  const calculateTokenCost = () => {
    // Base cost: 0.5 tokens per second
    return Math.ceil(config.duration * 0.5);
  };

  const handleGenerate = async () => {
    if (!config.prompt.trim()) {
      alert('Please enter a music prompt');
      return;
    }

    // --- SAFETY SCAN INTEGRATION ---
    if (!bypassSafetyCheck) {
      try {
        const analysisResult = await performSafetyAnalysis(
          null, // No image for music generation
          config.prompt,
          'fal_cassetteai_music'
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
      console.log('🎵 Starting CassetteAI Music generation...');
      
      // Create generation record
      const generation = await createAIGeneration(
        'fal_cassetteai_music',
        config.prompt.substring(0, 50) + '...',
        config,
        tokenCost
      );

      console.log('📝 Generation record created:', generation.id);

      // Add to local state immediately
      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      // Deduct tokens
      await updateTokenCount(user.id, tokenCost);
      
      // Refresh profile
      await fetchProfile();

      console.log('💰 Tokens deducted, calling Edge Function...');

      // Call Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-cassetteai-music`, {
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
        throw new Error(errorData.error || 'Music generation failed');
      }

      const result = await response.json();
      console.log('Edge Function result:', result);

      // Clear prompt after successful generation
      setConfig(prev => ({ ...prev, prompt: '' }));

      console.log('🎉 Music generation request completed successfully');

    } catch (error) {
      console.error('❌ Error generating music:', error);
      
      // Check if it's an NSFW content error
      if (isNSFWError(error.message)) {
        const nsfwDetails = parseNSFWError(error.message);
        setNsfwError(nsfwDetails);
        setShowNSFWAlert(true);
      } else {
        showAlert('error', 'Generation Failed', `CassetteAI Music generation failed: ${error.message}`);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handlePlay = (generation) => {
    if (currentlyPlaying === generation.id && isPlaying) {
      // Pause current track
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      // Play new track or resume
      if (currentlyPlaying !== generation.id) {
        setCurrentlyPlaying(generation.id);
        setCurrentTime(0);
      }
      audioRef.current?.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e) => {
    if (audioRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const newTime = percent * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = async (audioUrl, generationName) => {
    try {
      const response = await fetch(toCdnUrl(audioUrl));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${generationName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link
      const link = document.createElement('a');
      link.href = toCdnUrl(audioUrl);
      link.download = `${generationName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDelete = async (generationId) => {
    if (!confirm('Are you sure you want to remove this music track? It will be hidden from your account.')) return;

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

      // Stop playing if this track is currently playing
      if (currentlyPlaying === generationId) {
        audioRef.current?.pause();
        setCurrentlyPlaying(null);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Error deleting generation:', error);
      alert('Error removing music track. Please try again.');
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
                <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl flex items-center justify-center">
                  <Music className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">CassetteAI Music Generator</h1>
                  <p className="text-purple-200 text-sm">Generate original music tracks with AI - from chill beats to epic orchestral pieces</p>
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
                <h2 className="text-lg font-semibold text-white">Music Configuration</h2>
              </div>

              <div className="space-y-6">
                {/* Music Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Music className="w-4 h-4 inline mr-1" />
                    Music Prompt *
                  </label>
                  <textarea
                    value={config.prompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Describe the music you want to create..."
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={4}
                  />
                  <p className="text-purple-300 text-xs mt-1">
                    Be specific about genre, instruments, mood, tempo, and key
                  </p>
                </div>

                {/* Genre Suggestions */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Headphones className="w-4 h-4 inline mr-1" />
                    Genre Inspiration
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                    {genreSuggestions.slice(0, 5).map((suggestion, index) => (
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

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Duration: {config.duration} seconds
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="180"
                    value={config.duration}
                    onChange={(e) => setConfig(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>10s</span>
                    <span>90s</span>
                    <span>180s</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {durationOptions.slice(0, 4).map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setConfig(prev => ({ ...prev, duration: option.value }))}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                          config.duration === option.value
                            ? 'bg-pink-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cost Display */}
                <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4">
                  <h3 className="text-pink-200 font-medium mb-2 flex items-center">
                    <Zap className="w-4 h-4 mr-2" />
                    Cost Calculation
                  </h3>
                  <div className="text-pink-300 text-sm space-y-1">
                    <p>Duration: {config.duration} seconds</p>
                    <p>Rate: 0.5 tokens per second</p>
                    <p className="font-medium text-pink-200">Total: {calculateTokenCost()} tokens</p>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !config.prompt.trim()}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Music...</span>
                    </>
                  ) : (
                    <>
                      <Music className="w-4 h-4" />
                      <span>Generate Music ({calculateTokenCost()} tokens)</span>
                    </>
                  )}
                </button>

                {/* Processing Note */}
                <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-3">
                  <p className="text-pink-200 text-xs">
                    <Waves className="w-3 h-3 inline mr-1" />
                    Music generation may take 1-3 minutes. Cost: 0.5 tokens per second of audio.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Music Player & Generations Panel - Right Side */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {/* Active Generations */}
              {activeGenerations.length > 0 && (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin" />
                    <h3 className="text-lg font-semibold text-white">Generating Music ({activeGenerations.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {generations.slice(0, window.innerWidth >= 1024 ? 3 : generations.length).map((generation) => (
                      <div key={generation.id} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{generation.generation_name}</p>
                            <p className="text-purple-200 text-sm">
                              Duration: {generation.input_data?.duration}s • 
                              Started: {new Date(generation.created_at).toLocaleTimeString()}
                            </p>
                            <p className="text-purple-300 text-xs mt-1">
                              Music generation typically takes 1-3 minutes
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

              {/* Music Player */}
              {currentlyPlaying && (
                <div className="bg-gradient-to-r from-pink-500/20 to-rose-500/20 backdrop-blur-md rounded-2xl p-6 border border-pink-500/30">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl flex items-center justify-center">
                      <Music className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold">
                        {generations.find(g => g.id === currentlyPlaying)?.generation_name || 'Unknown Track'}
                      </h3>
                      <p className="text-pink-200 text-sm">CassetteAI Generated Music</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div 
                    className="w-full h-2 bg-white/20 rounded-full cursor-pointer mb-4"
                    onClick={handleSeek}
                  >
                    <div 
                      className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-100"
                      style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                    />
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => handlePlay(generations.find(g => g.id === currentlyPlaying))}
                        className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 rounded-full flex items-center justify-center text-white transition-all"
                      >
                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                      </button>
                      
                      <div className="text-white text-sm">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={toggleMute}
                        className="text-white hover:text-pink-300 transition-colors"
                      >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Generated Music Tracks */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Generated Music</h3>
                  <button
                    onClick={fetchGenerations}
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {generations.length === 0 ? (
                  <div className="text-center py-12">
                    <Music className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                    <p className="text-purple-200 text-lg">No music generated yet</p>
                    <p className="text-purple-300 text-sm">Enter a prompt to create your first AI-generated music track</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {generations.map((generation) => (
                      <div
                        key={generation.id}
                        className={`bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-all duration-200 ${
                          currentlyPlaying === generation.id ? 'ring-2 ring-pink-500/50 bg-pink-500/10' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1">
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

                        {generation.status === 'processing' && (
                          <div className="mb-4 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-lg p-6 text-center">
                            <div className="flex items-center justify-center space-x-2 mb-2">
                              <Disc3 className="w-8 h-8 text-pink-300 animate-spin" />
                              <Waves className="w-6 h-6 text-pink-300" />
                            </div>
                            <p className="text-pink-200">Generating music...</p>
                            <p className="text-pink-300 text-sm">This may take 1-3 minutes</p>
                          </div>
                        )}

                        {generation.status === 'failed' && (
                          <div className="mb-4 bg-red-500/20 rounded-lg p-4 text-center">
                            <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                            <p className="text-red-400 text-sm">Music generation failed</p>
                          </div>
                        )}

                        {generation.output_file_url && generation.status === 'completed' && (
                          <div className="mb-4">
                            <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-pink-500/10 to-rose-500/10 rounded-lg border border-pink-500/20">
                              <button
                                onClick={() => handlePlay(generation)}
                                className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition-all ${
                                  currentlyPlaying === generation.id && isPlaying
                                    ? 'bg-gradient-to-r from-rose-500 to-pink-500'
                                    : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600'
                                }`}
                              >
                                {currentlyPlaying === generation.id && isPlaying ? 
                                  <Pause className="w-6 h-6" /> : 
                                  <Play className="w-6 h-6 ml-1" />
                                }
                              </button>
                              
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <Radio className="w-4 h-4 text-pink-400" />
                                  <span className="text-white font-medium">AI Generated Music</span>
                                </div>
                                <p className="text-pink-200 text-sm">
                                  Duration: {generation.input_data?.duration}s • 
                                  {generation.tokens_used} tokens used
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2 text-sm text-purple-300">
                          <p>
                            <strong>Prompt:</strong> {generation.input_data?.prompt}
                          </p>
                          <div className="flex items-center justify-between">
                            <span>
                              <strong>Duration:</strong> {generation.input_data?.duration}s
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
                                onClick={() => handleDownload(generation.output_file_url, generation.generation_name)}
                                className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors"
                                title="Download music"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(generation.id)}
                              className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                              title="Delete track"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

      {/* Hidden Audio Element */}
      {currentlyPlaying && (
        <audio
          ref={audioRef}
          src={toCdnUrl(generations.find(g => g.id === currentlyPlaying)?.output_file_url)}
          onError={(e) => {
            console.error('Audio playback error:', e);
            setIsPlaying(false);
          }}
        />
      )}

      {/* NSFW Alert Modal */}
      <NSFWAlert
        isOpen={showNSFWAlert}
        onClose={() => {
          setShowNSFWAlert(false);
          setNsfwError(null);
        }}
        toolName="CassetteAI Music Generator"
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
        toolName="CassetteAI Music Generator"
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
          background: linear-gradient(to right, #EC4899, #F43F5E);
          cursor: pointer;
          border: 2px solid white;
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #EC4899, #F43F5E);
          cursor: pointer;
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
};

export default CassetteAIMusic;
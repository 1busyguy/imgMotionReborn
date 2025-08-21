import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { createAIGeneration, updateTokenCount, uploadFile } from '../utils/storageHelpers';
import { isNSFWError, parseNSFWError } from '../utils/errorHandlers';
import { toCdnUrl } from '../utils/cdnHelpers';
import { performSafetyAnalysis, shouldShowWarning, getSafetyWarningMessage, logSafetyAnalysis } from '../utils/safescan';
import NSFWAlert from '../components/NSFWAlert';
import SafetyWarningModal from '../components/SafetyWarningModal';
import ThemedAlert from '../components/ThemedAlert';
import { 
  ArrowLeft, 
  Zap, 
  Image as ImageIcon, 
  Upload, 
  Download, 
  Trash2, 
  Play, 
  Pause, 
  RefreshCw,
  Settings,
  Eye,
  Copy,
  Check,
  X
} from 'lucide-react';

const FluxGenerator = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Configuration state
  const [config, setConfig] = useState({
    model: 'runware:101@1', // FLUX.1 [dev]
    positivePrompt: '',
    negativePrompt: '',
    width: 1024,
    height: 1024,
    steps: 30,
    guidanceScale: 7.5,
    seed: -1,
    useRedux: false,
    guideImage: null,
    guideImageUrl: ''
  });
  
  // Generation state
  const [generations, setGenerations] = useState([]);
  const [activeGenerations, setActiveGenerations] = useState([]);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [uploadingGuide, setUploadingGuide] = useState(false);
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

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      
      // Set up real-time subscription for generations
      const subscription = supabase
        .channel('flux_generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ai_generations',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();

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
        .eq('tool_type', 'gen_01')
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
    
    if (newRecord?.tool_type !== 'gen_01') return;

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

    // Update active generations
    if (newRecord?.status === 'processing') {
      setActiveGenerations(current => {
        const exists = current.find(g => g.id === newRecord.id);
        return exists ? current.map(g => g.id === newRecord.id ? newRecord : g) : [newRecord, ...current];
      });
    } else {
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

  const handleGuideImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setUploadingGuide(true);
    try {
      const { url } = await uploadFile(file, 'guide-images');
      setConfig(prev => ({
        ...prev,
        guideImage: file,
        guideImageUrl: url
      }));
    } catch (error) {
      console.error('Error uploading guide image:', error);
      alert('Error uploading image. Please try again.');
    } finally {
      setUploadingGuide(false);
    }
  };

  const handleGenerate = async () => {
    if (!config.positivePrompt.trim() && !config.useRedux) {
      alert('Please enter a prompt or enable Redux mode with a guide image');
      return;
    }

    if (config.useRedux && !config.guideImageUrl) {
      alert('Please upload a guide image for Redux mode');
      return;
    }

    // --- SAFETY SCAN INTEGRATION ---
    if (!bypassSafetyCheck) {
      try {
        const analysisResult = await performSafetyAnalysis(
          config.useRedux ? config.guideImageUrl : null,
          config.positivePrompt,
          'gen_01'
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

    const tokenCost = 8;
    const totalTokens = (profile.tokens || 0) + (profile.purchased_tokens || 0);
    if (totalTokens < tokenCost) {
      alert('Insufficient tokens. Please upgrade your plan.');
      return;
    }

    setGenerating(true);
    try {
      // Create generation record
      const generation = await createAIGeneration(
        'gen_01',
        config.positivePrompt || 'FLUX Redux Generation',
        {
          ...config,
          model: config.model,
          useRedux: config.useRedux
        },
        tokenCost
      );

      // Immediately add to local state for instant UI feedback
      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      // Deduct tokens
      await updateTokenCount(user.id, tokenCost);
      
      // Refresh profile to get accurate token counts from database
      await fetchProfile();

      // Call Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-image-generator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationId: generation.id,
          prompt: config.positivePrompt,
          negativePrompt: config.negativePrompt,
          width: config.width,
          height: config.height,
          steps: config.steps,
          guidanceScale: config.guidanceScale,
          seed: config.seed,
          useRedux: config.useRedux,
          guideImageUrl: config.guideImageUrl
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      // Clear prompt after successful generation
      if (!config.useRedux) {
        setConfig(prev => ({ ...prev, positivePrompt: '' }));
      }

    } catch (error) {
      console.error('Error generating:', error);
      
      // Check if it's an NSFW content error
      if (isNSFWError(error.message)) {
        const nsfwDetails = parseNSFWError(error.message);
        setNsfwError(nsfwDetails);
        setShowNSFWAlert(true);
      } else {
        showAlert('error', 'Generation Failed', `FLUX generation failed: ${error.message}`);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (generation) => {
    if (generation.output_file_url) {
      const link = document.createElement('a');
      link.href = toCdnUrl(generation.output_file_url);
      link.download = `flux-${generation.id}.png`;
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
    // Could add a toast notification here
  };

  const handleCancelGeneration = async (generationId) => {
    if (!confirm('Are you sure you want to cancel this generation?')) return;

    try {
      // Delete the generation entirely instead of just marking as failed
      const { error } = await supabase
        .from('ai_generations')
        .delete()
        .eq('id', generationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Remove from both active generations and main generations list immediately
      setActiveGenerations(current => current.filter(g => g.id !== generationId));
      setGenerations(current => current.filter(g => g.id !== generationId));
    } catch (error) {
      console.error('Error canceling generation:', error);
      alert('Error canceling generation. Please try again.');
    }
  };

  const handleClearAllStalled = async () => {
    const stalledGenerations = activeGenerations.filter(gen => {
      const ageInMinutes = (Date.now() - new Date(gen.created_at).getTime()) / 60000;
      return ageInMinutes > 2; // Consider stalled if older than 2 minutes
    });

    if (stalledGenerations.length === 0) {
      alert('No stalled generations found (older than 2 minutes)');
      return;
    }

    if (!confirm(`Clear ${stalledGenerations.length} stalled generations?`)) return;

    try {
      // Delete the stalled generations entirely
      const { error } = await supabase
        .from('ai_generations')
        .delete()
        .in('id', stalledGenerations.map(g => g.id))
        .eq('user_id', user.id);

      if (error) throw error;

      // Remove from both active generations and main generations list
      setActiveGenerations(current => 
        current.filter(g => !stalledGenerations.some(stalled => stalled.id === g.id))
      );
      setGenerations(current => 
        current.filter(g => !stalledGenerations.some(stalled => stalled.id === g.id))
      );

      alert(`Cleared ${stalledGenerations.length} stalled generations`);
    } catch (error) {
      console.error('Error clearing stalled generations:', error);
      alert('Error clearing stalled generations. Please try again.');
    }
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
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Flux Image Generator</h1>
                  <p className="text-purple-200 text-sm">Advanced text-to-image with FLUX.1 [dev]</p>
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
                <h2 className="text-lg font-semibold text-white">Configuration</h2>
              </div>

              <div className="space-y-6">
                {/* Redux Mode Toggle */}
                <div>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={config.useRedux}
                      onChange={(e) => setConfig(prev => ({ ...prev, useRedux: e.target.checked }))}
                      className="w-4 h-4 text-purple-600 bg-white/10 border-white/20 rounded focus:ring-purple-500"
                    />
                    <span className="text-white font-medium">FLUX Redux Mode</span>
                  </label>
                  <p className="text-purple-200 text-sm mt-1">
                    Generate variations from an input image
                  </p>
                </div>

                {/* Guide Image Upload (Redux Mode) */}
                {config.useRedux && (
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Guide Image *
                    </label>
                    <div className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleGuideImageUpload}
                        className="hidden"
                        id="guide-upload"
                        disabled={uploadingGuide}
                      />
                      <label htmlFor="guide-upload" className="cursor-pointer">
                        {config.guideImageUrl ? (
                          <div className="space-y-2">
                            <img 
                              src={toCdnUrl(config.guideImageUrl)} 
                              alt="Guide" 
                              className="w-full h-32 object-cover rounded-lg"
                              loading="lazy"
                            />
                            <p className="text-purple-200 text-sm">Click to change</p>
                          </div>
                        ) : (
                          <div>
                            <Upload className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                            <p className="text-purple-200">
                              {uploadingGuide ? 'Uploading...' : 'Upload guide image'}
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                {/* Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    {config.useRedux ? 'Prompt (optional)' : 'Prompt *'}
                  </label>
                  <textarea
                    value={config.positivePrompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, positivePrompt: e.target.value }))}
                    placeholder={config.useRedux ? 'Leave blank for pure variations or add style guidance...' : 'Describe the image you want to generate...'}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    rows={4}
                  />
                  {config.useRedux && (
                    <p className="text-purple-300 text-xs mt-1">
                      Use "__BLANK__" for pure variations without prompt guidance
                    </p>
                  )}
                </div>

                {/* Negative Prompt */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Negative Prompt (optional)
                  </label>
                  <textarea
                    value={config.negativePrompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, negativePrompt: e.target.value }))}
                    placeholder="What to avoid in the image (leave empty if unsure)..."
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    rows={2}
                  />
                  <p className="text-purple-300 text-xs mt-1">
                    Must be 2-3000 characters or leave empty
                  </p>
                </div>

                {/* Dimensions */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Width
                    </label>
                    <select
                      value={config.width}
                      onChange={(e) => setConfig(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value={512}>512</option>
                      <option value={768}>768</option>
                      <option value={1024}>1024</option>
                      <option value={1536}>1536</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Height
                    </label>
                    <select
                      value={config.height}
                      onChange={(e) => setConfig(prev => ({ ...prev, height: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value={512}>512</option>
                      <option value={768}>768</option>
                      <option value={1024}>1024</option>
                      <option value={1536}>1536</option>
                    </select>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="space-y-4">
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
                      Seed (-1 for random)
                    </label>
                    <input
                      type="number"
                      value={config.seed}
                      onChange={(e) => setConfig(prev => ({ ...prev, seed: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || (!config.positivePrompt.trim() && !config.useRedux) || (config.useRedux && !config.guideImageUrl)}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Generate (8 tokens)</span>
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
                    <h3 className="text-lg font-semibold text-white">Processing ({activeGenerations.length})</h3>
                    {activeGenerations.length > 1 && (
                      <button
                        onClick={handleClearAllStalled}
                        className="ml-auto bg-red-500 hover:bg-red-600 text-white text-xs font-medium py-1 px-3 rounded-lg transition-colors"
                      >
                        Clear All Stalled
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {activeGenerations.map((generation) => (
                      <div key={generation.id} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{generation.generation_name}</p>
                            <p className="text-purple-200 text-sm">
                              {new Date(generation.created_at).toLocaleTimeString()} • 
                              <span className="text-purple-300">
                                {Math.round((Date.now() - new Date(generation.created_at).getTime()) / 60000)}m ago
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                            <span className="text-yellow-400 text-sm">Processing</span>
                            <button
                              onClick={() => handleCancelGeneration(generation.id)}
                              className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg transition-colors"
                              title="Cancel generation"
                            >
                              <X className="w-3 h-3" />
                            </button>
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
                  <h3 className="text-lg font-semibold text-white">Recent Generations</h3>
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
                    <p className="text-purple-200 text-lg">No generations yet</p>
                    <p className="text-purple-300 text-sm">Create your first FLUX image to get started</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {generations.slice(0, window.innerWidth >= 1024 ? 2 : generations.length).map((generation) => (
                      <div
                        key={generation.id}
                        className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-all duration-200 cursor-pointer"
                        onClick={() => setSelectedGeneration(generation)}
                      >
                        {generation.output_file_url ? (
                          <div className="relative">
                            <img
                              src={toCdnUrl(generation.output_file_url)}
                              alt={generation.generation_name}
                              className="w-full h-48 object-cover"
                              loading="lazy"
                            />
                            <div className="absolute top-2 right-2 flex space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(generation);
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
                            <ImageIcon className="w-12 h-12 text-purple-300" />
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

                          {generation.input_data?.positivePrompt && (
                            <div className="mt-2 flex items-center space-x-2">
                              <p className="text-purple-300 text-xs truncate flex-1">
                                {generation.input_data.positivePrompt}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyPrompt(generation.input_data.positivePrompt);
                                }}
                                className="text-purple-400 hover:text-purple-300 transition-colors"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          )}
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

              {selectedGeneration.output_file_url && (
                <div className="mb-6">
                  <img
                    src={toCdnUrl(selectedGeneration.output_file_url)}
                    alt={selectedGeneration.generation_name}
                    className="w-full max-h-96 object-contain rounded-lg"
                    loading="lazy"
                  />
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
                    {selectedGeneration.input_data?.positivePrompt && (
                      <div>
                        <span className="text-purple-200">Prompt:</span>
                        <p className="text-white mt-1 p-2 bg-white/5 rounded">
                          {selectedGeneration.input_data.positivePrompt}
                        </p>
                      </div>
                    )}
                    {selectedGeneration.input_data?.width && (
                      <div className="flex justify-between">
                        <span className="text-purple-200">Dimensions:</span>
                        <span className="text-white">
                          {selectedGeneration.input_data.width} × {selectedGeneration.input_data.height}
                        </span>
                      </div>
                    )}
                    {selectedGeneration.input_data?.steps && (
                      <div className="flex justify-between">
                        <span className="text-purple-200">Steps:</span>
                        <span className="text-white">{selectedGeneration.input_data.steps}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                {selectedGeneration.output_file_url && (
                  <button
                    onClick={() => handleDownload(selectedGeneration)}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
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

      {/* Custom Slider Styles */}
      
      {/* NSFW Alert Modal */}
      <NSFWAlert
        isOpen={showNSFWAlert}
        onClose={() => {
          setShowNSFWAlert(false);
          setNsfwError(null);
        }}
        toolName="Flux Image Generator"
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
        toolName="Flux Image Generator"
      />

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

export default FluxGenerator;
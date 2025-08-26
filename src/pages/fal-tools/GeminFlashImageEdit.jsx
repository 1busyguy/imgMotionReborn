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
    Edit3,
    Layers
} from 'lucide-react';

const GeminiFlashImageEdit = () => {
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
    const [uploadingImages, setUploadingImages] = useState(false);
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

            // Set up real-time subscription for this specific tool type
            const subscription = supabase
                .channel('gemini_flash_image_edit_generations')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'ai_generations',
                        filter: `user_id=eq.${user.id},tool_type=eq.fal_gemini_flash_image_edit`
                    },
                    (payload) => {
                        console.log('✨ Gemini Flash Image Edit Real-time update received:', payload);
                        handleRealtimeUpdate(payload);
                    }
                )
                .subscribe();

            console.log('Real-time subscription set up for Gemini Flash Image Edit');
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
    
    // Update main generations list
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
    
    // Update active generations based on status
    if (newRecord?.status === 'processing') {
        setActiveGenerations(current => {
            const exists = current.find(g => g.id === newRecord.id);
            return exists 
                ? current.map(g => g.id === newRecord.id ? newRecord : g) 
                : [newRecord, ...current];
        });
    } else if (newRecord?.status === 'completed' || newRecord?.status === 'failed') {
        setActiveGenerations(current => 
            current.filter(g => g.id !== newRecord?.id)
        );
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
        const files = Array.from(event.target.files);
        if (!files.length) return;

        // Validate files
        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                showAlert('error', 'Invalid File Type', 'Please select only image files');
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                showAlert('error', 'File Too Large', 'Each image must be less than 10MB');
                return;
            }
        }

        // Check total image limit
        if (config.imageUrls.length + files.length > 10) {
            showAlert('error', 'Too Many Images', 'Maximum 10 images allowed');
            return;
        }

        setUploadingImages(true);
        try {
            const uploadedUrls = [];

            for (const file of files) {
                const { url } = await uploadFile(file, 'gemini-flash-edit-images');
                uploadedUrls.push(url);
            }

            setConfig(prev => ({
                ...prev,
                imageUrls: [...prev.imageUrls, ...uploadedUrls]
            }));

        } catch (error) {
            console.error('Error uploading images:', error);
            showAlert('error', 'Upload Failed', 'Error uploading images. Please try again.');
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
        // Base cost: 8 tokens per image generated
        return config.numImages * 8;
    };

    const handleGenerate = async () => {
        if (config.imageUrls.length === 0) {
            showAlert('warning', 'No Images Selected', 'Please upload at least one image to edit');
            return;
        }

        if (!config.prompt.trim()) {
            showAlert('warning', 'No Prompt Entered', 'Please enter a prompt describing the edits you want');
            return;
        }

        // --- SAFETY SCAN INTEGRATION ---
        if (!bypassSafetyCheck) {
            try {
                // Analyze first image and prompt for safety
                const analysisResult = await performSafetyAnalysis(
                    config.imageUrls[0], // Analyze first image
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
            showAlert('error', 'Insufficient Tokens', `You need ${tokenCost} tokens but only have ${totalTokens}. Please upgrade your plan.`);
            return;
        }

        setGenerating(true);
        try {
            console.log('✨ Starting Gemini Flash Image Edit generation...');

            // Create generation record
            const generation = await createAIGeneration(
                'fal_gemini_flash_image_edit',
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
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-gemini-flash-image-edit`, {
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
                throw new Error(errorData.error || 'Image editing failed');
            }

            const result = await response.json();
            console.log('Edge Function result:', result);

            // Clear form after successful generation
            setConfig(prev => ({ ...prev, prompt: '' }));

            console.log('🎉 Gemini Flash Image Edit request completed successfully');

        } catch (error) {
            console.error('❌ Error generating:', error);

            // Check if it's an NSFW content error
            if (isNSFWError(error.message)) {
                const nsfwDetails = parseNSFWError(error.message);
                setNsfwError(nsfwDetails);
                setShowNSFWAlert(true);
            } else {
                showAlert('error', 'Generation Failed', `Gemini Flash Image Edit failed: ${error.message}`);
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
            link.download = `gemini-edited-image-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            const link = document.createElement('a');
            link.href = toCdnUrl(imageUrl);
            link.download = `gemini-edited-image-${Date.now()}.png`;
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
            showAlert('error', 'Delete Failed', 'Error removing generation. Please try again.');
        }
    };

    const copyPrompt = (prompt) => {
        navigator.clipboard.writeText(prompt);
        showAlert('success', 'Copied!', 'Prompt copied to clipboard');
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
    console.log('🔄 Real-time update received:', { 
      eventType, 
      generationId: newRecord?.id, 
      status: newRecord?.status,
      hasError: !!newRecord?.error_message 
    });

        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
      
      // Show failure notification with 1-second delay
      if (newRecord?.status === 'failed') {
        setTimeout(() => {
          const errorMessage = newRecord.error_message || 'Generation failed';
          showAlert('error', 'Generation Failed', `Gemini Flash Image Edit failed: ${errorMessage}`);
        }, 1000);
      // Remove from local state if there was an error during submission
      if (generation) {
        setGenerations(current => current.filter(g => g.id !== generation.id));
        setActiveGenerations(current => current.filter(g => g.id !== generation.id));
      }
      
      }
      
      // Show error notification for failed generations with 1-second delay
      if (newRecord?.status === 'failed') {
        setTimeout(() => {
          const errorMessage = newRecord.error_message || 'Generation failed';
          console.log('❌ Generation failed:', errorMessage);
          showAlert('error', 'Generation Failed', `Gemini Flash Image Edit failed: ${errorMessage}`);
        }, 1000);
      }
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
                                <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center">
                                    <Edit3 className="w-5 h-5 text-white" />
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
                                <h2 className="text-lg font-semibold text-white">Image Edit Configuration</h2>
                            </div>

                            <div className="space-y-6">
                                {/* Image Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        <ImageIcon className="w-4 h-4 inline mr-1" />
                                        Source Images * (1-10 images)
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
                                                handleImageUpload(event);
                                            }
                                        }}
                                    >
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleImageUpload}
                                            className="hidden"
                                            id="image-upload"
                                            disabled={uploadingImages}
                                        />
                                        <label htmlFor="image-upload" className="cursor-pointer">
                                            {config.imageUrls.length > 0 ? (
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {config.imageUrls.slice(0, 4).map((url, index) => (
                                                            <div key={index} className="relative">
                                                                <img
                                                                    src={url}
                                                                    alt={`Source ${index + 1}`}
                                                                    className="w-full h-16 object-cover rounded-lg"
                                                                    loading="lazy"
                                                                />
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        removeImage(index);
                                                                    }}
                                                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {config.imageUrls.length > 4 && (
                                                        <p className="text-purple-300 text-xs">
                                                            +{config.imageUrls.length - 4} more images
                                                        </p>
                                                    )}
                                                    <p className="text-purple-200 text-sm">
                                                        {uploadingImages ? 'Uploading...' : `${config.imageUrls.length} images • Click to add more`}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <Upload className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                                                    <p className="text-purple-200">
                                                        {uploadingImages ? 'Uploading...' : 'Upload or drag & drop images'}
                                                    </p>
                                                    <p className="text-purple-300 text-xs mt-1">
                                                        Multiple images supported • Max 10 images • Drag & drop supported
                                                    </p>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </div>

                                {/* Edit Prompt */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        <Wand2 className="w-4 h-4 inline mr-1" />
                                        Edit Prompt *
                                    </label>
                                    <textarea
                                        value={config.prompt}
                                        onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                                        placeholder="Describe the edits you want to make to the image(s)..."
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                        rows={4}
                                    />
                                    <p className="text-purple-300 text-xs mt-1">
                                        Be specific about what changes you want: add objects, change colors, modify backgrounds, etc.
                                    </p>
                                </div>

                                {/* Number of Images */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        <Layers className="w-4 h-4 inline mr-1" />
                                        Number of Images: {config.numImages}
                                    </label>
                                    <div className="flex items-center space-x-4">
                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, numImages: Math.max(1, prev.numImages - 1) }))}
                                            disabled={config.numImages <= 1}
                                            className="w-8 h-8 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>

                                        <div className="flex-1 text-center">
                                            <span className="text-white font-medium">{config.numImages}</span>
                                        </div>

                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, numImages: Math.min(4, prev.numImages + 1) }))}
                                            disabled={config.numImages >= 4}
                                            className="w-8 h-8 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-purple-300 text-xs mt-1">
                                        Generate 1-4 edited variations
                                    </p>
                                </div>

                                {/* Cost Display */}
                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                                    <h3 className="text-emerald-200 font-medium mb-2 flex items-center">
                                        <Zap className="w-4 h-4 mr-2" />
                                        Cost Calculation
                                    </h3>
                                    <div className="text-emerald-300 text-sm space-y-1">
                                        <p>Images to generate: {config.numImages}</p>
                                        <p>Rate: 8 tokens per image</p>
                                        <p className="font-medium text-emerald-200">Total: {calculateTokenCost()} tokens</p>
                                    </div>
                                </div>

                                {/* Generate Button */}
                                <button
                                    onClick={handleGenerate}
                                    disabled={generating || config.imageUrls.length === 0 || !config.prompt.trim()}
                                    className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                                >
                                    {generating ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Editing Images...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Edit3 className="w-4 h-4" />
                                            <span>Edit Images ({calculateTokenCost()} tokens)</span>
                                        </>
                                    )}
                                </button>

                                {/* Processing Note */}
                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                                    <p className="text-emerald-200 text-xs">
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
                                        <Edit3 className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                                        <p className="text-purple-200 text-lg">No images edited yet</p>
                                        <p className="text-purple-300 text-sm">Upload images and describe edits to create AI-enhanced versions</p>
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
                                                                        {imageUrls.map((url, index) => (
                                                                            <div key={index} className="relative group">
                                                                                <img
                                                                                    src={toCdnUrl(url)}
                                                                                    alt={`Edited ${index + 1}`}
                                                                                    className="w-full rounded-lg"
                                                                                    loading="lazy"
                                                                                />
                                                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                                                                    <button
                                                                                        onClick={() => handleDownload(url)}
                                                                                        className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-colors"
                                                                                    >
                                                                                        <Download className="w-4 h-4" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}

                                                    {generation.status === 'processing' && (
                                                        <div className="mb-4 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-lg p-8 text-center">
                                                            <RefreshCw className="w-12 h-12 text-emerald-300 animate-spin mx-auto mb-2" />
                                                            <p className="text-emerald-200">Editing images with Gemini Flash...</p>
                                                            <p className="text-emerald-300 text-sm">This may take 30-60 seconds</p>
                                                        </div>
                                                    )}

                                                    {generation.status === 'failed' && (
                                                        <div className="mb-4 bg-red-500/20 rounded-lg p-4 text-center">
                                                            <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                                                            <p className="text-red-400 text-sm">Image editing failed</p>
                                                            {generation.error_message && (
                                                                <p className="text-red-300 text-xs mt-2">{generation.error_message}</p>
                                                            )}
                                                        </div>
                                                    )}

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
                                                                    onClick={() => {
                                                                        // Download first image if multiple
                                                                        let firstUrl = generation.output_file_url;
                                                                        try {
                                                                            if (generation.output_file_url.startsWith('[')) {
                                                                                const urls = JSON.parse(generation.output_file_url);
                                                                                firstUrl = urls[0];
                                                                            }
                                                                        } catch (e) {
                                                                            // Use as-is if not JSON
                                                                        }
                                                                        handleDownload(firstUrl);
                                                                    }}
                                                                    className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors"
                                                                    title="Download edited image"
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
      `}</style>
        </div>
    );
};

export default GeminiFlashImageEdit;
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
    Video,
    Play,
    Clock,
    Camera,
    Sparkles,
    Film
} from 'lucide-react';

const SeeDANCEReferenceToVideo = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Configuration state - based on SeeDANCE API
    const [config, setConfig] = useState({
        prompt: '',
        referenceImageUrls: [],
        resolution: '720p',
        duration: '5',
        enableSafetyChecker: true,
        cameraFixed: false,
        seed: undefined
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

    // Video generation prompt suggestions
    const promptSuggestions = [
        "The girl catches the puppy and hugs it",
        "The person dances with smooth flowing movements",
        "The character walks forward and waves at the camera",
        "The subject turns around slowly and smiles",
        "The person performs a graceful spin and pose",
        "The character jumps with excitement and celebration",
        "The subject sits down and stands up naturally",
        "The person gestures while talking expressively",
        "The character runs forward with energy",
        "The subject performs martial arts movements"
    ];

    useEffect(() => {
        if (user) {
            fetchProfile();
            fetchGenerations();

            console.log('🔗 Setting up real-time subscription for user:', user.id);

            // Set up real-time subscription for this specific tool type
            const subscription = supabase
                .channel('seedance_video_generations')
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
                        if (record && record.tool_type === 'fal_seedance_reference_to_video') {
                            console.log('✅ Processing update for SeeDANCE tool');
                            handleRealtimeUpdate(payload);
                        } else {
                            console.log('⏭️ Skipping update for different tool:', record?.tool_type);
                        }
                    }
                )
                .subscribe();

            console.log('✅ Real-time subscription set up for SeeDANCE Reference-to-Video');
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
                .eq('tool_type', 'fal_seedance_reference_to_video')
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

        console.log('✨ Processing SeeDANCE real-time update:', {
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
                    showAlert('error', 'Generation Failed', `SeeDANCE video generation failed: ${errorMessage}`);
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
            showAlert('error', 'Unsupported File Format', 'Please upload only JPG or PNG images. Other formats are not supported by SeeDANCE.');
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
            // Upload to user-specific folder using the storageHelpers uploadFile function
            // This will automatically save to: user-files/{user_id}/seedance-reference-images/{timestamp}.{ext}
            const { url } = await uploadFile(file, 'seedance-reference-images');

            setConfig(prev => {
                const newImageUrls = [...prev.referenceImageUrls];
                newImageUrls[index] = url;
                return { ...prev, referenceImageUrls: newImageUrls };
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
        const validImageCount = config.referenceImageUrls.filter(url => url.trim()).length;
        if (validImageCount < 5 && config.referenceImageUrls.length < 5) {
            setConfig(prev => ({
                ...prev,
                referenceImageUrls: [...prev.referenceImageUrls, '']
            }));
        } else if (validImageCount >= 5) {
            showAlert('warning', 'Image Limit Reached', 'Maximum 5 reference images allowed for SeeDANCE');
        }
    };

    const removeImageSlot = (index) => {
        setConfig(prev => ({
            ...prev,
            referenceImageUrls: prev.referenceImageUrls.filter((_, i) => i !== index)
        }));
    };

    const calculateTokenCost = () => {
        // Base cost calculation based on duration and resolution
        const durationMultiplier = parseInt(config.duration);
        const resolutionMultiplier = config.resolution === '720p' ? 2 : 1;
        return 10 * durationMultiplier * resolutionMultiplier;
    };

    const handleGenerate = async () => {
        const validImageUrls = config.referenceImageUrls.filter(url => url.trim());

        if (validImageUrls.length === 0) {
            alert('Please upload at least one reference image');
            return;
        }

        if (!config.prompt.trim()) {
            alert('Please enter a video generation prompt');
            return;
        }

        // --- SAFETY SCAN INTEGRATION ---
        if (!bypassSafetyCheck && config.enableSafetyChecker) {
            try {
                // Analyze the first image and prompt
                const analysisResult = await performSafetyAnalysis(
                    validImageUrls[0],
                    config.prompt,
                    'fal_seedance_reference_to_video'
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
            console.log('✨ Starting SeeDANCE video generation...');

            generation = await createAIGeneration(
                'fal_seedance_reference_to_video',
                config.prompt.substring(0, 50) + '...',
                { ...config, referenceImageUrls: validImageUrls },
                tokenCost
            );

            setGenerations(current => [generation, ...current]);
            setActiveGenerations(current => [generation, ...current]);

            await updateTokenCount(user.id, tokenCost);
            await fetchProfile();

            console.log('💰 Tokens deducted, calling Edge Function...');

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-seedance-video`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    generationId: generation.id,
                    prompt: config.prompt,
                    referenceImageUrls: validImageUrls,
                    resolution: config.resolution,
                    duration: config.duration,
                    enableSafetyChecker: config.enableSafetyChecker,
                    cameraFixed: config.cameraFixed,
                    seed: config.seed
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Generation failed');
            }

            setConfig(prev => ({ ...prev, prompt: '' }));
            console.log('✅ SeeDANCE video generation request submitted successfully');

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
                showAlert('error', 'Generation Failed', `SeeDANCE video generation failed: ${error.message}`);
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
            link.download = `seedance-video-${Date.now()}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            const link = document.createElement('a');
            link.href = toCdnUrl(videoUrl);
            link.download = `seedance-video-${Date.now()}.mp4`;
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
                                <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl flex items-center justify-center">
                                    <Film className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">SeeDANCE Reference-to-Video</h1>
                                    <p className="text-purple-200 text-sm">Generate videos from reference images with AI</p>
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
                                <h2 className="text-lg font-semibold text-white">Video Configuration</h2>
                            </div>

                            <div className="space-y-6">
                                {/* Video Prompt */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        <Video className="w-4 h-4 inline mr-1" />
                                        Video Prompt *
                                    </label>
                                    <textarea
                                        value={config.prompt}
                                        onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                                        placeholder="Describe the motion and action for the video..."
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                        rows={4}
                                    />
                                    <p className="text-purple-300 text-xs mt-1">
                                        Describe movements, actions, and behaviors for the character
                                    </p>
                                </div>

                                {/* Prompt Suggestions */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        <Sparkles className="w-4 h-4 inline mr-1" />
                                        Prompt Ideas
                                    </label>
                                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                                        {promptSuggestions.slice(0, 4).map((suggestion, index) => (
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

                                {/* Reference Images */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        <ImageIcon className="w-4 h-4 inline mr-1" />
                                        Reference Images * (Max 5)
                                    </label>

                                    <div className="space-y-3">
                                        {Array.from({ length: Math.max(1, Math.min(5, config.referenceImageUrls.length + 1)) }).map((_, index) => (
                                            <div key={index} className="relative">
                                                <div
                                                    className="border-2 border-dashed border-white/30 rounded-lg p-3 text-center transition-colors hover:border-white/50"
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        e.currentTarget.classList.add('border-pink-400', 'bg-pink-500/10');
                                                    }}
                                                    onDragLeave={(e) => {
                                                        e.preventDefault();
                                                        e.currentTarget.classList.remove('border-pink-400', 'bg-pink-500/10');
                                                    }}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        e.currentTarget.classList.remove('border-pink-400', 'bg-pink-500/10');
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
                                                        id={`ref-image-upload-${index}`}
                                                        disabled={uploadingImages[index]}
                                                    />
                                                    <label htmlFor={`ref-image-upload-${index}`} className="cursor-pointer">
                                                        {config.referenceImageUrls[index] ? (
                                                            <div className="space-y-2">
                                                                <img
                                                                    src={config.referenceImageUrls[index]}
                                                                    alt={`Reference ${index + 1}`}
                                                                    className="w-full h-20 object-contain rounded-lg bg-black/20"
                                                                    loading="lazy"
                                                                />
                                                                <p className="text-purple-200 text-xs">Reference {index + 1} - Click to change</p>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <Upload className="w-6 h-6 text-purple-300 mx-auto mb-1" />
                                                                <p className="text-purple-200 text-xs">
                                                                    {uploadingImages[index] ? 'Uploading...' : `Upload Reference ${index + 1}`}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </label>

                                                    {/* Remove button for additional slots */}
                                                    {index > 0 && config.referenceImageUrls[index] && (
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
                                        {config.referenceImageUrls.length < 5 && config.referenceImageUrls.filter(url => url.trim()).length < 5 && (
                                            <button
                                                onClick={addImageSlot}
                                                className="w-full border-2 border-dashed border-purple-400/50 rounded-lg p-3 text-center hover:border-purple-400 hover:bg-purple-500/10 transition-colors"
                                            >
                                                <Plus className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                                                <p className="text-purple-300 text-xs">Add Another Reference</p>
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-purple-300 text-xs mt-1">
                                        JPG and PNG only • Max 10MB • Drag & drop supported
                                    </p>
                                </div>

                                {/* Video Settings */}
                                <div className="space-y-4">
                                    {/* Resolution */}
                                    <div>
                                        <label className="block text-sm font-medium text-purple-200 mb-2">
                                            <Settings className="w-4 h-4 inline mr-1" />
                                            Resolution
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setConfig(prev => ({ ...prev, resolution: '480p' }))}
                                                className={`px-4 py-2 rounded-lg transition-colors ${config.resolution === '480p'
                                                        ? 'bg-purple-500 text-white'
                                                        : 'bg-white/10 text-purple-200 hover:bg-white/20'
                                                    }`}
                                            >
                                                480p (Fast)
                                            </button>
                                            <button
                                                onClick={() => setConfig(prev => ({ ...prev, resolution: '720p' }))}
                                                className={`px-4 py-2 rounded-lg transition-colors ${config.resolution === '720p'
                                                        ? 'bg-purple-500 text-white'
                                                        : 'bg-white/10 text-purple-200 hover:bg-white/20'
                                                    }`}
                                            >
                                                720p (HD)
                                            </button>
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
                                            min="3"
                                            max="12"
                                            value={config.duration}
                                            onChange={(e) => setConfig(prev => ({ ...prev, duration: e.target.value }))}
                                            className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                                        />
                                        <div className="flex justify-between text-xs text-purple-300 mt-1">
                                            <span>3s</span>
                                            <span>6s</span>
                                            <span>9s</span>
                                            <span>12s</span>
                                        </div>
                                    </div>

                                    {/* Camera Fixed Toggle */}
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-purple-200">
                                            <Camera className="w-4 h-4 inline mr-1" />
                                            Fixed Camera
                                        </label>
                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, cameraFixed: !prev.cameraFixed }))}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.cameraFixed ? 'bg-purple-500' : 'bg-white/20'
                                                }`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.cameraFixed ? 'translate-x-6' : 'translate-x-1'
                                                }`} />
                                        </button>
                                    </div>

                                    {/* Safety Checker Toggle */}
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-purple-200">
                                            Safety Checker
                                        </label>
                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, enableSafetyChecker: !prev.enableSafetyChecker }))}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enableSafetyChecker ? 'bg-purple-500' : 'bg-white/20'
                                                }`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.enableSafetyChecker ? 'translate-x-6' : 'translate-x-1'
                                                }`} />
                                        </button>
                                    </div>

                                    {/* Seed (Optional) */}
                                    <div>
                                        <label className="block text-sm font-medium text-purple-200 mb-2">
                                            Seed (Optional)
                                        </label>
                                        <input
                                            type="number"
                                            value={config.seed || ''}
                                            onChange={(e) => setConfig(prev => ({ ...prev, seed: e.target.value ? parseInt(e.target.value) : undefined }))}
                                            placeholder="Random"
                                            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                        <p className="text-purple-300 text-xs mt-1">
                                            Use same seed for consistent results
                                        </p>
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
                                        <p>Resolution: {config.resolution}</p>
                                        <p className="font-medium text-pink-200">Total: {calculateTokenCost()} tokens</p>
                                    </div>
                                </div>

                                {/* Generate Button */}
                                <button
                                    onClick={handleGenerate}
                                    disabled={generating || !config.prompt.trim() || config.referenceImageUrls.filter(url => url.trim()).length === 0}
                                    className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                                >
                                    {generating ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Generating Video...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Film className="w-4 h-4" />
                                            <span>Generate Video ({calculateTokenCost()} tokens)</span>
                                        </>
                                    )}
                                </button>

                                {/* Processing Note */}
                                <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-3">
                                    <p className="text-pink-200 text-xs">
                                        <Sparkles className="w-3 h-3 inline mr-1" />
                                        Video generation typically takes 1-3 minutes depending on settings.
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
                                                            Duration: {generation.input_data?.duration}s •
                                                            Resolution: {generation.input_data?.resolution} •
                                                            Started: {new Date(generation.created_at).toLocaleTimeString()}
                                                        </p>
                                                        <p className="text-purple-300 text-xs mt-1">
                                                            Video generation typically takes 1-3 minutes
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
                                        <Film className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                                        <p className="text-purple-200 text-lg">No videos generated yet</p>
                                        <p className="text-purple-300 text-sm">Upload reference images and describe actions to create AI videos</p>
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
                                                                controls
                                                                className="w-full rounded-lg bg-black"
                                                                poster={generation.input_data?.referenceImageUrls?.[0]}
                                                            >
                                                                <source src={toCdnUrl(generation.output_file_url)} type="video/mp4" />
                                                                Your browser does not support the video tag.
                                                            </video>
                                                        </div>
                                                    )}

                                                    {generation.status === 'processing' && (
                                                        <div className="mb-4 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-lg p-8 text-center">
                                                            <RefreshCw className="w-12 h-12 text-pink-300 animate-spin mx-auto mb-2" />
                                                            <p className="text-pink-200">Generating video with SeeDANCE...</p>
                                                            <p className="text-pink-300 text-sm">This may take 1-3 minutes</p>
                                                        </div>
                                                    )}

                                                    {generation.status === 'failed' && (
                                                        <div className="mb-4 bg-red-500/20 rounded-lg p-4 text-center">
                                                            <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                                                            <p className="text-red-400 text-sm">Video generation failed</p>
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
                                                                <strong>Duration:</strong> {generation.input_data?.duration}s
                                                            </span>
                                                            <span>
                                                                <strong>Resolution:</strong> {generation.input_data?.resolution}
                                                            </span>
                                                            <span>
                                                                <strong>Camera:</strong> {generation.input_data?.cameraFixed ? 'Fixed' : 'Dynamic'}
                                                            </span>
                                                            <span>
                                                                <strong>Tokens:</strong> {generation.tokens_used}
                                                            </span>
                                                        </div>
                                                        {generation.metadata?.seed && (
                                                            <p>
                                                                <strong>Seed:</strong> {generation.metadata.seed}
                                                            </p>
                                                        )}
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
                toolName="SeeDANCE Reference-to-Video"
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
                toolName="SeeDANCE Reference-to-Video"
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

export default SeeDANCEReferenceToVideo;
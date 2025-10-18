import React, { useState, useEffect } from 'react';
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
    Image as ImageIcon,
    Download,
    Trash2,
    RefreshCw,
    Settings,
    Copy,
    X,
    Wand2,
    Sparkles,
    Palette,
    ZoomIn,
    Shuffle
} from 'lucide-react';

const SeeDreamText2Image = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Configuration state
    const [config, setConfig] = useState({
        prompt: '',
        imageSize: { width: 1024, height: 1024 },
        numImages: 3,
        maxImages: 3,
        enableSafetyChecker: false,
        seed: Math.floor(Math.random() * 100000000)
    });

    // Custom size inputs (only shown when "Custom" is selected)
    const [customWidth, setCustomWidth] = useState(4096);
    const [customHeight, setCustomHeight] = useState(4096);
    const [showCustomInputs, setShowCustomInputs] = useState(false);

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

    // State for desktop limit & modals
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [expandedImageIndex, setExpandedImageIndex] = useState(null);
    const [showExpandedImage, setShowExpandedImage] = useState(false);
    const [imageScale, setImageScale] = useState(1);
    const [imageFit, setImageFit] = useState(true); // true = fit to screen, false = actual size

    // Prompt suggestions for text-to-image
    const promptSuggestions = [
        "A majestic dragon soaring through a starlit sky",
        "Cyberpunk city at night with neon lights",
        "Serene zen garden with cherry blossoms",
        "Futuristic spacecraft in deep space",
        "Enchanted forest with glowing mushrooms",
        "Ancient temple in misty mountains",
        "Steampunk inventor's workshop",
        "Underwater coral reef city",
        "Fantasy castle on floating island",
        "Northern lights over snowy landscape"
    ];

    // Predefined size options - matching FAL.ai SeeDream v4 specifications
    const sizeOptions = [
        { value: 'default', label: 'Default', width: 1024, height: 1024 },
        { value: 'custom', label: 'Custom', width: 1024, height: 1024, isCustom: true },
        { value: 'portrait_uhd', label: 'Portrait UHD', width: 2160, height: 3840 },
        { value: 'landscape_uhd', label: 'Landscape UHD', width: 3840, height: 2160 },
        { value: 'square_hd', label: 'Square HD', width: 1024, height: 1024 },
        { value: 'square', label: 'Square', width: 512, height: 512 },
        { value: 'portrait_3_4', label: 'Portrait 3:4', width: 768, height: 1024 },
        { value: 'portrait_9_16', label: 'Portrait 9:16', width: 576, height: 1024 },
        { value: 'landscape_4_3', label: 'Landscape 4:3', width: 1024, height: 768 },
        { value: 'landscape_16_9', label: 'Landscape 16:9', width: 1024, height: 576 },
        { value: 'auto', label: 'Auto', width: 1024, height: 1024 },
        { value: 'auto_2k', label: 'Auto 2K', width: 2048, height: 2048 },
        { value: 'auto_4k', label: 'Auto 4K', width: 4096, height: 4096 }
    ];

    useEffect(() => {
        if (user) {
            fetchProfile();
            fetchGenerations();

            const subscription = supabase
                .channel('seedream_text2image_generations')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'ai_generations',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        const record = payload.new || payload.old;
                        if (record && record.tool_type === 'fal_seedream_v4_text2image') {
                            handleRealtimeUpdate(payload);
                        }
                    }
                )
                .subscribe();

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
            const limit = isDesktop ? 2 : 3;

            const { data, error } = await supabase
                .from('ai_generations')
                .select('*')
                .eq('user_id', user.id)
                .eq('tool_type', 'fal_seedream_v4_text2image')
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

        setGenerations(current => {
            switch (eventType) {
                case 'INSERT':
                    // Check if already exists before adding
                    const exists = current.find(g => g.id === newRecord.id);
                    return exists ? current : [newRecord, ...current];
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
                    showAlert('error', 'Generation Failed', `SeeDream Text-to-Image failed: ${errorMessage}`);
                }, 1000);
            }
        }
    };

    const getAllImageUrls = (url) => {
        if (!url) return [];

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

    const calculateTokenCost = () => {
        return config.numImages * config.maxImages * 3;
    };

    const handleSizeChange = (selectedValue) => {
    const selected = sizeOptions.find(opt => opt.value === selectedValue);
    if (selected) {
        if (selected.isCustom) {
            // Show custom input fields
            setShowCustomInputs(true);
            setConfig(prev => ({
                ...prev,
                // Don't clear prompt - allow multiple generations with same prompt
                seed: Math.floor(Math.random() * 100000000)
            }));
            // Use preset size
            setShowCustomInputs(false);
            setConfig(prev => ({
                ...prev,
                imageSize: { width: selected.width, height: selected.height }
            }));
        }
    }
};

const handleCustomSizeChange = () => {
    setConfig(prev => ({
        ...prev,
        imageSize: { width: customWidth, height: customHeight }
    }));
};

    const getCurrentSizeValue = () => {
    // If custom inputs are shown, always return 'custom'
    if (showCustomInputs) {
        return 'custom';
    }
    
    const current = sizeOptions.find(opt =>
        !opt.isCustom &&
        opt.width === config.imageSize.width &&
        opt.height === config.imageSize.height
    );
    return current?.value || 'custom';
};

    const handleGenerate = async () => {
        if (!config.prompt.trim()) {
            showAlert('error', 'No Prompt', 'Please enter a description of what you want to generate');
            return;
        }

        // Optional: Warn if too many concurrent generations
        if (activeGenerations.length >= 3) {
            if (!confirm(`You have ${activeGenerations.length} generations processing. Are you sure you want to start another?`)) {
                return;
            }
        }

        if (!bypassSafetyCheck) {
            try {
                const analysisResult = await performSafetyAnalysis(
                    null, // No image for text-to-image
                    config.prompt,
                    'fal_seedream_v4_text2image'
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
            showAlert('error', 'Insufficient Tokens', 'Please upgrade your plan or purchase more tokens.');
            return;
        }

        // Remove: setGenerating(true);
        let generation = null;

        try {
            generation = await createAIGeneration(
                'fal_seedream_v4_text2image',
                config.prompt.substring(0, 50) + '...',
                config,
                tokenCost
            );

            setGenerations(current => [generation, ...current]);
            setActiveGenerations(current => [generation, ...current]);

            await updateTokenCount(user.id, tokenCost);
            await fetchProfile();

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-seedream-text2image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    generationId: generation.id,
                    prompt: config.prompt,
                    imageSize: config.imageSize,
                    numImages: config.numImages,
                    maxImages: config.maxImages,
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
                seed: Math.floor(Math.random() * 100000000)
            }));

        } catch (error) {
            console.error('Error generating:', error);

            if (generation) {
                setGenerations(current => current.filter(g => g.id !== generation.id));
                setActiveGenerations(current => current.filter(g => g.id !== generation.id));
            }

            if (isNSFWError(error.message)) {
                const nsfwDetails = parseNSFWError(error.message);
                setNsfwError(nsfwDetails);
                setShowNSFWAlert(true);
            } else {
                showAlert('error', 'Generation Failed', `SeeDream Text-to-Image failed: ${error.message}`);
            }
        } finally {
            // Remove: setGenerating(false);
        }
    };

    const handleDownload = async (imageUrl) => {
        try {
            const response = await fetch(toCdnUrl(imageUrl));
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `seedream-text2image-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            const link = document.createElement('a');
            link.href = toCdnUrl(imageUrl);
            link.download = `seedream-text2image-${Date.now()}.png`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDelete = async (generationId) => {
        if (!confirm('Are you sure you want to remove this generation?')) return;

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
        showAlert('success', 'Copied', 'Prompt copied to clipboard');
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
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">SeeDream v4 Text-to-Image</h1>
                                    <p className="text-purple-200 text-sm">AI-powered image generation from text</p>
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
                                <h2 className="text-lg font-semibold text-white">Generation Settings</h2>
                            </div>

                            <div className="space-y-6">
                                {/* Prompt */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        <Wand2 className="w-4 h-4 inline mr-1" />
                                        Prompt *
                                    </label>
                                    <textarea
                                        value={config.prompt}
                                        onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                                        placeholder="Describe the image you want to create..."
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                        rows={4}
                                    />
                                    <p className="text-purple-300 text-xs mt-1">
                                        Be descriptive and detailed for best results
                                    </p>
                                </div>

                                {/* Prompt Suggestions */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        <Sparkles className="w-4 h-4 inline mr-1" />
                                        Quick Prompts
                                    </label>
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setConfig(prev => ({ ...prev, prompt: e.target.value }));
                                                e.target.value = ''; // Reset dropdown
                                            }
                                        }}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 [&>option]:bg-gray-800 [&>option]:text-white"
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Select a suggestion...</option>
                                        {promptSuggestions.map((suggestion, index) => (
                                            <option 
                                                key={index} 
                                                value={suggestion}
                                                className="bg-gray-800 text-white py-2"
                                            >
                                                {suggestion}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Image Size Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2 flex items-center">
                                        <span>Image Size</span>
                                        <span className="ml-2 w-4 h-4 rounded-full bg-purple-500/30 flex items-center justify-center text-xs">ⓘ</span>
                                    </label>
                                    <select
                                        value={getCurrentSizeValue()}
                                        onChange={(e) => handleSizeChange(e.target.value)}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 [&>option]:bg-gray-800 [&>option]:text-white"
                                    >
                                        {sizeOptions.map((option) => (
                                            <option 
                                                key={option.value} 
                                                value={option.value}
                                                className="bg-gray-800 text-white py-2"
                                            >
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
    
                                    {/* Custom size inputs - only shown when Custom is selected */}
                                    {showCustomInputs && (
                                        <div className="mt-3 space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="number"
                                                    value={customWidth}
                                                    onChange={(e) => setCustomWidth(parseInt(e.target.value) || 1024)}
                                                    placeholder="Width"
                                                    className="w-20 px-2 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                />
                                                <span className="text-purple-300 text-sm">×</span>
                                                <input
                                                    type="number"
                                                    value={customHeight}
                                                    onChange={(e) => setCustomHeight(parseInt(e.target.value) || 1024)}
                                                    placeholder="Height"
                                                    className="w-20 px-2 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                />
                                                <button
                                                    onClick={handleCustomSizeChange}
                                                    className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex-shrink-0"
                                                    title="Apply custom size"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <p className="text-purple-300 text-xs break-words">
                                                Note: When "sync_mode" is "true", the media will be returned as base64 encoded string
                                            </p>
                                        </div>
                                    )}
    
                                    {!showCustomInputs && (
                                        <div className="mt-2 text-xs text-purple-300">
                                            Current: {config.imageSize.width} × {config.imageSize.height}px
                                        </div>
                                    )}
                                </div>

                                {/* Number of Images */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        Images to Generate: {config.numImages}
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="6"
                                        value={config.numImages}
                                        onChange={(e) => setConfig(prev => ({ ...prev, numImages: parseInt(e.target.value) }))}
                                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                                    />
                                    <div className="flex justify-between text-xs text-purple-300 mt-1">
                                        <span>1</span>
                                        <span>2</span>
                                        <span>3</span>
                                        <span>4</span>
                                        <span>5</span>
                                        <span>6</span>
                                    </div>
                                </div>

                                {/* Max Images */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        Max Variations per Image: {config.maxImages}
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="6"
                                        value={config.maxImages}
                                        onChange={(e) => setConfig(prev => ({ ...prev, maxImages: parseInt(e.target.value) }))}
                                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                                    />
                                    <div className="flex justify-between text-xs text-purple-300 mt-1">
                                        <span>1</span>
                                        <span>2</span>
                                        <span>3</span>
                                        <span>4</span>
                                        <span>5</span>
                                        <span>6</span>
                                    </div>
                                    <p className="text-purple-300 text-xs mt-1">
                                        Controls variation diversity in output
                                    </p>
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
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enableSafetyChecker ? 'bg-purple-500' : 'bg-gray-600'
                                            }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.enableSafetyChecker ? 'translate-x-6' : 'translate-x-1'
                                            }`} />
                                    </button>
                                </div>

                                {/* Active Queue Indicator */}
                                {activeGenerations.length > 0 && (
                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                                        <h3 className="text-yellow-200 font-medium mb-2 flex items-center">
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            Active Generations
                                        </h3>
                                        <p className="text-yellow-300 text-sm">
                                            {activeGenerations.length} generation{activeGenerations.length !== 1 ? 's' : ''} currently processing
                                        </p>
                                    </div>
                                )}

                                {/* Cost Display */}
                                <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4">
                                    <h3 className="text-pink-200 font-medium mb-2 flex items-center">
                                        <Zap className="w-4 h-4 mr-2" />
                                        Cost Calculation
                                    </h3>
                                    <div className="text-pink-300 text-sm space-y-1">
                                        <p>Images: {config.numImages}</p>
                                        <p>Variations: {config.maxImages}</p>
                                        <p>Rate: 3 tokens per image</p>
                                        <p className="font-medium text-pink-200">Total: {calculateTokenCost()} tokens</p>
                                    </div>
                                </div>

                                {/* Generate Button */}
                                <button
                                    onClick={handleGenerate}
                                    disabled={!config.prompt.trim()}
                                    className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>
                                        Generate ({calculateTokenCost()} tokens)
                                        {activeGenerations.length > 0 && ` • ${activeGenerations.length} processing`}
                                    </span>
                                </button>

                                {/* Processing Note */}
                                <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-3">
                                    <p className="text-pink-200 text-xs">
                                        <Sparkles className="w-3 h-3 inline mr-1" />
                                        Processing typically takes 15-30 seconds. Cost: 3 tokens × images × variations.
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
                                        Generated Images {isDesktop && generations.length > 0 && `(Showing latest 2)`}
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
                                        <Sparkles className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                                        <p className="text-purple-200 text-lg">No images generated yet</p>
                                        <p className="text-purple-300 text-sm">Enter a prompt to start creating</p>
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
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                                {getAllImageUrls(generation.output_file_url).slice(0, 6).map((imageUrl, imgIndex) => (
                                                                    <div
                                                                        key={imgIndex}
                                                                        className="relative group cursor-pointer aspect-square"
                                                                        onClick={() => {
                                                                            setSelectedGeneration(generation);
                                                                            setExpandedImageIndex(imgIndex);
                                                                            setShowExpandedImage(true);
                                                                        }}
                                                                    >
                                                                        <img
                                                                            src={toCdnUrl(imageUrl)}
                                                                            alt={`Generated ${imgIndex + 1}`}
                                                                            className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
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
                                                                            <Download className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                                {getAllImageUrls(generation.output_file_url).length > 6 && (
                                                                    <div
                                                                        className="relative aspect-square bg-white/10 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors"
                                                                        onClick={() => {
                                                                            setSelectedGeneration(generation);
                                                                            setShowDetailModal(true);
                                                                        }}
                                                                    >
                                                                        <div className="text-center">
                                                                            <ZoomIn className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                                                                            <span className="text-white text-sm">+{getAllImageUrls(generation.output_file_url).length - 6} more</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {generation.status === 'processing' && (
                                                        <div className="mb-4 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-lg p-8 text-center">
                                                            <RefreshCw className="w-12 h-12 text-pink-300 animate-spin mx-auto mb-2" />
                                                            <p className="text-pink-200">Generating with SeeDream v4...</p>
                                                            <p className="text-pink-300 text-sm">This may take 15-30 seconds</p>
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
                                                                <strong>Generated:</strong> {generation.input_data?.numImages}
                                                            </span>
                                                            <span>
                                                                <strong>Tokens:</strong> {generation.tokens_used}
                                                            </span>
                                                            <span>
                                                                <strong>Size:</strong> {generation.input_data?.imageSize?.width}x{generation.input_data?.imageSize?.height}
                                                            </span>
                                                            <span>
                                                                <strong>Model:</strong> SeeDream v4
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
                                                                        setSelectedGeneration(generation);
                                                                        setShowDetailModal(true);
                                                                    }}
                                                                    className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg transition-colors"
                                                                    title="View all images"
                                                                >
                                                                    <ZoomIn className="w-4 h-4" />
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

                                        {isDesktop && generations.length >= 2 && (
                                            <div className="mt-4 text-center">
                                                <button
                                                    onClick={() => navigate('/gallery')}
                                                    className="text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium"
                                                >
                                                    View all images in Gallery →
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
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
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

                            {selectedGeneration.output_file_url && (
                                <div className="mb-6">
                                    <h4 className="text-lg font-semibold text-white mb-3">
                                        Generated Images ({getAllImageUrls(selectedGeneration.output_file_url).length})
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {getAllImageUrls(selectedGeneration.output_file_url).map((url, index) => (
                                            <div
                                                key={index}
                                                className="cursor-pointer hover:opacity-80 transition-opacity aspect-square"
                                                onClick={() => {
                                                    setExpandedImageIndex(index);
                                                    setShowExpandedImage(true);
                                                }}
                                            >
                                                <img
                                                    src={toCdnUrl(url)}
                                                    alt={`${selectedGeneration.generation_name} - Image ${index + 1}`}
                                                    className="w-full h-full object-cover rounded-lg"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                            <span className="text-white">SeeDream v4</span>
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

                            <div className="flex justify-end gap-3 mt-6">
                                {selectedGeneration.output_file_url && (
                                    <button
                                        onClick={() => {
                                            const imageUrls = getAllImageUrls(selectedGeneration.output_file_url);
                                            imageUrls.forEach((url, index) => {
                                                setTimeout(() => handleDownload(url), index * 500);
                                            });
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
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4 overflow-auto">
                    <div className="relative w-full min-h-full flex items-center justify-center py-20">
                        <button
                            onClick={() => {
                                setShowExpandedImage(false);
                                setExpandedImageIndex(null);
                            }}
                            className="absolute top-4 right-4 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <button
                            onClick={() => {
                                setShowExpandedImage(false);
                                setExpandedImageIndex(null);
                                setImageFit(true);
                                setImageScale(1);
                            }}
                            className="absolute top-4 right-4 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        {/* Zoom Controls */}
                        <div className="absolute top-20 right-4 z-10 flex flex-col gap-2">
                            <button
                                onClick={() => setImageFit(!imageFit)}
                                className="w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                                title={imageFit ? "View actual size" : "Fit to screen"}
                            >
                                {imageFit ? <ZoomIn className="w-5 h-5" /> : <ZoomIn className="w-5 h-5 rotate-180" />}
                            </button>
                            
                            {!imageFit && (
                                <>
                                    <button
                                        onClick={() => setImageScale(prev => Math.min(prev + 0.25, 3))}
                                        className="w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                                        title="Zoom in"
                                    >
                                        <span className="text-xl font-bold">+</span>
                                    </button>
                                    <button
                                        onClick={() => setImageScale(prev => Math.max(prev - 0.25, 0.25))}
                                        className="w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                                        title="Zoom out"
                                    >
                                        <span className="text-xl font-bold">−</span>
                                    </button>
                                    <button
                                        onClick={() => setImageScale(1)}
                                        className="w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors text-xs"
                                        title="Reset zoom"
                                    >
                                        100%
                                    </button>
                                </>
                            )}
                        </div>

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

                        <img
                            src={toCdnUrl(getAllImageUrls(selectedGeneration.output_file_url)[expandedImageIndex])}
                            alt={`${selectedGeneration.generation_name} - Image ${expandedImageIndex + 1}`}
                            className={`rounded-lg shadow-2xl transition-transform duration-200 ${
                                imageFit ? 'max-w-full max-h-[90vh] object-contain' : 'w-auto h-auto'
                            }`}
                            style={{
                                transform: imageFit ? 'none' : `scale(${imageScale})`,
                                cursor: imageFit ? 'zoom-in' : 'zoom-out'
                            }}
                            onClick={() => setImageFit(!imageFit)}
                        />

                        {getAllImageUrls(selectedGeneration.output_file_url).length > 1 && (
                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
                                {expandedImageIndex + 1} of {getAllImageUrls(selectedGeneration.output_file_url).length}
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
                toolName="SeeDream v4 Text-to-Image"
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
                toolName="SeeDream v4 Text-to-Image"
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

export default SeeDreamText2Image;
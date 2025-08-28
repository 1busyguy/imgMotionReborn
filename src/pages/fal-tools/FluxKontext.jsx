import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { createAIGeneration, updateTokenCount, uploadFile } from '../../utils/storageHelpers';
import {
    // New functions
    parseFalError,
    formatErrorDisplay,
    handleRetryGeneration,
    getErrorBadgeClasses,
    // Backward compatibility functions
    isNSFWError,
    parseNSFWError,
    isContentPolicyError,
    parseContentPolicyError
} from '../../utils/falErrorHandler';
import GenerationError from '../../components/GenerationError';
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
    Layers,
    Wand2,
    Monitor,
    Smartphone,
    Square,
    Maximize2
} from 'lucide-react';

const FluxKontext = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Configuration state - based on FLUX Kontext API parameters
    const [config, setConfig] = useState({
        imageUrl: '',
        prompt: '',
        numImages: 1,
        guidanceScale: 7.5,
        steps: 30,
        seed: -1,
        enableSafetyChecker: true,
        outputFormat: "jpeg",
        resolutionMode: "1:1",
        acceleration: "none"
    });

    // Generation state
    const [generations, setGenerations] = useState([]);
    const [activeGenerations, setActiveGenerations] = useState([]);
    const [selectedGeneration, setSelectedGeneration] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [imageAnalysis, setImageAnalysis] = useState(null);
    const [showSafetyWarning, setShowSafetyWarning] = useState(false);
    const [safetyWarningData, setSafetyWarningData] = useState(null);
    const [bypassSafetyCheck, setBypassSafetyCheck] = useState(false);
    const [analyzingImage, setAnalyzingImage] = useState(false);
    const [showNSFWAlert, setShowNSFWAlert] = useState(false);
    const [nsfwError, setNsfwError] = useState(null);
    const [enlargedImageIndex, setEnlargedImageIndex] = useState(null);
    const [alertConfig, setAlertConfig] = useState({
        show: false,
        type: 'error',
        title: '',
        message: ''
    });

    // Resolution mode options
    const resolutionModeOptions = [
        { label: 'Match Input', value: 'match_input', icon: <Square className="w-4 h-4" /> },
        { label: 'Square (1:1)', value: '1:1', icon: <Square className="w-4 h-4" /> },
        { label: 'Portrait (4:3)', value: '4:3', icon: <Smartphone className="w-4 h-4" /> },
        { label: 'Landscape (3:4)', value: '3:4', icon: <Monitor className="w-4 h-4" /> },
        { label: 'Widescreen (16:9)', value: '16:9', icon: <Maximize2 className="w-4 h-4" /> },
        { label: 'Tall (9:16)', value: '9:16', icon: <Smartphone className="w-4 h-4" /> },
        { label: 'Match Input Image', value: 'match_input', icon: <ImageIcon className="w-4 h-4" /> }
    ];

    useEffect(() => {
        if (user) {
            fetchProfile();
            fetchGenerations();

            // Set up real-time subscription for this specific tool type
            const subscription = supabase
                .channel('flux_kontext_generations')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'ai_generations',
                        filter: `user_id=eq.${user.id},tool_type=eq.fal_flux_kontext`
                    },
                    (payload) => {
                        console.log('🔄 FLUX Kontext Real-time update received:', payload);
                        handleRealtimeUpdate(payload);
                    }
                )
                .subscribe();

            console.log('✅ Real-time subscription set up for FLUX Kontext');
            return () => {
                console.log('🔌 Unsubscribing from FLUX Kontext real-time updates');
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
                .eq('tool_type', 'fal_flux_kontext')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;

            console.log('📊 Fetched FLUX Kontext generations:', data?.length || 0);
            setGenerations(data || []);
            setActiveGenerations(data?.filter(g => g.status === 'processing') || []);
        } catch (error) {
            console.error('Error fetching generations:', error);
        }
    };

    const handleRealtimeUpdate = (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        console.log('🔄 Processing FLUX Kontext real-time update:', {
            eventType,
            newRecord: newRecord ? { id: newRecord.id, status: newRecord.status, error_message: newRecord.error_message } : null,
            oldRecord: oldRecord ? { id: oldRecord.id } : null
        });

        setGenerations(current => {
            let updated;
            switch (eventType) {
                case 'INSERT':
                    console.log('➕ Adding new FLUX Kontext generation to list');
                    updated = [newRecord, ...current];
                    break;
                case 'UPDATE':
                    console.log('🔄 Updating existing FLUX Kontext generation');
                    updated = current.map(item =>
                        item.id === newRecord.id ? newRecord : item
                    );

                    // Debug the update
                    if (newRecord.status === 'completed') {
                        console.log('✅ FLUX Kontext generation completed! Output URL:', newRecord.output_file_url);
                    } else if (newRecord.status === 'failed') {
                        console.log('❌ FLUX Kontext generation failed!');
                        console.log('Error:', newRecord.error_message);
                        console.log('Error type:', newRecord.metadata?.error_type);

                        // Show appropriate alert for failures
                        if (newRecord.metadata?.error_type === 'content_violation') {
                            // Content violation - show NSFW alert
                            setNsfwError({
                                type: 'content_violation',
                                message: newRecord.error_message || 'Content policy violation detected',
                                technical: newRecord.metadata?.status_result || newRecord.error_message
                            });
                            setShowNSFWAlert(true);
                        } else {
                            // Other failures - show general alert
                            showAlert(
                                'error',
                                'Generation Failed',
                                newRecord.error_message || 'Generation failed. Please check the details.'
                            );
                        }
                    }
                    break;
                case 'DELETE':
                    console.log('🗑️ Removing FLUX Kontext generation from list');
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
            console.log('⏳ Adding to active FLUX Kontext generations');
            setActiveGenerations(current => {
                const exists = current.find(g => g.id === newRecord.id);
                const updated = exists ? current.map(g => g.id === newRecord.id ? newRecord : g) : [newRecord, ...current];
                console.log('📊 Active generations count:', updated.length);
                return updated;
            });
        } else if (newRecord?.status === 'completed' || newRecord?.status === 'failed') {
            console.log('✅ Removing from active FLUX Kontext generations - Status:', newRecord.status);
            setActiveGenerations(current => {
                const updated = current.filter(g => g.id !== newRecord?.id);
                console.log('📊 Active generations count after removal:', updated.length);
                return updated;
            });

            if (newRecord?.status === 'completed' && newRecord?.output_file_url) {
                console.log('🎉 FLUX Kontext generation completed successfully! Has output:', !!newRecord.output_file_url);
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

    // Analyze image to get dimensions and calculate megapixels
    const analyzeImage = (file) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const width = img.width;
                const height = img.height;
                const megapixels = (width * height) / 1000000;

                resolve({
                    width,
                    height,
                    megapixels,
                    resolution: `${width}x${height}`
                });

                // Clean up
                URL.revokeObjectURL(img.src);
            };

            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                reject(new Error('Failed to analyze image'));
            };

            img.src = URL.createObjectURL(file);
        });
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
        setAnalyzingImage(true);
        try {
            // First analyze the image
            const analysis = await analyzeImage(file);
            console.log('Image analysis:', analysis);
            setImageAnalysis(analysis);

            // Then upload to storage
            const { url } = await uploadFile(file, 'flux-kontext-images');
            setConfig(prev => ({ ...prev, imageUrl: url }));
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Error uploading image. Please try again.');
        } finally {
            setAnalyzingImage(false);
            setUploadingImage(false);
        }
    };

    const calculateTokenCost = () => {
        // Base cost
        let baseCost = 10;

        // Inference steps pricing
        if (config.steps >= 29 && config.steps <= 35) {
            baseCost += 10;
        } else if (config.steps >= 36 && config.steps <= 50) {
            baseCost += 20;
        }
        // Steps 10-28 add 0 tokens (no additional cost)

        // Resolution-based pricing
        let resolutionCost = 0;
        if (config.resolutionMode === 'match_input' && imageAnalysis) {
            // Megapixels × 5 tokens
            resolutionCost = Math.ceil(imageAnalysis.megapixels * 5);
        }

        // Total cost per image
        const costPerImage = baseCost + resolutionCost;

        // Multiply by number of images
        return costPerImage * config.numImages;
    };

    const handleGenerate = async () => {
        if (!config.imageUrl) {
            alert('Please upload an image');
            return;
        }

        if (!config.prompt.trim()) {
            alert('Please enter a modification prompt');
            return;
        }

        // --- SAFETY SCAN INTEGRATION ---
        if (!bypassSafetyCheck) {
            try {
                const analysisResult = await performSafetyAnalysis(
                    config.imageUrl,
                    config.prompt,
                    'fal_flux_kontext'
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
            console.log('🚀 Starting FLUX Kontext generation...');

            // Create generation record
            const generation = await createAIGeneration(
                'fal_flux_kontext',
                config.prompt.substring(0, 50) + '...',
                config,
                tokenCost
            );

            console.log('📝 FLUX Kontext generation record created:', generation.id);

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

            // Call Edge Function using direct fetch
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-flux-kontext`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    generationId: generation.id,
                    ...config,
                    imageAnalysis: imageAnalysis,
                    acceleration: config.acceleration
                })
            });

            console.log('📡 Edge Function response status:', response.status);

            // Parse the response body first
            const responseData = await response.json();
            console.log('📡 Edge Function response data:', responseData);

            // Check both HTTP status AND success field
            if (!response.ok && response.status >= 500) {
                // Actual server error (500+)
                console.error('❌ Edge Function server error:', responseData);
                throw new Error(responseData.error || 'Server error occurred');
            }

            // Check the success field in the response
            if (!responseData.success) {
                console.error('❌ Edge Function reported failure:', responseData);

                // IMMEDIATELY remove the stuck generation from active list
                setActiveGenerations(current => {
                    console.log('Removing failed generation from active list:', generation.id);
                    return current.filter(g => g.id !== generation.id);
                });

                // Also update it in the main generations list to show as failed
                setGenerations(current => {
                    console.log('Marking generation as failed in main list:', generation.id);
                    return current.map(g =>
                        g.id === generation.id
                            ? {
                                ...g,
                                status: 'failed',
                                error_message: responseData.error || 'Content policy violation detected',
                                completed_at: new Date().toISOString()
                            }
                            : g
                    );
                });

                // Check if it's a content violation
                if (responseData.error_type === 'content_violation') {
                    // Show the NSFW alert
                    setNsfwError({
                        type: 'content_violation',
                        message: responseData.error || 'Content policy violation detected',
                        technical: responseData.error
                    });
                    setShowNSFWAlert(true);

                    // Force a refresh of the generations list after a short delay
                    setTimeout(() => {
                        console.log('Force refreshing generations list');
                        fetchGenerations();
                    }, 1000);
                } else {
                    // Other errors
                    showAlert('error', 'Generation Failed', responseData.error || 'Generation failed');
                }

                // Don't throw - the generation has been properly handled
                return;
            }

            // Success response
            console.log('✅ Edge Function result:', responseData);

            // Clear prompt after successful generation submission
            setConfig(prev => ({ ...prev, prompt: '' }));

            console.log('🎉 FLUX Kontext generation request completed successfully');

        } catch (error) {
            console.error('❌ Error generating:', error);

            // Check if it's an NSFW content error
            if (isNSFWError(error.message)) {
                const nsfwDetails = parseNSFWError(error.message);
                setNsfwError(nsfwDetails);
                setShowNSFWAlert(true);
            } else {
                showAlert('error', 'Generation Failed', `FLUX Kontext generation failed: ${error.message}`);
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
                link.download = `flux-kontext-${Date.now()}-${i + 1}.jpg`;
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
                link.download = `flux-kontext-${Date.now()}-${i + 1}.jpg`;
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

    // 👇 ADD IT HERE - WITH YOUR OTHER HANDLERS 👇
    const onRetryGeneration = (failedGeneration) => {
        handleRetryGeneration(failedGeneration, setConfig, handleGenerate);
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
                                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                                    <Layers className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">FLUX Kontext</h1>
                                    <p className="text-purple-200 text-sm">Generate images with context-aware composition and spatial understanding</p>
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
                                <h2 className="text-lg font-semibold text-white">Context Configuration</h2>
                            </div>

                            <div className="space-y-6">
                                {/* Image Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        <ImageIcon className="w-4 h-4 inline mr-1" />
                                        Input Image *
                                    </label>
                                    <div
                                        className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center transition-colors hover:border-white/50"
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
                                            {config.imageUrl ? (
                                                <div className="space-y-2">
                                                    <img
                                                        src={toCdnUrl(config.imageUrl)}
                                                        alt="Input"
                                                        className="w-full h-32 object-contain rounded-lg bg-black/20"
                                                        loading="lazy"
                                                    />
                                                    <p className="text-purple-200 text-sm">
                                                        {analyzingImage ? 'Analyzing...' : 'Click to change'}
                                                    </p>
                                                    {imageAnalysis && (
                                                        <div className="text-xs text-purple-300 space-y-1">
                                                            <p>Resolution: {imageAnalysis.resolution}</p>
                                                            <p>Megapixels: {imageAnalysis.megapixels.toFixed(2)}MP</p>
                                                            {config.resolutionMode === 'match_input' && (
                                                                <p className="text-green-300">+{Math.ceil(imageAnalysis.megapixels * 5)} tokens for match input</p>
                                                            )}
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
                                                        Context-aware image generation • Drag & drop supported
                                                    </p>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </div>

                                {/* Modification Prompt */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        <Wand2 className="w-4 h-4 inline mr-1" />
                                        Modification Prompt *
                                    </label>
                                    <textarea
                                        value={config.prompt}
                                        onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                                        placeholder="Describe how to modify the image..."
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                        rows={3}
                                    />
                                    <p className="text-purple-300 text-xs mt-1">
                                        Example: "Change the setting to daytime, add people walking"
                                    </p>
                                </div>

                                {/* Number of Images */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        Number of Images: {config.numImages}
                                        {config.numImages > 1 && <span className="text-blue-300">(×{config.numImages} total cost)</span>}
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

                                {/* Steps */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        Steps: {config.steps}
                                        {config.steps >= 29 && config.steps <= 35 && <span className="text-yellow-300">(+10 tokens)</span>}
                                        {config.steps >= 36 && config.steps <= 50 && <span className="text-orange-300">(+20 tokens)</span>}
                                    </label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="50"
                                        value={config.steps}
                                        onChange={(e) => setConfig(prev => ({ ...prev, steps: parseInt(e.target.value) }))}
                                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                                    />
                                    <div className="flex justify-between text-xs text-purple-300 mt-1">
                                        <span>10 (Base)</span>
                                        <span>28 (Base)</span>
                                        <span>35 (+10)</span>
                                        <span>50 (+20)</span>
                                    </div>
                                </div>

                                {/* Resolution Mode */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        Resolution Mode
                                    </label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {resolutionModeOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => setConfig(prev => ({ ...prev, resolutionMode: option.value }))}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${config.resolutionMode === option.value
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-white/10 text-purple-200 hover:bg-white/20'
                                                    }`}
                                            >
                                                {option.icon}
                                                <span>{option.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Output Format */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        Output Format
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, outputFormat: "jpeg" }))}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${config.outputFormat === "jpeg"
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white/10 text-purple-200 hover:bg-white/20'
                                                }`}
                                        >
                                            JPEG
                                        </button>
                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, outputFormat: "png" }))}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${config.outputFormat === "png"
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white/10 text-purple-200 hover:bg-white/20'
                                                }`}
                                        >
                                            PNG
                                        </button>
                                    </div>
                                </div>

                                {/* Acceleration */}
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        Acceleration
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, acceleration: "none" }))}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${config.acceleration === "none"
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white/10 text-purple-200 hover:bg-white/20'
                                                }`}
                                        >
                                            None
                                        </button>
                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, acceleration: "fast" }))}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${config.acceleration === "fast"
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white/10 text-purple-200 hover:bg-white/20'
                                                }`}
                                        >
                                            Fast
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
                                                className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-white font-medium">Safety Checker</span>
                                        </label>
                                    </div>
                                </div>
                                {/* Cost Breakdown */}
                                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                                    <h3 className="text-purple-200 font-medium mb-2 flex items-center">
                                        <Zap className="w-4 h-4 mr-2" />
                                        Cost Breakdown
                                    </h3>
                                    <div className="text-purple-300 text-sm space-y-1">
                                        <p>Base cost: 10 tokens</p>
                                        {config.steps >= 29 && config.steps <= 35 && (
                                            <p>Steps (29-35): +10 tokens</p>
                                        )}
                                        {config.steps >= 36 && config.steps <= 50 && (
                                            <p>Steps (36-50): +20 tokens</p>
                                        )}
                                        {config.resolutionMode === 'match_input' && imageAnalysis && (
                                            <p>Match input ({imageAnalysis.megapixels.toFixed(2)}MP): +{Math.ceil(imageAnalysis.megapixels * 5)} tokens</p>
                                        )}
                                        {config.numImages > 1 && (
                                            <p>Multiple images (×{config.numImages}): {calculateTokenCost() / config.numImages} × {config.numImages}</p>
                                        )}
                                        <p className="font-medium text-white border-t border-purple-500/30 pt-1 mt-2">
                                            Total: {calculateTokenCost()} tokens
                                        </p>
                                    </div>
                                </div>

                                {/* Generate Button */}
                                <button
                                    onClick={handleGenerate}
                                    disabled={generating || !config.imageUrl || !config.prompt.trim() || analyzingImage}
                                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                                >
                                    {generating ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Generating...</span>
                                        </>
                                    ) : analyzingImage ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Analyzing Image...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Layers className="w-4 h-4" />
                                            <span>Generate ({calculateTokenCost()} tokens)</span>
                                        </>
                                    )}
                                </button>

                                {/* Processing Note */}
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                                    <p className="text-blue-200 text-xs">
                                        <Layers className="w-3 h-3 inline mr-1" />
                                        Context-aware generation may take 1-3 minutes. You can navigate away and check your Gallery later.
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
                                                        <p className="text-purple-300 text-xs mt-1">
                                                            Context-aware generation typically takes 1-3 minutes
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
                                    <h3 className="text-lg font-semibold text-white">Context-Aware Generations</h3>
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
                                        <p className="text-purple-200 text-lg">No generations yet</p>
                                        <p className="text-purple-300 text-sm">Upload an image and describe modifications to create context-aware images</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {generations.slice(0, window.innerWidth >= 1024 ? 4 : generations.length).map((generation) => (
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
                                                                    src={toCdnUrl(getPrimaryImageUrl(generation))}
                                                                    alt={generation.generation_name}
                                                                    className="w-full rounded-lg max-h-96 object-contain"
                                                                    loading="lazy"
                                                                />
                                                            ) : (
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    {getImageUrls(generation).slice(0, 4).map((url, index) => (
                                                                        <img
                                                                            key={index}
                                                                            src={toCdnUrl(url)}
                                                                            alt={`${generation.generation_name} - ${index + 1}`}
                                                                            className="w-full rounded-lg h-48 object-cover"
                                                                            loading="lazy"
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
                                                        <div className="mb-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg p-8 text-center">
                                                            <RefreshCw className="w-12 h-12 text-blue-300 animate-spin mx-auto mb-2" />
                                                            <p className="text-blue-200">Generating context-aware images...</p>
                                                            <p className="text-blue-300 text-sm">This may take 1-3 minutes</p>
                                                        </div>
                                                    )}

                                                    {generation.status === 'failed' && (
                                                        <GenerationError
                                                            generation={generation}
                                                            onRetry={onRetryGeneration}
                                                            canRetry={true}
                                                        />
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
                                                                <strong>Resolution:</strong> {generation.input_data?.resolutionMode}
                                                            </span>
                                                            {generation.input_data?.imageAnalysis && (
                                                                <span>
                                                                    <strong>Input:</strong> {generation.input_data.imageAnalysis.resolution}
                                                                </span>
                                                            )}
                                                            <span>
                                                                <strong>Format:</strong> {generation.input_data?.outputFormat?.toUpperCase()}
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
                                                        src={toCdnUrl(url)}
                                                        alt={`${selectedGeneration.generation_name} - Image ${index + 1}`}
                                                        className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                        onClick={() => setEnlargedImageIndex(index)}
                                                        loading="lazy"
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
                                            <span className="text-purple-200">Resolution Mode:</span>
                                            <span className="text-white">{selectedGeneration.input_data?.resolutionMode}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-purple-200">Output Format:</span>
                                            <span className="text-white">{selectedGeneration.input_data?.outputFormat?.toUpperCase()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-purple-200">Acceleration:</span>
                                            <span className="text-white">{selectedGeneration.input_data?.acceleration}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-purple-200">Guidance Scale:</span>
                                            <span className="text-white">{selectedGeneration.input_data?.guidanceScale}</span>
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
                            src={toCdnUrl(getImageUrls(selectedGeneration)[enlargedImageIndex])}
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
                toolName="FLUX Kontext"
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
                toolName="FLUX Kontext"
            />

            {/* Custom Styles */}
            <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #3B82F6, #8B5CF6);
          cursor: pointer;
          border: 2px solid white;
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #3B82F6, #8B5CF6);
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

export default FluxKontext;
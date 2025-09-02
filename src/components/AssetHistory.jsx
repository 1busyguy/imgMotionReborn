import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { toCdnUrl } from '../utils/cdnHelpers';
import {
    X,
    Image as ImageIcon,
    Video,
    Search,
    Clock,
    Star,
    Check,
    Loader2,
    Grid3x3,
    List,
    Filter,
    ChevronLeft,
    ChevronRight,
    Upload,
    Sparkles,
    FolderOpen,
    FileImage,
    FileVideo
} from 'lucide-react';

const AssetHistory = ({
    isOpen,
    onClose,
    onSelect,
    assetType = 'all', // 'image', 'video', or 'all'
    title = 'Select from Your Library',
    allowUploads = true // Whether to show uploads tab
}) => {
    const { user } = useAuth();
    const [generations, setGenerations] = useState([]);
    const [uploads, setUploads] = useState([]);
    const [filteredAssets, setFilteredAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('generations'); // 'generations', 'uploads', or 'favorites'
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const [filterType, setFilterType] = useState(assetType); // Current filter
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const ITEMS_PER_PAGE = 20;

    // Asset type categories based on tool_type
    const IMAGE_TOOLS = [
        'fal_flux_kontext',
        'fal_flux_kontext_lora',
        'fal_flux_kontext_max_multi',
        'fal_hidream_i1',
        'fal_bria_bg_remove',
        'fal_gemini_flash_image_edit',
        'fal_qwen_image',
        'fal_qwen_image_to_image'
    ];

    const VIDEO_TOOLS = [
        'fal_minimax_hailuo',
        'fal_kling_pro',
        'fal_ltxv',
        'fal_seedance_pro',
        'fal_wan_v22_img2video_lora',
        'fal_wan_v22_text2video_lora',
        'fal_wan_v22_video2video',
        'fal_veo3_fast',
        'fal_veo3',
        'fal_wan22_s2v',
        'fal_omnihuman',
        'ai_scene_gen'
    ];

    // Extract uploads from generation input data
    const extractUploadsFromGenerations = (generationsData) => {
        const uploadsMap = new Map();

        generationsData.forEach(gen => {
            if (!gen.input_data) return;

            // Extract image uploads
            if (gen.input_data.imageUrl) {
                const url = gen.input_data.imageUrl;
                if (!uploadsMap.has(url)) {
                    uploadsMap.set(url, {
                        id: `upload_${btoa(url).substring(0, 10)}`,
                        url: url,
                        type: 'image',
                        name: `Upload from ${gen.generation_name || gen.tool_name}`,
                        created_at: gen.created_at,
                        used_in: gen.tool_name,
                        used_for: gen.generation_name,
                        is_upload: true,
                        original_generation_id: gen.id
                    });
                }
            }

            // Extract video uploads
            if (gen.input_data.videoUrl) {
                const url = gen.input_data.videoUrl;
                if (!uploadsMap.has(url)) {
                    uploadsMap.set(url, {
                        id: `upload_${btoa(url).substring(0, 10)}`,
                        url: url,
                        type: 'video',
                        name: `Upload from ${gen.generation_name || gen.tool_name}`,
                        created_at: gen.created_at,
                        used_in: gen.tool_name,
                        used_for: gen.generation_name,
                        is_upload: true,
                        original_generation_id: gen.id
                    });
                }
            }

            // Also check for reference images in some tools
            if (gen.input_data.referenceImageUrl) {
                const url = gen.input_data.referenceImageUrl;
                if (!uploadsMap.has(url)) {
                    uploadsMap.set(url, {
                        id: `upload_${btoa(url).substring(0, 10)}`,
                        url: url,
                        type: 'image',
                        name: `Reference from ${gen.generation_name || gen.tool_name}`,
                        created_at: gen.created_at,
                        used_in: gen.tool_name,
                        used_for: gen.generation_name,
                        is_upload: true,
                        original_generation_id: gen.id
                    });
                }
            }
        });

        return Array.from(uploadsMap.values()).sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );
    };

    // Fetch user's generations and extract uploads
    const fetchAssets = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        try {
            // Fetch all generations to extract uploads
            const { data: allGenerations, error: allError } = await supabase
                .from('ai_generations')
                .select('*')
                .eq('user_id', user.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (allError) throw allError;

            // Extract uploads from all generations
            const extractedUploads = extractUploadsFromGenerations(allGenerations || []);
            setUploads(extractedUploads);

            // Now fetch completed generations for the generations tab
            let query = supabase
                .from('ai_generations')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'completed')
                .not('output_file_url', 'is', null)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            // Filter by asset type if specified
            if (assetType === 'image') {
                query = query.in('tool_type', IMAGE_TOOLS);
            } else if (assetType === 'video') {
                query = query.in('tool_type', VIDEO_TOOLS);
            }

            // Pagination for generations
            const startRange = (page - 1) * ITEMS_PER_PAGE;
            const endRange = startRange + ITEMS_PER_PAGE;
            query = query.range(startRange, endRange);

            const { data, error } = await query;

            if (error) throw error;

            // Process generations
            const processedGenerations = (data || []).map(gen => ({
                ...gen,
                is_generation: true,
                type: IMAGE_TOOLS.includes(gen.tool_type) ? 'image' : 'video'
            }));

            // Check if there are more items
            setHasMore(data.length > ITEMS_PER_PAGE);

            // Only show ITEMS_PER_PAGE items
            const paginatedData = processedGenerations.slice(0, ITEMS_PER_PAGE);

            if (page === 1) {
                setGenerations(paginatedData);
            } else {
                setGenerations(prev => [...prev, ...paginatedData]);
            }

        } catch (error) {
            console.error('Error fetching assets:', error);
        } finally {
            setLoading(false);
        }
    }, [user, assetType, page]);

    useEffect(() => {
        if (isOpen) {
            fetchAssets();
        }
    }, [isOpen, fetchAssets]);

    // Get current assets based on active tab
    const getCurrentAssets = () => {
        if (activeTab === 'uploads') {
            return uploads;
        } else if (activeTab === 'favorites') {
            return [...generations.filter(g => g.is_favorite), ...uploads.filter(u => u.is_favorite)];
        } else {
            return generations;
        }
    };

    // Filter assets based on search and type
    useEffect(() => {
        const currentAssets = getCurrentAssets();
        let filtered = [...currentAssets];

        // Filter by search query
        if (searchQuery) {
            filtered = filtered.filter(asset => {
                const searchLower = searchQuery.toLowerCase();
                return (
                    asset.generation_name?.toLowerCase().includes(searchLower) ||
                    asset.name?.toLowerCase().includes(searchLower) ||
                    asset.input_data?.prompt?.toLowerCase().includes(searchLower) ||
                    asset.tool_name?.toLowerCase().includes(searchLower) ||
                    asset.used_in?.toLowerCase().includes(searchLower) ||
                    asset.used_for?.toLowerCase().includes(searchLower)
                );
            });
        }

        // Filter by type
        if (filterType !== 'all') {
            filtered = filtered.filter(asset => {
                if (asset.is_upload) {
                    return asset.type === filterType;
                } else {
                    if (filterType === 'image') {
                        return IMAGE_TOOLS.includes(asset.tool_type);
                    } else if (filterType === 'video') {
                        return VIDEO_TOOLS.includes(asset.tool_type);
                    }
                }
            });
        }

        setFilteredAssets(filtered);
    }, [searchQuery, filterType, activeTab, generations, uploads]);

    // Handle asset selection
    const handleSelect = () => {
        if (selectedAsset) {
            const assetUrl = selectedAsset.is_upload ? selectedAsset.url : selectedAsset.output_file_url;
            const assetData = {
                url: assetUrl,
                type: selectedAsset.is_upload
                    ? selectedAsset.type
                    : (IMAGE_TOOLS.includes(selectedAsset.tool_type) ? 'image' : 'video'),
                name: selectedAsset.is_upload ? selectedAsset.name : selectedAsset.generation_name,
                created: selectedAsset.created_at,
                metadata: selectedAsset.is_upload ? {} : selectedAsset.input_data,
                isUpload: selectedAsset.is_upload || false,
                isGeneration: selectedAsset.is_generation || false
            };
            onSelect(assetData);
            onClose();
            // Reset state
            setSelectedAsset(null);
            setSearchQuery('');
            setPage(1);
        }
    };

    // Toggle favorite status
    const toggleFavorite = async (assetId, currentStatus, isUpload = false) => {
        if (isUpload) {
            // For uploads, we store favorites in localStorage or a separate table
            // For now, just update local state
            setUploads(prev => prev.map(upload =>
                upload.id === assetId ? { ...upload, is_favorite: !currentStatus } : upload
            ));
        } else {
            try {
                const { error } = await supabase
                    .from('ai_generations')
                    .update({ is_favorite: !currentStatus })
                    .eq('id', assetId);

                if (!error) {
                    setGenerations(prev => prev.map(gen =>
                        gen.id === assetId ? { ...gen, is_favorite: !currentStatus } : gen
                    ));
                }
            } catch (error) {
                console.error('Error toggling favorite:', error);
            }
        }
    };

    // Get asset type icon
    const getAssetIcon = (asset) => {
        if (asset.is_upload) {
            return asset.type === 'image' ? <FileImage className="w-4 h-4" /> : <FileVideo className="w-4 h-4" />;
        }
        if (IMAGE_TOOLS.includes(asset.tool_type)) {
            return <ImageIcon className="w-4 h-4" />;
        }
        return <Video className="w-4 h-4" />;
    };

    // Format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    // Render thumbnail based on asset type
    const renderThumbnail = (asset) => {
        if (asset.is_upload) {
            // For uploads, directly use the URL
            if (asset.type === 'image') {
                return (
                    <img
                        src={toCdnUrl(asset.url)}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                );
            } else {
                return (
                    <video
                        src={toCdnUrl(asset.url)}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                    />
                );
            }
        }

        // For generations
        const isImage = IMAGE_TOOLS.includes(asset.tool_type);
        const thumbnailUrl = asset.thumbnail_url || asset.output_file_url;

        if (isImage) {
            return (
                <img
                    src={toCdnUrl(thumbnailUrl)}
                    alt={asset.generation_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                />
            );
        } else {
            // For videos, try to use thumbnail or show video element
            if (asset.thumbnail_url) {
                return (
                    <img
                        src={toCdnUrl(asset.thumbnail_url)}
                        alt={asset.generation_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                );
            }
            return (
                <video
                    src={toCdnUrl(asset.output_file_url)}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                />
            );
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-purple-900/95 via-blue-900/95 to-indigo-900/95 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-white/20 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/20">
                    <h2 className="text-2xl font-bold text-white">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-purple-300 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs and Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 space-y-4 sm:space-y-0 border-b border-white/10">
                    <div className="flex space-x-1">
                        <button
                            onClick={() => setActiveTab('generations')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2 ${activeTab === 'generations'
                                    ? 'bg-violet-500/30 text-white border border-violet-400'
                                    : 'text-purple-300 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            <Sparkles className="w-4 h-4" />
                            <span>Generations</span>
                        </button>
                        {allowUploads && (
                            <button
                                onClick={() => setActiveTab('uploads')}
                                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2 ${activeTab === 'uploads'
                                        ? 'bg-violet-500/30 text-white border border-violet-400'
                                        : 'text-purple-300 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                <Upload className="w-4 h-4" />
                                <span>Uploads</span>
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('favorites')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2 ${activeTab === 'favorites'
                                    ? 'bg-violet-500/30 text-white border border-violet-400'
                                    : 'text-purple-300 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            <Star className="w-4 h-4" />
                            <span>Favorites</span>
                        </button>
                    </div>

                    <div className="flex items-center space-x-3 w-full sm:w-auto">
                        {/* Search */}
                        <div className="relative flex-1 sm:flex-initial">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search assets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-violet-500 w-full sm:w-64"
                            />
                        </div>

                        {/* Filter */}
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                            <option value="all" className="bg-gray-800">All Types</option>
                            <option value="image" className="bg-gray-800">Images</option>
                            <option value="video" className="bg-gray-800">Videos</option>
                        </select>

                        {/* View Mode */}
                        <div className="flex space-x-1 bg-white/10 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-violet-500 text-white' : 'text-purple-300 hover:text-white'
                                    }`}
                            >
                                <Grid3x3 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-violet-500 text-white' : 'text-purple-300 hover:text-white'
                                    }`}
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading && page === 1 ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                        </div>
                    ) : filteredAssets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-purple-300">
                            {activeTab === 'generations' ? (
                                <>
                                    <Sparkles className="w-16 h-16 mb-4 opacity-50" />
                                    <p className="text-lg">No generations found</p>
                                    <p className="text-sm mt-2">Create some content to see it here</p>
                                </>
                            ) : activeTab === 'uploads' ? (
                                <>
                                    <Upload className="w-16 h-16 mb-4 opacity-50" />
                                    <p className="text-lg">No uploads found</p>
                                    <p className="text-sm mt-2">Upload files when creating content to see them here</p>
                                </>
                            ) : (
                                <>
                                    <Star className="w-16 h-16 mb-4 opacity-50" />
                                    <p className="text-lg">No favorites found</p>
                                    <p className="text-sm mt-2">Star your favorite content to see it here</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Grid View */}
                            {viewMode === 'grid' && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {filteredAssets.map((asset) => (
                                        <div
                                            key={asset.id}
                                            onClick={() => setSelectedAsset(asset)}
                                            className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${selectedAsset?.id === asset.id
                                                    ? 'border-violet-400 ring-2 ring-violet-400/50'
                                                    : 'border-white/20 hover:border-violet-400/50'
                                                }`}
                                        >
                                            <div className="aspect-square bg-black/50">
                                                {renderThumbnail(asset)}
                                            </div>

                                            {/* Type Badge */}
                                            <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium ${asset.is_upload
                                                    ? 'bg-blue-500/80 text-white'
                                                    : 'bg-violet-500/80 text-white'
                                                }`}>
                                                {asset.is_upload ? 'Upload' : 'Generated'}
                                            </div>

                                            {/* Overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="absolute bottom-0 left-0 right-0 p-2">
                                                    <p className="text-white text-xs font-medium truncate">
                                                        {asset.is_upload ? asset.name : asset.generation_name}
                                                    </p>
                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-purple-300 text-xs flex items-center">
                                                            {getAssetIcon(asset)}
                                                        </span>
                                                        <span className="text-purple-300 text-xs">
                                                            {formatDate(asset.created_at)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Selected indicator */}
                                            {selectedAsset?.id === asset.id && (
                                                <div className="absolute top-2 right-2 bg-violet-500 rounded-full p-1">
                                                    <Check className="w-4 h-4 text-white" />
                                                </div>
                                            )}

                                            {/* Favorite button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFavorite(asset.id, asset.is_favorite, asset.is_upload);
                                                }}
                                                className="absolute top-12 left-2 p-1.5 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                            >
                                                <Star
                                                    className={`w-4 h-4 ${asset.is_favorite ? 'text-yellow-400 fill-yellow-400' : 'text-white'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* List View */}
                            {viewMode === 'list' && (
                                <div className="space-y-2">
                                    {filteredAssets.map((asset) => (
                                        <div
                                            key={asset.id}
                                            onClick={() => setSelectedAsset(asset)}
                                            className={`flex items-center space-x-4 p-3 rounded-lg cursor-pointer transition-all ${selectedAsset?.id === asset.id
                                                    ? 'bg-violet-500/30 border border-violet-400'
                                                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                                                }`}
                                        >
                                            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                                {renderThumbnail(asset)}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-2">
                                                    {getAssetIcon(asset)}
                                                    <p className="text-white font-medium truncate">
                                                        {asset.is_upload ? asset.name : asset.generation_name}
                                                    </p>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${asset.is_upload
                                                            ? 'bg-blue-500/30 text-blue-300'
                                                            : 'bg-violet-500/30 text-violet-300'
                                                        }`}>
                                                        {asset.is_upload ? 'Upload' : 'Generated'}
                                                    </span>
                                                </div>
                                                <p className="text-purple-300 text-sm truncate mt-1">
                                                    {asset.is_upload
                                                        ? `Used in: ${asset.used_in || 'N/A'}`
                                                        : (asset.input_data?.prompt || asset.tool_name)
                                                    }
                                                </p>
                                                <p className="text-purple-400 text-xs mt-1">
                                                    {formatDate(asset.created_at)}
                                                </p>
                                            </div>

                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFavorite(asset.id, asset.is_favorite, asset.is_upload);
                                                    }}
                                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                >
                                                    <Star
                                                        className={`w-4 h-4 ${asset.is_favorite ? 'text-yellow-400 fill-yellow-400' : 'text-purple-400'
                                                            }`}
                                                    />
                                                </button>
                                                {selectedAsset?.id === asset.id && (
                                                    <div className="bg-violet-500 rounded-full p-1">
                                                        <Check className="w-4 h-4 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Load More - Only for generations tab */}
                            {activeTab === 'generations' && hasMore && (
                                <div className="flex justify-center mt-6">
                                    <button
                                        onClick={() => setPage(prev => prev + 1)}
                                        disabled={loading}
                                        className="px-6 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Loading...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Load More</span>
                                                <ChevronRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-white/20">
                    <div className="text-purple-300 text-sm">
                        {selectedAsset ? (
                            <span className="flex items-center space-x-2">
                                <span>Selected:</span>
                                <span className="font-medium text-white">
                                    {selectedAsset.is_upload ? selectedAsset.name : selectedAsset.generation_name}
                                </span>
                                {selectedAsset.is_upload && (
                                    <span className="px-2 py-0.5 bg-blue-500/30 text-blue-300 rounded-full text-xs">
                                        Upload
                                    </span>
                                )}
                            </span>
                        ) : (
                            <span>
                                {activeTab === 'generations' && `${filteredAssets.length} generations available`}
                                {activeTab === 'uploads' && `${filteredAssets.length} uploads available`}
                                {activeTab === 'favorites' && `${filteredAssets.length} favorites`}
                            </span>
                        )}
                    </div>

                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSelect}
                            disabled={!selectedAsset}
                            className="px-6 py-2 bg-violet-500 hover:bg-violet-600 disabled:bg-violet-500/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                        >
                            <Check className="w-4 h-4" />
                            <span>Use Selected</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetHistory;
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useDebounce } from '../hooks/useDebounce';
import { toCdnUrl } from '../utils/cdnHelpers';
import OptimizedImage from '../components/OptimizedImage';
import OptimizedVideo from '../components/OptimizedVideo';
import {
    ArrowLeft,
    Download,
    Trash2,
    Search,
    Filter,
    Calendar,
    User,
    RefreshCw,
    X,
    Play,
    Pause,
    Music,
    Video,
    Image as ImageIcon,
    Grid3X3,
    List,
    ChevronLeft,
    ChevronRight,
    Activity,
    Clock,
    ZoomIn,
    Wrench
} from 'lucide-react';

const RecentGenerations = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // State
    const [generations, setGenerations] = useState([]);
    const [filteredGenerations, setFilteredGenerations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterUser, setFilterUser] = useState('');
    const [filterTool, setFilterTool] = useState('all');
    const [filterDateRange, setFilterDateRange] = useState('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [selectedGeneration, setSelectedGeneration] = useState(null);
    const [showViewer, setShowViewer] = useState(false);
    const [uniqueTools, setUniqueTools] = useState([]);
    const [uniqueUsers, setUniqueUsers] = useState([]);
    const [stats, setStats] = useState({
        totalGenerations: 0,
        uniqueUsers: 0,
        totalTokensUsed: 0
    });

    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const debouncedFilterUser = useDebounce(filterUser, 300);

    // Audio player state
    const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);
    
    // Expanded image viewer state
    const [expandedImageIndex, setExpandedImageIndex] = useState(null);
    const [showExpandedImage, setShowExpandedImage] = useState(false);
    const [imageScale, setImageScale] = useState(1);
    const [imageFit, setImageFit] = useState(true); // true = fit to screen, false = actual size

    // Constants
    const ITEMS_PER_PAGE = 12;
    const TOTAL_GENERATIONS = 64;

    // Admin check - matching Admin.jsx pattern
    const adminUUIDs = ['991e17a6-c1a8-4496-8b28-cc83341c028a'];
    const isAdmin = user && (
        adminUUIDs.includes(user.id) ||
        user.email === 'jim@1busyguy.com' ||
        user.user_metadata?.email === 'jim@1busyguy.com'
    );

    // Set auth loading to false after a short delay (matching Admin.jsx pattern)
    useEffect(() => {
        const timer = setTimeout(() => {
            setAuthLoading(false);
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        console.log('🔎 RecentGenerations - checking auth...');
        console.log('User:', user ? { id: user.id, email: user.email } : 'null');
        console.log('Is Admin:', isAdmin);

        // Wait for auth to finish loading
        if (user === null && authLoading) {
            console.log('⏳ Still loading auth, waiting...');
            return;
        }

        setAuthLoading(false);

        if (!user) {
            console.log('❌ No user found, redirecting to login');
            navigate('/login');
            return;
        }

        if (!isAdmin) {
            console.log('❌ User is not admin, redirecting to dashboard');
            navigate('/dashboard');
            return;
        }

        console.log('✅ Admin user verified, fetching recent generations...');
        fetchRecentGenerations();
    }, [user, isAdmin, navigate, authLoading]);

    useEffect(() => {
        applyFilters();
    }, [generations, debouncedSearchTerm, debouncedFilterUser, filterTool, filterDateRange, customStartDate, customEndDate]);

    const fetchRecentGenerations = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-recent-generations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    limit: TOTAL_GENERATIONS
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch generations: ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.generations) {
                setGenerations(result.generations);

                // Extract unique tools and users
                const toolsMap = new Map();
                const usersMap = new Map();
                let totalTokens = 0;

                result.generations.forEach(gen => {
                    if (gen.tool_type && !toolsMap.has(gen.tool_type)) {
                        toolsMap.set(gen.tool_type, gen.tool_name || gen.tool_type);
                    }
                    if (gen.user_email && !usersMap.has(gen.user_email)) {
                        usersMap.set(gen.user_email, gen.user_email);
                    }
                    totalTokens += gen.tokens_used || 0;
                });

                const toolsArray = Array.from(toolsMap.entries())
                    .map(([type, name]) => ({ type, name }))
                    .sort((a, b) => a.name.localeCompare(b.name));

                const usersArray = Array.from(usersMap.keys()).sort();

                setUniqueTools(toolsArray);
                setUniqueUsers(usersArray);

                setStats({
                    totalGenerations: result.generations.length,
                    uniqueUsers: usersMap.size,
                    totalTokensUsed: totalTokens
                });
            }
        } catch (error) {
            console.error('Error fetching recent generations:', error);
            alert('Failed to fetch recent generations');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...generations];

        // Search filter
        if (debouncedSearchTerm) {
            const searchLower = debouncedSearchTerm.toLowerCase();
            filtered = filtered.filter(gen =>
                gen.generation_name?.toLowerCase().includes(searchLower) ||
                gen.tool_name?.toLowerCase().includes(searchLower) ||
                gen.user_email?.toLowerCase().includes(searchLower) ||
                gen.input_data?.prompt?.toLowerCase().includes(searchLower)
            );
        }

        // User filter
        if (debouncedFilterUser) {
            const userLower = debouncedFilterUser.toLowerCase();
            filtered = filtered.filter(gen =>
                gen.user_email?.toLowerCase().includes(userLower)
            );
        }

        // Tool filter
        if (filterTool !== 'all') {
            filtered = filtered.filter(gen => gen.tool_type === filterTool);
        }

        // Date filter
        if (filterDateRange !== 'all') {
            const now = new Date();
            let startDate, endDate;

            switch (filterDateRange) {
                case 'today':
                    startDate = new Date(now.setHours(0, 0, 0, 0));
                    endDate = new Date(now.setHours(23, 59, 59, 999));
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    endDate = new Date();
                    break;
                case 'month':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    endDate = new Date();
                    break;
                case 'custom':
                    if (customStartDate) startDate = new Date(customStartDate);
                    if (customEndDate) endDate = new Date(customEndDate + 'T23:59:59');
                    break;
            }

            if (startDate) {
                filtered = filtered.filter(gen => {
                    const genDate = new Date(gen.created_at);
                    return (!startDate || genDate >= startDate) &&
                        (!endDate || genDate <= endDate);
                });
            }
        }

        setFilteredGenerations(filtered);
        setTotalPages(Math.ceil(filtered.length / ITEMS_PER_PAGE));
        setCurrentPage(1);
    };

    // Paginated data
    const paginatedGenerations = filteredGenerations.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Helper functions
    const getAllImageUrls = (url) => {
        if (!url) return [];

        if (typeof url === 'string' && url.startsWith('[')) {
            try {
                const urlArray = JSON.parse(url);
                return Array.isArray(urlArray) ? urlArray : [url];
            } catch (error) {
                return [url];
            }
        }

        return [url];
    };

    const getVideoPoster = (g) => {
        const c = g?.input_data || {};
        const candidates = [
            g?.thumbnail_url,
            g?.metadata?.thumbnail_url,
            c.thumbnail_url,
            c.imageUrl,
            c.image_url,
            c.input_image_url,
            c.init_image,
            c.image,
        ].filter(Boolean);
        return candidates.length ? toCdnUrl(candidates[0]) : null;
    };

    const getThumbnailForTextVideoTool = (generation) => {
        const textVideoTools = [
            'fal_wan_v22_video2video',
            'fal_kling_pro',
            'fal_minimax_hailuo',
            'fal_veo3_fast',
            'veo3-standard',
            'fal_ltxv',
            'fal_seedance_pro',
            'fal_wan_v22_img2video_lora',
            'fal_wan_v22_text2video_lora',
            'fal_wan22_s2v',
            'fal_omnihuman',
            'fal_mmaudio_video2'
        ];

        if (textVideoTools.includes(generation.tool_type)) {
            return generation.thumbnail_url || null;
        }

        return null;
    };

    const getMediaType = (generation) => {
    const toolType = generation.tool_type;

    // Check for text-to-image tools first (to avoid false matches)
    if (toolType === 'fal_seedream_v4_text2image' || 
        toolType === 'fal_seedream_v4_edit' ||
        toolType === 'fal_flux_kontext' ||
        toolType === 'fal_flux_redux' ||
        toolType?.includes('text2image') ||
        toolType?.includes('image2image')) {
        return 'image';
    }

    if (toolType?.includes('video') || toolType?.includes('kling') || toolType?.includes('wan') ||
        toolType?.includes('minimax') || toolType?.includes('veo') || toolType?.includes('ltxv') ||
        toolType?.includes('seedance') || toolType?.includes('fal_wan_v22_a14b') ||
        toolType?.includes('ai_scene_gen') || toolType?.includes('fal_omnihuman')) {
        return 'video';
    } else if (toolType?.includes('music') || toolType?.includes('cassetteai') ||
        toolType?.includes('mmaudio')) {
        return 'audio';
    } else {
        return 'image';
    }
};

    const getToolIcon = (toolType) => {
        if (toolType?.includes('video') || toolType?.includes('kling') || toolType?.includes('wan') ||
            toolType?.includes('minimax') || toolType?.includes('veo') || toolType?.includes('ltxv') ||
            toolType?.includes('seedance') || toolType?.includes('fal_wan_v22_a14b') ||
            toolType?.includes('ai_scene_gen') || toolType?.includes('fal_omnihuman')) {
            return <Video className="w-4 h-4" />;
        } else if (toolType?.includes('music') || toolType?.includes('cassetteai') ||
            toolType?.includes('mmaudio')) {
            return <Music className="w-4 h-4" />;
        } else {
            return <ImageIcon className="w-4 h-4" />;
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

    const formatConfigValue = (key, value) => {
        const keyLower = String(key || '').toLowerCase();

        if (keyLower.includes('lora')) {
            const extractLoraTitle = (item) => {
                if (!item) return '';
                const maybe = item.title || item.name || item.modelName || item.displayName || item.weight_name;
                if (maybe && typeof maybe === 'string') return maybe;
                const url = item.path || item.url || item.href;
                if (typeof url === 'string') {
                    try {
                        const u = new URL(url);
                        const last = (u.pathname || '').split('/').pop() || '';
                        if (/^\d+$/.test(last)) return `#${last}`;
                        return decodeURIComponent(last.split('?')[0].split('#')[0]);
                    } catch {
                        if (url.includes('/')) {
                            const last = url.split('/').pop();
                            return decodeURIComponent(last.split('?')[0].split('#')[0]);
                        }
                    }
                }
                try { return JSON.stringify(item); } catch { return String(item); }
            };

            try {
                const parsed = (typeof value === 'string' && value.trim().startsWith('[')) ? JSON.parse(value) : value;
                if (Array.isArray(parsed)) return parsed.map(extractLoraTitle).filter(Boolean).join(', ');
                if (parsed && typeof parsed === 'object') return extractLoraTitle(parsed);
                return typeof value === 'string' ? value : String(value);
            } catch {
                return typeof value === 'string' ? value : String(value);
            }
        }

        if (typeof value === 'string' && (/^https?:\/\//i.test(value) || /url/i.test(key))) {
            try {
                const u = new URL(value);
                const last = (u.pathname || '').split('/').pop() || '';
                return decodeURIComponent(last.split('?')[0].split('#')[0]) || value;
            } catch {
                if (value.includes('/')) {
                    const last = value.split('/').pop();
                    return decodeURIComponent(last.split('?')[0].split('#')[0]);
                }
                return value;
            }
        }

        return typeof value === 'object' ? JSON.stringify(value) : String(value);
    };

    const handleDownload = async (generation) => {
        if (!generation || !generation.output_file_url) {
            alert('No file available for download');
            return;
        }

        const imageUrls = getAllImageUrls(generation.output_file_url);

        if (imageUrls.length > 1) {
            await downloadMultipleImagesAsZip(imageUrls, generation.generation_name);
            return;
        }

        try {
            const response = await fetch(toCdnUrl(generation.output_file_url));
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            let extension = 'jpg';
            if (getMediaType(generation) === 'video') {
                extension = 'mp4';
            } else if (getMediaType(generation) === 'audio') {
                extension = 'mp3';
            }

            link.download = `${generation.generation_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Download failed. Please try again.');
        }
    };

    const downloadMultipleImagesAsZip = async (imageUrls, generationName) => {
        try {
            const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
            const zip = new JSZip();

            for (let i = 0; i < imageUrls.length; i++) {
                try {
                    const response = await fetch(toCdnUrl(imageUrls[i]));
                    if (!response.ok) continue;

                    const blob = await response.blob();
                    const filename = `image_${i + 1}.jpg`;
                    zip.file(filename, blob);
                } catch (error) {
                    console.warn(`Error downloading image ${i + 1}:`, error);
                }
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = window.URL.createObjectURL(zipBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${generationName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_images.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Zip creation failed:', error);
            alert('Failed to create zip file.');
        }
    };

    const handlePermanentDelete = async (generation) => {
        if (!confirm(`Are you sure you want to PERMANENTLY delete "${generation.generation_name}"? This cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-permanent-delete`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ generationId: generation.id })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Delete failed');
            }

            setGenerations(prev => prev.filter(g => g.id !== generation.id));
            setFilteredGenerations(prev => prev.filter(g => g.id !== generation.id));

            alert('Generation permanently deleted');
        } catch (error) {
            console.error('Error deleting generation:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const handlePlay = (generation) => {
        if (currentlyPlaying === generation.id && isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
        } else {
            if (currentlyPlaying !== generation.id) {
                setCurrentlyPlaying(generation.id);
            }
            audioRef.current?.play();
            setIsPlaying(true);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
                <div className="text-white text-xl flex items-center space-x-3">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span>{authLoading ? 'Authenticating...' : 'Loading recent generations...'}</span>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
                <div className="text-center">
                    <Activity className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
                    <p className="text-purple-200">You don't have permission to access this page.</p>
                </div>
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
                                onClick={() => navigate('/admin')}
                                className="flex items-center space-x-2 text-purple-200 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                <span>Back to Admin</span>
                            </button>
                            <div className="h-6 w-px bg-white/20"></div>
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                                    <Activity className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">Recent Generations</h1>
                                    <p className="text-purple-200 text-sm">Last {TOTAL_GENERATIONS} generations across all users</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={fetchRecentGenerations}
                            className="flex items-center space-x-2 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats Cards */}
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                                <Activity className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Total Shown</h3>
                                <p className="text-2xl font-bold text-blue-400">{stats.totalGenerations}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                                <User className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Unique Users</h3>
                                <p className="text-2xl font-bold text-green-400">{stats.uniqueUsers}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center">
                                <Wrench className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Tokens Used</h3>
                                <p className="text-2xl font-bold text-yellow-400">{stats.totalTokensUsed.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-8">
                    <div className="space-y-4">
                        {/* Search and User Filter */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search generations..."
                                    className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            <div className="relative">
                                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    value={filterUser}
                                    onChange={(e) => setFilterUser(e.target.value)}
                                    placeholder="Filter by user email..."
                                    className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                        </div>

                        {/* Tool and Date Filters */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <select
                                value={filterTool}
                                onChange={(e) => setFilterTool(e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 [&>option]:bg-gray-800"
                            >
                                <option value="all">All Tools</option>
                                {uniqueTools.map(tool => (
                                    <option key={tool.type} value={tool.type}>{tool.name}</option>
                                ))}
                            </select>

                            <select
                                value={filterDateRange}
                                onChange={(e) => setFilterDateRange(e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 [&>option]:bg-gray-800"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="week">Last 7 Days</option>
                                <option value="month">Last 30 Days</option>
                                <option value="custom">Custom Range</option>
                            </select>
                        </div>

                        {/* Custom Date Range */}
                        {filterDateRange === 'custom' && (
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-purple-200 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-purple-200 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>
                        )}

                        {/* View Mode and Results Info */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded-lg transition-colors ${viewMode === 'grid'
                                            ? 'bg-purple-500 text-white'
                                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                                        }`}
                                >
                                    <Grid3X3 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded-lg transition-colors ${viewMode === 'list'
                                            ? 'bg-purple-500 text-white'
                                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                                        }`}
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="text-purple-200 text-sm">
                                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-
                                {Math.min(currentPage * ITEMS_PER_PAGE, filteredGenerations.length)} of {filteredGenerations.length} filtered
                            </div>
                        </div>
                    </div>
                </div>

                {/* Generations Grid/List */}
                {paginatedGenerations.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ImageIcon className="w-8 h-8 text-purple-300" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">No generations found</h3>
                        <p className="text-purple-200">
                            Try adjusting your filters or search terms
                        </p>
                    </div>
                ) : (
                    <>
                        <div className={`${viewMode === 'grid'
                                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                                : 'space-y-4'
                            }`}>
                            {paginatedGenerations.map((generation) => {
                                const mediaType = getMediaType(generation);
                                const imageUrls = getAllImageUrls(generation.output_file_url);
                                const primaryUrl = imageUrls[0];
                                const thumbnailUrl = getThumbnailForTextVideoTool(generation);

                                return (
                                    <div
                                        key={generation.id}
                                        className={`bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-all duration-200 cursor-pointer ${viewMode === 'list' ? 'flex items-center space-x-4 p-4' : ''
                                            }`}
                                        onClick={() => {
                                            setSelectedGeneration(generation);
                                            setShowViewer(true);
                                        }}
                                    >
                                        {/* Media Thumbnail */}
                                        <div className={`relative ${viewMode === 'list' ? 'w-24 h-24 flex-shrink-0' : 'w-full h-48'}`}>
                                            {primaryUrl ? (
                                                mediaType === 'video' ? (
                                                    thumbnailUrl ? (
                                                        <OptimizedImage
                                                            src={thumbnailUrl}
                                                            alt={generation.generation_name}
                                                            className="w-full h-full object-cover rounded-lg"
                                                        />
                                                    ) : (
                                                        <OptimizedVideo
                                                            src={toCdnUrl(primaryUrl)}
                                                            poster={getVideoPoster(generation)}
                                                            className="w-full h-full object-cover rounded-lg"
                                                            controls={false}
                                                            preload="metadata"
                                                            muted={true}
                                                            playsInline={true}
                                                        />
                                                    )
                                                ) : mediaType === 'audio' ? (
                                                    <div className="w-full h-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-lg flex items-center justify-center">
                                                        <div className="text-center">
                                                            <Music className="w-8 h-8 text-pink-400 mx-auto mb-2" />
                                                            <p className="text-pink-300 text-xs">Audio Track</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <OptimizedImage
                                                        src={primaryUrl}
                                                        alt={generation.generation_name}
                                                        className="w-full h-full object-cover rounded-lg"
                                                    />
                                                )
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center">
                                                    {getToolIcon(generation.tool_type)}
                                                </div>
                                            )}

                                            {/* Multiple images indicator */}
                                            {imageUrls.length > 1 && (
                                                <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded-lg text-xs font-medium">
                                                    +{imageUrls.length - 1} more
                                                </div>
                                            )}

                                            {/* Status badge */}
                                            <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(generation.status)}`}>
                                                {generation.status}
                                            </div>

                                            {/* Play button for audio */}
                                            {mediaType === 'audio' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handlePlay(generation);
                                                    }}
                                                    className={`absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${currentlyPlaying === generation.id && isPlaying
                                                            ? 'bg-pink-500 text-white'
                                                            : 'bg-black/50 text-white hover:bg-pink-500'
                                                        }`}
                                                >
                                                    {currentlyPlaying === generation.id && isPlaying ?
                                                        <Pause className="w-4 h-4" /> :
                                                        <Play className="w-4 h-4 ml-0.5" />
                                                    }
                                                </button>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className={`${viewMode === 'list' ? 'flex-1' : 'p-4'}`}>
                                            <h3 className={`font-medium text-white truncate mb-1 ${viewMode === 'list' ? 'text-base' : 'text-sm'}`}>
                                                {generation.generation_name}
                                            </h3>

                                            <div className="space-y-1 text-xs text-purple-200">
                                                <div className="flex items-center space-x-2">
                                                    <User className="w-3 h-3" />
                                                    <span className="truncate">{generation.user_email}</span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    {getToolIcon(generation.tool_type)}
                                                    <span className="truncate">{generation.tool_name}</span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{formatDate(generation.created_at)}</span>
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex space-x-2 mt-3">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownload(generation);
                                                    }}
                                                    className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors"
                                                    title="Download"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handlePermanentDelete(generation);
                                                    }}
                                                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                                                    title="Permanent Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-8">
                                <button
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>

                                <div className="flex items-center space-x-1">
                                    {[...Array(totalPages)].map((_, i) => {
                                        const page = i + 1;
                                        const isActive = page === currentPage;
                                        const isNearCurrent = Math.abs(page - currentPage) <= 2;
                                        const isFirst = page === 1;
                                        const isLast = page === totalPages;

                                        if (!isActive && !isNearCurrent && !isFirst && !isLast) {
                                            if (page === 2 || page === totalPages - 1) {
                                                return <span key={page} className="text-purple-300 px-2">...</span>;
                                            }
                                            return null;
                                        }

                                        return (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`w-10 h-10 rounded-lg font-medium transition-colors ${isActive
                                                        ? 'bg-purple-500 text-white'
                                                        : 'bg-white/10 hover:bg-white/20 text-purple-200'
                                                    }`}
                                            >
                                                {page}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Generation Viewer Modal */}
            {showViewer && selectedGeneration && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white">{selectedGeneration.generation_name}</h3>
                                <button
                                    onClick={() => setShowViewer(false)}
                                    className="text-purple-400 hover:text-purple-300 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* User Info */}
                            <div className="bg-white/5 rounded-lg p-4 mb-6">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                                        <User className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">{selectedGeneration.user_email}</p>
                                        <p className="text-purple-300 text-sm">User ID: {selectedGeneration.user_id}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Media Display */}
                            {selectedGeneration.output_file_url && getAllImageUrls(selectedGeneration.output_file_url).length > 0 && (
                                <div className="mb-6">
                                    {getMediaType(selectedGeneration) === 'video' ? (
                                        selectedGeneration.thumbnail_url ? (
                                            <div className="space-y-4">
                                                <OptimizedImage
                                                    src={toCdnUrl(selectedGeneration.thumbnail_url)}
                                                    alt={`${selectedGeneration.generation_name} thumbnail`}
                                                    className="w-full max-h-96 object-contain rounded-lg"
                                                />
                                                <OptimizedVideo
                                                    src={getAllImageUrls(selectedGeneration.output_file_url)[0]}
                                                    className="w-full max-h-96 rounded-lg"
                                                    poster={selectedGeneration.thumbnail_url}
                                                    controls={true}
                                                    preload="metadata"
                                                />
                                            </div>
                                        ) : (
                                            <OptimizedVideo
                                                src={getAllImageUrls(selectedGeneration.output_file_url)[0]}
                                                className="w-full max-h-96 rounded-lg"
                                                poster={getVideoPoster(selectedGeneration)}
                                                controls={true}
                                                preload="metadata"
                                            />
                                        )
                                    ) : getMediaType(selectedGeneration) === 'audio' ? (
                                        <div className="w-full h-64 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-lg flex items-center justify-center">
                                            <div className="text-center">
                                                <div className="w-24 h-24 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Music className="w-12 h-12 text-white" />
                                                </div>
                                                <h4 className="text-white font-semibold text-lg mb-2">Audio Track</h4>
                                                <audio
                                                    src={toCdnUrl(selectedGeneration.output_file_url)}
                                                    controls
                                                    className="w-full max-w-md mx-auto"
                                                    preload="metadata"
                                                />
                                            </div>
                                        </div>
                                    ) : getAllImageUrls(selectedGeneration.output_file_url).length === 1 ? (
                                        <div
                                            className="cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => {
                                                setExpandedImageIndex(0);
                                                setShowExpandedImage(true);
                                            }}
                                        >
                                            <OptimizedImage
                                                src={getAllImageUrls(selectedGeneration.output_file_url)[0]}
                                                alt={selectedGeneration.generation_name}
                                                className="w-full max-h-96 object-contain rounded-lg"
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <h4 className="text-lg font-semibold text-white mb-3">
                                                Generated Images ({getAllImageUrls(selectedGeneration.output_file_url).length})
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                {getAllImageUrls(selectedGeneration.output_file_url).map((url, index) => (
                                                    <div
                                                        key={index}
                                                        className="cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => {
                                                            setExpandedImageIndex(index);
                                                            setShowExpandedImage(true);
                                                        }}
                                                    >
                                                        <OptimizedImage
                                                            src={url}
                                                            alt={`${selectedGeneration.generation_name} - Image ${index + 1}`}
                                                            className="w-full h-48 object-cover rounded-lg"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Details and Configuration */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <h4 className="text-lg font-semibold text-white mb-3">Generation Details</h4>
                                    <div className="space-y-3 text-sm">
                                        <div className="grid grid-cols-12 gap-3 items-center">
                                            <span className="col-span-5 text-purple-200">Status</span>
                                            <span className="col-span-7 justify-self-end">
                                                <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(selectedGeneration.status)}`}>
                                                    {selectedGeneration.status}
                                                </span>
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-12 gap-3 items-center">
                                            <span className="col-span-5 text-purple-200">Tool</span>
                                            <span className="col-span-7 text-white justify-self-end text-right break-words">
                                                {selectedGeneration.tool_name}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-12 gap-3 items-center">
                                            <span className="col-span-5 text-purple-200">Tokens Used</span>
                                            <span className="col-span-7 text-white justify-self-end text-right">
                                                {selectedGeneration.tokens_used}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-12 gap-3 items-start">
                                            <span className="col-span-5 text-purple-200">Created</span>
                                            <span className="col-span-7 text-white justify-self-end text-right break-words">
                                                {new Date(selectedGeneration.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <h4 className="text-lg font-semibold text-white mb-3">Configuration</h4>
                                    <div className="space-y-3 text-sm max-h-64 overflow-y-auto">
                                        {selectedGeneration.input_data && Object.entries(selectedGeneration.input_data).map(([key, value]) => {
                                            const label = key.replace(/([A-Z])/g, ' $1').trim();
                                            const displayValue = formatConfigValue(key, value);
                                            const isLongText = ['prompt', 'negativeprompt', 'description'].includes(key.toLowerCase());
                                            return (
                                                <div key={key} className="grid grid-cols-12 gap-3 items-start">
                                                    <span className="col-span-5 text-purple-200 capitalize">{label}:</span>
                                                    <span
                                                        className={`col-span-7 justify-self-end text-right break-words ${isLongText ? 'whitespace-pre-wrap bg-black/20 border border-white/10 rounded-md px-3 py-2 text-white' : 'text-white'
                                                            }`}
                                                        title={typeof value === 'string' ? value : undefined}
                                                    >
                                                        {displayValue}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => handleDownload(selectedGeneration)}
                                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Download</span>
                                </button>
                                <button
                                    onClick={() => {
                                        handlePermanentDelete(selectedGeneration);
                                        setShowViewer(false);
                                    }}
                                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Permanent Delete</span>
                                </button>
                                <button
                                    onClick={() => setShowViewer(false)}
                                    className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Audio Element */}
            {currentlyPlaying && (
                <audio
                    ref={audioRef}
                    src={toCdnUrl(generations.find(g => g.id === currentlyPlaying)?.output_file_url)}
                    onError={(e) => {
                        console.error('Audio playback error:', e);
                        setIsPlaying(false);
                        setCurrentlyPlaying(null);
                    }}
                />
            )}

            {/* Expanded Image Viewer */}
            {showExpandedImage && selectedGeneration && expandedImageIndex !== null && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4 overflow-auto">
                    <div className="relative w-full min-h-full flex items-center justify-center py-20">
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
                                <ZoomIn className={`w-5 h-5 ${!imageFit && 'rotate-180'}`} />
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

                        {/* Navigation Arrows */}
                        {getAllImageUrls(selectedGeneration.output_file_url).length > 1 && (
                            <>
                                <button
                                    onClick={() => {
                                        const imageUrls = getAllImageUrls(selectedGeneration.output_file_url);
                                        setExpandedImageIndex((expandedImageIndex - 1 + imageUrls.length) % imageUrls.length);
                                    }}
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                                
                                <button
                                    onClick={() => {
                                        const imageUrls = getAllImageUrls(selectedGeneration.output_file_url);
                                        setExpandedImageIndex((expandedImageIndex + 1) % imageUrls.length);
                                    }}
                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                                >
                                    <ChevronRight className="w-6 h-6" />
                                </button>
                            </>
                        )}

                        {/* Expanded Image */}
                        <OptimizedImage
                            src={getAllImageUrls(selectedGeneration.output_file_url)[expandedImageIndex]}
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

                        {/* Image Counter */}
                        {getAllImageUrls(selectedGeneration.output_file_url).length > 1 && (
                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
                                {expandedImageIndex + 1} of {getAllImageUrls(selectedGeneration.output_file_url).length}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecentGenerations;
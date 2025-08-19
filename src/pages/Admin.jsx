import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useDebounce } from '../hooks/useDebounce';
import { toCdnUrl } from '../utils/cdnHelpers';
import OptimizedImage from '../components/OptimizedImage';
import OptimizedVideo from '../components/OptimizedVideo';
import {
    ArrowLeft,
    Users,
    Database,
    Activity,
    AlertTriangle,
    RefreshCw,
    Eye,
    Trash2,
    Download,
    ChevronDown,
    ChevronUp,
    Search,
    Filter,
    BarChart3,
    Zap,
    CreditCard,
    Calendar,
    Mail,
    User,
    Shield,
    X,
    Star,
    Music,
    Play,
    Pause,
    Volume2,
    VolumeX,
    ZoomIn,
    Archive,
    Video,
    Grid3X3,
    List,
    Image as ImageIcon,
    SortAsc,
    SortDesc,
    Flag
} from 'lucide-react';

const Admin = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { userId: routeUserId } = useParams();

    // State
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('generations-desc');
    const [selectedUser, setSelectedUser] = useState(null);
    const [userGenerations, setUserGenerations] = useState([]);
    const [loadingGenerations, setLoadingGenerations] = useState(false);
    const [selectedGeneration, setSelectedGeneration] = useState(null);
    const [enlargedImage, setEnlargedImage] = useState(null);
    const [showEnlargedModal, setShowEnlargedModal] = useState(false);
    const [showBanModal, setShowBanModal] = useState(false);
    const [banningUser, setBanningUser] = useState(null);
    const [banReason, setBanReason] = useState('');
    const [processingBan, setProcessingBan] = useState(false);
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalGenerations: 0,
        activeSubscriptions: 0,
        totalTokensUsed: 0
    });

    // New state for enhanced admin features
    const [viewMode, setViewMode] = useState('user-list'); // 'user-list' or 'user-generations'
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [filterTool, setFilterTool] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [generationViewMode, setGenerationViewMode] = useState('grid');
    const [showViewer, setShowViewer] = useState(false);
    const [allUniqueTools, setAllUniqueTools] = useState([]);

    // Audio player state
    const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.7);
    const [isMuted, setIsMuted] = useState(false);
    const audioRef = React.useRef(null);

    // Pagination settings
    const ITEMS_PER_PAGE = 20;

    // Helper function to get all image URLs from a generation
    const getAllImageUrls = (url) => {
        if (!url) return [];
        
        // Handle JSON array format from FLUX tools
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

    // Helper function to get primary image URL
    const getPrimaryImageUrl = (url) => {
        const urls = getAllImageUrls(url);
        return urls.length > 0 ? urls[0] : null;
    };

    // Helper function to get video poster/thumbnail
    const getVideoPoster = (generation) => {
        // Check if there's an input image that can be used as poster
        if (generation.input_data?.imageUrl) {
            return toCdnUrl(generation.input_data.imageUrl);
        }
        if (generation.input_data?.image_url) {
            return toCdnUrl(generation.input_data.image_url);
        }
        if (generation.input_data?.input_image_url) {
            return toCdnUrl(generation.input_data.input_image_url);
        }
        if (generation.input_data?.init_image) {
            return toCdnUrl(generation.input_data.init_image);
        }
        if (generation.input_data?.image) {
            return toCdnUrl(generation.input_data.image);
        }
        // Return null if no poster available
        return null;
    };

    // Component for video thumbnail with iOS fallback
    const VideoThumbnail = ({ generation, className }) => {
        const [showFallback, setShowFallback] = useState(false);
        const [videoFrame, setVideoFrame] = useState(null);
        const videoRef = React.useRef(null);
        const poster = getVideoPoster(generation);
        
        // Detect iOS devices
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        // Try to capture a frame from the video for text-to-video tools
        React.useEffect(() => {
            if (!poster && !isIOS && generation.output_file_url && !showFallback && !videoFrame) {
                const video = document.createElement('video');
                video.src = toCdnUrl(generation.output_file_url);
                video.crossOrigin = 'anonymous';
                video.muted = true;
                video.playsInline = true;
                
                const captureFrame = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(video, 0, 0);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                        setVideoFrame(dataUrl);
                        video.remove();
                    } catch (error) {
                        console.warn('Could not capture video frame:', error);
                        setShowFallback(true);
                        video.remove();
                    }
                };
                
                video.addEventListener('loadeddata', () => {
                    video.currentTime = 0.1; // Seek to 0.1 seconds to get a better frame
                });
                
                video.addEventListener('seeked', captureFrame);
                
                video.addEventListener('error', () => {
                    setShowFallback(true);
                    video.remove();
                });
                
                // Set timeout to prevent hanging
                const timeout = setTimeout(() => {
                    setShowFallback(true);
                    video.remove();
                }, 5000);
                
                video.load();
                
                return () => {
                    clearTimeout(timeout);
                    video.remove();
                };
            }
        }, [poster, isIOS, generation.output_file_url, showFallback, videoFrame]);
        
        // For iOS or when fallback is needed
        if (showFallback || (isIOS && !poster && !videoFrame)) {
            return (
                <div className={`${className} bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                </div>
            );
        }
        
        // Use poster, video frame, or actual video element
        if (poster || videoFrame) {
            return (
                <div className="relative">
                    <img
                        src={poster || videoFrame}
                        alt={generation.generation_name}
                        className={className}
                        onError={() => setShowFallback(true)}
                        loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                </div>
            );
        }
        
        // Default video element for non-iOS devices when no poster/frame available
        return (
            <div className="relative">
                <video
                    ref={videoRef}
                    src={toCdnUrl(generation.output_file_url)}
                    className={className}
                    muted
                    playsInline
                    webkit-playsinline="true"
                    preload="metadata"
                    crossOrigin="anonymous"
                    onLoadedMetadata={(e) => {
                        // Try to seek to get a thumbnail
                        if (e.target.duration > 0) {
                            e.target.currentTime = Math.min(0.1, e.target.duration * 0.1);
                        }
                    }}
                    onError={() => setShowFallback(true)}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </div>
            </div>
        );
    };

    // Helper function to detect video tools
    const isVideoTool = (toolType) => {
        const videoTools = [
            'fal_wan_pro', 
            'wan22_pro',
            'fal_minimax_hailuo',
            'fal_seedance_pro',
            'ai_scene_gen',
            'fal_omnihuman',
            'fal_mmaudio_video2',
            'fal_wan_v22_a14b',
            'fal_kling_pro',
            'fal_veo2',
            'fal_ltxv',
            'fal_video_upscaler',
            'fal_veo3_fast',
            'fal_wan_v22_text2video_lora',
            'fal_wan_v22_img2video_lora',
            'fal_wan_v22_video2video'
        ];
        
        return videoTools.includes(toolType) || 
               toolType?.includes('video') || 
               toolType?.includes('wan') || 
               toolType?.includes('kling') || 
               toolType?.includes('minimax') || 
               toolType?.includes('veo') || 
               toolType?.includes('ltxv') || 
               toolType?.includes('fal_wan_v22_a14b') || 
               toolType?.includes('fal_seedance_pro') ||
               toolType?.includes('fal_wan_v22_text2video_lora') || 
               toolType?.includes('fal_wan_v22_img2video_lora') || 
               toolType?.includes('fal_wan_v22_video2video') || 
               toolType?.includes('ai_scene_gen') || 
               toolType?.includes('fal_omnihuman') || 
               toolType?.includes('fal_mmaudio_video2');
    };

    // Helper function to detect music tools
    const isMusicTool = (toolType) => {
        const musicTools = [
            'fal_cassetteai_music',
            'fal_mmaudio_v2'
        ];
        
        return musicTools.includes(toolType) || 
               toolType?.includes('music') || 
               toolType?.includes('fal_cassetteai_music') ||
               toolType?.includes('fal_mmaudio_v2');
    };

    const isAudioType = (toolType) => {
        return toolType?.includes('music') || 
               toolType?.includes('fal_cassetteai_music') || 
               toolType?.includes('fal_mmaudio_v2');
    };

    // Helper function to determine media type
    const getMediaType = (generation) => {
        const toolType = generation.tool_type;
        
        if (toolType?.includes('video') || toolType?.includes('kling') || toolType?.includes('wan') || 
            toolType?.includes('minimax') || toolType?.includes('veo') || toolType?.includes('ltxv') || 
            toolType?.includes('seedance') || toolType?.includes('fal_wan_v22_a14b') || 
            toolType?.includes('ai_scene_gen') || toolType?.includes('fal_omnihuman')) {
          return 'video';
        } else if (toolType?.includes('music') || toolType?.includes('cassetteai')) {
          return 'audio';
        } else {
          return 'image';
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

    const getToolIcon = (toolType) => {
        if (toolType?.includes('video') || toolType?.includes('kling') || toolType?.includes('wan') || 
            toolType?.includes('minimax') || toolType?.includes('veo') || toolType?.includes('ltxv') || 
            toolType?.includes('seedance') || toolType?.includes('fal_wan_v22_a14b') || 
            toolType?.includes('ai_scene_gen') || toolType?.includes('fal_omnihuman')) {
          return <Video className="w-4 h-4" />;
        } else if (toolType?.includes('music') || toolType?.includes('cassetteai')) {
          return <Music className="w-4 h-4" />;
        } else {
          return <ImageIcon className="w-4 h-4" />;
        }
    };

    // Admin check
    const adminUUIDs = ['991e17a6-c1a8-4496-8b28-cc83341c028a'];
    const isAdmin = user && (
        adminUUIDs.includes(user.id) ||
        user.email === 'jim@1busyguy.com' ||
        user.user_metadata?.email === 'jim@1busyguy.com'
    );

    // Ban reasons dropdown options
    const banReasons = [
        'Inappropriate content generation',
        'Violation of terms of service',
        'Abuse of AI tools',
        'Sexualization of Children prompting',
        'NSFW content violations',
        'Harassment or abuse',
        'Copyright infringement',
        'Fraudulent activity',
        'Multiple account violations',
        'Other policy violations'
    ];

    // Debug logging for admin check
    console.log('🔍 Admin check debug:', {
        hasUser: !!user,
        userId: user?.id,
        userEmail: user?.email,
        metadataEmail: user?.user_metadata?.email,
        isInAdminUUIDs: user ? adminUUIDs.includes(user.id) : false,
        isAdmin: isAdmin
    });

    // Audio player effects
    React.useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration);
        const handleEnded = () => {
          setIsPlaying(false);
          setCurrentTime(0);
          setCurrentlyPlaying(null);
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
    React.useEffect(() => {
        if (audioRef.current) {
          audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    // Check if we're viewing a specific user's generations
    React.useEffect(() => {
        if (routeUserId && isAdmin) {
          setViewMode('user-generations');
          const user = users.find(u => u.id === routeUserId);
          if (user) {
            setSelectedUser(user);
            fetchUserGenerations(routeUserId);
          }
        }
    }, [routeUserId, users, isAdmin]);

    useEffect(() => {
        console.log('🔍 Admin useEffect - checking auth...');
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

        // Reset modal states when navigating between views
        setSelectedGeneration(null);
        setShowViewer(false);

        console.log('✅ Admin user verified, fetching users...');
        fetchUsers();
    }, [user, isAdmin, navigate, routeUserId]);

    // Separate effect to handle auth loading state
    useEffect(() => {
        // Set auth loading to false after a short delay to ensure auth hook has time to load
        const timer = setTimeout(() => {
            setAuthLoading(false);
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        filterAndSortUsers();
    }, [users, searchTerm, sortBy]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            console.log('🔍 Fetching users from admin endpoint...');

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-users`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Admin API error: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ Admin API response:', result);

            if (result.success && result.users) {
                setUsers(result.users);

                // Calculate stats
                const totalGenerations = result.users.reduce((sum, user) => sum + (user.generation_count || 0), 0);
                const activeSubscriptions = result.users.filter(user =>
                    user.subscriptions?.some(sub => sub.status === 'active')
                ).length;
                const totalTokensUsed = result.users.reduce((sum, user) =>
                    sum + (user.generation_count || 0) * 10, 0 // Estimate 10 tokens per generation
                );

                setStats({
                    totalUsers: result.users.length,
                    totalGenerations,
                    activeSubscriptions,
                    totalTokensUsed
                });

                console.log('📊 Stats calculated:', {
                    totalUsers: result.users.length,
                    totalGenerations,
                    activeSubscriptions
                });
            } else {
                throw new Error('Invalid response from admin API');
            }
        } catch (error) {
            console.error('❌ Error fetching users:', error);
            alert(`Error fetching users: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const filterAndSortUsers = () => {
        let filtered = [...users];

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(user =>
                user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.username?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'email-asc':
                    return (a.email || '').localeCompare(b.email || '');
                case 'email-desc':
                    return (b.email || '').localeCompare(a.email || '');
                case 'created-asc':
                    return new Date(a.created_at) - new Date(b.created_at);
                case 'created-desc':
                    return new Date(b.created_at) - new Date(a.created_at);
                case 'tokens-asc':
                    return ((a.tokens || 0) + (a.purchased_tokens || 0)) - ((b.tokens || 0) + (b.purchased_tokens || 0));
                case 'tokens-desc':
                    return ((b.tokens || 0) + (b.purchased_tokens || 0)) - ((a.tokens || 0) + (a.purchased_tokens || 0));
                case 'generations-asc':
                    return (a.generation_count || 0) - (b.generation_count || 0);
                case 'generations-desc':
                default:
                    return (b.generation_count || 0) - (a.generation_count || 0);
            }
        });

        setFilteredUsers(filtered);
    };

    const fetchUserGenerations = async (userId, page = 1) => {
        setLoadingGenerations(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-user-generations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch generations: ${response.status}`);
            }

            const result = await response.json();
            if (result.success) {
                // The edge function returns generations in result.generations
                const generations = result.generations || [];
                console.log('📊 Processing generations:', {
                    total: generations.length,
                    active: generations.filter(g => !g.deleted_at).length,
                    softDeleted: generations.filter(g => g.deleted_at).length
                });
                
                setUserGenerations(generations);
                setTotalPages(Math.ceil(generations.length / ITEMS_PER_PAGE));
                
                // Get unique tools for filtering
                const uniqueToolsMap = new Map();
                generations.forEach(gen => {
                  if (gen.tool_type && !uniqueToolsMap.has(gen.tool_type)) {
                    uniqueToolsMap.set(gen.tool_type, gen.tool_name || gen.tool_type);
                  }
                });
                
                const uniqueToolsArray = Array.from(uniqueToolsMap.entries())
                  .map(([type, name]) => ({ type, name }))
                  .sort((a, b) => a.name.localeCompare(b.name));
                
                setAllUniqueTools(uniqueToolsArray);
            } else {
                throw new Error(result.error || 'Failed to fetch generations');
            }
        } catch (error) {
            console.error('Error fetching user generations:', error);
            alert(`Error fetching generations: ${error.message}`);
            setUserGenerations([]); // Clear generations on error
        } finally {
            setLoadingGenerations(false);
        }
    };

    const handleViewUser = (user) => {
        navigate(`/admin/user/${user.id}`);
    };

    const handleBackToAdmin = () => {
        // Clear all modal states before navigating
        setSelectedGeneration(null);
        setShowViewer(false);
        setCurrentlyPlaying(null);
        setIsPlaying(false);
        
        navigate('/admin');
    };

    // Memoized filtered and sorted generations for performance
    const filteredGenerations = React.useMemo(() => {
        let filtered = userGenerations;

        // Apply search filter
        if (debouncedSearchTerm) {
          const searchLower = debouncedSearchTerm.toLowerCase();
          filtered = filtered.filter(gen => 
            gen.generation_name?.toLowerCase().includes(searchLower) ||
            gen.tool_name?.toLowerCase().includes(searchLower) ||
            gen.input_data?.prompt?.toLowerCase().includes(searchLower)
          );
        }

        // Apply tool filter
        if (filterTool !== 'all') {
          filtered = filtered.filter(gen => gen.tool_type === filterTool);
        }

        // Apply status filter
        if (filterStatus !== 'all') {
          filtered = filtered.filter(gen => gen.status === filterStatus);
        }

        // Apply sorting
        return filtered.sort((a, b) => {
          switch (sortBy) {
            case 'name':
              return a.generation_name?.localeCompare(b.generation_name || '') || 0;
            case 'tool':
              return a.tool_name?.localeCompare(b.tool_name || '') || 0;
            case 'tokens':
              return (b.tokens_used || 0) - (a.tokens_used || 0);
            case 'status':
              return a.status?.localeCompare(b.status || '') || 0;
            case 'date':
            default:
              return new Date(b.created_at) - new Date(a.created_at);
          }
        });
    }, [userGenerations, debouncedSearchTerm, filterTool, filterStatus, sortBy]);

    // Paginated generations
    const paginatedGenerations = React.useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredGenerations.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredGenerations, currentPage]);

    // Audio player functions
    const handlePlay = (generation) => {
        if (currentlyPlaying === generation.id && isPlaying) {
          audioRef.current?.pause();
          setIsPlaying(false);
        } else {
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

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    const formatTime = (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleFlagGeneration = async (generation) => {
        if (!confirm(`Flag "${generation.generation_name}" for review?`)) return;

        try {
            // Update generation with flag
            const { error } = await supabase
                .from('ai_generations')
                .update({
                    metadata: {
                        ...generation.metadata,
                        flagged: true,
                        flagged_at: new Date().toISOString(),
                        flagged_by: user.id,
                        flag_reason: 'Admin review'
                    }
                })
                .eq('id', generation.id);

            if (error) throw error;

            // Refresh the generations list
            fetchUserGenerations(selectedUser.id);
            alert('Generation flagged for review');
        } catch (error) {
            console.error('Error flagging generation:', error);
            alert(`Error flagging generation: ${error.message}`);
        }
    };

    const handleBanUser = (userToBan) => {
        setBanningUser(userToBan);
        setBanReason('');
        setShowBanModal(true);
    };

    const handleUnbanUser = async (userToUnban) => {
        if (!confirm(`Are you sure you want to unban ${userToUnban.email}?`)) return;

        setProcessingBan(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-ban-user`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userToUnban.id,
                    action: 'unban'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to unban user');
            }

            const result = await response.json();
            console.log('✅ User unbanned successfully:', result);

            // Update local state
            setUsers(current => 
                current.map(u => 
                    u.id === userToUnban.id 
                        ? { ...u, banned: false, ban_reason: null, banned_at: null, banned_by: null }
                        : u
                )
            );

            alert(`${userToUnban.email} has been unbanned successfully.`);

        } catch (error) {
            console.error('❌ Error unbanning user:', error);
            alert(`Error unbanning user: ${error.message}`);
        } finally {
            setProcessingBan(false);
        }
    };

    const processBan = async () => {
        if (!banReason) {
            alert('Please select a ban reason');
            return;
        }

        setProcessingBan(true);
        try {
            console.log('🚫 Processing ban for user:', banningUser.email);

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-ban-user`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: banningUser.id,
                    banReason: banReason,
                    action: 'ban'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to ban user');
            }

            const result = await response.json();
            console.log('✅ User banned successfully:', result);

            // Update local state
            setUsers(current => 
                current.map(u => 
                    u.id === banningUser.id 
                        ? { ...u, banned: true, ban_reason: banReason, banned_at: new Date().toISOString(), banned_by: user.id }
                        : u
                )
            );

            // Close modal
            setShowBanModal(false);
            setBanningUser(null);
            setBanReason('');

            alert(`${banningUser.email} has been banned successfully.`);

        } catch (error) {
            console.error('❌ Error banning user:', error);
            alert(`Error banning user: ${error.message}`);
        } finally {
            setProcessingBan(false);
        }
    };

    const handlePlayMusic = (generation) => {
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

    // Helper function to download multiple images as ZIP
    const downloadMultipleImagesAsZip = async (imageUrls, generationName) => {
        try {
            // Import JSZip dynamically
            const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
            const zip = new JSZip();
            
            console.log(`📦 Admin downloading zip with ${imageUrls.length} images...`);
            
            // Download all images and add to zip
            for (let i = 0; i < imageUrls.length; i++) {
                try {
                    const response = await fetch(imageUrls[i]);
                    if (!response.ok) {
                        console.warn(`Failed to download image ${i + 1}:`, response.status);
                        continue;
                    }
                    
                    const blob = await response.blob();
                    const filename = `image_${i + 1}.jpg`;
                    zip.file(filename, blob);
                    console.log(`✅ Added ${filename} to zip`);
                } catch (error) {
                    console.warn(`Error downloading image ${i + 1}:`, error);
                }
            }
            
            // Generate zip file
            console.log('📦 Generating zip file...');
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            
            // Download zip file
            const url = window.URL.createObjectURL(zipBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `admin_${generationName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_images.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            console.log('✅ Admin zip download completed');
        } catch (error) {
            console.error('❌ Admin zip creation failed:', error);
            alert('Failed to create zip file. Downloading images individually...');
            
            // Fallback: download images individually
            for (let i = 0; i < imageUrls.length; i++) {
                try {
                    const response = await fetch(imageUrls[i]);
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `admin_${generationName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${i + 1}.jpg`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                    
                    // Small delay between downloads
                    if (i < imageUrls.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (downloadError) {
                    console.error(`Failed to download image ${i + 1}:`, downloadError);
                }
            }
        }
    };

    const handleImageClick = (imageUrl, generationName, imageIndex) => {
        setEnlargedImage({
            url: imageUrl,
            title: `${generationName} - Image ${imageIndex + 1}`,
            generation: generationName
        });
        setShowEnlargedModal(true);
    };

    const handleDownloadGeneration = async (generation) => {
        const imageUrls = getAllImageUrls(generation.output_file_url);
        
        // If multiple images, create a zip file
        if (imageUrls.length > 1) {
            await downloadMultipleImagesAsZip(imageUrls, generation.generation_name);
            return;
        }
        
        // Single file download
        try {
            const response = await fetch(generation.output_file_url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            // Determine file extension based on tool type
            let extension = 'jpg';
            if (generation.tool_type?.includes('video') || generation.tool_type?.includes('kling') || generation.tool_type?.includes('wan') || generation.tool_type?.includes('minimax') || generation.tool_type?.includes('veo') || generation.tool_type?.includes('ltxv') || generation.tool_type?.includes('fal_seedance_pro') || generation.tool_type?.includes('fal_wan_v22_a14b') || generation.tool_type?.includes('fal_omnihuman')) {
                extension = 'mp4';
            } else if (generation.tool_type?.includes('music') || generation.tool_type?.includes('cassetteai')) {
                extension = 'mp3';
            }
            
            link.download = `admin_${generation.generation_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Download failed. Please try again.');
        }
    };

    const handleDownload = async (generation) => {
        if (!generation || !generation.output_file_url) {
          alert('No file available for download');
          return;
        }
        
        try {
          const response = await fetch(toCdnUrl(generation.output_file_url));
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          
          // Determine file extension based on tool type
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

    const handleDeleteGeneration = async (generation) => {
        if (!confirm(`Are you sure you want to delete "${generation.generation_name}"? This action cannot be undone.`)) return;

        try {
            console.log('🗑️ Admin deleting generation:', generation.id);
            
            // Stop playing if this track is currently playing
            if (currentlyPlaying === generation.id) {
                audioRef.current?.pause();
                setCurrentlyPlaying(null);
                setIsPlaying(false);
            }
            
            // Use admin permanent delete function for hard delete
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

            const result = await response.json();
            console.log('✅ Admin delete result:', result);

            console.log('✅ Generation deleted successfully');
            
            // Remove from userGenerations state immediately for UI feedback
            setUserGenerations(prev => 
                prev.filter(gen => gen.id !== generation.id)
            );
            
            // Also update the user's generation count in the main users list
            setUsers(prev => 
                prev.map(user => 
                    user.id === generation.user_id 
                        ? { ...user, generation_count: Math.max(0, (user.generation_count || 0) - 1) }
                        : user
                )
            );
            
            alert('Generation permanently deleted successfully');
        } catch (error) {
            console.error('Error deleting generation:', error);
            alert(`Error deleting generation: ${error.message}`);
        }
    };

    const handlePermanentDelete = async (generationId) => {
        const generation = userGenerations.find(g => g.id === generationId);
        if (generation) {
            await handleDeleteGeneration(generation);
        }
    };

    const toggleShowcase = async (generationId, currentShowcased) => {
        try {
            console.log('🌟 Admin toggling showcase for generation:', generationId, 'from', currentShowcased, 'to', !currentShowcased);
            
            // Call dedicated admin function that uses service role
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-toggle-showcase`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    generationId,
                    showcased: !currentShowcased
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to toggle showcase');
            }

            const result = await response.json();
            console.log('✅ Successfully toggled showcase status:', result);

            // Update local state
            setUserGenerations(prev => 
                prev.map(gen => 
                    gen.id === generationId 
                        ? { ...gen, showcased: result.generation.showcased }
                        : gen
                )
            );

            // Also update the users list if the generation count changed
            if (!currentShowcased) {
                // Added to showcase - this might affect user stats
                fetchUsers();
            }

            console.log(`${result.message}:`, generationId);
        } catch (error) {
            console.error('Error toggling showcase:', error);
            alert('Error updating showcase status. Please try again.');
        }
    };

    const handleToggleShowcase = async (generationId, currentShowcased) => {
        await toggleShowcase(generationId, currentShowcased);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getSubscriptionStatus = (user) => {
        const activeSub = user.subscriptions?.find(sub => sub.status === 'active');
        if (activeSub) {
            return {
                status: 'active',
                plan: user.subscription_status || 'unknown',
                nextBilling: activeSub.current_period_end
            };
        }
        return {
            status: user.subscription_status || 'free',
            plan: 'free',
            nextBilling: null
        };
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
                <div className="text-white text-xl flex items-center space-x-3">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span>{authLoading ? 'Authenticating...' : 'Loading admin panel...'}</span>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
                    <p className="text-purple-200">You don't have permission to access this page.</p>
                </div>
            </div>
        );
    }

    // If we're viewing a specific user's generations, show that view
    if (viewMode === 'user-generations' && selectedUser) {
        return (
          <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
            {/* Header */}
            <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => {
                        setViewMode('user-list');
                        setSelectedUser(null);
                        setUserGenerations([]);
                        navigate('/admin');
                      }}
                      className="flex items-center space-x-2 text-purple-200 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      <span>Back to Admin</span>
                    </button>
                    <div className="h-6 w-px bg-white/20"></div>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h1 className="text-xl font-bold text-white">{selectedUser.email}</h1>
                        <p className="text-purple-200 text-sm">{userGenerations.length} generations</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* User Info Card */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-8">
                <div className="grid md:grid-cols-4 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Account Info</h3>
                    <div className="space-y-1 text-sm">
                      <p className="text-purple-200">Username: <span className="text-white">{selectedUser.username || 'Not set'}</span></p>
                      <p className="text-purple-200">Joined: <span className="text-white">{formatDate(selectedUser.created_at)}</span></p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Tokens</h3>
                    <div className="space-y-1 text-sm">
                      <p className="text-purple-200">Subscription: <span className="text-white">{selectedUser.tokens || 0}</span></p>
                      <p className="text-purple-200">Purchased: <span className="text-white">{selectedUser.purchased_tokens || 0}</span></p>
                      <p className="text-green-400 font-semibold">Total: {(selectedUser.tokens || 0) + (selectedUser.purchased_tokens || 0)}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Subscription</h3>
                    <div className="space-y-2 text-sm">
                      {selectedUser.subscriptions?.map((sub, index) => (
                        <div key={index}>
                          <div className="flex justify-between">
                            <span className="text-purple-200">Status:</span>
                            <span className={`px-2 py-1 rounded text-xs ${sub.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                              {sub.status}
                            </span>
                          </div>
                          {sub.current_period_end && (
                            <p className="text-purple-200 text-xs mt-1">
                              Next: {formatDate(sub.current_period_end)}
                            </p>
                          )}
                        </div>
                      ))}
                      {(!selectedUser.subscriptions || selectedUser.subscriptions.length === 0) && (
                        <p className="text-gray-400 text-xs">No active subscriptions</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Activity</h3>
                    <div className="space-y-1 text-sm">
                      <p className="text-purple-200">Generations: <span className="text-green-400 font-semibold">{selectedUser.generation_count || 0}</span></p>
                      <p className="text-purple-200">Status: <span className={`px-2 py-1 rounded text-xs ${getSubscriptionStatus(selectedUser).status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                        }`}>
                        {getSubscriptionStatus(selectedUser).plan}
                      </span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters and Controls */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-8">
                <div className="flex flex-col gap-4 mb-4">
                  {/* Search */}
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

                  {/* Filters */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <select
                      value={filterTool}
                      onChange={(e) => setFilterTool(e.target.value)}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 [&>option]:bg-gray-800 [&>option]:text-white"
                    >
                      <option value="all">All Tools</option>
                      {allUniqueTools.map(tool => (
                        <option key={tool.type} value={tool.type}>{tool.name}</option>
                      ))}
                    </select>

                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 [&>option]:bg-gray-800 [&>option]:text-white"
                    >
                      <option value="all">All Status</option>
                      <option value="completed">Completed</option>
                      <option value="processing">Processing</option>
                      <option value="failed">Failed</option>
                    </select>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 [&>option]:bg-gray-800 [&>option]:text-white"
                    >
                      <option value="date">Date</option>
                      <option value="name">Name</option>
                      <option value="tool">Tool</option>
                      <option value="tokens">Tokens</option>
                      <option value="status">Status</option>
                    </select>
                  </div>
                </div>

                {/* View Mode Toggle and Results Info */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setGenerationViewMode('grid')}
                      className={`p-2 rounded-lg transition-colors ${
                        generationViewMode === 'grid' 
                          ? 'bg-purple-500 text-white' 
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setGenerationViewMode('list')}
                      className={`p-2 rounded-lg transition-colors ${
                        generationViewMode === 'list' 
                          ? 'bg-purple-500 text-white' 
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-purple-200 text-sm">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredGenerations.length)} of {filteredGenerations.length}
                  </div>
                </div>
              </div>

              {/* Generations Grid/List */}
              {loadingGenerations ? (
                <div className="text-center py-16">
                  <div className="text-white text-xl">Loading generations...</div>
                </div>
              ) : paginatedGenerations.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ImageIcon className="w-8 h-8 text-purple-300" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">No generations found</h3>
                  <p className="text-purple-200">
                    {searchTerm || filterTool !== 'all' || filterStatus !== 'all' 
                      ? 'Try adjusting your filters or search terms'
                      : 'This user has no generations yet'
                    }
                  </p>
                </div>
              ) : (
                <>
                  <div className={`${
                    generationViewMode === 'grid' 
                      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6' 
                      : 'space-y-4'
                  }`}>
                    {paginatedGenerations.map((generation) => (
                      <div
                        key={generation.id}
                        className={`bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-all duration-200 cursor-pointer ${
                          generationViewMode === 'list' ? 'flex items-center space-x-4 p-4' : ''
                        }`}
                        onClick={() => {
                          setSelectedGeneration(generation);
                          setShowViewer(true);
                        }}
                      >
                        {/* Media Thumbnail */}
                        <div className={`relative ${generationViewMode === 'list' ? 'w-24 h-24 flex-shrink-0' : 'w-full h-48'}`}>
                          {generation.output_file_url ? (
                            getMediaType(generation) === 'video' ? (
                              <OptimizedVideo
                                src={getAllImageUrls(generation.output_file_url)[0]}
                                poster={generation.metadata?.thumbnail_url || generation.input_data?.imageUrl}
                                className="w-full h-full object-cover rounded-lg"
                                controls={false}
                                preload="metadata"
                                muted={true}
                                playsInline={true}
                              />
                            ) : getMediaType(generation) === 'audio' ? (
                              <div className="w-full h-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-lg flex items-center justify-center">
                                <div className="text-center">
                                  <Music className="w-8 h-8 text-pink-400 mx-auto mb-2" />
                                  <p className="text-pink-300 text-xs">Audio Track</p>
                                </div>
                              </div>
                            ) : (
                              <OptimizedImage
                                src={getAllImageUrls(generation.output_file_url)[0]}
                                alt={generation.generation_name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            )
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center">
                              {getToolIcon(generation.tool_type)}
                            </div>
                          )}
                          
                          {/* Status badge */}
                          <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(generation.status)}`}>
                            {generation.status}
                          </div>
                          
                          {/* Play button for videos */}
                          {getMediaType(generation) === 'video' && (
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
                              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                                <Play className="w-6 h-6 text-white ml-1" />
                              </div>
                            </div>
                          )}
                          
                          {/* Play button for audio */}
                          {getMediaType(generation) === 'audio' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlay(generation);
                              }}
                              className={`absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                currentlyPlaying === generation.id && isPlaying
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
                        <div className={`${generationViewMode === 'list' ? 'flex-1' : 'p-4'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className={`font-medium text-white truncate ${generationViewMode === 'list' ? 'text-base' : 'text-sm'}`}>
                              {generation.generation_name}
                            </h3>
                            {generationViewMode === 'grid' && (
                              <div className="flex space-x-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleShowcase(generation.id, generation.showcased);
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    generation.showcased 
                                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                                      : 'bg-gray-500 hover:bg-gray-600 text-white'
                                  }`}
                                  title={generation.showcased ? 'Remove from showcase' : 'Add to showcase'}
                                >
                                  <Flag className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(generation);
                                  }}
                                  className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded-lg transition-colors"
                                  title="Download"
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePermanentDelete(generation.id);
                                  }}
                                  className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg transition-colors"
                                  title="Permanent Delete"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <div className={`flex items-center space-x-2 mb-2 ${generationViewMode === 'list' ? 'text-sm' : 'text-xs'}`}>
                            <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded flex items-center justify-center text-white">
                              {getToolIcon(generation.tool_type)}
                            </div>
                            <span className="text-purple-200 truncate">{generation.tool_name}</span>
                          </div>
                          
                          <div className={`flex items-center justify-between text-purple-300 ${generationViewMode === 'list' ? 'text-sm' : 'text-xs'}`}>
                            <span>{generation.tokens_used} tokens</span>
                            <span>{new Date(generation.created_at).toLocaleDateString()}</span>
                          </div>
                          
                          {generationViewMode === 'list' && (
                            <div className="flex space-x-2 mt-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleShowcase(generation.id, generation.showcased);
                                }}
                                className={`p-2 rounded-lg transition-colors ${
                                  generation.showcased 
                                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                                }`}
                                title={generation.showcased ? 'Remove from showcase' : 'Add to showcase'}
                              >
                                <Flag className="w-4 h-4" />
                              </button>
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
                                  handlePermanentDelete(generation.id);
                                }}
                                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                                title="Permanent Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="w-full sm:w-auto bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Previous
                      </button>
                      
                      <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = i + 1;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg font-medium text-sm transition-colors flex-shrink-0 ${
                                currentPage === pageNum
                                  ? 'bg-purple-500 text-white'
                                  : 'bg-white/10 hover:bg-white/20 text-purple-200'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="w-full sm:w-auto bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Next
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
                  <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg sm:text-xl font-bold text-white pr-4">{selectedGeneration.generation_name}</h3>
                      <button
                        onClick={() => setShowViewer(false)}
                        className="text-purple-400 hover:text-purple-300 transition-colors flex-shrink-0"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    {/* Media Display */}
                    {selectedGeneration.output_file_url && getAllImageUrls(selectedGeneration.output_file_url).length > 0 && (
                      <div className="mb-6">
                        {getMediaType(selectedGeneration) === 'video' ? (
                          <OptimizedVideo
                            src={getAllImageUrls(selectedGeneration.output_file_url)[0]}
                            className="w-full max-h-96 rounded-lg"
                            poster={selectedGeneration.metadata?.thumbnail_url || selectedGeneration.input_data?.imageUrl}
                            controls={true}
                            preload="metadata"
                          />
                        ) : getMediaType(selectedGeneration) === 'audio' ? (
                          <div className="w-full h-64 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-lg flex items-center justify-center">
                            <div className="text-center">
                              <div className="w-24 h-24 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Music className="w-12 h-12 text-white" />
                              </div>
                              <h4 className="text-white font-semibold text-lg mb-2">🎵 Audio Track</h4>
                              <audio
                                src={toCdnUrl(selectedGeneration.output_file_url)}
                                controls
                                className="w-full max-w-md mx-auto"
                                preload="metadata"
                              />
                            </div>
                          </div>
                        ) : getAllImageUrls(selectedGeneration.output_file_url).length === 1 ? (
                          <OptimizedImage
                            src={getAllImageUrls(selectedGeneration.output_file_url)[0]}
                            alt={selectedGeneration.generation_name}
                            className="w-full max-h-96 object-contain rounded-lg"
                          />
                        ) : (
                          <div>
                            <h4 className="text-lg font-semibold text-white mb-3">
                              Generated Images ({getAllImageUrls(selectedGeneration.output_file_url).length})
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {getAllImageUrls(selectedGeneration.output_file_url).map((url, index) => (
                                <OptimizedImage
                                  key={index}
                                  src={url}
                                  alt={`${selectedGeneration.generation_name} - Image ${index + 1}`}
                                  className="w-full h-48 object-cover rounded-lg"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Admin Actions */}
                    <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleToggleShowcase(selectedGeneration.id, selectedGeneration.showcased)}
                          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                            selectedGeneration.showcased 
                              ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                              : 'bg-gray-500 hover:bg-gray-600 text-white'
                          }`}
                        >
                          <Flag className="w-4 h-4" />
                          <span>{selectedGeneration.showcased ? 'Remove from Showcase' : 'Add to Showcase'}</span>
                        </button>
                        
                        <button
                          onClick={() => handleDownload(selectedGeneration)}
                          className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </button>
                        
                        <button
                          onClick={() => handlePermanentDelete(selectedGeneration.id)}
                          className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Permanent Delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            <span className="text-purple-200">Tool:</span>
                            <span className="text-white">{selectedGeneration.tool_name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-purple-200">Tokens Used:</span>
                            <span className="text-white">{selectedGeneration.tokens_used}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-purple-200">Showcased:</span>
                            <span className={selectedGeneration.showcased ? 'text-yellow-400' : 'text-gray-400'}>
                              {selectedGeneration.showcased ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-purple-200">Created:</span>
                            <span className="text-white text-right">
                              {new Date(selectedGeneration.created_at).toLocaleString()}
                            </span>
                          </div>
                          {selectedGeneration.completed_at && (
                            <div className="flex justify-between">
                              <span className="text-purple-200">Completed:</span>
                              <span className="text-white text-right">
                                {new Date(selectedGeneration.completed_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-lg font-semibold text-white mb-3">Configuration</h4>
                        <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
                          {selectedGeneration.input_data && Object.entries(selectedGeneration.input_data).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-purple-200 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                              <span className="text-white text-right max-w-xs truncate">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end mt-6">
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
                src={toCdnUrl(userGenerations.find(g => g.id === currentlyPlaying)?.output_file_url)}
                onError={(e) => {
                  console.error('Audio playback error:', e);
                  setIsPlaying(false);
                  setCurrentlyPlaying(null);
                }}
              />
            )}

            {/* Mini Audio Player */}
            {currentlyPlaying && (
              <div className="fixed bottom-4 right-4 bg-gradient-to-r from-pink-500/90 to-rose-500/90 backdrop-blur-md rounded-2xl p-4 border border-pink-500/30 shadow-2xl z-50">
                <div className="flex items-center space-x-3 mb-2">
                  <button
                    onClick={() => handlePlay(userGenerations.find(g => g.id === currentlyPlaying))}
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-all"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {userGenerations.find(g => g.id === currentlyPlaying)?.generation_name || 'Music Track'}
                    </p>
                    <p className="text-pink-200 text-xs">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </p>
                  </div>

                  <button
                    onClick={toggleMute}
                    className="text-white hover:text-pink-200 transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
                
                {/* Progress Bar */}
                <div 
                  className="w-full h-1 bg-white/20 rounded-full cursor-pointer"
                  onClick={handleSeek}
                >
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-100"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
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
                                <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">Admin Panel</h1>
                                    <p className="text-purple-200 text-sm">System management and user overview</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={fetchUsers}
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
                <div className="grid md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Total Users</h3>
                                <p className="text-2xl font-bold text-blue-400">{stats.totalUsers}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                                <Activity className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Total Generations</h3>
                                <p className="text-2xl font-bold text-green-400">{stats.totalGenerations}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                                <CreditCard className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Active Subscriptions</h3>
                                <p className="text-2xl font-bold text-purple-400">{stats.activeSubscriptions}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Est. Tokens Used</h3>
                                <p className="text-2xl font-bold text-yellow-400">{stats.totalTokensUsed.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Search users by email or username..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="generations-desc" className="bg-gray-800">Most Generations</option>
                                <option value="generations-asc" className="bg-gray-800">Least Generations</option>
                                <option value="email-asc" className="bg-gray-800">Email A-Z</option>
                                <option value="email-desc" className="bg-gray-800">Email Z-A</option>
                                <option value="created-desc" className="bg-gray-800">Newest First</option>
                                <option value="created-asc" className="bg-gray-800">Oldest First</option>
                                <option value="tokens-desc" className="bg-gray-800">Most Tokens</option>
                                <option value="tokens-asc" className="bg-gray-800">Least Tokens</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Users List */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-white/20">
                        <h2 className="text-xl font-semibold text-white">
                            Users ({filteredUsers.length})
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-medium text-purple-200">User</th>
                                    <th className="px-6 py-4 text-left text-sm font-medium text-purple-200">Generations</th>
                                    <th className="px-6 py-4 text-left text-sm font-medium text-purple-200">Tokens</th>
                                    <th className="px-6 py-4 text-left text-sm font-medium text-purple-200">Subscription</th>
                                    <th className="px-6 py-4 text-left text-sm font-medium text-purple-200">Joined</th>
                                    <th className="px-6 py-4 text-left text-sm font-medium text-purple-200">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {filteredUsers.map((user, index) => {
                                    const subscription = getSubscriptionStatus(user);
                                    return (
                                        <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                                                        {user.avatar_url ? (
                                                            <img src={toCdnUrl(user.avatar_url)} alt="" className="w-full h-full rounded-full object-cover" loading="lazy" />
                                                        ) : (
                                                            <User className="w-5 h-5 text-white" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-medium">{user.email}</p>
                                                        {user.username && (
                                                            <p className="text-purple-300 text-sm">@{user.username}</p>
                                                        )}
                                                        {user.banned && (
                                                            <p className="text-red-400 text-xs font-medium">
                                                                🚫 BANNED: {user.ban_reason}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-2xl font-bold text-green-400">
                                                        {user.generation_count || 0}
                                                    </span>
                                                    {index === 0 && sortBy === 'generations-desc' && (
                                                        <span className="bg-yellow-500 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold">
                                                            TOP
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-white">
                                                    <div className="font-semibold">
                                                        {(user.tokens || 0) + (user.purchased_tokens || 0)}
                                                    </div>
                                                    <div className="text-xs text-purple-300">
                                                        Sub: {user.tokens || 0} | Purchased: {user.purchased_tokens || 0}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${subscription.status === 'active'
                                                            ? 'bg-green-500/20 text-green-400'
                                                            : 'bg-gray-500/20 text-gray-400'
                                                        }`}>
                                                        {subscription.plan}
                                                    </span>
                                                    {subscription.nextBilling && (
                                                        <div className="text-xs text-purple-300 mt-1">
                                                            Next: {formatDate(subscription.nextBilling)}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-purple-200 text-sm">
                                                {formatDate(user.created_at)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => handleViewUser(user)}
                                                        className="flex items-center space-x-2 bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        <span>View</span>
                                                    </button>
                                                    
                                                    {user.banned ? (
                                                        <button
                                                            onClick={() => handleUnbanUser(user)}
                                                            disabled={processingBan}
                                                            className="bg-green-500 hover:bg-green-600 disabled:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors disabled:cursor-not-allowed"
                                                        >
                                                            {processingBan ? 'Unbanning...' : 'Unban'}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleBanUser(user)}
                                                            disabled={processingBan}
                                                            className="bg-red-500 hover:bg-red-600 disabled:bg-red-700 text-white px-3 py-2 rounded-lg text-sm transition-colors disabled:cursor-not-allowed"
                                                        >
                                                            {processingBan ? 'Banning...' : 'Ban'}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* User Detail Modal */}
            {selectedUser && (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 z-50 overflow-y-auto">
                    {/* Header */}
                    <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <button
                                        onClick={() => setSelectedUser(null)}
                                        className="flex items-center space-x-2 text-purple-200 hover:text-white transition-colors"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                        <span>Back to Admin</span>
                                    </button>
                                    <div className="h-6 w-px bg-white/20"></div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center overflow-hidden">
                                            {selectedUser.avatar_url ? (
                                                <img src={toCdnUrl(selectedUser.avatar_url)} alt="" className="w-full h-full object-cover" loading="lazy" />
                                            ) : (
                                                <User className="w-5 h-5 text-white" />
                                            )}
                                        </div>
                                        <div>
                                            <h1 className="text-xl font-bold text-white">{selectedUser.email}</h1>
                                            <p className="text-purple-200 text-sm">
                                                {selectedUser.generation_count || 0} generations • {(selectedUser.tokens || 0) + (selectedUser.purchased_tokens || 0)} tokens
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-4">
                                    <span className="text-purple-200 text-sm">
                                        {userGenerations.length} of {selectedUser.generation_count || 0} generations
                                    </span>
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        {/* User Info Card */}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-8">
                            <div className="grid md:grid-cols-4 gap-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Account Info</h3>
                                    <div className="space-y-1 text-sm">
                                        <p className="text-purple-200">Username: <span className="text-white">{selectedUser.username || 'Not set'}</span></p>
                                        <p className="text-purple-200">Joined: <span className="text-white">{formatDate(selectedUser.created_at)}</span></p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Tokens</h3>
                                    <div className="space-y-1 text-sm">
                                        <p className="text-purple-200">Subscription: <span className="text-white">{selectedUser.tokens || 0}</span></p>
                                        <p className="text-purple-200">Purchased: <span className="text-white">{selectedUser.purchased_tokens || 0}</span></p>
                                        <p className="text-green-400 font-semibold">Total: {(selectedUser.tokens || 0) + (selectedUser.purchased_tokens || 0)}</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Subscription</h3>
                                    <div className="space-y-2 text-sm">
                                        {selectedUser.subscriptions?.map((sub, index) => (
                                            <div key={index}>
                                                <div className="flex justify-between">
                                                    <span className="text-purple-200">Status:</span>
                                                    <span className={`px-2 py-1 rounded text-xs ${sub.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                                                        }`}>
                                                        {sub.status}
                                                    </span>
                                                </div>
                                                {sub.current_period_end && (
                                                    <p className="text-purple-200 text-xs mt-1">
                                                        Next: {formatDate(sub.current_period_end)}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                        {(!selectedUser.subscriptions || selectedUser.subscriptions.length === 0) && (
                                            <p className="text-gray-400 text-xs">No active subscriptions</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Activity</h3>
                                    <div className="space-y-1 text-sm">
                                        <p className="text-purple-200">Generations: <span className="text-green-400 font-semibold">{selectedUser.generation_count || 0}</span></p>
                                        <p className="text-purple-200">Status: <span className={`px-2 py-1 rounded text-xs ${getSubscriptionStatus(selectedUser).status === 'active'
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-gray-500/20 text-gray-400'
                                            }`}>
                                            {getSubscriptionStatus(selectedUser).plan}
                                        </span></p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Generations Gallery */}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-white">User Generations</h2>
                                <button
                                    onClick={() => fetchUserGenerations(selectedUser.id)}
                                    className="text-purple-400 hover:text-purple-300 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>

                            {loadingGenerations ? (
                                <div className="text-center py-12">
                                    <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-4" />
                                    <p className="text-purple-200 text-lg">Loading generations...</p>
                                </div>
                            ) : userGenerations.length === 0 ? (
                                <div className="text-center py-12">
                                    <Activity className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                                    <p className="text-purple-200 text-lg">No generations found</p>
                                    <p className="text-purple-300 text-sm">This user hasn't created any content yet</p>
                                </div>
                            ) : (
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {userGenerations.map((generation) => {
                                        // Helper function to get image URLs
                                        const getImageUrls = (generation) => {
                                            if (!generation.output_file_url) return [];
                                            try {
                                                const parsed = JSON.parse(generation.output_file_url);
                                                return Array.isArray(parsed) ? parsed : [generation.output_file_url];
                                            } catch {
                                                return [generation.output_file_url];
                                            }
                                        };

                                        // Helper function to check if it's a video
                                        const isVideoGeneration = (generation) => {
                                            const videoToolTypes = [
                                                'gen_02', 'gen_03', 'gen_06',
                                                'fal_minimax_hailuo', 'fal_wan_pro', 'fal_kling_pro', 'fal_veo2', 'fal_video_upscaler',
                                                'wan22_pro', 'fal_ltxv', 'fal_veo3_fast', 'ai_scene_gen', 'fal_wan_v22_a14b', 'ai_scene_gen', 'fal_omnihuman', 'fal_seedance_pro', 'fal_mmaudio_video2',
                                                'fal_wan_v22_text2video_lora', 'fal_wan_v22_img2video_lora', 'fal_wan_v22_video2video'
                                            ];
                                            return videoToolTypes.includes(generation.tool_type) ||
                                                (generation.output_file_url && generation.output_file_url.toLowerCase().includes('video'));
                                        };

                                        const imageUrls = getImageUrls(generation);
                                        const primaryUrl = imageUrls[0];
                                        const isVideo = isVideoGeneration(generation);
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

                                        return (
                                            <div
                                                key={generation.id}
                                                className="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-1 flex flex-col"
                                            >
                                                <div className="relative">
                                                    {primaryUrl ? (
                                                        <div
                                                            className="relative cursor-pointer"
                                                            onClick={() => {
                                                                setSelectedGeneration(generation);
                                                            }}
                                                        >
                                                            {generation.tool_type?.includes('music') || generation.tool_type?.includes('cassetteai') ? (
                                                                <div className="w-full h-24 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded flex items-center justify-center">
                                                                    <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center">
                                                                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                                                                        </svg>
                                                                    </div>
                                                                </div>
                                                            ) : isAudioType(generation.tool_type) ? (
                                                                <div 
                                                                    className="w-full h-48 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded flex items-center justify-center cursor-pointer hover:from-pink-500/30 hover:to-rose-500/30 transition-colors"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handlePlayMusic(generation);
                                                                    }}
                                                                >
                                                                    <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center">
                                                                        {currentlyPlaying === generation.id && isPlaying ? (
                                                                            <Pause className="w-8 h-8 text-white" />
                                                                        ) : (
                                                                            <Play className="w-8 h-8 text-white ml-1" />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : isVideo ? (
                                                                <VideoThumbnail 
                                                                    generation={generation}
                                                                    className="w-full h-48 object-cover hover:opacity-90 transition-opacity"
                                                                />
                                                            ) : (
                                                                <img
                                                                    src={primaryUrl}
                                                                    alt={generation.generation_name}
                                                                    className="w-full h-48 object-cover hover:opacity-90 transition-opacity"
                                                                />
                                                            )}

                                                            {/* Multiple images indicator */}
                                                            {imageUrls.length > 1 && (
                                                                <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded-lg text-xs font-medium">
                                                                    +{imageUrls.length - 1} more
                                                                </div>
                                                            )}

                                                            {/* Click to view overlay */}
                                                             <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
                                                                 <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                                                                     <Play className="w-6 h-6 text-white ml-1" />
                                                                 </div>
                                                             </div>
                                                         </div>
                                                     ) : (
                                                         <div className="w-full h-48 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center">
                                                             {getToolIcon(generation.tool_type)}
                                                         </div>
                                                     )}
                                                 </div>

                                                <div className="p-4 flex-1 flex flex-col">
                                                    <h3 className="font-semibold text-white text-sm mb-2 line-clamp-2">
                                                        {generation.generation_name}
                                                    </h3>

                                                    <div className="flex items-center space-x-2 mb-2">
                                                        <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded flex items-center justify-center text-white">
                                                            {getToolIcon(generation.tool_type)}
                                                        </div>
                                                        <span className="text-purple-200 text-xs truncate">{generation.tool_name}</span>
                                                    </div>

                                                    <div className="flex items-center justify-between text-purple-300 text-xs mb-3">
                                                        <span>{generation.tokens_used} tokens</span>
                                                        <span>{new Date(generation.created_at).toLocaleDateString()}</span>
                                                    </div>

                                                    {/* Admin Actions */}
                                                    <div className="flex space-x-1 mt-auto">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleShowcase(generation.id, generation.showcased);
                                                            }}
                                                            className={`flex-1 p-2 rounded-lg text-xs font-medium transition-colors ${
                                                                generation.showcased 
                                                                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                                                                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                                                            }`}
                                                            title={generation.showcased ? 'Remove from showcase' : 'Add to showcase'}
                                                        >
                                                            <Flag className="w-3 h-3 mx-auto" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownloadGeneration(generation);
                                                            }}
                                                            className="flex-1 bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg text-xs font-medium transition-colors"
                                                            title="Download"
                                                        >
                                                            <Download className="w-3 h-3 mx-auto" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteGeneration(generation);
                                                            }}
                                                            className="flex-1 bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg text-xs font-medium transition-colors"
                                                            title="Permanent Delete"
                                                        >
                                                            <Trash2 className="w-3 h-3 mx-auto" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Ban User Modal */}
            {showBanModal && banningUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl max-w-md w-full border border-white/20">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-white">Ban User</h3>
                                <button
                                    onClick={() => setShowBanModal(false)}
                                    className="text-purple-400 hover:text-purple-300 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="mb-6">
                                <p className="text-purple-200 mb-4">
                                    Are you sure you want to ban <strong className="text-white">{banningUser.email}</strong>?
                                </p>
                                
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        Ban Reason
                                    </label>
                                    <select
                                        value={banReason}
                                        onChange={(e) => setBanReason(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="" className="bg-gray-800">Select a reason...</option>
                                        {banReasons.map((reason, index) => (
                                            <option key={index} value={reason} className="bg-gray-800">
                                                {reason}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    onClick={() => setShowBanModal(false)}
                                    className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={processBan}
                                    disabled={!banReason || processingBan}
                                    className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
                                >
                                    {processingBan ? 'Banning...' : 'Ban User'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Enlarged Image Modal */}
            {showEnlargedModal && enlargedImage && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="relative max-w-4xl max-h-[90vh] w-full">
                        <button
                            onClick={() => setShowEnlargedModal(false)}
                            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        
                        <img
                            src={enlargedImage.url}
                            alt={enlargedImage.title}
                            className="w-full h-full object-contain rounded-lg"
                        />
                        
                        <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm text-white p-3 rounded-lg">
                            <p className="font-semibold">{enlargedImage.title}</p>
                        </div>
                    </div>
                </div>
            )}

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

                            {/* Media Display */}
                            {selectedGeneration.output_file_url && getAllImageUrls(selectedGeneration.output_file_url).length > 0 && (
                                <div className="mb-6">
                                    {getMediaType(selectedGeneration) === 'video' ? (
                                        <OptimizedVideo
                                            src={getAllImageUrls(selectedGeneration.output_file_url)[0]}
                                            className="w-full max-h-96 rounded-lg"
                                            poster={selectedGeneration.metadata?.thumbnail_url || selectedGeneration.input_data?.imageUrl}
                                            controls={true}
                                            preload="metadata"
                                        />
                                    ) : getMediaType(selectedGeneration) === 'audio' ? (
                                        <div className="w-full h-64 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-lg flex items-center justify-center">
                                            <div className="text-center">
                                                <div className="w-24 h-24 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Music className="w-12 h-12 text-white" />
                                                </div>
                                                <h4 className="text-white font-semibold text-lg mb-2">🎵 Audio Track</h4>
                                                <audio
                                                    src={toCdnUrl(selectedGeneration.output_file_url)}
                                                    controls
                                                    className="w-full max-w-md mx-auto"
                                                    preload="metadata"
                                                />
                                            </div>
                                        </div>
                                    ) : getAllImageUrls(selectedGeneration.output_file_url).length === 1 ? (
                                        <OptimizedImage
                                            src={getAllImageUrls(selectedGeneration.output_file_url)[0]}
                                            alt={selectedGeneration.generation_name}
                                            className="w-full max-h-96 object-contain rounded-lg"
                                        />
                                    ) : (
                                        <div>
                                            <h4 className="text-lg font-semibold text-white mb-3">
                                                Generated Images ({getAllImageUrls(selectedGeneration.output_file_url).length})
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {getAllImageUrls(selectedGeneration.output_file_url).map((url, index) => (
                                                    <OptimizedImage
                                                        key={index}
                                                        src={url}
                                                        alt={`${selectedGeneration.generation_name} - Image ${index + 1}`}
                                                        className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                        onClick={() => handleImageClick(url, selectedGeneration.generation_name, index)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Admin Actions */}
                            <div className="flex justify-between mb-6">
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => handleToggleShowcase(selectedGeneration.id, selectedGeneration.showcased)}
                                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                                            selectedGeneration.showcased 
                                                ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                                                : 'bg-gray-500 hover:bg-gray-600 text-white'
                                        }`}
                                    >
                                        <Flag className="w-4 h-4" />
                                        <span>{selectedGeneration.showcased ? 'Remove from Showcase' : 'Add to Showcase'}</span>
                                    </button>
                                    
                                    <button
                                        onClick={() => handleDownloadGeneration(selectedGeneration)}
                                        className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span>Download</span>
                                    </button>
                                    
                                    <button
                                        onClick={() => handleDeleteGeneration(selectedGeneration)}
                                        className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Permanent Delete</span>
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                            <span className="text-purple-200">Tool:</span>
                                            <span className="text-white">{selectedGeneration.tool_name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-purple-200">Tokens Used:</span>
                                            <span className="text-white">{selectedGeneration.tokens_used}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-purple-200">Showcased:</span>
                                            <span className={selectedGeneration.showcased ? 'text-yellow-400' : 'text-gray-400'}>
                                                {selectedGeneration.showcased ? 'Yes' : 'No'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-purple-200">Created:</span>
                                            <span className="text-white text-right">
                                                {new Date(selectedGeneration.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        {selectedGeneration.completed_at && (
                                            <div className="flex justify-between">
                                                <span className="text-purple-200">Completed:</span>
                                                <span className="text-white text-right">
                                                    {new Date(selectedGeneration.completed_at).toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-lg font-semibold text-white mb-3">Configuration</h4>
                                    <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
                                        {selectedGeneration.input_data && Object.entries(selectedGeneration.input_data).map(([key, value]) => (
                                            <div key={key} className="flex justify-between">
                                                <span className="text-purple-200 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                                <span className="text-white text-right max-w-xs truncate">
                                                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end mt-6">
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
        </div>
    );
};

export default Admin;
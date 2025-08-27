import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useDebounce } from '../hooks/useDebounce';
import { allTools } from '../data/data';
import { toCdnUrl } from '../utils/cdnHelpers';
import OptimizedImage from '../components/OptimizedImage';
import OptimizedVideo from '../components/OptimizedVideo';
import { 
  ArrowLeft, 
  Zap, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Grid3X3, 
  List, 
  Calendar,
  User,
  Eye,
  ExternalLink,
  RefreshCw,
  SortAsc,
  SortDesc,
  Image as ImageIcon,
  Video,
  Music,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ZoomIn,
  Archive,
  X
} from 'lucide-react';

// Helper function to extract filename from URL
const extractFilename = (url) => {
  if (!url) return 'unknown';
  
  try {
    // Extract filename from URL path
    const urlParts = url.split('/');
    let filename = urlParts[urlParts.length - 1];
    
    // Remove query parameters if present
    filename = filename.split('?')[0];
    
    // If filename is too long, shorten it
    if (filename.length > 30) {
      const extension = filename.split('.').pop();
      const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
      const start = nameWithoutExt.substring(0, 12);
      const end = nameWithoutExt.substring(nameWithoutExt.length - 8);
      filename = `${start}...${end}.${extension}`;
    }
    
    return filename;
  } catch (error) {
    return 'unknown';
  }
};

const Gallery = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [allGenerations, setAllGenerations] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [filterTool, setFilterTool] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);
  const [allUniqueTools, setAllUniqueTools] = useState([]);
  const [expandedImageIndex, setExpandedImageIndex] = useState(null);
  const [showExpandedImage, setShowExpandedImage] = useState(false);
  
  // Pagination settings
  const ITEMS_PER_PAGE = 20;
  
  // Helper function to get all image URLs from a generation's output
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
  
  // Collapse any URL-like string to just its filename (no query/hash)
const filenameFromUrl = (str) => {
  if (typeof str !== 'string') return str;
  try {
    // Try parsing as a full URL
    const u = new URL(str);
    const last = u.pathname.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(last);
  } catch {
    // Fallback for bare paths or not-a-URL
    const path = String(str).split('?')[0].split('#')[0];
    const last = path.split('/').filter(Boolean).pop() || path;
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }
};

// Replace all URLs inside a string with their filenames
const collapseUrlString = (s) => {
  if (typeof s !== 'string') return s;
  const URL_REGEX = /https?:\/\/[^\s)'"<>]+/gi;
  return s.replace(URL_REGEX, (m) => filenameFromUrl(m));
};
  
  const formatConfigValue = (key, value) => {
  if (value == null) return '';

  // Friendly display for LoRA arrays like:
  // [{ path: ".../model.safetensors?... ", weight_name: "boobs", ...}, ...]
  if (Array.isArray(value) && key?.toLowerCase?.() === 'loras') {
    const names = value
      .map((it) => {
        if (!it) return '';
        if (typeof it === 'string') return filenameFromUrl(it);
        if (typeof it === 'object') {
          return it.weight_name || filenameFromUrl(it.path || '');
        }
        return String(it);
      })
      .filter(Boolean);
    return names.join(', ');
  }

  // Arrays: collapse URLs item-by-item
  if (Array.isArray(value)) {
    return value
      .map((v) =>
        typeof v === 'string'
          ? collapseUrlString(v)
          : typeof v === 'object' && v !== null
            ? JSON.stringify(v, (k, vv) =>
                typeof vv === 'string' ? collapseUrlString(vv) : vv
              )
            : String(v)
      )
      .join(', ');
  }

  // Objects: stringify but collapse any URL-looking strings deeply
  if (typeof value === 'object') {
    return JSON.stringify(
      value,
      (k, v) => (typeof v === 'string' ? collapseUrlString(v) : v),
      2
    );
  }

  // Strings: if it's a URL or the key suggests a URL, show filename
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) || /url/i.test(key)) {
      return filenameFromUrl(value);
    }
    // Also collapse embedded URLs inside free text
    return collapseUrlString(value);
  }

  return String(value);
};
    
    // Helper function to get primary image URL
    const getPrimaryImageUrl = (url) => {
      const urls = getAllImageUrls(url);
      return urls.length > 0 ? urls[0] : null;
    };

  // Gallery.jsx (near your other helpers)
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

  // Helper function to get thumbnail for text-based video tools
  const getThumbnailForTextVideoTool = (generation) => {
    const textVideoTools = [
      'fal_wan_v22_text2video_lora',
      'fal_wan_v22_img2video_lora',
      'fal_wan_v22_video2video',
      'fal_veo3_fast',
      '/veo3-standard',
      'fal_video_upscaler',
      'fal_mmaudio_video2',
      'fal_wan22_s2v'
    ];
    
    if (textVideoTools.includes(generation.tool_type)) {
      // Return the thumbnail_url from the database if it exists
      return generation.thumbnail_url || null;
    }
    
    return null;
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenerations();
      fetchAllUniqueTools();
    }
  }, [user, currentPage, debouncedSearchTerm, filterTool, filterStatus, filterDate, sortBy]);

  // Audio player effects
  useEffect(() => {
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
    }
  };

  const fetchGenerations = async () => {
    try {
      setLoading(true);
      
      // Build query with filters
      let query = supabase
        .from('ai_generations')
        .select(`
          id,
          generation_name,
          tool_type,
          tool_name,
          status,
          tokens_used,
          created_at,
          completed_at,
          output_file_url,
          thumbnail_url,
          input_data,
          metadata
        `, { count: 'exact' })
        .eq('user_id', user.id)
        .is('deleted_at', null);

      // Apply filters before pagination
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase();
        query = query.or(`generation_name.ilike.%${searchLower}%,tool_name.ilike.%${searchLower}%,input_data->>prompt.ilike.%${searchLower}%`);
      }

      if (filterTool !== 'all') {
        query = query.eq('tool_type', filterTool);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (filterDate !== 'all') {
        const now = new Date();
        const filterDate_ms = {
          'today': 24 * 60 * 60 * 1000,
          'week': 7 * 24 * 60 * 60 * 1000,
          'month': 30 * 24 * 60 * 60 * 1000
        }[filterDate];
        
        if (filterDate_ms) {
          const cutoffDate = new Date(now.getTime() - filterDate_ms).toISOString();
          query = query.gte('created_at', cutoffDate);
        }
      }

      // Apply sorting
      switch (sortBy) {
        case 'name':
          query = query.order('generation_name', { ascending: true });
          break;
        case 'tool':
          query = query.order('tool_name', { ascending: true });
          break;
        case 'tokens':
          query = query.order('tokens_used', { ascending: false });
          break;
        case 'status':
          query = query.order('status', { ascending: true });
          break;
        case 'date':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      // Apply pagination after all filters
      const { data, error, count } = await query
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (error) throw error;
      
      setAllGenerations(data || []);
      setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));
    } catch (error) {
      console.error('Error fetching generations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUniqueTools = async () => {
    try {
      // Fetch all unique tool_type values from user's generations
      const { data, error } = await supabase
        .from('ai_generations')
        .select('tool_type, tool_name')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (error) throw error;
      
      // Get unique tools with their display names
      const uniqueToolsMap = new Map();
      data?.forEach(gen => {
        if (gen.tool_type && !uniqueToolsMap.has(gen.tool_type)) {
          uniqueToolsMap.set(gen.tool_type, gen.tool_name || gen.tool_type);
        }
      });
      
      // Convert to array and sort by display name
      const uniqueToolsArray = Array.from(uniqueToolsMap.entries())
        .map(([type, name]) => ({ type, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setAllUniqueTools(uniqueToolsArray);
    } catch (error) {
      console.error('Error fetching unique tools:', error);
    }
  };

  // Since filtering is now done at database level, just use the fetched data
  const filteredGenerations = allGenerations;

  // Pagination handlers
  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  }, [currentPage, handlePageChange]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, handlePageChange]);

  // Audio player functions
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

  const handleDownload = useCallback(async (generation) => {
    if (!generation || !generation.output_file_url) {
      alert('No file available for download');
      return;
    }
    
    // For image generations, check if multiple images exist
    if (!isVideoType(generation.tool_type) && !isAudioType(generation.tool_type)) {
      const imageUrls = getAllImageUrls(generation.output_file_url);
      
      // If multiple images, create a zip file
      if (imageUrls.length > 1) {
        await downloadMultipleImagesAsZip(imageUrls.map(url => toCdnUrl(url)), generation.generation_name);
        return;
      }
    }
    
    // Single file download (existing logic)
    try {
      const response = await fetch(toCdnUrl(generation.output_file_url));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Determine file extension based on tool type
      let extension = 'jpg';
      if (generation.tool_type?.includes('video') || generation.tool_type?.includes('kling') || generation.tool_type?.includes('wan') || generation.tool_type?.includes('minimax') || generation.tool_type?.includes('veo') || generation.tool_type?.includes('ltxv') || generation.tool_type?.includes('seedance') || generation.tool_type?.includes('fal_wan_v22_a14b') || generation.tool_type?.includes('fal_omnihuman')) {
        extension = 'mp4';
      } else if (generation.tool_type?.includes('music') || generation.tool_type?.includes('cassetteai')) {
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
  }, []);

  const downloadMultipleImagesAsZip = async (imageUrls, generationName) => {
    try {
      // Import JSZip dynamically
      const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
      const zip = new JSZip();
      
      console.log(`📦 Creating zip with ${imageUrls.length} images...`);
      
      // Download all images and add to zip
      for (let i = 0; i < imageUrls.length; i++) {
        try {
          const response = await fetch(toCdnUrl(imageUrls[i]));
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
      link.download = `${generationName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_images.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ Zip download completed');
    } catch (error) {
      console.error('❌ Zip creation failed:', error);
      alert('Failed to create zip file. Downloading images individually...');
      
      // Fallback: download images individually
      for (let i = 0; i < imageUrls.length; i++) {
        try {
          const response = await fetch(toCdnUrl(imageUrls[i]));
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${generationName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${i + 1}.jpg`;
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

 const handleDelete = useCallback(async (generationId) => {
  if (!confirm('Are you sure you want to remove this generation? It will be hidden from your account.')) return;
  
  try {
    // Get fresh user data
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No authenticated user found');
      alert('Please log in to delete generations');
      // Optionally redirect to login
      navigate('/login');
      return;
    }

    // Stop playing if this track is currently playing
    if (currentlyPlaying === generationId) {
      audioRef.current?.pause();
      setCurrentlyPlaying(null);
      setIsPlaying(false);
    }
    
    // Use soft delete function
    const { data, error } = await supabase.rpc('soft_delete_generation', {
      generation_id: generationId,
      user_id: user.id  // Now user is guaranteed to exist
    });
    
    if (error) throw error;
    
    if (!data) {
      throw new Error('Generation not found or already removed');
    }
    
    // Remove from local state immediately for instant UI feedback
    setAllGenerations(current => current.filter(g => g.id !== generationId));
    
    // Stop playing if this item is currently playing (double-check)
    if (currentlyPlaying === generationId) {
      audioRef.current?.pause();
      setCurrentlyPlaying(null);
      setIsPlaying(false);
    }
  } catch (error) {
    console.error('Error deleting generation:', error);
    alert('Error removing generation. Please try again.');
  }
}, [currentlyPlaying, navigate]);

  const handlePlay = useCallback((generation) => {
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
  }, [currentlyPlaying, isPlaying]);

  const getImageUrls = useCallback((outputFileUrl) => {
    if (!outputFileUrl) return [];
    
    try {
      if (typeof outputFileUrl === 'string' && outputFileUrl.startsWith('[')) {
        const parsed = JSON.parse(outputFileUrl);
        return Array.isArray(parsed) ? parsed : [outputFileUrl];
      }
      return [outputFileUrl];
    } catch {
      return [outputFileUrl];
    }
  }, []);

  const getMediaType = useCallback((generation) => {
    const toolType = generation.tool_type;
    
    if (toolType?.includes('video') || toolType?.includes('kling') || toolType?.includes('wan') || 
        toolType?.includes('minimax') || toolType?.includes('veo') || toolType?.includes('ltxv') || 
        toolType?.includes('seedance') || toolType?.includes('fal_wan_v22_a14b') || 
        toolType?.includes('ai_scene_gen') || toolType?.includes('fal_omnihuman') ||
        toolType?.includes('fal_mmaudio_video2')) {
      return 'video';
    } else if (toolType?.includes('music') || toolType?.includes('cassetteai') || 
               toolType?.includes('fal_mmaudio_v2')) {
      return 'audio';
    } else {
      return 'image';
    }
  }, []);

  const getStatusColor = useCallback((status) => {
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
  }, []);

  const getToolIcon = useCallback((toolType) => {
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
  }, []);

  const isVideoType = (toolType) => {
    return toolType?.includes('video') || toolType?.includes('fal_omnihuman') || toolType?.includes('kling') || toolType?.includes('wan') || toolType?.includes('minimax') || toolType?.includes('veo') || toolType?.includes('ltxv') || toolType?.includes('seedance') || toolType?.includes('fal_wan_v22_a14b') || toolType?.includes('ai_scene_gen') || toolType?.includes('fal_wan_v22_video2video') || toolType?.includes('fal_mmaudio_video2');
  };

  const isAudioType = (toolType) => {
    return toolType?.includes('music') || toolType?.includes('cassetteai') || toolType?.includes('fal_mmaudio_v2');
  };

  // Memoized generation card component for performance
  const GenerationCard = React.memo(({ generation, index }) => {
    const mediaType = getMediaType(generation);
    const imageUrls = getImageUrls(generation.output_file_url);
    const primaryUrl = imageUrls[0];
    const thumbnailUrl = getThumbnailForTextVideoTool(generation);

    return (
      <div
        key={generation.id}
        className={`bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-all duration-200 cursor-pointer ${
          viewMode === 'list' ? 'flex items-center space-x-4 p-4' : ''
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
              thumbnailUrl && generation.thumbnail_url ? (
                // Use the actual thumbnail image for text-to-video tools
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
              {thumbnailUrl ? (
                <div className="w-full h-full bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
                  <span className="text-gray-500 text-xs">Loading thumbnail...</span>
                </div>
              ) : (
                getToolIcon(generation.tool_type)
              )}
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
          
          {/* Play button for videos */}
          {mediaType === 'video' && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Play className="w-6 h-6 text-white ml-1" />
              </div>
            </div>
          )}
          
          {/* Play button for audio */}
          {mediaType === 'audio' && (
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
        <div className={`${viewMode === 'list' ? 'flex-1' : 'p-4'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`font-medium text-white truncate ${viewMode === 'list' ? 'text-base' : 'text-sm'}`}>
              {generation.generation_name}
            </h3>
            {viewMode === 'grid' && (
              <div className="flex space-x-1">
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
                    handleDelete(generation.id);
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          
          <div className={`flex items-center space-x-2 mb-2 ${viewMode === 'list' ? 'text-sm' : 'text-xs'}`}>
            <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded flex items-center justify-center text-white">
              {getToolIcon(generation.tool_type)}
            </div>
            <span className="text-purple-200 truncate">{generation.tool_name}</span>
          </div>
          
          <div className={`flex items-center justify-between text-purple-300 ${viewMode === 'list' ? 'text-sm' : 'text-xs'}`}>
            <span>{generation.tokens_used} tokens</span>
            <span>{new Date(generation.created_at).toLocaleDateString()}</span>
          </div>
          
          {viewMode === 'list' && (
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
                  handleDelete(generation.id);
                }}
                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading gallery...</div>
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
              <h1 className="text-xl font-bold text-white">My Gallery</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchGenerations}
                className="flex items-center space-x-2 text-purple-200 hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                <option value="all" className="bg-gray-800 text-white">All Status</option>
                <option value="completed" className="bg-gray-800 text-white">Completed</option>
                <option value="processing" className="bg-gray-800 text-white">Processing</option>
                <option value="failed" className="bg-gray-800 text-white">Failed</option>
              </select>

              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 [&>option]:bg-gray-800 [&>option]:text-white"
              >
                <option value="all" className="bg-gray-800 text-white">All Time</option>
                <option value="today" className="bg-gray-800 text-white">Today</option>
                <option value="week" className="bg-gray-800 text-white">This Week</option>
                <option value="month" className="bg-gray-800 text-white">This Month</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 [&>option]:bg-gray-800 [&>option]:text-white"
              >
                <option value="date" className="bg-gray-800 text-white">Date</option>
                <option value="name" className="bg-gray-800 text-white">Name</option>
                <option value="tool" className="bg-gray-800 text-white">Tool</option>
                <option value="tokens" className="bg-gray-800 text-white">Tokens</option>
                <option value="status" className="bg-gray-800 text-white">Status</option>
              </select>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-white/10 text-purple-200 hover:bg-white/20'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-white/10 text-purple-200 hover:bg-white/20'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Results Info */}
            <div className="text-purple-200 text-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0">
                <span>
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, (currentPage - 1) * ITEMS_PER_PAGE + filteredGenerations.length)} of {totalPages * ITEMS_PER_PAGE}
                </span>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Generations Grid/List */}
        {filteredGenerations.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-8 h-8 text-purple-300" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No generations found</h3>
            <p className="text-purple-200 mb-6">
              {searchTerm || filterTool !== 'all' || filterStatus !== 'all' 
                ? 'Try adjusting your filters or search terms'
                : 'Start creating with our AI tools to see your generations here'
              }
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              Start Creating
            </button>
          </div>
        ) : (
          <>
            <div className={`${
              viewMode === 'grid' 
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6' 
                : 'space-y-4'
            }`}>
              {filteredGenerations.map((generation, index) => (
                <GenerationCard 
                  key={generation.id} 
                  generation={generation} 
                  index={index} 
                />
              ))}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                <button
                  onClick={handlePrevPage}
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
                        onClick={() => handlePageChange(pageNum)}
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
                  
                  {totalPages > 5 && (
                    <>
                      <span className="text-purple-300 px-1">...</span>
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg font-medium text-sm transition-colors flex-shrink-0 ${
                          currentPage === totalPages
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/10 hover:bg-white/20 text-purple-200'
                        }`}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>
                
                <button
                  onClick={handleNextPage}
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
              {selectedGeneration.output_file_url && getImageUrls(selectedGeneration.output_file_url).length > 0 && (
                <div className="mb-6">
                  {getMediaType(selectedGeneration) === 'video' ? (
                    selectedGeneration.thumbnail_url ? (
                      // Show thumbnail first, then video for text-to-video tools
                      <div className="space-y-4">
                        <OptimizedImage
                          src={toCdnUrl(selectedGeneration.thumbnail_url)}
                          alt={`${selectedGeneration.generation_name} thumbnail`}
                          className="w-full max-h-96 object-contain rounded-lg"
                        />
                        <OptimizedVideo
                          src={getImageUrls(selectedGeneration.output_file_url)[0]}
                          className="w-full max-h-96 rounded-lg"
                          poster={selectedGeneration.thumbnail_url}
                          controls={true}
                          preload="metadata"
                        />
                      </div>
                    ) : (
                    <OptimizedVideo
                      src={getImageUrls(selectedGeneration.output_file_url)[0]}
                      className="w-full max-h-96 rounded-lg"
                      poster={selectedGeneration.thumbnail_url || selectedGeneration.metadata?.thumbnail_url || selectedGeneration.input_data?.imageUrl}
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
                        <h4 className="text-white font-semibold text-lg mb-2">🎵 Audio Track</h4>
                        <audio
                          src={toCdnUrl(selectedGeneration.output_file_url)}
                          controls
                          className="w-full max-w-md mx-auto"
                          preload="metadata"
                        />
                      </div>
                    </div>
                  ) : getImageUrls(selectedGeneration.output_file_url).length === 1 ? (
                    <OptimizedImage
                      src={getImageUrls(selectedGeneration.output_file_url)[0]}
                      alt={selectedGeneration.generation_name}
                      className="w-full max-h-96 object-contain rounded-lg"
                    />
                  ) : (
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-3">
                        Generated Images ({getImageUrls(selectedGeneration.output_file_url).length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {getImageUrls(selectedGeneration.output_file_url).map((url, index) => (
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

              {/* -------- Polished details + configuration layout (UI-only changes) -------- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Details Card */}
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
                    {selectedGeneration.completed_at && (
                      <div className="grid grid-cols-12 gap-3 items-start">
                        <span className="col-span-5 text-purple-200">Completed</span>
                        <span className="col-span-7 text-white justify-self-end text-right break-words">
                          {new Date(selectedGeneration.completed_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Configuration Card */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">Configuration</h4>
                  <div className="space-y-3 text-sm">
                    {selectedGeneration.input_data && Object.entries(selectedGeneration.input_data).map(([key, value]) => {
                      const label = key.replace(/([A-Z])/g, ' $1').trim();
                      const displayValue = formatConfigValue(key, value);
                      const isLongText = ['prompt', 'negativeprompt', 'description', 'caption'].includes(key.toLowerCase());
                      return (
                        <div key={key} className="grid grid-cols-12 gap-3 items-start">
                          <span className="col-span-5 text-purple-200 capitalize">{label}:</span>
                          <span
                            className={`col-span-7 justify-self-end text-right break-words ${
                              isLongText ? 'whitespace-pre-wrap bg-black/20 border border-white/10 rounded-md px-3 py-2 text-white' : 'text-white'
                            }`}
                            // keep the full URL in a tooltip when we collapse to a filename
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
              {/* ----------------------------------------------------------------------- */}

              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                {selectedGeneration.output_file_url && (
                  <button
                    onClick={() => handleDownload(selectedGeneration)}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                )}
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

      {/* Expanded Image Viewer */}
      {showExpandedImage && selectedGeneration && expandedImageIndex !== null && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="relative max-w-7xl w-full max-h-[95vh] flex items-center justify-center">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowExpandedImage(false);
                setExpandedImageIndex(null);
              }}
              className="absolute top-4 right-4 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Navigation Arrows */}
            {getImageUrls(selectedGeneration.output_file_url).length > 1 && (
              <>
                <button
                  onClick={() => {
                    const imageUrls = getImageUrls(selectedGeneration.output_file_url);
                    setExpandedImageIndex((expandedImageIndex - 1 + imageUrls.length) % imageUrls.length);
                  }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                
                <button
                  onClick={() => {
                    const imageUrls = getImageUrls(selectedGeneration.output_file_url);
                    setExpandedImageIndex((expandedImageIndex + 1) % imageUrls.length);
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-6 h-6 rotate-180" />
                </button>
              </>
            )}

            {/* Expanded Image */}
            <OptimizedImage
              src={getImageUrls(selectedGeneration.output_file_url)[expandedImageIndex]}
              alt={`${selectedGeneration.generation_name} - Image ${expandedImageIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg"
            />

            {/* Image Counter */}
            {getImageUrls(selectedGeneration.output_file_url).length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
                {expandedImageIndex + 1} of {getImageUrls(selectedGeneration.output_file_url).length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden Audio Element */}
      {currentlyPlaying && (
        <audio
          ref={audioRef}
          src={toCdnUrl(allGenerations.find(g => g.id === currentlyPlaying)?.output_file_url)}
          onError={(e) => {
            console.error('Audio playback error:', e);
            setIsPlaying(false);
            setCurrentlyPlaying(null);
          }}
        />
      )}

      {/* Mini Audio Player (when music is playing) */}
      {currentlyPlaying && (
        <div className="fixed bottom-4 right-4 bg-gradient-to-r from-pink-500/90 to-rose-500/90 backdrop-blur-md rounded-2xl p-4 border border-pink-500/30 shadow-2xl z-50">
          <div className="flex items-center space-x-3 mb-2">
            <button
              onClick={() => handlePlay(allGenerations.find(g => g.id === currentlyPlaying))}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-all"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">
                {allGenerations.find(g => g.id === currentlyPlaying)?.generation_name || 'Music Track'}
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
};

export default Gallery;
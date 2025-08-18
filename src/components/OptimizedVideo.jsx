import React, { useState, useCallback } from 'react';
import { toCdnUrl } from '../utils/cdnHelpers';
import { Video, Play } from 'lucide-react';

const OptimizedVideo = React.memo(({ 
  src, 
  poster,
  className = '', 
  controls = true,
  preloadProp = 'metadata',
  muted = false,
  playsInline = false,
  onError,
  ...props 
}) => {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  const handleLoadedData = useCallback(() => {
    setVideoLoaded(true);
    setVideoError(false);
  }, []);

  const handleError = useCallback((e) => {
    console.error('Video load error:', e, 'Source:', src);
    
    // Try to retry loading with different approach
    if (retryCount < maxRetries) {
      console.log(`Retrying video load (${retryCount + 1}/${maxRetries})`);
      setRetryCount(prev => prev + 1);
      // Force reload by updating the src
      setTimeout(() => {
        const video = e.target;
        if (video) {
          video.load();
        }
      }, 1000);
    } else {
      setVideoError(true);
      if (onError) onError(e);
    }
  }, [onError]);

  if (videoError) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <Video className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 text-xs">Video unavailable</p>
          <button 
            onClick={() => {
              setVideoError(false);
              setRetryCount(0);
              setVideoLoaded(false);
            }}
            className="text-blue-500 text-xs mt-1 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {!videoLoaded && (
        <div className={`absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center`}>
          <Play className="w-8 h-8 text-gray-400" />
        </div>
      )}
      <video
        key={`${src}-${retryCount}`}
        src={toCdnUrl(src)}
        poster={poster ? toCdnUrl(poster) : undefined}
        className={`${className} ${videoLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        controls={controls}
        preload={preloadProp}
        muted={muted}
        playsInline={playsInline}
        onLoadedData={handleLoadedData}
        onError={handleError}
        onCanPlay={() => setVideoLoaded(true)}
        crossOrigin="anonymous"
        {...props}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
});

OptimizedVideo.displayName = 'OptimizedVideo';

export default OptimizedVideo;
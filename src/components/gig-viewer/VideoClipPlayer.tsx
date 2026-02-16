import { useState, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoClipPlayerProps {
  videoUrl: string | null;
  thumbnailUrl?: string | null;
  isPlaying: boolean;
  onEnded?: () => void;
}

export const VideoClipPlayer = memo(({ videoUrl, thumbnailUrl, isPlaying, onEnded }: VideoClipPlayerProps) => {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [activeVideo, setActiveVideo] = useState<'a' | 'b'>('a');
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);

  // Handle video URL changes with crossfade
  useEffect(() => {
    if (!videoUrl || videoUrl === currentUrl) return;

    if (!currentUrl) {
      // First video - no crossfade needed
      setCurrentUrl(videoUrl);
      setActiveVideo('a');
      return;
    }

    // Set up crossfade: load new URL in inactive video
    setNextUrl(videoUrl);
    const nextVideo = activeVideo === 'a' ? 'b' : 'a';
    
    // Short delay to let the new video buffer
    const timer = setTimeout(() => {
      setCurrentUrl(videoUrl);
      setActiveVideo(nextVideo);
      setNextUrl(null);
    }, 300);

    return () => clearTimeout(timer);
  }, [videoUrl]);

  // Control playback
  useEffect(() => {
    const activeRef = activeVideo === 'a' ? videoARef : videoBRef;
    if (activeRef.current) {
      if (isPlaying) {
        activeRef.current.play().catch(() => {});
      } else {
        activeRef.current.pause();
      }
    }
  }, [isPlaying, activeVideo, currentUrl]);

  if (!currentUrl) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
        ) : (
          <div className="text-muted-foreground text-sm">Waiting for clips...</div>
        )}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black overflow-hidden">
      {/* Video A */}
      <AnimatePresence>
        {(activeVideo === 'a' || nextUrl) && (
          <motion.video
            ref={videoARef}
            key="video-a"
            src={activeVideo === 'a' ? currentUrl : nextUrl || undefined}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: activeVideo === 'a' ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            autoPlay={isPlaying && activeVideo === 'a'}
            muted
            loop
            playsInline
            onEnded={onEnded}
          />
        )}
      </AnimatePresence>

      {/* Video B */}
      <AnimatePresence>
        {(activeVideo === 'b' || nextUrl) && (
          <motion.video
            ref={videoBRef}
            key="video-b"
            src={activeVideo === 'b' ? currentUrl : nextUrl || undefined}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: activeVideo === 'b' ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            autoPlay={isPlaying && activeVideo === 'b'}
            muted
            loop
            playsInline
            onEnded={onEnded}
          />
        )}
      </AnimatePresence>

      {/* Film grain overlay for MTV2/Kerrang aesthetic */}
      <div 
        className="absolute inset-0 pointer-events-none z-10 mix-blend-overlay opacity-20"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.4\'/%3E%3C/svg%3E")',
          backgroundSize: '128px 128px',
        }}
      />

      {/* Vignette */}
      <div 
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%)',
        }}
      />
    </div>
  );
});

VideoClipPlayer.displayName = 'VideoClipPlayer';

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Eye,
  Star,
  DollarSign,
  Music,
  Film,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";

interface MusicVideo {
  id: string;
  title: string;
  description: string | null;
  video_url?: string | null;
  production_quality: number;
  views_count: number;
  earnings: number;
  hype_score: number;
  status: string;
  songs?: {
    title: string;
    audio_url?: string;
    audio_generation_status?: string;
  } | null;
}

interface MusicVideoViewerDialogProps {
  video: MusicVideo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewLogged?: () => void;
}

// Animated equalizer bars
const AudioVisualizer = ({ isPlaying, quality }: { isPlaying: boolean; quality: number }) => {
  const barCount = 48;
  
  return (
    <div className="absolute bottom-0 left-0 right-0 h-28 flex items-end justify-center gap-[3px] px-6 pointer-events-none">
      {Array.from({ length: barCount }).map((_, i) => {
        const baseHeight = 12 + Math.random() * 50;
        const qualityBoost = Math.max(0.4, quality / 100);
        const center = barCount / 2;
        const distFromCenter = Math.abs(i - center) / center;
        const shapeMult = 1 - distFromCenter * 0.6;
        
        return (
          <motion.div
            key={i}
            className="rounded-t"
            style={{
              width: "3px",
              background: `linear-gradient(to top, hsl(var(--primary)), hsl(var(--primary) / 0.4))`,
              opacity: isPlaying ? 0.85 : 0.3,
            }}
            initial={{ height: 3 }}
            animate={{
              height: isPlaying
                ? [
                    baseHeight * qualityBoost * shapeMult,
                    (baseHeight + 25) * qualityBoost * shapeMult,
                    (baseHeight - 8) * qualityBoost * shapeMult,
                    (baseHeight + 35) * qualityBoost * shapeMult,
                    baseHeight * qualityBoost * shapeMult,
                  ]
                : 3,
            }}
            transition={{
              duration: 0.4 + Math.random() * 0.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.015,
            }}
          />
        );
      })}
    </div>
  );
};

// Floating particles
const FloatingParticles = ({ isPlaying, hype }: { isPlaying: boolean; hype: number }) => {
  const particleCount = Math.floor(hype / 8) + 8;
  
  if (!isPlaying) return null;
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: particleCount }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 3 + Math.random() * 4,
            height: 3 + Math.random() * 4,
            background: `hsl(var(--primary) / ${0.3 + Math.random() * 0.4})`,
          }}
          initial={{
            x: Math.random() * 100 + "%",
            y: "110%",
            opacity: 0,
          }}
          animate={{
            y: "-10%",
            opacity: [0, 0.8, 0.8, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 3,
            repeat: Infinity,
            delay: i * 0.25,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
};

export function MusicVideoViewerDialog({
  video,
  open,
  onOpenChange,
  onViewLogged,
}: MusicVideoViewerDialogProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [hasLoggedView, setHasLoggedView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const audioUrl = video?.songs?.audio_url;
  const videoUrl = video?.video_url;
  
  const hasRealVideo = !!videoUrl;
  const hasAudio = !!audioUrl;
  const hasPlayableContent = hasRealVideo || hasAudio;

  // Parse description for AI metadata
  const aiMetadata = video?.description ? (() => {
    try {
      return JSON.parse(video.description);
    } catch {
      return null;
    }
  })() : null;

  // Get a visual theme background
  const getThemeBackground = () => {
    const theme = aiMetadata?.visual_theme;
    switch (theme) {
      case "neon_cyberpunk":
        return "radial-gradient(ellipse at 30% 20%, hsl(280 60% 15% / 0.8) 0%, hsl(220 50% 8%) 50%, hsl(var(--primary) / 0.1) 100%)";
      case "nature_ethereal":
        return "radial-gradient(ellipse at 50% 30%, hsl(150 30% 15% / 0.6) 0%, hsl(180 20% 8%) 60%, hsl(120 20% 5%) 100%)";
      case "vintage_retro":
        return "radial-gradient(ellipse at 40% 40%, hsl(35 40% 18% / 0.6) 0%, hsl(25 20% 10%) 60%, hsl(20 15% 5%) 100%)";
      case "urban_gritty":
        return "radial-gradient(ellipse at 50% 50%, hsl(0 0% 18% / 0.8) 0%, hsl(0 0% 8%) 70%, hsl(0 0% 3%) 100%)";
      default:
        return "radial-gradient(ellipse at 30% 30%, hsl(var(--primary) / 0.15) 0%, hsl(240 10% 6%) 50%, hsl(0 0% 3%) 100%)";
    }
  };

  // Auto-play when dialog opens
  useEffect(() => {
    if (open && hasPlayableContent && isLoaded) {
      const timer = setTimeout(() => {
        const mediaElement = hasRealVideo ? videoRef.current : audioRef.current;
        if (mediaElement) {
          mediaElement.play().then(() => {
            setIsPlaying(true);
            // Log view after 10 seconds
            if (!hasLoggedView) {
              setTimeout(() => {
                setHasLoggedView(true);
                onViewLogged?.();
              }, 10000);
            }
          }).catch(() => {
            // Autoplay blocked by browser, user will need to click
          });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, hasPlayableContent, isLoaded, hasRealVideo]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setCurrentTime(0);
      setHasLoggedView(false);
      setIsLoaded(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [open]);

  useEffect(() => {
    const mediaElement = hasRealVideo ? videoRef.current : audioRef.current;
    if (mediaElement) {
      mediaElement.volume = volume / 100;
    }
  }, [volume, hasRealVideo]);

  const togglePlay = useCallback(() => {
    const mediaElement = hasRealVideo ? videoRef.current : audioRef.current;
    if (!mediaElement) return;
    
    if (isPlaying) {
      mediaElement.pause();
    } else {
      mediaElement.play();
      if (!hasLoggedView) {
        setTimeout(() => {
          setHasLoggedView(true);
          onViewLogged?.();
        }, 10000);
      }
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, hasRealVideo, hasLoggedView, onViewLogged]);

  const toggleMute = () => {
    const mediaElement = hasRealVideo ? videoRef.current : audioRef.current;
    if (mediaElement) {
      mediaElement.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    const mediaElement = hasRealVideo ? videoRef.current : audioRef.current;
    if (mediaElement) {
      setCurrentTime(mediaElement.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const mediaElement = hasRealVideo ? videoRef.current : audioRef.current;
    if (mediaElement) {
      setDuration(mediaElement.duration);
      setIsLoaded(true);
    }
  };

  const handleSeek = (value: number[]) => {
    const mediaElement = hasRealVideo ? videoRef.current : audioRef.current;
    if (mediaElement) {
      mediaElement.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleFullscreen = () => {
    if (hasRealVideo && videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
        <DialogHeader className="p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
          <DialogTitle className="flex items-center gap-3 text-white">
            <Film className="h-5 w-5 text-primary" />
            <span className="truncate">{video.title}</span>
            {video.songs?.title && video.songs.title !== video.title && (
              <span className="text-white/50 text-sm truncate">— {video.songs.title}</span>
            )}
            {hasRealVideo && (
              <Badge className="bg-green-600 shrink-0">
                HD Video
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Video/Audio Display Area - Clickable */}
        <div 
          className="relative aspect-video overflow-hidden cursor-pointer select-none"
          style={{ background: getThemeBackground() }}
          onClick={hasPlayableContent ? togglePlay : undefined}
        >
          {hasRealVideo ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="absolute inset-0 w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
            />
          ) : (
            <>
              {/* Floating particles */}
              <FloatingParticles isPlaying={isPlaying} hype={video.hype_score} />

              {/* Pulsing background rings */}
              {isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {[1, 2, 3].map((ring) => (
                    <motion.div
                      key={ring}
                      className="absolute rounded-full border border-primary/10"
                      animate={{
                        width: [100 + ring * 60, 200 + ring * 80],
                        height: [100 + ring * 60, 200 + ring * 80],
                        opacity: [0.3, 0],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        delay: ring * 0.6,
                        ease: "easeOut",
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Center content */}
              <div className="absolute inset-0 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {!isPlaying ? (
                    <motion.div
                      key="paused"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="text-center space-y-4"
                    >
                      <motion.div
                        className="w-28 h-28 rounded-full bg-primary/20 flex items-center justify-center backdrop-blur-sm border border-primary/30 mx-auto"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {hasPlayableContent ? (
                          <Play className="h-14 w-14 text-primary fill-primary/30 ml-1" />
                        ) : (
                          <Music className="h-14 w-14 text-primary" />
                        )}
                      </motion.div>
                      <div className="text-white/80">
                        <p className="font-semibold text-lg">{video.songs?.title || video.title}</p>
                        {aiMetadata?.visual_theme && (
                          <p className="text-sm text-white/50 capitalize">
                            {aiMetadata.visual_theme.replace(/_/g, " ")}
                            {aiMetadata.art_style ? ` • ${aiMetadata.art_style.replace(/_/g, " ")}` : ""}
                          </p>
                        )}
                        {hasPlayableContent && (
                          <p className="text-xs text-primary/80 mt-2">
                            Click anywhere to play
                          </p>
                        )}
                        {!hasPlayableContent && (
                          <p className="text-xs text-white/40 mt-2">
                            No audio available for this video yet
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="playing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center"
                    >
                      {/* Spinning vinyl disc */}
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="w-20 h-20 rounded-full flex items-center justify-center"
                        style={{
                          background: "conic-gradient(from 0deg, hsl(var(--primary) / 0.4), hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.3), hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.4))",
                          boxShadow: "0 0 40px hsl(var(--primary) / 0.2)",
                        }}
                      >
                        <div className="w-6 h-6 rounded-full bg-black/80 border border-primary/30" />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Audio visualizer */}
              <AudioVisualizer isPlaying={isPlaying} quality={video.production_quality} />
            </>
          )}

          {/* Stats overlay */}
          <div className="absolute top-16 right-4 space-y-2 text-white/80 text-sm z-20">
            <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <Eye className="h-3.5 w-3.5" />
              {video.views_count.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <Star className="h-3.5 w-3.5 text-yellow-500" />
              {video.hype_score}
            </div>
            <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <DollarSign className="h-3.5 w-3.5 text-green-500" />
              ${video.earnings.toLocaleString()}
            </div>
          </div>

          {/* Tap-to-pause indicator */}
          {isPlaying && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none"
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              <Pause className="h-16 w-16 text-white/80" />
            </motion.div>
          )}

          {/* Hidden audio element */}
          {!hasRealVideo && hasAudio && (
            <audio
              ref={audioRef}
              src={audioUrl}
              preload="auto"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              onCanPlayThrough={() => setIsLoaded(true)}
            />
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-gradient-to-t from-black to-black/90 space-y-3">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60 w-10 text-right font-mono">{formatTime(currentTime)}</span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              disabled={!hasPlayableContent}
              className="flex-1"
            />
            <span className="text-xs text-white/60 w-10 font-mono">{formatTime(duration)}</span>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                disabled={!hasPlayableContent}
                className="text-white hover:bg-white/20"
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                disabled={!hasPlayableContent}
                className="text-white hover:bg-white/20"
              >
                {isMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </Button>

              <div className="w-24">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={100}
                  step={1}
                  onValueChange={(v) => {
                    setVolume(v[0]);
                    setIsMuted(v[0] === 0);
                  }}
                  disabled={!hasPlayableContent}
                />
              </div>
            </div>

            <div className="text-white/50 text-sm">
              {hasRealVideo ? (
                <span className="text-green-400">HD Video • {video.production_quality}% Quality</span>
              ) : hasAudio ? (
                <span>🎵 {video.songs?.title || "Now Playing"}</span>
              ) : (
                <span className="text-white/30">No media available</span>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleFullscreen}
              disabled={!hasRealVideo}
            >
              <Maximize2 className="h-5 w-5" />
            </Button>
          </div>

          {/* AI Scene descriptions */}
          {aiMetadata?.scene_descriptions && aiMetadata.scene_descriptions.length > 0 && (
            <div className="pt-2 border-t border-white/10">
              <p className="text-xs text-white/30 mb-2">Scene Descriptions:</p>
              <div className="flex gap-2 flex-wrap">
                {aiMetadata.scene_descriptions.slice(0, 4).map((scene: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-white/50 border-white/15 text-xs">
                    {scene.length > 40 ? scene.substring(0, 40) + "..." : scene}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
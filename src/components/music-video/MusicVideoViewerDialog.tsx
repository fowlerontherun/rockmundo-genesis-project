import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

// Simple audio visualizer bars
const AudioVisualizer = ({ isPlaying, quality }: { isPlaying: boolean; quality: number }) => {
  const barCount = 32;
  const bars = Array.from({ length: barCount });
  
  return (
    <div className="absolute bottom-0 left-0 right-0 h-24 flex items-end justify-center gap-1 px-4 pointer-events-none">
      {bars.map((_, i) => {
        const baseHeight = 10 + Math.random() * 40;
        const qualityBoost = quality / 100;
        
        return (
          <motion.div
            key={i}
            className="w-2 rounded-t bg-gradient-to-t from-primary to-primary/50"
            initial={{ height: 4 }}
            animate={{
              height: isPlaying
                ? [
                    baseHeight * qualityBoost,
                    (baseHeight + 20) * qualityBoost,
                    (baseHeight - 10) * qualityBoost,
                    (baseHeight + 30) * qualityBoost,
                    baseHeight * qualityBoost,
                  ]
                : 4,
            }}
            transition={{
              duration: 0.5 + Math.random() * 0.3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.02,
            }}
            style={{ opacity: 0.8 }}
          />
        );
      })}
    </div>
  );
};

// Floating particles effect
const FloatingParticles = ({ isPlaying, hype }: { isPlaying: boolean; hype: number }) => {
  const particleCount = Math.floor(hype / 10) + 5;
  
  if (!isPlaying) return null;
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: particleCount }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-primary/40"
          initial={{
            x: Math.random() * 100 + "%",
            y: "100%",
            opacity: 0,
          }}
          animate={{
            y: "-10%",
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: i * 0.3,
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [hasLoggedView, setHasLoggedView] = useState(false);

  const audioUrl = video?.songs?.audio_url;
  const hasAudio = !!audioUrl;

  // Parse description for AI metadata
  const aiMetadata = video?.description ? (() => {
    try {
      return JSON.parse(video.description);
    } catch {
      return null;
    }
  })() : null;

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setCurrentTime(0);
      setHasLoggedView(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [open]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
      // Log view after 10 seconds of watching
      if (!hasLoggedView) {
        setTimeout(() => {
          setHasLoggedView(true);
          onViewLogged?.();
        }, 10000);
      }
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
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
            {aiMetadata?.ai_generated && (
              <Badge variant="secondary" className="shrink-0">
                AI Generated
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Video Display Area */}
        <div className="relative aspect-video bg-gradient-to-br from-background via-muted to-background overflow-hidden">
          {/* Background visual effects based on AI metadata */}
          <div 
            className="absolute inset-0"
            style={{
              background: aiMetadata?.visual_theme === "neon_cyberpunk"
                ? "linear-gradient(135deg, hsl(var(--primary)/0.3), hsl(280 70% 30% / 0.3), hsl(var(--primary)/0.3))"
                : aiMetadata?.visual_theme === "nature_ethereal"
                ? "linear-gradient(135deg, hsl(120 40% 20% / 0.5), hsl(180 40% 30% / 0.5))"
                : aiMetadata?.visual_theme === "vintage_retro"
                ? "linear-gradient(135deg, hsl(30 50% 30% / 0.5), hsl(40 40% 25% / 0.5))"
                : aiMetadata?.visual_theme === "urban_gritty"
                ? "linear-gradient(135deg, hsl(0 0% 20% / 0.7), hsl(0 0% 15% / 0.7))"
                : "linear-gradient(135deg, hsl(var(--primary)/0.2), hsl(var(--secondary)/0.2))",
            }}
          />

          {/* Floating particles */}
          <FloatingParticles isPlaying={isPlaying} hype={video.hype_score} />

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
                  <div className="relative">
                    <motion.div
                      className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center backdrop-blur-sm border border-primary/30"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Music className="h-16 w-16 text-primary" />
                    </motion.div>
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary/50"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  <div className="text-white/80">
                    <p className="font-semibold text-lg">{video.songs?.title || "Music Video"}</p>
                    {aiMetadata?.visual_theme && (
                      <p className="text-sm text-white/60 capitalize">
                        {aiMetadata.visual_theme.replace(/_/g, " ")} • {aiMetadata.art_style?.replace(/_/g, " ")}
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
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="w-24 h-24 rounded-full border-4 border-primary/30 flex items-center justify-center"
                    style={{
                      background: "radial-gradient(circle, hsl(var(--primary)/0.3), transparent)",
                    }}
                  >
                    <Music className="h-10 w-10 text-primary" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Audio visualizer */}
          <AudioVisualizer isPlaying={isPlaying} quality={video.production_quality} />

          {/* Stats overlay */}
          <div className="absolute top-16 right-4 space-y-2 text-white/80 text-sm">
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full">
              <Eye className="h-4 w-4" />
              {video.views_count.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full">
              <Star className="h-4 w-4 text-yellow-500" />
              {video.hype_score}
            </div>
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full">
              <DollarSign className="h-4 w-4 text-green-500" />
              ${video.earnings.toLocaleString()}
            </div>
          </div>

          {/* Hidden audio element */}
          {hasAudio && (
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
            />
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-gradient-to-t from-black to-black/90 space-y-3">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60 w-10">{formatTime(currentTime)}</span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              disabled={!hasAudio}
              className="flex-1"
            />
            <span className="text-xs text-white/60 w-10">{formatTime(duration)}</span>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                disabled={!hasAudio}
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
                disabled={!hasAudio}
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
                  disabled={!hasAudio}
                />
              </div>
            </div>

            <div className="text-white/60 text-sm">
              {hasAudio ? (
                <span>Quality: {video.production_quality}%</span>
              ) : (
                <span className="text-yellow-500">No audio available - generate song first</span>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => {
                // Could implement fullscreen here
              }}
            >
              <Maximize2 className="h-5 w-5" />
            </Button>
          </div>

          {/* AI Scene descriptions */}
          {aiMetadata?.scene_descriptions && aiMetadata.scene_descriptions.length > 0 && (
            <div className="pt-2 border-t border-white/10">
              <p className="text-xs text-white/40 mb-2">Scene Descriptions:</p>
              <div className="flex gap-2 flex-wrap">
                {aiMetadata.scene_descriptions.slice(0, 4).map((scene: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-white/60 border-white/20 text-xs">
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

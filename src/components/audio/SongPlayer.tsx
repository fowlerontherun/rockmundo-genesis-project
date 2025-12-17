import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2, VolumeX, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SongShareButtons } from "./SongShareButtons";

interface SongPlayerProps {
  audioUrl: string | null;
  title?: string;
  artist?: string;
  className?: string;
  compact?: boolean;
  generationStatus?: string | null;
  showShare?: boolean;
  onPlay?: () => void;
}

export const SongPlayer = ({
  audioUrl,
  title,
  artist,
  className,
  compact = false,
  generationStatus,
  showShare = true,
  onPlay,
}: SongPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = async () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        // Track play when user starts playing
        onPlay?.();
      } catch (error) {
        console.error("Error playing audio:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(value[0] === 0);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Show generating status
  if (generationStatus === "generating" || generationStatus === "pending") {
    return (
      <div className={cn("flex items-center gap-2 p-2 rounded-lg bg-secondary/50", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">
          {generationStatus === "generating" ? "Generating audio..." : "Audio pending..."}
        </span>
      </div>
    );
  }

  // No audio available
  if (!audioUrl) {
    return (
      <div className={cn("flex items-center gap-2 p-2 rounded-lg bg-secondary/30", className)}>
        <VolumeX className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">No audio available</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={togglePlay}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <div className="flex-1 min-w-0">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={handleSeek}
            className="w-full"
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        {showShare && audioUrl && (
          <SongShareButtons songTitle={title || "Song"} artistName={artist} compact />
        )}
      </div>
    );
  }

  return (
    <div className={cn("p-4 rounded-lg bg-secondary/30 border", className)}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      {/* Title and Artist */}
      {(title || artist) && (
        <div className="mb-3">
          {title && <div className="font-medium truncate">{title}</div>}
          {artist && <div className="text-sm text-muted-foreground truncate">{artist}</div>}
        </div>
      )}

      {/* Progress Bar */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-muted-foreground w-10">
          {formatTime(currentTime)}
        </span>
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={1}
          onValueChange={handleSeek}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-10 text-right">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <Button
          size="icon"
          variant="outline"
          onClick={togglePlay}
          disabled={isLoading}
          className="h-10 w-10"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </Button>

        <div className="flex items-center gap-2">
          {/* Share Button */}
          {showShare && audioUrl && (
            <SongShareButtons songTitle={title || "Song"} artistName={artist} compact />
          )}

          {/* Volume Control */}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.1}
            onValueChange={handleVolumeChange}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
};

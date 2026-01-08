import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Pause, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Loader2, 
  Radio,
  Music,
  Shuffle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Song {
  id: string;
  title: string;
  audio_url: string;
  band_name: string;
  genre: string | null;
}

interface RMRadioPlayerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const RMRadioPlayer = ({ open, onOpenChange }: RMRadioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Fetch all songs with audio
  const { data: allSongs, isLoading: songsLoading } = useQuery({
    queryKey: ["rm-radio-songs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select(`
          id,
          title,
          audio_url,
          genre,
          bands(name, artist_name)
        `)
        .eq("audio_generation_status", "completed")
        .not("audio_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error("[RMRadio] Error fetching songs:", error);
        return [];
      }

      return (data || []).map((song) => ({
        id: song.id,
        title: song.title || "Unknown Song",
        audio_url: song.audio_url!,
        band_name: song.bands?.artist_name || song.bands?.name || "Unknown Artist",
        genre: song.genre,
      })) as Song[];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Initialize shuffled playlist when songs load
  useEffect(() => {
    if (allSongs && allSongs.length > 0 && !hasInitialized) {
      const shuffled = shuffleArray(allSongs);
      setPlaylist(shuffled);
      setCurrentIndex(0);
      setHasInitialized(true);
    }
  }, [allSongs, hasInitialized]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setHasInitialized(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [open]);

  const currentSong = playlist[currentIndex];

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => playNext();
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = (e: Event) => {
      console.error("[RMRadio] Audio error:", e);
      playNext(); // Skip to next on error
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
    };
  }, [currentIndex, playlist.length]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Auto-play when song changes and radio is playing
  useEffect(() => {
    if (isPlaying && currentSong && audioRef.current) {
      audioRef.current.load();
      audioRef.current.play().catch(console.error);
    }
  }, [currentIndex, currentSong?.id]);

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    
    const nextIndex = (currentIndex + 1) % playlist.length;
    setCurrentIndex(nextIndex);
    setCurrentTime(0);
    setDuration(0);
  }, [currentIndex, playlist.length]);

  const reshufflePlaylist = () => {
    if (allSongs && allSongs.length > 0) {
      const shuffled = shuffleArray(allSongs);
      setPlaylist(shuffled);
      setCurrentIndex(0);
      setCurrentTime(0);
      setDuration(0);
      if (audioRef.current && isPlaying) {
        audioRef.current.load();
        audioRef.current.play().catch(console.error);
      }
    }
  };

  const togglePlay = async () => {
    if (!audioRef.current || !currentSong) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error("[RMRadio] Error playing:", error);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary animate-pulse" />
            RM Radio
            <Badge variant="outline" className="ml-2">
              {playlist.length} songs
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Loading State */}
          {songsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading songs...</span>
            </div>
          ) : playlist.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Music className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No AI-generated songs available yet</p>
            </div>
          ) : (
            <>
              {/* Hidden Audio Element */}
              <audio 
                ref={audioRef} 
                src={currentSong?.audio_url} 
                preload="metadata"
              />

              {/* Now Playing */}
              <div className="bg-gradient-to-br from-primary/10 to-secondary/20 rounded-lg p-4 border">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Now Playing
                </div>
                <div className="text-lg font-semibold truncate">
                  {currentSong?.title || "---"}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {currentSong?.band_name || "---"}
                </div>
                {currentSong?.genre && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    {currentSong.genre}
                  </Badge>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={1}
                  onValueChange={handleSeek}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={reshufflePlaylist}
                  title="Shuffle playlist"
                >
                  <Shuffle className="h-5 w-5" />
                </Button>

                <Button
                  size="icon"
                  variant="default"
                  className="h-12 w-12"
                  onClick={togglePlay}
                  disabled={isLoading || !currentSong}
                >
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6 ml-0.5" />
                  )}
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={playNext}
                  title="Next song"
                >
                  <SkipForward className="h-5 w-5" />
                </Button>
              </div>

              {/* Volume Control */}
              <div className="flex items-center gap-2">
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
                  className="flex-1"
                />
              </div>

              {/* Queue Info */}
              <div className="text-center text-xs text-muted-foreground">
                Song {currentIndex + 1} of {playlist.length} • Continuous play
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Button to trigger the radio player
interface RMRadioButtonProps {
  className?: string;
}

export const RMRadioButton = ({ className }: RMRadioButtonProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        title="RM Radio"
        className={cn("relative", className)}
      >
        <Radio className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full animate-pulse" />
      </Button>
      <RMRadioPlayer open={open} onOpenChange={setOpen} />
    </>
  );
};

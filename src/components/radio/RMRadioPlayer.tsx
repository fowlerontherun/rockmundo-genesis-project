import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
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
  Shuffle,
  Megaphone
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useRadioContent, RadioContent, getRandomContent } from "@/hooks/useRadioContent";

interface Song {
  id: string;
  title: string;
  audio_url: string;
  band_name: string;
  genre: string | null;
}

interface PlaylistItem {
  type: 'song' | 'content' | 'host-segment' | 'chart-number-one';
  song?: Song;
  content?: RadioContent;
}

// The radio host clip that plays every 30 minutes
const RADIO_HOST_CLIP_URL = "/audio/radio-host-blondie.mp3";
const HOST_SEGMENT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Build playlist with interleaved content
function buildPlaylistWithContent(songs: Song[], content: RadioContent[]): PlaylistItem[] {
  const result: PlaylistItem[] = [];
  const songsBetweenContent = 3 + Math.floor(Math.random() * 3); // 3-5 songs between content
  
  songs.forEach((song, index) => {
    result.push({ type: 'song', song });
    
    // Add random content every X songs
    if ((index + 1) % songsBetweenContent === 0 && content.length > 0) {
      const randomContent = getRandomContent(content);
      if (randomContent) {
        result.push({ type: 'content', content: randomContent });
      }
    }
  });
  
  return result;
}

// Global radio state context
interface RadioState {
  isPlaying: boolean;
  currentItem: PlaylistItem | null;
  playlist: PlaylistItem[];
  currentIndex: number;
  volume: number;
  isMuted: boolean;
}

interface RadioContextValue {
  state: RadioState;
  audioRef: React.RefObject<HTMLAudioElement>;
  togglePlay: () => void;
  playNext: () => void;
  reshufflePlaylist: () => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  initializePlaylist: (songs: Song[], content: RadioContent[]) => void;
  isInitialized: boolean;
}

const RadioContext = createContext<RadioContextValue | null>(null);

export const useRadio = () => {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error("useRadio must be used within RadioProvider");
  return ctx;
};

// Helper to get audio URL from playlist item
function getAudioUrl(item: PlaylistItem): string | null {
  if (item.type === 'song' && item.song) {
    return item.song.audio_url;
  }
  if (item.type === 'content' && item.content) {
    return item.content.audio_url;
  }
  if (item.type === 'host-segment') {
    return RADIO_HOST_CLIP_URL;
  }
  if (item.type === 'chart-number-one' && item.song) {
    return item.song.audio_url;
  }
  return null;
}

// Global audio element that persists
let globalAudio: HTMLAudioElement | null = null;
let globalState: RadioState = {
  isPlaying: false,
  currentItem: null,
  playlist: [],
  currentIndex: 0,
  volume: 0.7,
  isMuted: false,
};
let stateListeners: Set<() => void> = new Set();
let lastHostSegmentTime: number = Date.now(); // Track when last host segment played
let chartNumberOneSong: Song | null = null; // Cached #1 chart song
let pendingHostSegment: boolean = false; // Flag: next track should be host segment

const notifyListeners = () => {
  stateListeners.forEach(l => l());
};

export const RadioProvider = ({ children }: { children: React.ReactNode }) => {
  const [, forceUpdate] = useState({});
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Create global audio if not exists
    if (!globalAudio) {
      globalAudio = new Audio();
      globalAudio.volume = globalState.volume;
    }

    const listener = () => forceUpdate({});
    stateListeners.add(listener);
    
    return () => {
      stateListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!globalAudio) return;

    const handleEnded = () => {
      playNext();
    };

    const handleError = () => {
      playNext();
    };

    globalAudio.addEventListener("ended", handleEnded);
    globalAudio.addEventListener("error", handleError);

    return () => {
      globalAudio?.removeEventListener("ended", handleEnded);
      globalAudio?.removeEventListener("error", handleError);
    };
  }, []);

  const initializePlaylist = useCallback((songs: Song[], content: RadioContent[]) => {
    if (songs.length === 0) return;
    if (globalState.playlist.length > 0) return; // Already initialized
    
    const shuffledSongs = shuffleArray(songs);
    const playlist = buildPlaylistWithContent(shuffledSongs, content);
    
    globalState = {
      ...globalState,
      playlist,
      currentIndex: 0,
      currentItem: playlist[0] || null,
    };
    
    const audioUrl = playlist[0] ? getAudioUrl(playlist[0]) : null;
    if (globalAudio && audioUrl) {
      globalAudio.src = audioUrl;
    }
    notifyListeners();
  }, []);

  const togglePlay = useCallback(async () => {
    if (!globalAudio || !globalState.currentItem) return;

    if (globalState.isPlaying) {
      globalAudio.pause();
      globalState = { ...globalState, isPlaying: false };
    } else {
      try {
        await globalAudio.play();
        globalState = { ...globalState, isPlaying: true };
      } catch (error) {
        console.error("[RMRadio] Error playing:", error);
      }
    }
    notifyListeners();
  }, []);

  const playNext = useCallback(() => {
    if (globalState.playlist.length === 0) return;

    const now = Date.now();
    const timeSinceLastHost = now - lastHostSegmentTime;

    // Check if it's time for a host segment (every 30 minutes)
    if (timeSinceLastHost >= HOST_SEGMENT_INTERVAL_MS && !pendingHostSegment && globalState.currentItem?.type !== 'host-segment') {
      // Play host segment clip
      pendingHostSegment = true;
      lastHostSegmentTime = now;
      
      const hostItem: PlaylistItem = { type: 'host-segment' };
      globalState = {
        ...globalState,
        currentItem: hostItem,
      };

      if (globalAudio) {
        globalAudio.src = RADIO_HOST_CLIP_URL;
        if (globalState.isPlaying) {
          globalAudio.play().catch(console.error);
        }
      }
      notifyListeners();
      return;
    }

    // After host segment, play the #1 chart song
    if (pendingHostSegment && globalState.currentItem?.type === 'host-segment') {
      pendingHostSegment = false;
      
      if (chartNumberOneSong) {
        const chartItem: PlaylistItem = { type: 'chart-number-one', song: chartNumberOneSong };
        globalState = {
          ...globalState,
          currentItem: chartItem,
        };

        if (globalAudio) {
          globalAudio.src = chartNumberOneSong.audio_url;
          if (globalState.isPlaying) {
            globalAudio.play().catch(console.error);
          }
        }
        notifyListeners();
        return;
      }
    }

    // Normal playlist progression
    const nextIndex = (globalState.currentIndex + 1) % globalState.playlist.length;
    const nextItem = globalState.playlist[nextIndex];
    
    globalState = {
      ...globalState,
      currentIndex: nextIndex,
      currentItem: nextItem,
    };

    const audioUrl = nextItem ? getAudioUrl(nextItem) : null;
    if (globalAudio && audioUrl) {
      globalAudio.src = audioUrl;
      if (globalState.isPlaying) {
        globalAudio.play().catch(console.error);
      }
    }
    notifyListeners();
  }, []);

  const reshufflePlaylist = useCallback(() => {
    if (globalState.playlist.length === 0) return;
    
    const shuffled = shuffleArray(globalState.playlist);
    globalState = {
      ...globalState,
      playlist: shuffled,
      currentIndex: 0,
      currentItem: shuffled[0] || null,
    };

    const audioUrl = shuffled[0] ? getAudioUrl(shuffled[0]) : null;
    if (globalAudio && audioUrl) {
      globalAudio.src = audioUrl;
      if (globalState.isPlaying) {
        globalAudio.play().catch(console.error);
      }
    }
    notifyListeners();
  }, []);

  const setVolume = useCallback((v: number) => {
    globalState = { ...globalState, volume: v, isMuted: v === 0 };
    if (globalAudio) {
      globalAudio.volume = v;
    }
    notifyListeners();
  }, []);

  const setMuted = useCallback((m: boolean) => {
    globalState = { ...globalState, isMuted: m };
    if (globalAudio) {
      globalAudio.volume = m ? 0 : globalState.volume;
    }
    notifyListeners();
  }, []);

  return (
    <RadioContext.Provider
      value={{
        state: globalState,
        audioRef,
        togglePlay,
        playNext,
        reshufflePlaylist,
        setVolume,
        setMuted,
        initializePlaylist,
        isInitialized: globalState.playlist.length > 0,
      }}
    >
      {children}
    </RadioContext.Provider>
  );
};

interface RMRadioPlayerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RMRadioPlayer = ({ open, onOpenChange }: RMRadioPlayerProps) => {
  const radio = useRadio();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch radio content (jingles and adverts)
  const { data: radioContent } = useRadioContent();

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
    staleTime: 5 * 60 * 1000,
  });

  // Fetch the #1 chart song for the host segment
  useQuery({
    queryKey: ["rm-radio-chart-number-one"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_singles")
        .select("song_id, title, band_name, total_streams")
        .order("total_streams", { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        console.error("[RMRadio] Error fetching #1 chart song:", error);
        return null;
      }

      const chartSong = data[0];
      // Get the audio_url from songs table
      const { data: songData } = await supabase
        .from("songs")
        .select("audio_url")
        .eq("id", chartSong.song_id)
        .single();

      if (songData?.audio_url) {
        chartNumberOneSong = {
          id: chartSong.song_id,
          title: chartSong.title || "Unknown",
          audio_url: songData.audio_url,
          band_name: chartSong.band_name || "Unknown Artist",
          genre: null,
        };
      }
      return chartNumberOneSong;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Initialize playlist when songs and content load
  useEffect(() => {
    if (allSongs && allSongs.length > 0 && !radio.isInitialized) {
      radio.initializePlaylist(allSongs, radioContent || []);
    }
  }, [allSongs, radioContent, radio.isInitialized]);

  // Audio time tracking
  useEffect(() => {
    if (!globalAudio) return;

    const handleTimeUpdate = () => setCurrentTime(globalAudio?.currentTime || 0);
    const handleDurationChange = () => setDuration(globalAudio?.duration || 0);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    globalAudio.addEventListener("timeupdate", handleTimeUpdate);
    globalAudio.addEventListener("durationchange", handleDurationChange);
    globalAudio.addEventListener("waiting", handleWaiting);
    globalAudio.addEventListener("canplay", handleCanPlay);

    return () => {
      globalAudio?.removeEventListener("timeupdate", handleTimeUpdate);
      globalAudio?.removeEventListener("durationchange", handleDurationChange);
      globalAudio?.removeEventListener("waiting", handleWaiting);
      globalAudio?.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  const handleSeek = (value: number[]) => {
    if (globalAudio) {
      globalAudio.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    radio.setVolume(value[0]);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const { state } = radio;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className={cn("h-5 w-5 text-primary", state.isPlaying && "animate-pulse")} />
            RM Radio
            <Badge variant="outline" className="ml-2">
              {state.playlist.length} songs
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {songsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading songs...</span>
            </div>
          ) : state.playlist.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Music className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No AI-generated songs available yet</p>
            </div>
          ) : (
            <>
              {/* Now Playing */}
              {state.currentItem?.type === 'host-segment' ? (
                <div className="bg-primary/10 rounded-lg p-4 border border-primary/30">
                  <div className="text-xs text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Radio className="h-3 w-3 animate-pulse" />
                    Live Host Segment
                  </div>
                  <div className="text-lg font-semibold truncate">
                    Blondie - Radio Host
                  </div>
                  <div className="text-sm text-muted-foreground">RM Radio Presenter</div>
                </div>
              ) : state.currentItem?.type === 'chart-number-one' ? (
                <div className="bg-chart-1/10 rounded-lg p-4 border border-chart-1/30">
                  <div className="text-xs text-chart-1 uppercase tracking-wider mb-1 flex items-center gap-1">
                    🏆 #1 Chart Hit
                  </div>
                  <div className="text-lg font-semibold truncate">
                    {state.currentItem?.song?.title || "---"}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {state.currentItem?.song?.band_name || "---"}
                  </div>
                </div>
              ) : state.currentItem?.type === 'content' ? (
                <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/30">
                  <div className="text-xs text-amber-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Megaphone className="h-3 w-3" />
                    {state.currentItem.content?.content_type === 'jingle' ? 'Station Break' : 'Message from our Sponsors'}
                  </div>
                  <div className="text-lg font-semibold truncate">
                    {state.currentItem.content?.title || "---"}
                  </div>
                  {state.currentItem.content?.brand_name && (
                    <div className="text-sm text-muted-foreground">by {state.currentItem.content.brand_name}</div>
                  )}
                </div>
              ) : (
                <div className="bg-gradient-to-br from-primary/10 to-secondary/20 rounded-lg p-4 border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Now Playing
                  </div>
                  <div className="text-lg font-semibold truncate">
                    {state.currentItem?.song?.title || "---"}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {state.currentItem?.song?.band_name || "---"}
                  </div>
                  {state.currentItem?.song?.genre && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {state.currentItem.song.genre}
                    </Badge>
                  )}
                </div>
              )}

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
                  onClick={radio.reshufflePlaylist}
                  title="Shuffle playlist"
                >
                  <Shuffle className="h-5 w-5" />
                </Button>

                <Button
                  size="icon"
                  variant="default"
                  className="h-12 w-12"
                  onClick={radio.togglePlay}
                  disabled={isLoading || !state.currentItem}
                >
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : state.isPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6 ml-0.5" />
                  )}
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={radio.playNext}
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
                  onClick={() => radio.setMuted(!state.isMuted)}
                >
                  {state.isMuted || state.volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
                <Slider
                  value={[state.isMuted ? 0 : state.volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="flex-1"
                />
              </div>

              {/* Queue Info */}
              <div className="text-center text-xs text-muted-foreground">
                Song {state.currentIndex + 1} of {state.playlist.length} • Continuous play
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Button to trigger the radio player - for header
interface RMRadioButtonProps {
  className?: string;
}

export const RMRadioButton = ({ className }: RMRadioButtonProps) => {
  const [open, setOpen] = useState(false);
  
  // Try to use radio context if available
  let isPlaying = false;
  try {
    const radio = useRadio();
    isPlaying = radio.state.isPlaying;
  } catch {
    // Not in provider context, that's ok
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        title="RM Radio"
        className={cn("relative gap-1.5 h-7 px-2", className)}
      >
        <Radio className={cn("h-4 w-4", isPlaying && "text-primary animate-pulse")} />
        <span className="text-xs hidden sm:inline">Radio</span>
        {isPlaying && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-primary rounded-full animate-pulse" />
        )}
      </Button>
      <RMRadioPlayer open={open} onOpenChange={setOpen} />
    </>
  );
};

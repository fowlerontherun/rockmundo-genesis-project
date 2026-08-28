import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  useOpenMicPerformance, 
  useOpenMicSongPerformances,
  useStartOpenMicPerformance,
  type OpenMicPerformance,
} from "@/hooks/useOpenMicNights";
import { OpenMicOutcomeReport } from "@/components/open-mic/OpenMicOutcomeReport";
import {
  getOpenMicSongDurationMs,
  getOpenMicSongProgress,
  getOpenMicSongRemainingMs,
  getOpenMicSongStartedAtMs,
} from "@/features/open-mic/liveProgress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { 
  Mic, 
  Play, 
  Music, 
  Clock, 
  MapPin, 
  Loader2,
  Volume2,
  VolumeX,
  Users,
  Sparkles
} from "lucide-react";
import { format, isPast, differenceInMinutes, differenceInHours } from "date-fns";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { FMLiveSkeleton } from "@/components/fm/FMPageSkeleton";
import { useToast } from "@/hooks/use-toast";

interface LiveCommentary {
  text: string;
  type: 'neutral' | 'positive' | 'negative';
  timestamp: number;
}

type OpenMicSong = NonNullable<OpenMicPerformance["song_1"]>;

const getSongAudioUrl = (song: OpenMicSong | null | undefined) =>
  (song as (OpenMicSong & { audio_url?: string | null }) | null | undefined)?.audio_url ?? null;

const getErrorMessage = async (error: unknown) => {
  const response = error instanceof Error && "context" in error
    ? (error as Error & { context?: unknown }).context
    : null;

  if (response instanceof Response) {
    try {
      const body = await response.clone().json() as { error?: unknown };
      if (typeof body.error === "string" && body.error.trim()) return body.error;
    } catch {
      // Fall back to the client error when the function did not return JSON.
    }
  }

  return error instanceof Error ? error.message : "The performance could not be processed.";
};

export default function PerformOpenMic() {
  const { performanceId } = useParams<{ performanceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: performance, isLoading, refetch } = useOpenMicPerformance(performanceId || null);
  const {
    data: songPerformances = [],
    isLoading: songPerformancesLoading,
    refetch: refetchSongs,
  } = useOpenMicSongPerformances(performanceId || null);
  const startPerformance = useStartOpenMicPerformance();
  
  const [commentary, setCommentary] = useState<LiveCommentary[]>([]);
  const [currentSongProgress, setCurrentSongProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);
  const announcedSongsRef = useRef(new Set<string>());
  
  // Audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const playbackSettingsRef = useRef({ volume, isMuted });
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Get current song based on position
  const currentSong = performance?.current_song_position === 1 
    ? performance?.song_1 
    : performance?.song_2;
  const firstSongCompletedAt = songPerformances.find((result) => result.position === 1)?.created_at ?? null;

  const processSongComplete = useCallback(async (
    targetPerformance: OpenMicPerformance,
    targetSong: OpenMicSong,
  ): Promise<boolean> => {
    if (processingRef.current) return false;

    processingRef.current = true;
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('process-open-mic-song', {
        body: {
          performanceId: targetPerformance.id,
          songId: targetSong.id,
          position: targetPerformance.current_song_position,
        },
      });

      if (error) throw error;

      const crowdResponse = data?.crowd_response || 'engaged';
      const responseComments: Record<string, string> = {
        ecstatic: '🎉 The crowd goes wild! Standing ovation!',
        enthusiastic: '👏 Great response from the audience!',
        engaged: '👍 The crowd is appreciating the performance.',
        mixed: '😐 Some mixed reactions from the audience.',
        disappointed: '😔 The crowd seems a bit underwhelmed.',
      };

      setCommentary(prev => [...prev, {
        text: responseComments[crowdResponse] || 'Song completed.',
        type: crowdResponse === 'ecstatic' || crowdResponse === 'enthusiastic' ? 'positive' :
              crowdResponse === 'disappointed' ? 'negative' : 'neutral',
        timestamp: Date.now(),
      }]);

      if (targetPerformance.current_song_position < 2) {
        setCommentary(prev => [...prev, {
          text: 'Getting ready for the next song...',
          type: 'neutral',
          timestamp: Date.now(),
        }]);
        setCurrentSongProgress(0);
        setAudioCurrentTime(0);
      } else {
        const { error: completeError } = await supabase.functions.invoke('complete-open-mic', {
          body: { performanceId: targetPerformance.id },
        });

        if (completeError) throw completeError;
      }

      await Promise.all([refetch(), refetchSongs()]);
      return true;
    } catch (error) {
      console.error('Error processing open mic song:', error);
      setCommentary(prev => [...prev, {
        text: 'Technical difficulties — use Finish Performance Now to retry safely.',
        type: 'negative',
        timestamp: Date.now(),
      }]);
      toast({
        title: "Open Mic processing failed",
        description: await getErrorMessage(error),
        variant: "destructive",
      });
      return true;
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [refetch, refetchSongs, toast]);

  // Audio playback effect
  useEffect(() => {
    if (!currentSong || performance?.status !== 'in_progress') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      return;
    }

    const audioUrl = getSongAudioUrl(currentSong);
    if (!audioUrl) return;

    // Create or update audio element
    if (!audioRef.current || audioRef.current.src !== audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(audioUrl);
      const playbackSettings = playbackSettingsRef.current;
      audioRef.current.volume = playbackSettings.isMuted ? 0 : playbackSettings.volume;
      
      audioRef.current.onloadedmetadata = () => {
        setAudioDuration(audioRef.current?.duration || 0);
      };
      
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          setAudioCurrentTime(audioRef.current.currentTime);
          const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
          setCurrentSongProgress(progress);
        }
      };
      
      audioRef.current.onended = () => {
        setIsAudioPlaying(false);
        void processSongComplete(performance, currentSong);
      };
      
      // Auto-play when ready
      audioRef.current.play().then(() => {
        setIsAudioPlaying(true);
      }).catch(err => {
        console.error('Audio playback error:', err);
        // Fall back to simulated progress if audio fails
        setIsAudioPlaying(false);
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [currentSong, performance, processSongComplete]);

  // Update volume
  useEffect(() => {
    playbackSettingsRef.current = { volume, isMuted };
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Fallback: simulated progression if no audio
  useEffect(() => {
    if (!performance || performance.status !== 'in_progress' || !currentSong) return;
    if (performance.current_song_position > 2) return;

    const audioUrl = getSongAudioUrl(currentSong);
    if (audioUrl) return; // Use audio-based progression instead
    if (performance.current_song_position === 2 && songPerformancesLoading) return;

    const songKey = `${performance.id}:${performance.current_song_position}`;
    const songDurationMs = getOpenMicSongDurationMs(currentSong.duration_seconds);
    const songStartedAtMs = getOpenMicSongStartedAtMs(
      performance.current_song_position,
      performance.started_at,
      firstSongCompletedAt ? [{ position: 1, created_at: firstSongCompletedAt }] : [],
    ) ?? Date.now();

    if (!announcedSongsRef.current.has(songKey)) {
      announcedSongsRef.current.add(songKey);
      setCommentary(prev => [...prev,
        { text: `Now performing: "${currentSong.title}"`, type: 'neutral', timestamp: Date.now() },
        { text: 'The crowd settles in...', type: 'neutral', timestamp: Date.now() + 1 },
      ]);
    }

    let completionRetryTimeout: number | undefined;
    let midpointTimeout: number | undefined;

    const updateProgress = () => {
      setCurrentSongProgress(getOpenMicSongProgress(Date.now(), songStartedAtMs, songDurationMs));
    };

    updateProgress();
    const progressInterval = window.setInterval(updateProgress, 500);

    const midpointDelayMs = songStartedAtMs + (songDurationMs / 2) - Date.now();
    if (midpointDelayMs > 0) {
      midpointTimeout = window.setTimeout(() => {
        const midComments = [
          'The energy in the room is building!',
          'People are nodding along to the beat.',
          'Someone in the back pulls out their phone to record.',
        ];
        const randomComment = midComments[Math.floor(Math.random() * midComments.length)];
        setCommentary(prev => [...prev, {
          text: randomComment,
          type: 'positive',
          timestamp: Date.now(),
        }]);
      }, midpointDelayMs);
    }

    const finishSong = async () => {
      window.clearInterval(progressInterval);
      setCurrentSongProgress(100);

      const startedProcessing = await processSongComplete(performance, currentSong);
      if (!startedProcessing) {
        completionRetryTimeout = window.setTimeout(() => {
          void finishSong();
        }, 500);
      }
    };

    const completionTimeout = window.setTimeout(() => {
      void finishSong();
    }, getOpenMicSongRemainingMs(Date.now(), songStartedAtMs, songDurationMs));

    return () => {
      window.clearInterval(progressInterval);
      if (completionTimeout !== undefined) window.clearTimeout(completionTimeout);
      if (completionRetryTimeout !== undefined) window.clearTimeout(completionRetryTimeout);
      if (midpointTimeout !== undefined) window.clearTimeout(midpointTimeout);
    };
  }, [
    currentSong,
    firstSongCompletedAt,
    performance,
    processSongComplete,
    songPerformancesLoading,
  ]);

  const handleStart = () => {
    if (!performanceId) return;
    startPerformance.mutate(performanceId);
  };

  const handleFinishNow = useCallback(async () => {
    if (!performance || processingRef.current) return;

    processingRef.current = true;
    setIsProcessing(true);

    try {
      const songs = [performance.song_1, performance.song_2];

      for (const [index, song] of songs.entries()) {
        if (!song) throw new Error(`Song ${index + 1} is missing from the Open Mic setlist.`);

        const { error } = await supabase.functions.invoke('process-open-mic-song', {
          body: {
            performanceId: performance.id,
            songId: song.id,
            position: index + 1,
          },
        });

        if (error) throw error;
      }

      const { error: completeError } = await supabase.functions.invoke('complete-open-mic', {
        body: { performanceId: performance.id },
      });
      if (completeError) throw completeError;

      await Promise.all([refetch(), refetchSongs()]);
      toast({
        title: "Performance complete",
        description: "Your Open Mic results are ready.",
      });
    } catch (error) {
      console.error('Error completing Open Mic performance:', error);
      toast({
        title: "Could not finish the performance",
        description: await getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [performance, refetch, refetchSongs, toast]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <FMPageScaffold title="Open Mic" icon={Mic} backTo="/open-mic">
        <FMLiveSkeleton />
      </FMPageScaffold>
    );
  }

  if (!performance) {
    return (
      <FMPageScaffold title="Open Mic" icon={Mic} backTo="/open-mic">
        <Alert variant="destructive">
          <AlertDescription>Performance not found.</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/open-mic')} className="mt-4">
          Back to Open Mic
        </Button>
      </FMPageScaffold>
    );
  }

  // Show outcome report if completed
  if (performance.status === 'completed') {
    return (
      <FMPageScaffold
        title="Open Mic — Performance Complete!"
        icon={Mic}
        backTo="/open-mic"
      >
        <OpenMicOutcomeReport
          performance={performance}
          songPerformances={songPerformances}
        />
      </FMPageScaffold>
    );
  }

  // Pre-show view
  if (performance.status === 'scheduled') {
    const scheduledDate = new Date(performance.scheduled_date);
    const canStartNow = isPast(scheduledDate);
    const minutesUntilStart = differenceInMinutes(scheduledDate, new Date());
    const hoursUntilStart = differenceInHours(scheduledDate, new Date());
    
    const getTimeUntilText = () => {
      if (hoursUntilStart > 24) {
        const days = Math.floor(hoursUntilStart / 24);
        return `${days} day${days > 1 ? 's' : ''} until showtime`;
      } else if (hoursUntilStart >= 1) {
        return `${hoursUntilStart} hour${hoursUntilStart > 1 ? 's' : ''} until showtime`;
      } else if (minutesUntilStart > 0) {
        return `${minutesUntilStart} minute${minutesUntilStart > 1 ? 's' : ''} until showtime`;
      }
      return "It's showtime!";
    };

    return (
      <FMPageScaffold title="Ready for Open Mic Night?" icon={Mic} backTo="/open-mic">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-6 w-6 text-primary" />
              Ready for Open Mic Night?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {performance.venue?.name}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {format(scheduledDate, 'EEEE, MMM d @ h:mm a')}
              </span>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Your Setlist</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                  <Badge>1</Badge>
                  <Music className="h-4 w-4" />
                  <span>{performance.song_1?.title}</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                  <Badge>2</Badge>
                  <Music className="h-4 w-4" />
                  <span>{performance.song_2?.title}</span>
                </div>
              </div>
            </div>

            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                Remember: Open mics are about exposure! You'll earn fame and fans based on your performance.
              </AlertDescription>
            </Alert>

            {!canStartNow && (
              <Alert variant="default" className="bg-amber-500/10 border-amber-500/30">
                <Clock className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  {getTimeUntilText()} - come back when it's time to perform!
                </AlertDescription>
              </Alert>
            )}

            <Button 
              size="lg" 
              className="w-full" 
              onClick={handleStart}
              disabled={startPerformance.isPending || !canStartNow}
            >
              {startPerformance.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Play className="h-5 w-5 mr-2" />
              )}
              {canStartNow ? 'Start Performance' : getTimeUntilText()}
            </Button>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  // Live performance view
  const hasAudio = !!getSongAudioUrl(currentSong);
  
  return (
    <FMPageScaffold
      title="Live Performance"
      icon={Volume2}
      backTo="/open-mic"
      headerActions={<Badge variant="default" className="animate-pulse">🔴 LIVE</Badge>}
    >
      <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-6 w-6 text-primary animate-pulse" />
              Live Performance
            </CardTitle>
            <Badge variant="default" className="animate-pulse">
              🔴 LIVE
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Now Playing</p>
            <h2 className="text-2xl font-bold">{currentSong?.title || 'Loading...'}</h2>
            <p className="text-sm text-muted-foreground">
              Song {performance.current_song_position} of 2
            </p>
          </div>

          {/* Progress bar with time display */}
          <div className="space-y-2">
            <Progress value={currentSongProgress} className="h-3" />
            {hasAudio && audioDuration > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(audioCurrentTime)}</span>
                <span>{formatTime(audioDuration)}</span>
              </div>
            )}
          </div>

          {/* Audio Controls */}
          {hasAudio && (
            <div className="flex items-center justify-center gap-4 p-3 bg-muted/50 rounded-lg">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                onValueChange={([val]) => {
                  setVolume(val / 100);
                  if (val > 0) setIsMuted(false);
                }}
                max={100}
                step={1}
                className="w-32"
              />
              <span className="text-xs text-muted-foreground w-8">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>
          )}

          <div className="flex justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {performance.venue?.capacity} capacity
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {performance.venue?.name}
            </span>
          </div>

          {/* Manual Complete Button */}
          <Button 
            variant="destructive" 
            className="w-full"
            onClick={() => void handleFinishNow()}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Finish Performance Now
          </Button>
        </CardContent>
      </Card>

      {/* Live Commentary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live Commentary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {commentary.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Waiting for the show to begin...
              </p>
            ) : (
              commentary.map((c, i) => (
                <div 
                  key={c.timestamp + i}
                  className={`p-2 rounded text-sm ${
                    c.type === 'positive' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                    c.type === 'negative' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                    'bg-muted'
                  }`}
                >
                  {c.text}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Processing performance...</span>
        </div>
      )}
    </FMPageScaffold>
  );
}

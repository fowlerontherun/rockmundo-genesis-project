import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  useOpenMicPerformance, 
  useOpenMicSongPerformances,
  useStartOpenMicPerformance 
} from "@/hooks/useOpenMicNights";
import { OpenMicOutcomeReport } from "@/components/open-mic/OpenMicOutcomeReport";
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

interface LiveCommentary {
  text: string;
  type: 'neutral' | 'positive' | 'negative';
  timestamp: number;
}

export default function PerformOpenMic() {
  const { performanceId } = useParams<{ performanceId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: performance, isLoading, refetch } = useOpenMicPerformance(performanceId || null);
  const { data: songPerformances = [], refetch: refetchSongs } = useOpenMicSongPerformances(performanceId || null);
  const startPerformance = useStartOpenMicPerformance();
  
  const [commentary, setCommentary] = useState<LiveCommentary[]>([]);
  const [currentSongProgress, setCurrentSongProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Get current song based on position
  const currentSong = performance?.current_song_position === 1 
    ? performance?.song_1 
    : performance?.song_2;

  // Audio playback effect
  useEffect(() => {
    if (!currentSong || performance?.status !== 'in_progress') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      return;
    }

    const audioUrl = (currentSong as any).audio_url;
    if (!audioUrl) return;

    // Create or update audio element
    if (!audioRef.current || audioRef.current.src !== audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(audioUrl);
      audioRef.current.volume = isMuted ? 0 : volume;
      
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
      
      audioRef.current.onended = async () => {
        setIsAudioPlaying(false);
        // Song finished - process it
        await processSongComplete();
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
  }, [currentSong, performance?.status]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Process song completion
  const processSongComplete = async () => {
    if (!performance || !currentSong || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      // Call edge function to process the song
      const { data, error } = await supabase.functions.invoke('process-open-mic-song', {
        body: {
          performanceId: performance.id,
          songId: currentSong.id,
          position: performance.current_song_position,
        },
      });

      if (error) throw error;

      // Add result commentary
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
        timestamp: Date.now() 
      }]);

      // Advance to next song or complete
      if (performance.current_song_position < 2) {
        await supabase
          .from('open_mic_performances')
          .update({ current_song_position: 2 })
          .eq('id', performance.id);
        
        setCommentary(prev => [...prev, { 
          text: 'Getting ready for the next song...', 
          type: 'neutral', 
          timestamp: Date.now() 
        }]);
        
        // Reset audio state for next song
        setCurrentSongProgress(0);
        setAudioCurrentTime(0);
      } else {
        // Complete the performance
        const { error: completeError } = await supabase.functions.invoke('complete-open-mic', {
          body: { performanceId: performance.id },
        });

        if (completeError) throw completeError;
      }

      // Refetch data
      await refetch();
      await refetchSongs();
      
    } catch (err) {
      console.error('Error processing song:', err);
      setCommentary(prev => [...prev, { 
        text: 'Technical difficulties... but the show goes on!', 
        type: 'negative', 
        timestamp: Date.now() 
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Fallback: simulated progression if no audio
  useEffect(() => {
    if (!performance || performance.status !== 'in_progress' || !currentSong) return;
    if (performance.current_song_position > 2) return;
    
    const audioUrl = (currentSong as any).audio_url;
    if (audioUrl) return; // Use audio-based progression instead

    let progressInterval: NodeJS.Timeout;
    let processingTimeout: NodeJS.Timeout;

    const processSong = async () => {
      setIsProcessing(true);
      setCurrentSongProgress(0);
      
      // Add intro commentary
      const introComments = [
        { text: `Now performing: "${currentSong.title}"`, type: 'neutral' as const },
        { text: 'The crowd settles in...', type: 'neutral' as const },
      ];
      setCommentary(prev => [...prev, ...introComments.map((c, i) => ({ ...c, timestamp: Date.now() + i }))]);

      // Simulate song progress (use actual duration, capped at 60s for demo)
      const songDuration = Math.min(currentSong.duration_seconds || 180, 60) * 1000;
      const progressStep = 100 / (songDuration / 500);
      
      progressInterval = setInterval(() => {
        setCurrentSongProgress(prev => Math.min(prev + progressStep, 100));
      }, 500);

      // Mid-song commentary
      setTimeout(() => {
        const midComments = [
          'The energy in the room is building!',
          'People are nodding along to the beat.',
          'Someone in the back pulls out their phone to record.',
        ];
        const randomComment = midComments[Math.floor(Math.random() * midComments.length)];
        setCommentary(prev => [...prev, { text: randomComment, type: 'positive', timestamp: Date.now() }]);
      }, songDuration / 2);

      // Process song completion
      processingTimeout = setTimeout(async () => {
        clearInterval(progressInterval);
        setCurrentSongProgress(100);
        await processSongComplete();
        setIsProcessing(false);
      }, songDuration);
    };

    processSong();

    return () => {
      clearInterval(progressInterval);
      clearTimeout(processingTimeout);
    };
  }, [performance?.status, performance?.current_song_position, currentSong?.id]);

  // Add intro commentary when starting
  useEffect(() => {
    if (performance?.status === 'in_progress' && currentSong && commentary.length === 0) {
      setCommentary([
        { text: `Now performing: "${currentSong.title}"`, type: 'neutral', timestamp: Date.now() },
        { text: 'The crowd settles in...', type: 'neutral', timestamp: Date.now() + 1 },
      ]);
    }
  }, [performance?.status, currentSong]);

  const handleStart = () => {
    if (!performanceId) return;
    startPerformance.mutate(performanceId);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!performance) {
    return (
      <div className="container max-w-4xl py-8">
        <Alert variant="destructive">
          <AlertDescription>Performance not found.</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/open-mic')} className="mt-4">
          Back to Open Mic
        </Button>
      </div>
    );
  }

  // Show outcome report if completed
  if (performance.status === 'completed') {
    return (
      <div className="container max-w-4xl py-8">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Mic className="h-6 w-6 text-primary" />
          Open Mic Performance Complete!
        </h1>
        <OpenMicOutcomeReport 
          performance={performance} 
          songPerformances={songPerformances} 
        />
      </div>
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
      <div className="container max-w-4xl py-8 space-y-6">
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
      </div>
    );
  }

  // Live performance view
  const hasAudio = !!(currentSong as any)?.audio_url;
  
  return (
    <div className="container max-w-4xl py-8 space-y-6">
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
            onClick={async () => {
              setIsProcessing(true);
              try {
                // Process remaining songs first
                if (!songPerformances.find(sp => sp.position === performance.current_song_position)) {
                  await supabase.functions.invoke('process-open-mic-song', {
                    body: {
                      performanceId: performance.id,
                      songId: currentSong?.id,
                      position: performance.current_song_position,
                    },
                  });
                }
                if (performance.current_song_position === 1 && !songPerformances.find(sp => sp.position === 2)) {
                  await supabase.functions.invoke('process-open-mic-song', {
                    body: {
                      performanceId: performance.id,
                      songId: performance.song_2?.id,
                      position: 2,
                    },
                  });
                }
                // Complete the performance
                await supabase.functions.invoke('complete-open-mic', {
                  body: { performanceId: performance.id },
                });
                await refetch();
              } catch (err) {
                console.error('Error completing performance:', err);
              } finally {
                setIsProcessing(false);
              }
            }}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Complete Performance Now
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
    </div>
  );
}

import { useEffect, useState } from "react";
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
import { 
  Mic, 
  Play, 
  Music, 
  Clock, 
  MapPin, 
  Loader2,
  Volume2,
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

  // Get current song based on position
  const currentSong = performance?.current_song_position === 1 
    ? performance?.song_1 
    : performance?.song_2;

  // Process song when performance is in progress
  useEffect(() => {
    if (!performance || performance.status !== 'in_progress' || !currentSong) return;
    if (performance.current_song_position > 2) return; // Already done

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

      // Simulate song progress (30 seconds for demo, real would use duration)
      const songDuration = Math.min(currentSong.duration_seconds || 180, 30) * 1000;
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
      }, songDuration);
    };

    processSong();

    return () => {
      clearInterval(progressInterval);
      clearTimeout(processingTimeout);
    };
  }, [performance?.status, performance?.current_song_position, currentSong?.id]);

  const handleStart = () => {
    if (!performanceId) return;
    startPerformance.mutate(performanceId);
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

          <Progress value={currentSongProgress} className="h-3" />

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

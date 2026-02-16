import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  useMajorEventPerformance, 
  useMajorEventSongPerformances,
  useStartMajorEventPerformance 
} from "@/hooks/useMajorEvents";
import { MajorEventOutcomeReport } from "@/components/major-events/MajorEventOutcomeReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Trophy, 
  Play, 
  Music, 
  Clock, 
  Loader2,
  Volume2,
  Users,
  Sparkles,
  DollarSign
} from "lucide-react";

interface LiveCommentary {
  text: string;
  type: 'neutral' | 'positive' | 'negative';
  timestamp: number;
}

export default function PerformMajorEvent() {
  const { performanceId } = useParams<{ performanceId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: performance, isLoading, refetch } = useMajorEventPerformance(performanceId || null);
  const { data: songPerformances = [], refetch: refetchSongs } = useMajorEventSongPerformances(performanceId || null);
  const startPerformance = useStartMajorEventPerformance();
  
  const [commentary, setCommentary] = useState<LiveCommentary[]>([]);
  const [currentSongProgress, setCurrentSongProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const songs = [performance?.song_1, performance?.song_2, performance?.song_3];
  const currentSong = performance ? songs[performance.current_song_position - 1] : null;

  const processSongComplete = async () => {
    if (!performance || !currentSong || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('process-major-event-song', {
        body: {
          performanceId: performance.id,
          songId: currentSong.id,
          position: performance.current_song_position,
        },
      });

      if (error) throw error;

      const crowdResponse = data?.crowd_response || 'engaged';
      const responseComments: Record<string, string> = {
        ecstatic: '🎉 The crowd goes absolutely wild!',
        enthusiastic: '👏 Massive applause from the audience!',
        engaged: '👍 The audience is appreciating the performance.',
        mixed: '😐 Some mixed reactions from the crowd.',
        disappointed: '😔 The crowd seems underwhelmed.',
      };
      
      setCommentary(prev => [...prev, { 
        text: responseComments[crowdResponse] || 'Song completed.', 
        type: crowdResponse === 'ecstatic' || crowdResponse === 'enthusiastic' ? 'positive' : 
              crowdResponse === 'disappointed' ? 'negative' : 'neutral',
        timestamp: Date.now() 
      }]);

      if (performance.current_song_position < 3) {
        await (supabase as any)
          .from('major_event_performances')
          .update({ current_song_position: performance.current_song_position + 1 })
          .eq('id', performance.id);
        
        setCommentary(prev => [...prev, { 
          text: `Getting ready for song ${performance.current_song_position + 1}...`, 
          type: 'neutral', 
          timestamp: Date.now() 
        }]);
        
        setCurrentSongProgress(0);
      } else {
        setCommentary(prev => [...prev, { 
          text: '🎤 Final song complete! Calculating your results...', 
          type: 'positive', 
          timestamp: Date.now() 
        }]);

        const { error: completeError } = await supabase.functions.invoke('complete-major-event', {
          body: { performanceId: performance.id },
        });

        if (completeError) throw completeError;
      }

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

  // Simulated progression (no audio)
  useEffect(() => {
    if (!performance || performance.status !== 'in_progress' || !currentSong) return;
    if (performance.current_song_position > 3) return;
    
    let progressInterval: NodeJS.Timeout;
    let processingTimeout: NodeJS.Timeout;

    const processSong = async () => {
      setIsProcessing(true);
      setCurrentSongProgress(0);
      
      setCommentary(prev => [...prev, 
        { text: `Now performing: "${currentSong.title}"`, type: 'neutral', timestamp: Date.now() },
        { text: 'The massive crowd settles in...', type: 'neutral', timestamp: Date.now() + 1 },
      ]);

      const songDuration = Math.min(currentSong.duration_seconds || 180, 45) * 1000;
      const progressStep = 100 / (songDuration / 500);
      
      progressInterval = setInterval(() => {
        setCurrentSongProgress(prev => Math.min(prev + progressStep, 100));
      }, 500);

      setTimeout(() => {
        const midComments = [
          'The energy in the stadium is incredible!',
          'Cameras are flashing everywhere!',
          'The worldwide audience is captivated!',
          'Social media is blowing up!',
        ];
        const randomComment = midComments[Math.floor(Math.random() * midComments.length)];
        setCommentary(prev => [...prev, { text: randomComment, type: 'positive', timestamp: Date.now() }]);
      }, songDuration / 2);

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
        <Button onClick={() => navigate('/major-events')} className="mt-4">
          Back to Major Events
        </Button>
      </div>
    );
  }

  // Show outcome report if completed
  if (performance.status === 'completed') {
    return (
      <div className="container max-w-4xl py-8">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" />
          {performance.instance?.event?.name} — Performance Complete!
        </h1>
        <MajorEventOutcomeReport 
          performance={performance} 
          songPerformances={songPerformances} 
        />
      </div>
    );
  }

  // Pre-show view
  if (performance.status === 'accepted') {
    const eventName = performance.instance?.event?.name || 'Major Event';
    const audienceSize = performance.instance?.event?.audience_size || 0;
    const cashRange = `$${((performance.instance?.event?.base_cash_reward || 0) / 1000).toFixed(0)}K - $${((performance.instance?.event?.max_cash_reward || 0) / 1000).toFixed(0)}K`;

    return (
      <div className="container max-w-4xl py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              Ready for {eventName}?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {audienceSize.toLocaleString()} audience
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                {cashRange}
              </span>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Your Setlist (3 Songs)</h3>
              <div className="space-y-2">
                {[performance.song_1, performance.song_2, performance.song_3].map((song, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                    <Badge>{i + 1}</Badge>
                    <Music className="h-4 w-4" />
                    <span>{song?.title || 'Unknown'}</span>
                  </div>
                ))}
              </div>
            </div>

            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                This is the big stage! Your performance will earn you cash, fame, and fans based on how well you do.
              </AlertDescription>
            </Alert>

            <Button 
              size="lg" 
              className="w-full" 
              onClick={handleStart}
              disabled={startPerformance.isPending}
            >
              {startPerformance.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Play className="h-5 w-5 mr-2" />
              )}
              Start Performance
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Live performance view
  const eventName = performance.instance?.event?.name || 'Major Event';
  
  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-6 w-6 text-primary animate-pulse" />
              {eventName} — Live
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
              Song {performance.current_song_position} of 3
            </p>
          </div>

          <Progress value={currentSongProgress} className="h-3" />

          <div className="flex justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {(performance.instance?.event?.audience_size || 0).toLocaleString()} watching
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
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {commentary.length === 0 ? (
              <p className="text-muted-foreground text-sm italic">Waiting for the show to begin...</p>
            ) : (
              commentary.map((c, i) => (
                <div
                  key={i}
                  className={`text-sm p-2 rounded ${
                    c.type === 'positive' ? 'bg-green-500/10 text-green-700 dark:text-green-400' :
                    c.type === 'negative' ? 'bg-red-500/10 text-red-700 dark:text-red-400' :
                    'bg-muted/50'
                  }`}
                >
                  {c.text}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Song Results */}
      {songPerformances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Songs Completed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {songPerformances.map((sp) => {
              const song = songs[sp.position - 1];
              return (
                <div key={sp.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{sp.position}</Badge>
                    <span className="text-sm">{song?.title}</span>
                  </div>
                  <Badge>{(sp.performance_score || 0).toFixed(0)}%</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

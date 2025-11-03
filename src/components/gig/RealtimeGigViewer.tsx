import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Music, Star, Users, Clock, TrendingUp, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNowStrict, differenceInSeconds } from "date-fns";
import type { Database } from "@/lib/supabase-types";

type Gig = Database['public']['Tables']['gigs']['Row'];
type SongPerformance = Database['public']['Tables']['gig_song_performances']['Row'];

interface RealtimeGigViewerProps {
  gigId: string;
  onComplete: () => void;
}

const crowdResponseConfig: Record<string, { variant: any; label: string; icon: string; color: string }> = {
  ecstatic: { variant: 'default', label: 'Ecstatic', icon: '🔥', color: 'text-orange-500' },
  enthusiastic: { variant: 'default', label: 'Enthusiastic', icon: '🎉', color: 'text-yellow-500' },
  engaged: { variant: 'secondary', label: 'Engaged', icon: '👍', color: 'text-blue-500' },
  mixed: { variant: 'outline', label: 'Mixed', icon: '😐', color: 'text-gray-500' },
  disappointed: { variant: 'destructive', label: 'Disappointed', icon: '😞', color: 'text-red-500' },
};

export const RealtimeGigViewer = ({ gigId, onComplete }: RealtimeGigViewerProps) => {
  const [gig, setGig] = useState<Gig | null>(null);
  const [setlistSongs, setSetlistSongs] = useState<any[]>([]);
  const [performances, setPerformances] = useState<SongPerformance[]>([]);
  const [rehearsals, setRehearsals] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [commentary, setCommentary] = useState<string>("");

  const loadGig = useCallback(async () => {
    const { data: gigData, error } = await supabase
      .from('gigs')
      .select('*, bands!inner(id)')
      .eq('id', gigId)
      .single();

    if (error) {
      console.error('Error loading gig:', error);
      return;
    }

    setGig(gigData);

    if (gigData.setlist_id) {
      const { data: songs } = await supabase
        .from('setlist_songs')
        .select('*, songs!inner(id, title, genre, quality_score, duration_seconds)')
        .eq('setlist_id', gigData.setlist_id)
        .order('position');

      setSetlistSongs(songs || []);
    }

    // Load rehearsal data for the band
    if ((gigData as any).bands?.id) {
      const { data: rehearsalData } = await supabase
        .from('song_rehearsals')
        .select('song_id, rehearsal_level')
        .eq('band_id', (gigData as any).bands.id);
      
      setRehearsals(rehearsalData || []);
    }
  }, [gigId]);

  const loadPerformances = useCallback(async () => {
    if (!gig?.id) return;

    const { data: outcome } = await supabase
      .from('gig_outcomes')
      .select('id')
      .eq('gig_id', gig.id)
      .single();

    if (!outcome) return;

    const { data: perfs } = await supabase
      .from('gig_song_performances')
      .select('*')
      .eq('gig_outcome_id', outcome.id)
      .order('position');

    setPerformances(perfs || []);
  }, [gig]);

  const generateCommentary = useCallback((perf: SongPerformance) => {
    const comments = {
      ecstatic: [
        "The crowd is going absolutely wild! 🔥",
        "This is incredible! The energy in here is electric! ⚡",
        "Best performance of the night! The crowd can't get enough!",
        "Absolutely sensational! This is what live music is all about!"
      ],
      enthusiastic: [
        "The crowd loves it! Great performance! 🎉",
        "Amazing energy from the band right now!",
        "The audience is really feeling this one!",
        "Strong performance - the crowd is really into it!"
      ],
      engaged: [
        "Nice work! The crowd is engaged 👍",
        "Solid performance - audience is enjoying this",
        "Good vibes in the venue right now",
        "The crowd is nodding along nicely"
      ],
      mixed: [
        "Mixed reactions from the crowd... 😐",
        "The energy has dipped a bit on this one",
        "Some people are into it, others less so",
        "Decent but not quite hitting the mark"
      ],
      disappointed: [
        "Tough one... the crowd seems disappointed 😞",
        "That didn't land as well as hoped",
        "The energy in the room has dropped significantly",
        "The band will need to win them back after that one"
      ]
    };

    const options = comments[perf.crowd_response as keyof typeof comments] || comments.mixed;
    return options[Math.floor(Math.random() * options.length)];
  }, []);

  useEffect(() => {
    loadGig();
  }, [loadGig]);

  useEffect(() => {
    loadPerformances();
  }, [loadPerformances]);

  // Subscribe to gig updates
  useEffect(() => {
    const channel = supabase
      .channel('gig-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'gigs',
          filter: `id=eq.${gigId}`
        },
        (payload) => {
          setGig(payload.new as Gig);
          
          if (payload.new.status === 'completed' || payload.new.status === 'ready_for_completion') {
            onComplete();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gigId, onComplete]);

  // Subscribe to song performances
  useEffect(() => {
    if (!gig?.id) return;

    const channel = supabase
      .channel('song-performances')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gig_song_performances'
        },
        (payload) => {
          const newPerf = payload.new as SongPerformance;
          setPerformances(prev => [...prev, newPerf]);
          
          // Generate commentary
          const comment = generateCommentary(newPerf);
          setCommentary(comment);
          
          // Clear commentary after 5 seconds
          setTimeout(() => setCommentary(""), 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gig, generateCommentary]);

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!gig) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentSongIndex = gig.current_song_position || 0;
  const currentSong = setlistSongs[currentSongIndex - 1]; // -1 because position is 1-indexed
  const totalSongs = setlistSongs.length;
  const progress = totalSongs > 0 ? ((performances.length) / totalSongs) * 100 : 0;

  // Calculate elapsed time
  const elapsedSeconds = gig.started_at 
    ? differenceInSeconds(currentTime, new Date(gig.started_at))
    : 0;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const totalMinutes = gig.setlist_duration_minutes || 60;

  // Calculate average score
  const avgScore = performances.length > 0
    ? performances.reduce((sum, p) => sum + (p.performance_score || 0), 0) / performances.length
    : 0;

  return (
    <div className="space-y-4">
      {/* Show Status Banner */}
      <Card className="border-primary bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="animate-pulse">
                <Music className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Live Show in Progress</p>
                <p className="text-sm text-muted-foreground">
                  {elapsedMinutes} of {totalMinutes} minutes elapsed
                </p>
              </div>
            </div>
            <Badge variant="default" className="animate-pulse">
              🔴 LIVE
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Show Progress
            </span>
            <Badge variant="outline">
              {performances.length} / {totalSongs} Songs
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progress} className="h-3" />
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{avgScore.toFixed(1)}/25</p>
              <p className="text-xs text-muted-foreground">Avg Score</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{elapsedMinutes}m</p>
              <p className="text-xs text-muted-foreground">Elapsed</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{totalMinutes - elapsedMinutes}m</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commentary */}
      {commentary && (
        <Alert className="border-primary bg-primary/10">
          <Zap className="h-4 w-4" />
          <AlertDescription className="text-base font-medium">
            {commentary}
          </AlertDescription>
        </Alert>
      )}

      {/* Current/Next Song */}
      {currentSong && (
        <Card className="border-primary shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 animate-pulse text-primary" />
              Now Playing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-2xl font-bold">{currentSong.songs.title}</p>
                <p className="text-sm text-muted-foreground">Song #{currentSongIndex}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < Math.floor((currentSong.songs.quality_score || 0) / 20)
                          ? 'fill-yellow-500 text-yellow-500'
                          : 'text-muted'
                      }`}
                    />
                  ))}
                </div>
                
                {(() => {
                  const rehearsal = rehearsals.find(r => r.song_id === currentSong.song_id);
                  const level = rehearsal?.rehearsal_level || 0;
                  return (
                    <Badge variant={level >= 5 ? "default" : level >= 3 ? "secondary" : "destructive"}>
                      Rehearsed: {level}/10
                    </Badge>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance History */}
      {performances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {performances.slice().reverse().map((perf, idx) => {
                const config = crowdResponseConfig[perf.crowd_response] || crowdResponseConfig.mixed;
                const songData = setlistSongs.find(s => s.songs.id === perf.song_id);
                const rehearsal = rehearsals.find(r => r.song_id === perf.song_id);
                const rehearsalLevel = rehearsal?.rehearsal_level || 0;
                
                return (
                  <div key={perf.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-semibold">{perf.position}. {perf.song_title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          Score: {(perf.performance_score || 0).toFixed(1)}/25
                        </span>
                        <Badge variant="outline" className="text-xs">
                          Rehearsed: {rehearsalLevel}/10
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={config.variant}>
                        {config.icon} {config.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Waiting for Show to Start */}
      {gig.status === 'scheduled' && !gig.started_at && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Show will start automatically at scheduled time. Sit back and enjoy!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
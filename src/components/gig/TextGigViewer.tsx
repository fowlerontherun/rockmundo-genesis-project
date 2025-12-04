import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, Mic2, Users, Sparkles, AlertTriangle, Star, Clock } from "lucide-react";
import { differenceInSeconds } from "date-fns";

interface TextGigViewerProps {
  gigId: string;
  onComplete?: () => void;
}

interface CommentaryEntry {
  id: string;
  timestamp: Date;
  type: 'arrival' | 'song_start' | 'crowd_reaction' | 'special_moment' | 'song_end' | 'encore' | 'event' | 'finale';
  message: string;
  icon?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

// Extensive commentary pools for variety
const ARRIVAL_COMMENTS = [
  "The lights dim as the band takes the stage to thunderous applause!",
  "A roar erupts from the crowd as the musicians walk out!",
  "The venue erupts as the band emerges from backstage!",
  "Screams fill the air as spotlights illuminate the stage!",
  "The crowd goes wild - the band is finally here!",
  "An electric buzz fills the room as the performers take their positions!",
];

const SONG_START_COMMENTS: Record<string, string[]> = {
  high_energy: [
    "They launch into '{title}' with explosive energy!",
    "'{title}' kicks off with a thunderous opening riff!",
    "The crowd recognizes '{title}' immediately and goes crazy!",
    "'{title}' begins - the bass is shaking the entire venue!",
  ],
  medium_energy: [
    "'{title}' begins with a smooth groove...",
    "The band transitions into '{title}' seamlessly",
    "'{title}' starts up, getting heads nodding throughout the crowd",
    "A familiar intro fills the air - it's '{title}'!",
  ],
  low_energy: [
    "'{title}' begins with a mellow, atmospheric intro...",
    "The band slows things down with '{title}'",
    "A hush falls as '{title}' starts with delicate notes...",
    "'{title}' opens softly, the crowd swaying gently",
  ],
};

const CROWD_REACTIONS: Record<string, string[]> = {
  ecstatic: [
    "The crowd is going ABSOLUTELY WILD! 🔥 People are jumping, screaming, arms everywhere!",
    "PANDEMONIUM! The energy is OFF THE CHARTS! Everyone is on their feet!",
    "This is INCREDIBLE! The whole venue is shaking with the crowd's energy!",
    "LEGENDARY performance! The crowd can't contain themselves!",
    "Phones are UP, hands are UP, the roof is about to come off!",
    "The pit has ERUPTED! This is what live music is all about!",
  ],
  enthusiastic: [
    "The crowd LOVES it! Hands in the air everywhere! 🎉",
    "Amazing response! People are singing along at the top of their lungs!",
    "Fantastic energy! The audience is completely hooked!",
    "The venue is vibing HARD to this one!",
    "Crowd is eating this up! What a performance!",
  ],
  engaged: [
    "The crowd is into it - heads bobbing, good vibes all around 👍",
    "Solid response from the audience - they're clearly enjoying this",
    "Nice energy building in the venue...",
    "The crowd seems to be warming up nicely",
    "Good reaction - people are getting into the groove",
  ],
  mixed: [
    "Mixed reactions from the crowd... some love it, others seem unsure 😐",
    "The energy has dipped a bit - the crowd seems divided on this one",
    "Some people are really into it, others are heading to the bar...",
    "Not everyone's feeling this one, but some fans are still going hard",
    "A bit of an uneven response from the audience tonight...",
  ],
  disappointed: [
    "Ouch... the crowd isn't feeling this one 😞 Visible restlessness in the venue",
    "The energy has tanked - people are checking their phones...",
    "Tough crowd tonight... this song isn't landing at all",
    "You can feel the disappointment - the band needs to turn this around",
    "The vibe has really dropped - audible groans from some corners",
  ],
};

const SPECIAL_MOMENTS = [
  "CROWD SINGALONG! The entire venue is singing in unison!",
  "The lead guitarist pulls off an INSANE solo! The crowd goes nuts!",
  "A massive mosh pit has formed! Security is on alert!",
  "Someone just crowd surfed to the front! What a moment!",
  "The drummer just nailed an incredible fill! Standing ovation!",
  "Camera flashes light up the venue like stars!",
  "The band invites someone from the crowd on stage!",
  "A wall of death forms - this is getting INTENSE!",
  "The vocalist hits a note so perfect, goosebumps everywhere!",
  "Beach balls and inflatables appear in the crowd!",
];

const NEGATIVE_EVENTS = [
  "A brief feedback squeal from the monitors - quickly fixed by the crew",
  "The singer misses a verse but recovers smoothly",
  "Guitar string snaps! The tech rushes in with a backup",
  "Brief technical hiccup - the band plays through it professionally",
  "Someone in the front row faints - medical team responds quickly",
];

const ENCORE_COMMENTS = [
  "ENCORE! The crowd chants in unison as the band returns!",
  "They're back! The lights come up for one more!",
  "The crowd's persistence pays off - ENCORE TIME!",
  "You didn't think they'd leave without playing this one, did you?",
];

const FINALE_COMMENTS = [
  "The final notes ring out as confetti rains down on the crowd!",
  "What a show! The band takes their final bow to deafening applause!",
  "The lights come up - but the crowd won't stop cheering!",
  "An unforgettable performance comes to an end!",
];

export const TextGigViewer = ({ gigId, onComplete }: TextGigViewerProps) => {
  const [commentary, setCommentary] = useState<CommentaryEntry[]>([]);
  const [gig, setGig] = useState<any>(null);
  const [setlistSongs, setSetlistSongs] = useState<any[]>([]);
  const [performances, setPerformances] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hasArrived, setHasArrived] = useState(false);
  const [momentum, setMomentum] = useState(0); // -3 to +3 momentum tracker

  const addCommentary = useCallback((entry: Omit<CommentaryEntry, 'id' | 'timestamp'>) => {
    setCommentary(prev => [...prev, {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    }]);
  }, []);

  const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const generateSongStartCommentary = useCallback((songTitle: string, score: number) => {
    const energyLevel = score >= 18 ? 'high_energy' : score >= 12 ? 'medium_energy' : 'low_energy';
    const template = getRandomItem(SONG_START_COMMENTS[energyLevel]);
    return template.replace('{title}', songTitle);
  }, []);

  const generateCrowdReaction = useCallback((crowdResponse: string, score: number, songTitle: string) => {
    const reactions = CROWD_REACTIONS[crowdResponse] || CROWD_REACTIONS.mixed;
    let reaction = getRandomItem(reactions);
    
    // Add momentum-based modifiers
    if (momentum >= 2 && crowdResponse === 'enthusiastic') {
      reaction += " The band is really building something special here!";
    } else if (momentum <= -2 && crowdResponse === 'mixed') {
      reaction += " They need to turn this around fast...";
    }
    
    return reaction;
  }, [momentum]);

  // Load gig data
  useEffect(() => {
    const loadGig = async () => {
      const { data: gigData } = await supabase
        .from('gigs')
        .select('*, bands!gigs_band_id_fkey(name), venues!gigs_venue_id_fkey(name, capacity)')
        .eq('id', gigId)
        .single();

      if (gigData) {
        setGig(gigData);

        if (gigData.setlist_id) {
          const { data: songs } = await supabase
            .from('setlist_songs')
            .select('*, songs!inner(id, title, genre, quality_score, duration_seconds)')
            .eq('setlist_id', gigData.setlist_id)
            .order('position');
          
          setSetlistSongs(songs || []);
        }
      }
    };

    loadGig();
  }, [gigId]);

  // Band arrival commentary
  useEffect(() => {
    if (gig?.status === 'in_progress' && gig?.started_at && !hasArrived) {
      setHasArrived(true);
      addCommentary({
        type: 'arrival',
        message: getRandomItem(ARRIVAL_COMMENTS),
        icon: '🎸',
        variant: 'success',
      });
    }
  }, [gig, hasArrived, addCommentary]);

  // Subscribe to song performances
  useEffect(() => {
    if (!gig?.id) return;

    const loadExistingPerformances = async () => {
      const { data: outcome } = await supabase
        .from('gig_outcomes')
        .select('id')
        .eq('gig_id', gig.id)
        .single();

      if (outcome) {
        const { data: perfs } = await supabase
          .from('gig_song_performances')
          .select('*')
          .eq('gig_outcome_id', outcome.id)
          .order('position');

        if (perfs) {
          setPerformances(perfs);
        }
      }
    };

    loadExistingPerformances();

    const channel = supabase
      .channel('text-viewer-performances')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gig_song_performances' },
        (payload) => {
          const newPerf = payload.new as any;
          setPerformances(prev => [...prev, newPerf]);
          
          // Find song title
          const songData = setlistSongs.find(s => s.song_id === newPerf.song_id);
          const songTitle = songData?.songs?.title || newPerf.song_title || 'Unknown Song';
          const isEncore = songData?.is_encore;
          
          // Calculate new momentum
          const momentumChange = 
            newPerf.crowd_response === 'ecstatic' ? 1.5 :
            newPerf.crowd_response === 'enthusiastic' ? 0.5 :
            newPerf.crowd_response === 'engaged' ? 0 :
            newPerf.crowd_response === 'mixed' ? -0.5 : -1;
          
          setMomentum(prev => Math.max(-3, Math.min(3, prev + momentumChange)));

          // Add song start commentary
          if (isEncore) {
            addCommentary({
              type: 'encore',
              message: getRandomItem(ENCORE_COMMENTS),
              icon: '🌟',
              variant: 'success',
            });
          }
          
          addCommentary({
            type: 'song_start',
            message: generateSongStartCommentary(songTitle, newPerf.performance_score || 15),
            icon: '🎵',
          });

          // Add crowd reaction after a brief delay
          setTimeout(() => {
            addCommentary({
              type: 'crowd_reaction',
              message: generateCrowdReaction(newPerf.crowd_response, newPerf.performance_score || 15, songTitle),
              variant: newPerf.crowd_response === 'ecstatic' || newPerf.crowd_response === 'enthusiastic' 
                ? 'success' 
                : newPerf.crowd_response === 'disappointed' 
                  ? 'destructive' 
                  : 'default',
            });
          }, 1500);

          // Random chance for special moment (20%)
          if (Math.random() < 0.2) {
            setTimeout(() => {
              const isPositivePerformance = newPerf.performance_score >= 15;
              addCommentary({
                type: isPositivePerformance ? 'special_moment' : 'event',
                message: isPositivePerformance 
                  ? getRandomItem(SPECIAL_MOMENTS) 
                  : getRandomItem(NEGATIVE_EVENTS),
                icon: isPositivePerformance ? '✨' : '⚠️',
                variant: isPositivePerformance ? 'success' : 'warning',
              });
            }, 3000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gig, setlistSongs, addCommentary, generateSongStartCommentary, generateCrowdReaction]);

  // Subscribe to gig status updates
  useEffect(() => {
    const channel = supabase
      .channel('text-viewer-gig')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'gigs', filter: `id=eq.${gigId}` },
        (payload) => {
          setGig(payload.new);
          
          if (payload.new.status === 'completed') {
            addCommentary({
              type: 'finale',
              message: getRandomItem(FINALE_COMMENTS),
              icon: '🎆',
              variant: 'success',
            });
            onComplete?.();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gigId, onComplete, addCommentary]);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedSeconds = gig?.started_at 
    ? differenceInSeconds(currentTime, new Date(gig.started_at))
    : 0;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  const avgScore = useMemo(() => {
    if (performances.length === 0) return 0;
    return performances.reduce((sum, p) => sum + (p.performance_score || 0), 0) / performances.length;
  }, [performances]);

  const getMomentumLabel = () => {
    if (momentum >= 2) return { label: 'On Fire! 🔥', color: 'text-orange-500' };
    if (momentum >= 1) return { label: 'Building Momentum', color: 'text-green-500' };
    if (momentum <= -2) return { label: 'Struggling...', color: 'text-red-500' };
    if (momentum <= -1) return { label: 'Losing Steam', color: 'text-yellow-500' };
    return { label: 'Steady', color: 'text-muted-foreground' };
  };

  const momentumInfo = getMomentumLabel();

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <Card className="border-primary bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Mic2 className="h-6 w-6 text-primary animate-pulse" />
              <div>
                <p className="font-semibold">Live Text Commentary</p>
                <p className="text-sm text-muted-foreground">
                  {performances.length} of {setlistSongs.length} songs • {elapsedMinutes}m elapsed
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={momentumInfo.color}>
                {momentumInfo.label}
              </Badge>
              <Badge variant="default" className="animate-pulse">
                🔴 LIVE
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Star className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-xl font-bold">{avgScore.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-xl font-bold">{gig?.attendance || '—'}</p>
            <p className="text-xs text-muted-foreground">Attendance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-xl font-bold">{elapsedMinutes}m</p>
            <p className="text-xs text-muted-foreground">Elapsed</p>
          </CardContent>
        </Card>
      </div>

      {/* Commentary Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Live Commentary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            {commentary.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Music className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Waiting for the show to begin...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...commentary].reverse().map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-3 rounded-lg border transition-all ${
                      entry.variant === 'success' ? 'bg-green-500/10 border-green-500/30' :
                      entry.variant === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                      entry.variant === 'destructive' ? 'bg-red-500/10 border-red-500/30' :
                      'bg-muted/50 border-border'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {entry.icon && <span className="text-lg">{entry.icon}</span>}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{entry.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
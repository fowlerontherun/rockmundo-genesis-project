import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Music, Mic2, Users, Star, Clock, Play, Pause, 
  SkipForward, FastForward, Volume2, VolumeX, Crown 
} from "lucide-react";
import { useVipStatus } from "@/hooks/useVipStatus";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";

interface GigReviewViewerProps {
  gigId: string;
  gigOutcomeId: string;
  onClose: () => void;
  onInstantOutcome: () => void;
}

interface SongPerformance {
  id: string;
  song_id: string;
  position: number;
  performance_score: number;
  crowd_response: string;
  song_title?: string;
  audio_url?: string | null;
}

interface CommentaryEntry {
  id: string;
  timestamp: Date;
  type: 'arrival' | 'song_start' | 'crowd_reaction' | 'special_moment' | 'song_end' | 'finale';
  message: string;
  icon?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

const ARRIVAL_COMMENTS = [
  "The lights dim as the band takes the stage to thunderous applause!",
  "A roar erupts from the crowd as the musicians walk out!",
  "The venue erupts as the band emerges from backstage!",
  "Screams fill the air as spotlights illuminate the stage!",
];

const SONG_START_COMMENTS: Record<string, string[]> = {
  high_energy: [
    "They launch into '{title}' with explosive energy!",
    "'{title}' kicks off with a thunderous opening riff!",
    "The crowd recognizes '{title}' immediately and goes crazy!",
  ],
  medium_energy: [
    "'{title}' begins with a smooth groove...",
    "The band transitions into '{title}' seamlessly",
    "'{title}' starts up, getting heads nodding throughout the crowd",
  ],
  low_energy: [
    "'{title}' begins with a mellow, atmospheric intro...",
    "The band slows things down with '{title}'",
    "A hush falls as '{title}' starts with delicate notes...",
  ],
};

const CROWD_REACTIONS: Record<string, string[]> = {
  ecstatic: [
    "The crowd is going ABSOLUTELY WILD! 🔥",
    "PANDEMONIUM! The energy is OFF THE CHARTS!",
    "This is INCREDIBLE! The whole venue is shaking!",
  ],
  enthusiastic: [
    "The crowd LOVES it! Hands in the air everywhere! 🎉",
    "Amazing response! People are singing along!",
    "Fantastic energy! The audience is completely hooked!",
  ],
  engaged: [
    "The crowd is into it - heads bobbing, good vibes 👍",
    "Solid response from the audience",
    "Nice energy building in the venue...",
  ],
  mixed: [
    "Mixed reactions from the crowd... 😐",
    "The energy has dipped a bit...",
    "Some people are really into it, others not so much...",
  ],
  disappointed: [
    "Ouch... the crowd isn't feeling this one 😞",
    "The energy has tanked - people are checking their phones...",
    "Tough crowd tonight...",
  ],
};

const SPECIAL_MOMENTS = [
  "CROWD SINGALONG! The entire venue is singing in unison!",
  "The lead guitarist pulls off an INSANE solo!",
  "A massive mosh pit has formed!",
  "Camera flashes light up the venue like stars!",
];

const FINALE_COMMENTS = [
  "The final notes ring out as confetti rains down!",
  "What a show! The band takes their final bow!",
  "An unforgettable performance comes to an end!",
];

export const GigReviewViewer = ({ 
  gigId, 
  gigOutcomeId, 
  onClose, 
  onInstantOutcome 
}: GigReviewViewerProps) => {
  const { data: vipStatus } = useVipStatus();
  const isVip = vipStatus?.isVip || false;
  
  const [performances, setPerformances] = useState<SongPerformance[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1); // -1 = arrival, 0+ = song index
  const [commentary, setCommentary] = useState<CommentaryEntry[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [gig, setGig] = useState<any>(null);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Load gig and performances
  useEffect(() => {
    const loadData = async () => {
      // Load gig details
      const { data: gigData } = await supabase
        .from('gigs')
        .select('*, bands!gigs_band_id_fkey(name), venues!gigs_venue_id_fkey(name, capacity)')
        .eq('id', gigId)
        .single();
      
      if (gigData) setGig(gigData);

      // Load performances with song audio
      const { data: perfs } = await supabase
        .from('gig_song_performances')
        .select('*, songs(title, audio_url)')
        .eq('gig_outcome_id', gigOutcomeId)
        .order('position');

      if (perfs) {
        setPerformances(perfs.map(p => ({
          id: p.id,
          song_id: p.song_id,
          position: p.position,
          performance_score: p.performance_score,
          crowd_response: p.crowd_response,
          song_title: p.songs?.title || 'Unknown Song',
          audio_url: p.songs?.audio_url,
        })));
      }
    };

    loadData();
  }, [gigId, gigOutcomeId]);

  const addCommentary = useCallback((entry: Omit<CommentaryEntry, 'id' | 'timestamp'>) => {
    setCommentary(prev => [...prev, {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    }]);
    
    // Auto-scroll to bottom
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  }, []);

  const playCurrentSong = useCallback(() => {
    if (currentIndex < 0 || currentIndex >= performances.length) return;
    
    const perf = performances[currentIndex];
    
    // Play audio if VIP and audio exists
    if (isVip && perf.audio_url) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(perf.audio_url);
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.play().catch(console.error);
    }
  }, [currentIndex, performances, isVip, volume, isMuted]);

  const generateSongCommentary = useCallback((perf: SongPerformance) => {
    const score = perf.performance_score;
    const energyLevel = score >= 18 ? 'high_energy' : score >= 12 ? 'medium_energy' : 'low_energy';
    
    // Song start
    const startTemplate = getRandomItem(SONG_START_COMMENTS[energyLevel]);
    addCommentary({
      type: 'song_start',
      message: startTemplate.replace('{title}', perf.song_title || 'this song'),
      icon: '🎵',
    });

    // Crowd reaction after delay
    setTimeout(() => {
      const reactions = CROWD_REACTIONS[perf.crowd_response] || CROWD_REACTIONS.engaged;
      addCommentary({
        type: 'crowd_reaction',
        message: getRandomItem(reactions),
        variant: perf.crowd_response === 'ecstatic' || perf.crowd_response === 'enthusiastic' 
          ? 'success' 
          : perf.crowd_response === 'disappointed' 
            ? 'destructive' 
            : 'default',
      });
    }, 2000);

    // Special moment chance (30%)
    if (Math.random() < 0.3 && score >= 15) {
      setTimeout(() => {
        addCommentary({
          type: 'special_moment',
          message: getRandomItem(SPECIAL_MOMENTS),
          icon: '✨',
          variant: 'success',
        });
      }, 4000);
    }
  }, [addCommentary]);

  const advanceToNext = useCallback(() => {
    if (currentIndex < performances.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (currentIndex === performances.length - 1) {
      // Finale
      addCommentary({
        type: 'finale',
        message: getRandomItem(FINALE_COMMENTS),
        icon: '🎆',
        variant: 'success',
      });
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [currentIndex, performances.length, addCommentary]);

  // Handle song advancement
  useEffect(() => {
    if (!isPlaying || performances.length === 0) return;

    if (currentIndex === -1) {
      // Arrival commentary
      addCommentary({
        type: 'arrival',
        message: getRandomItem(ARRIVAL_COMMENTS),
        icon: '🎸',
        variant: 'success',
      });
      
      if (isAutoPlay) {
        timeoutRef.current = setTimeout(() => {
          setCurrentIndex(0);
        }, 3000);
      }
    } else if (currentIndex >= 0 && currentIndex < performances.length) {
      const perf = performances[currentIndex];
      generateSongCommentary(perf);
      playCurrentSong();
      
      if (isAutoPlay) {
        // Auto-advance after 8 seconds per song
        timeoutRef.current = setTimeout(() => {
          advanceToNext();
        }, 8000);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentIndex, isPlaying, performances, isAutoPlay, addCommentary, generateSongCommentary, playCurrentSong, advanceToNext]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handlePlayPause = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      if (currentIndex === -1) {
        // Start from beginning
      }
    } else {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  const handleSkipSong = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    advanceToNext();
  };

  const progress = performances.length > 0 
    ? Math.max(0, ((currentIndex + 1) / performances.length) * 100)
    : 0;

  const getVariantClass = (variant?: string) => {
    switch (variant) {
      case 'success': return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'destructive': return 'bg-red-500/10 border-red-500/30 text-red-400';
      default: return 'bg-card border-border';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-primary bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Mic2 className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold">Gig Review - {gig?.venues?.name || 'Unknown Venue'}</p>
                <p className="text-sm text-muted-foreground">
                  {gig?.bands?.name} • {performances.length} songs
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isVip && (
                <Badge variant="default" className="bg-yellow-500 text-black">
                  <Crown className="h-3 w-3 mr-1" />
                  VIP Audio
                </Badge>
              )}
              <Badge variant="outline">
                Review Mode
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Song {Math.max(0, currentIndex + 1)} of {performances.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
          
          {currentIndex >= 0 && currentIndex < performances.length && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" />
                <span className="font-medium">{performances[currentIndex]?.song_title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>{performances[currentIndex]?.performance_score}/25</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={handlePlayPause}
              size="lg"
              className="gap-2"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              {isPlaying ? 'Pause' : 'Play Review'}
            </Button>
            
            <Button
              onClick={handleSkipSong}
              variant="outline"
              size="lg"
              disabled={!isPlaying || currentIndex >= performances.length - 1}
              className="gap-2"
            >
              <SkipForward className="h-5 w-5" />
              Skip Song
            </Button>
            
            <Button
              onClick={onInstantOutcome}
              variant="secondary"
              size="lg"
              className="gap-2"
            >
              <FastForward className="h-5 w-5" />
              Instant Outcome
            </Button>
          </div>
          
          {/* VIP Audio Controls */}
          {isVip && (
            <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t">
              <Button
                variant="ghost"
                size="icon"
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
              <span className="text-xs text-muted-foreground">
                {!performances[currentIndex]?.audio_url && currentIndex >= 0 && 'No audio for this song'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commentary Feed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Live Commentary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]" ref={scrollRef as any}>
            <div className="space-y-3 pr-4">
              <AnimatePresence>
                {commentary.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Press Play to start the gig review with commentary
                  </p>
                ) : (
                  commentary.map((entry) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`p-3 rounded-lg border ${getVariantClass(entry.variant)}`}
                    >
                      <div className="flex items-start gap-2">
                        {entry.icon && <span className="text-lg">{entry.icon}</span>}
                        <p className="text-sm">{entry.message}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {entry.timestamp.toLocaleTimeString()}
                      </p>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Close button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Close Review
        </Button>
      </div>
    </div>
  );
};

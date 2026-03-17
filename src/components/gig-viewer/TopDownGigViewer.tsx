import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Music, Mic2, Users, Star, Flame, Sparkles, Zap, Volume2, VolumeX, X } from "lucide-react";
import {
  generateEnhancedCommentary,
  generateArrivalCommentary,
  generateSongCommentary,
  generateBetweenSongBanter,
  generateCrowdChant,
  generateTechnicalEvent,
  generateMilestoneCommentary,
  getVenueType,
  getRandomItem,
  VENUE_ARRIVALS,
  CROWD_CHANTS,
  SPECIAL_MOMENTS,
  TECHNICAL_EVENTS,
  WEATHER_EFFECTS,
  FAME_COMMENTARY,
  FAN_FAVOURITE_COMMENTARY,
  BETWEEN_SONG_BANTER,
  MILESTONE_MOMENTS,
  type VenueContext,
  type BandContext,
  type SongContext,
} from "@/utils/enhancedCommentaryGenerator";

// Massive extra commentary pools for 100s of lines
const CROWD_ATMOSPHERE = [
  "Someone holds up a hand-drawn banner — the band notices and points!",
  "A couple in the front row shares a kiss during the ballad 🥰",
  "The smell of food trucks drifts over from behind the venue",
  "A group of friends link arms and sway together",
  "Someone in row 5 just lost their shoe crowd surfing!",
  "The bartenders have stopped serving — even they're watching!",
  "A parent lifts their kid onto their shoulders for a better view",
  "The merch stand reports they're running low on t-shirts!",
  "Security guards are tapping their feet — even they can't resist!",
  "Phone flashlights create a galaxy of stars across the venue ✨",
  "Someone throws a flower on stage — the singer catches it!",
  "The VIP section is on their feet for the first time tonight!",
  "A fan is openly weeping with joy in the front row",
  "The whole venue smells of sweat, beer, and pure rock energy!",
  "Two strangers just became best friends over their shared love of this band",
  "The sound reverberates off the walls — you can FEEL it in your bones!",
  "Camera crews are capturing every moment for the live stream",
  "The bass player winks at someone in the crowd — chaos ensues!",
  "A circle pit opens up in the middle of the floor!",
  "Beach balls appear from nowhere, bouncing across the crowd!",
  "The energy is so thick you could cut it with a knife!",
  "Glow sticks rain down from the balcony! 🌈",
  "The floor is literally vibrating from the crowd jumping!",
  "Someone just proposed during the slow song! They said YES! 💍",
  "The acoustics in this venue are absolutely PERFECT tonight",
  "A sea of raised hands stretches as far as you can see",
  "The bouncer at the front is air-drumming when he thinks no one's watching",
  "First aid tent reports only cases of 'too much fun'!",
  "The lighting tech deserves a medal for this show!",
  "You can hear the crowd from THREE blocks away!",
];

const MUSICIAN_MOMENTS = [
  "The guitarist switches to a 12-string for the next section — gorgeous!",
  "The drummer spins a stick and catches it perfectly mid-beat",
  "The bassist slides across the stage on their knees!",
  "The keyboardist is absolutely SHREDDING a solo!",
  "The singer climbs on the monitor wedge — pure showmanship!",
  "The lead guitarist bends a note that seems to last FOREVER",
  "The rhythm section locks in so tight it sounds like one instrument",
  "The band shares a knowing smile — they KNOW they're killing it",
  "The vocalist hits a note so high the crowd gasps!",
  "Guitar feedback builds into something beautiful and haunting",
  "The drummer does a fill that makes every jaw in the room DROP",
  "The singer holds the mic out to the crowd — they deliver!",
  "Two guitarists face each other for a duel — the crowd picks sides!",
  "The bassist walks to the front of the stage and drops a FILTHY riff",
  "The singer sits on the edge of the stage, intimate and raw",
  "The band kicks into double time — the venue EXPLODES!",
  "An improvised jam session breaks out between songs!",
  "The guitarist plays behind their head — showoff! The crowd loves it!",
  "The singer's voice cracks with emotion — it makes it even MORE powerful",
  "The band drops to a whisper then ERUPTS back to full volume!",
  "The keyboardist adds a subtle harmony that elevates everything",
  "The drummer counts in with stick clicks — 1, 2, 1-2-3-4!",
  "The guitarist's effects pedal creates an otherworldly soundscape",
  "The singer does a call-and-response with the crowd — MAGICAL!",
  "A moment of silence... then the heaviest riff of the night!",
];

const PRODUCTION_MOMENTS = [
  "The lighting shifts to deep purple — atmospheric!",
  "Spotlights sweep the crowd in time with the beat",
  "A massive LED screen displays psychedelic visuals behind the band",
  "Fog machines fill the stage — the band emerges like ghosts!",
  "PYROTECHNICS! Flames shoot up from either side of the stage! 🔥",
  "Confetti RAINS down from the ceiling! The crowd goes MENTAL!",
  "The house lights drop to complete darkness... then BOOM! Full lights!",
  "Laser beams cut through the haze — stunning visual effect!",
  "The stage rotates slightly giving everyone a better view",
  "CO2 cannons blast the front rows with a refreshing burst!",
  "The lighting engineer matches every beat drop perfectly",
  "Strobe lights create a stop-motion effect during the fast section",
  "A single spotlight isolates the singer for the emotional bridge",
  "The entire ceiling is now a canvas of moving lights ✨",
  "Smoke rings float above the crowd — how did they DO that?!",
  "The screens show a montage of the band's journey — fans get emotional",
];

const NARRATIVE_MOMENTS = [
  "This is the kind of night that changes lives. You can feel it.",
  "In years to come, people will say 'I was there that night'",
  "The connection between band and audience is palpable right now",
  "This isn't just a concert — this is a MOMENT",
  "Every person in this venue is sharing something special right now",
  "The air is charged with electricity — both literal and figurative!",
  "For these few hours, nothing else in the world matters",
  "The band is feeding off the crowd's energy and giving it back tenfold",
  "Music has a way of bringing strangers together — tonight proves it",
  "You couldn't script a better night if you tried",
  "This is the setlist of a band at the peak of their powers",
  "Every musician on that stage is giving 110% tonight",
  "The crowd's energy has pushed this performance to another level",
  "This is what they mean when they say 'you had to be there'",
  "Pure, unfiltered musical MAGIC happening right now",
  "The venue walls seem to breathe with the collective energy",
];

interface CommentaryEntry {
  id: string;
  timestamp: Date;
  type: string;
  message: string;
  icon?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

interface TopDownGigViewerProps {
  gigId: string;
  onComplete?: () => void;
}

export const TopDownGigViewer = ({ gigId, onComplete }: TopDownGigViewerProps) => {
  const [gig, setGig] = useState<any>(null);
  const [setlistSongs, setSetlistSongs] = useState<any[]>([]);
  const [performances, setPerformances] = useState<any[]>([]);
  const [commentary, setCommentary] = useState<CommentaryEntry[]>([]);
  const [hasArrived, setHasArrived] = useState(false);
  const [momentum, setMomentum] = useState(0);
  const [currentSongAudioUrl, setCurrentSongAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const processedIds = useRef<Set<string>>(new Set());
  const lastSongIndex = useRef(-1);
  const commentaryIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const addComment = useCallback((type: string, message: string, variant?: CommentaryEntry['variant'], icon?: string) => {
    setCommentary(prev => {
      if (prev.length > 0 && prev[prev.length - 1]?.message === message) return prev;
      return [...prev, { id: crypto.randomUUID(), timestamp: new Date(), type, message, variant, icon }];
    });
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commentary.length]);

  // Audio management
  useEffect(() => {
    if (!currentSongAudioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(currentSongAudioUrl);
    } else if (audioRef.current.src !== currentSongAudioUrl) {
      audioRef.current.src = currentSongAudioUrl;
      audioRef.current.load();
    }
    audioRef.current.volume = isMuted ? 0 : volume;
    if (isPlaying) {
      audioRef.current.play().catch(console.error);
    }
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, [currentSongAudioUrl, isPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Load gig data
  useEffect(() => {
    const load = async () => {
      const { data: gigData } = await supabase
        .from('gigs')
        .select('*, bands!gigs_band_id_fkey(name, genre, fame), venues!gigs_venue_id_fkey(name, capacity, location, venue_type, city_id)')
        .eq('id', gigId)
        .single();

      if (gigData) {
        setGig(gigData);
        if (gigData.setlist_id) {
          const { data: songs } = await supabase
            .from('setlist_songs')
            .select('*, songs!inner(id, title, genre, quality_score, duration_seconds, audio_url)')
            .eq('setlist_id', gigData.setlist_id)
            .order('position');
          setSetlistSongs(songs || []);
          
          // Start playing the first song's audio if available
          if (songs && songs.length > 0 && songs[0].songs?.audio_url) {
            setCurrentSongAudioUrl(songs[0].songs.audio_url);
            setIsPlaying(true);
          }
        }
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [gigId]);

  // Arrival commentary
  useEffect(() => {
    if (gig && !hasArrived) {
      setHasArrived(true);
      const bandName = (gig.bands as any)?.name || 'The band';
      const venueName = (gig.venues as any)?.name || 'the venue';
      const venueCapacity = (gig.venues as any)?.capacity || 100;
      const venueType = getVenueType(venueCapacity, venueName);
      const templates = VENUE_ARRIVALS[venueType] || VENUE_ARRIVALS.default;
      let msg = getRandomItem(templates).replace(/{band}/g, bandName).replace(/{venue}/g, venueName);
      addComment('arrival', msg, 'success', '🎭');
      
      // Extra arrival commentary
      setTimeout(() => addComment('atmosphere', `The crowd at ${venueName} is buzzing with anticipation!`, 'default', '👥'), 1500);
      setTimeout(() => addComment('production', 'The lights sweep across the stage as the sound check hums to life...', 'default', '💡'), 3000);
      setTimeout(() => addComment('atmosphere', `${gig.attendance || 0} fans packed into a venue that holds ${venueCapacity}!`, 'default', '🎟️'), 4500);
    }
  }, [gig, hasArrived, addComment]);

  // Continuous ambient commentary generator - runs every 3-6 seconds
  useEffect(() => {
    if (!gig || !hasArrived) return;

    const bandName = (gig.bands as any)?.name || 'The band';
    const venueName = (gig.venues as any)?.name || 'the venue';

    commentaryIntervalRef.current = setInterval(() => {
      const roll = Math.random();
      if (roll < 0.25) {
        addComment('atmosphere', getRandomItem(CROWD_ATMOSPHERE), 'default', '👥');
      } else if (roll < 0.45) {
        addComment('musician', getRandomItem(MUSICIAN_MOMENTS), 'default', '🎸');
      } else if (roll < 0.60) {
        addComment('production', getRandomItem(PRODUCTION_MOMENTS), 'default', '💡');
      } else if (roll < 0.72) {
        addComment('narrative', getRandomItem(NARRATIVE_MOMENTS), 'success', '✨');
      } else if (roll < 0.82) {
        addComment('chant', generateCrowdChant(Math.random() < 0.5 ? 'band_name' : 'appreciation', { name: bandName, fame: (gig.bands as any)?.fame || 0 }), 'default', '📣');
      } else if (roll < 0.90) {
        addComment('technical', generateTechnicalEvent(Math.random() < 0.7), 'default', '⚙️');
      } else {
        addComment('banter', generateBetweenSongBanter((gig.venues as any)?.location || undefined), 'default', '🎤');
      }
    }, 3000 + Math.random() * 3000);

    return () => clearInterval(commentaryIntervalRef.current);
  }, [gig, hasArrived, addComment]);

  // Process song performances
  const processPerf = useCallback((perf: any) => {
    if (processedIds.current.has(perf.id)) return;
    processedIds.current.add(perf.id);

    const songData = setlistSongs.find(s => s.song_id === perf.song_id);
    const title = songData?.songs?.title || 'Unknown Song';
    const score = perf.performance_score || 15;
    const response = perf.crowd_response || 'engaged';
    const position = perf.position || 0;
    const audioUrl = songData?.songs?.audio_url;

    // Update audio to current song
    if (audioUrl) {
      setCurrentSongAudioUrl(audioUrl);
      setIsPlaying(true);
    }

    const change = response === 'ecstatic' ? 1.5 : response === 'enthusiastic' ? 0.5 : response === 'engaged' ? 0 : response === 'mixed' ? -0.5 : -1;
    setMomentum(prev => Math.max(-3, Math.min(3, prev + change)));

    // Song transition commentary
    if (position !== lastSongIndex.current) {
      lastSongIndex.current = position;

      if (position === 0) {
        addComment('milestone', '🎵 Here we GO! Opening strong!', 'success', '🎵');
      } else if (position === Math.floor(setlistSongs.length / 2)) {
        addComment('milestone', "We're halfway through the set and the energy is INCREDIBLE!", 'success', '⚡');
      } else if (position >= setlistSongs.length - 1) {
        addComment('milestone', "This is it — the FINAL song of the main set!", 'warning', '🏁');
      }
    }

    // Song start
    const energyLabel = score >= 18 ? 'EXPLOSIVE' : score >= 14 ? 'solid' : 'mellow';
    addComment('song_start', `🎵 Now playing: '${title}' — the band opens with ${energyLabel} energy!`, 'default', '🎵');

    // Multiple commentary lines per song for density
    const delays = [1200, 2800, 4500, 6500, 8500, 11000, 14000];
    const bandCtx: BandContext = { name: (gig?.bands as any)?.name || 'The band', fame: (gig?.bands as any)?.fame || 0, genre: (gig?.bands as any)?.genre };
    const songCtx: SongContext = { title, genre: songData?.songs?.genre, position, totalSongs: setlistSongs.length, performanceScore: score, crowdResponse: response };

    delays.forEach((delay, i) => {
      setTimeout(() => {
        if (i === 0) {
          addComment('song_mid', generateSongCommentary(songCtx, bandCtx), score >= 15 ? 'success' : 'default', '🎶');
        } else if (i === 1) {
          const crowdVariant = (response === 'ecstatic' || response === 'enthusiastic') ? 'success' : response === 'disappointed' ? 'destructive' : 'default';
          const crowdLines: Record<string, string[]> = {
            ecstatic: ["The crowd is going ABSOLUTELY WILD! 🔥", "PANDEMONIUM! The energy is OFF THE CHARTS!", "LEGENDARY performance! The crowd can't contain themselves!"],
            enthusiastic: ["The crowd LOVES it! Hands in the air everywhere! 🎉", "Amazing response! People are singing along!", "Fantastic energy! The audience is completely hooked!"],
            engaged: ["The crowd is into it — heads bobbing, good vibes 👍", "Solid response from the audience", "Nice energy building in the venue..."],
            mixed: ["Mixed reactions... some love it, others unsure 😐", "The energy has dipped a bit", "Not everyone's feeling this one..."],
            disappointed: ["Ouch... the crowd isn't feeling this one 😞", "The energy has tanked...", "Tough crowd tonight..."],
          };
          addComment('crowd_reaction', getRandomItem(crowdLines[response] || crowdLines.engaged), crowdVariant as any, '👥');
        } else if (i === 2 && score >= 16) {
          addComment('special', getRandomItem(MUSICIAN_MOMENTS), 'success', '🌟');
        } else if (i === 3) {
          addComment('atmosphere', getRandomItem(CROWD_ATMOSPHERE), 'default', '👥');
        } else if (i === 4 && score >= 18) {
          addComment('production', getRandomItem(PRODUCTION_MOMENTS), 'success', '💡');
        } else if (i === 5) {
          addComment('narrative', getRandomItem(NARRATIVE_MOMENTS), 'default', '✨');
        } else if (i === 6) {
          addComment('song_end', `'${title}' wraps up to ${response === 'ecstatic' ? 'THUNDEROUS applause!' : response === 'enthusiastic' ? 'huge cheers!' : response === 'engaged' ? 'warm applause.' : 'polite clapping.'}`, score >= 15 ? 'success' : 'default', '👏');
        }
      }, delay);
    });
  }, [setlistSongs, addComment, gig]);

  // Poll performances
  useEffect(() => {
    if (!gig?.id) return;

    const loadPerfs = async () => {
      const { data: outcome } = await supabase
        .from('gig_outcomes')
        .select('id')
        .eq('gig_id', gig.id)
        .maybeSingle();

      if (outcome) {
        const { data: perfs } = await supabase
          .from('gig_song_performances')
          .select('*')
          .eq('gig_outcome_id', outcome.id)
          .order('position');

        if (perfs) {
          perfs.forEach(p => processPerf(p));
          setPerformances(perfs);
        }
      }
    };

    loadPerfs();
    const interval = setInterval(loadPerfs, 3000);

    const channel = supabase
      .channel('commentary-perfs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gig_song_performances' }, (payload) => {
        processPerf(payload.new);
        setPerformances(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [gig?.id, processPerf]);

  // Gig status subscription
  useEffect(() => {
    const channel = supabase
      .channel('commentary-gig-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gigs', filter: `id=eq.${gigId}` }, (payload) => {
        setGig(payload.new);
        if (payload.new.status === 'completed') {
          addComment('finale', '🎆 The final notes ring out... WHAT A SHOW!', 'success', '🎆');
          addComment('finale', '🎆 An UNFORGETTABLE performance comes to an end!', 'success', '🎆');
          addComment('finale', "The crowd won't stop cheering! What a night!", 'success', '🥳');
          setTimeout(() => onComplete?.(), 5000);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gigId, onComplete, addComment]);

  // Derived state
  const currentSongIndex = gig?.current_song_position || 0;
  const currentSong = setlistSongs[currentSongIndex];
  const latestPerf = performances[performances.length - 1];
  const crowdMood = latestPerf?.crowd_response || 'engaged';
  const isLive = gig?.status === 'in_progress';
  const bandName = (gig?.bands as any)?.name || 'Unknown Band';
  const venueName = (gig?.venues as any)?.name || 'Unknown Venue';
  const attendance = gig?.attendance || 0;
  const capacity = (gig?.venues as any)?.capacity || 100;

  const moodColor = crowdMood === 'ecstatic' ? 'text-yellow-400' : crowdMood === 'enthusiastic' ? 'text-green-400' : crowdMood === 'engaged' ? 'text-blue-400' : crowdMood === 'mixed' ? 'text-orange-400' : 'text-red-400';

  const iconMap: Record<string, string> = {
    arrival: '🎭', song_start: '🎵', song_mid: '🎶', song_end: '👏', crowd_reaction: '👥',
    special: '🌟', milestone: '⚡', atmosphere: '🌎', musician: '🎸', production: '💡',
    narrative: '✨', chant: '📣', technical: '⚙️', banter: '🎤', finale: '🎆',
  };

  const variantBg: Record<string, string> = {
    success: 'bg-green-500/10 border-green-500/20',
    warning: 'bg-yellow-500/10 border-yellow-500/20',
    destructive: 'bg-red-500/10 border-red-500/20',
    default: 'bg-muted/30 border-border/50',
  };

  return (
    <Card className="border-primary/30 bg-card">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic2 className="h-5 w-5 text-primary" />
            Live Commentary
          </CardTitle>
          <div className="flex items-center gap-2">
            {isLive && (
              <Badge variant="default" className="animate-pulse text-xs">🔴 LIVE</Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {performances.length}/{setlistSongs.length} songs
            </Badge>
          </div>
        </div>
        
        {/* Info bar */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-2">
          <span className="flex items-center gap-1"><Music className="h-3 w-3" /> {bandName}</span>
          <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {venueName}</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {attendance}/{capacity}</span>
          <span className={`flex items-center gap-1 font-medium ${moodColor}`}>
            <Flame className="h-3 w-3" /> {crowdMood}
          </span>
          {currentSong && (
            <span className="flex items-center gap-1 font-medium text-primary">
              🎵 {currentSong.songs?.title || 'Loading...'}
            </span>
          )}
        </div>

        {/* Volume controls */}
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume * 100]}
            onValueChange={([val]) => {
              setVolume(val / 100);
              if (val > 0) setIsMuted(false);
            }}
            max={100}
            step={1}
            className="w-24"
          />
        </div>
      </CardHeader>

      {/* Commentary Feed */}
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-2 pr-2">
            {commentary.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">
                Waiting for the show to begin...
              </p>
            )}
            {commentary.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-start gap-2 p-2 rounded-lg border text-sm animate-in fade-in-50 slide-in-from-bottom-1 ${variantBg[entry.variant || 'default']}`}
              >
                <span className="text-base flex-shrink-0 mt-0.5">{entry.icon || iconMap[entry.type] || '📢'}</span>
                <p className="flex-1 leading-relaxed">{entry.message}</p>
                <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                  {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

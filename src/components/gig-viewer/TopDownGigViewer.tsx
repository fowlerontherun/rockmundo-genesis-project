import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TopDownStage, type StageMember } from "./TopDownStage";
import { TopDownCrowd } from "./TopDownCrowd";
import { TopDownHUD } from "./TopDownHUD";
import { TopDownCommentary, type CommentaryEntry } from "./TopDownCommentary";
import {
  generateEnhancedCommentary,
  getVenueType,
  getRandomItem,
  VENUE_ARRIVALS,
  type VenueContext,
  type BandContext,
} from "@/utils/enhancedCommentaryGenerator";

// Local commentary pools (migrated from old TextGigViewer)
const ARRIVAL_COMMENTS = [
  "The lights dim as the band takes the stage to thunderous applause!",
  "A roar erupts from the crowd as the musicians walk out!",
  "The venue erupts as the band emerges from backstage!",
  "Screams fill the air as spotlights illuminate the stage!",
];

const SONG_START: Record<string, string[]> = {
  high_energy: [
    "They launch into '{title}' with explosive energy!",
    "'{title}' kicks off with a thunderous opening riff!",
    "BOOM! '{title}' hits like a freight train!",
  ],
  medium_energy: [
    "'{title}' begins with a smooth groove...",
    "The band transitions into '{title}' seamlessly",
  ],
  low_energy: [
    "'{title}' begins with a mellow, atmospheric intro...",
    "The band slows things down with '{title}'",
  ],
};

const CROWD_REACTIONS: Record<string, string[]> = {
  ecstatic: [
    "The crowd is going ABSOLUTELY WILD! 🔥",
    "PANDEMONIUM! The energy is OFF THE CHARTS!",
    "LEGENDARY performance! The crowd can't contain themselves!",
  ],
  enthusiastic: [
    "The crowd LOVES it! Hands in the air everywhere! 🎉",
    "Amazing response! People are singing along!",
    "Fantastic energy! The audience is completely hooked!",
  ],
  engaged: [
    "The crowd is into it — heads bobbing, good vibes 👍",
    "Solid response from the audience",
    "Nice energy building in the venue...",
  ],
  mixed: [
    "Mixed reactions... some love it, others unsure 😐",
    "The energy has dipped a bit",
    "Not everyone's feeling this one...",
  ],
  disappointed: [
    "Ouch... the crowd isn't feeling this one 😞",
    "The energy has tanked...",
    "Tough crowd tonight...",
  ],
};

const FINALE_COMMENTS = [
  "The final notes ring out as confetti rains down!",
  "What a show! The band takes their final bow!",
  "INCREDIBLE! A night nobody will forget!",
];

const SPECIAL_MOMENTS = [
  "CROWD SINGALONG! The entire venue is singing in unison!",
  "The lead guitarist pulls off an INSANE solo!",
  "Someone just crowd surfed to the front!",
  "Camera flashes light up the venue like stars!",
  "The whole venue is bouncing! The floor is SHAKING!",
];

interface TopDownGigViewerProps {
  gigId: string;
  onComplete?: () => void;
}

export const TopDownGigViewer = ({ gigId, onComplete }: TopDownGigViewerProps) => {
  const [gig, setGig] = useState<any>(null);
  const [setlistSongs, setSetlistSongs] = useState<any[]>([]);
  const [performances, setPerformances] = useState<any[]>([]);
  const [members, setMembers] = useState<StageMember[]>([]);
  const [commentary, setCommentary] = useState<CommentaryEntry[]>([]);
  const [hasArrived, setHasArrived] = useState(false);
  const [momentum, setMomentum] = useState(0);
  const processedIds = useRef<Set<string>>(new Set());

  const addComment = useCallback((type: string, message: string, variant?: CommentaryEntry['variant']) => {
    setCommentary(prev => {
      if (prev[prev.length - 1]?.message === message) return prev;
      return [...prev, { id: crypto.randomUUID(), timestamp: new Date(), type, message, variant }];
    });
  }, []);

  // Load gig data + poll
  useEffect(() => {
    const load = async () => {
      const { data: gigData } = await supabase
        .from('gigs')
        .select('*, bands!gigs_band_id_fkey(name), venues!gigs_venue_id_fkey(name, capacity, location)')
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

        // Load band members
        const { data: bandMembers } = await supabase
          .from('band_members')
          .select('id, instrument_role, vocal_role, user_id, profiles:user_id(display_name)')
          .eq('band_id', gigData.band_id)
          .eq('member_status', 'active');

        if (bandMembers) {
          setMembers(bandMembers.map((m: any) => ({
            id: m.id,
            name: (m.profiles as any)?.display_name || m.instrument_role,
            instrumentRole: m.instrument_role,
            vocalRole: m.vocal_role,
          })));
        }
      }
    };

    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [gigId]);

  // Arrival commentary
  useEffect(() => {
    if (gig?.status === 'in_progress' && gig?.started_at && !hasArrived) {
      setHasArrived(true);
      addComment('arrival', getRandomItem(ARRIVAL_COMMENTS), 'success');
    }
  }, [gig, hasArrived, addComment]);

  // Process new performance
  const processPerf = useCallback((perf: any) => {
    if (processedIds.current.has(perf.id)) return;
    processedIds.current.add(perf.id);

    const songData = setlistSongs.find(s => s.song_id === perf.song_id);
    const title = songData?.songs?.title || 'Unknown Song';
    const score = perf.performance_score || 15;
    const response = perf.crowd_response || 'engaged';

    // Momentum
    const change = response === 'ecstatic' ? 1.5 : response === 'enthusiastic' ? 0.5 : response === 'engaged' ? 0 : response === 'mixed' ? -0.5 : -1;
    setMomentum(prev => Math.max(-3, Math.min(3, prev + change)));

    // Song start
    const energy = score >= 18 ? 'high_energy' : score >= 12 ? 'medium_energy' : 'low_energy';
    const template = getRandomItem(SONG_START[energy]);
    addComment('song_start', template.replace('{title}', title));

    // Crowd reaction after delay
    setTimeout(() => {
      const reactions = CROWD_REACTIONS[response] || CROWD_REACTIONS.engaged;
      const variant = (response === 'ecstatic' || response === 'enthusiastic') ? 'success' : response === 'disappointed' ? 'destructive' : 'default';
      addComment('crowd_reaction', getRandomItem(reactions), variant as CommentaryEntry['variant']);
    }, 1500);

    // Special moment (20% chance)
    if (Math.random() < 0.2 && score >= 15) {
      setTimeout(() => addComment('special_moment', getRandomItem(SPECIAL_MOMENTS), 'success'), 3000);
    }
  }, [setlistSongs, addComment]);

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

          // Update member scores from latest performance
          if (perfs.length > 0) {
            const latest = perfs[perfs.length - 1];
            setMembers(prev => prev.map(m => ({
              ...m,
              performanceScore: latest.performance_score || undefined,
              skillContribution: latest.member_skills_contribution || undefined,
            })));
          }
        }
      }
    };

    loadPerfs();
    const interval = setInterval(loadPerfs, 3000);

    // Realtime subscription
    const channel = supabase
      .channel('topdown-perfs')
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
      .channel('topdown-gig-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gigs', filter: `id=eq.${gigId}` }, (payload) => {
        setGig(payload.new);
        if (payload.new.status === 'completed') {
          addComment('finale', getRandomItem(FINALE_COMMENTS), 'success');
          onComplete?.();
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
  const perfScore = latestPerf?.performance_score || 15;
  const songEnergy: 'high' | 'medium' | 'low' = perfScore >= 18 ? 'high' : perfScore >= 12 ? 'medium' : 'low';
  const intensity = Math.max(0, Math.min(1, (momentum + 3) / 6));
  const attendance = gig?.attendance || 0;
  const capacity = gig?.venues?.capacity || 100;
  const attendancePercent = Math.round((attendance / capacity) * 100);
  const isLive = gig?.status === 'in_progress';

  const lightingColor = useMemo(() => {
    if (crowdMood === 'ecstatic') return 'hsl(20, 90%, 50%)';
    if (crowdMood === 'enthusiastic') return 'hsl(120, 70%, 45%)';
    if (crowdMood === 'mixed') return 'hsl(45, 80%, 50%)';
    if (crowdMood === 'disappointed') return 'hsl(0, 60%, 40%)';
    return 'hsl(220, 70%, 50%)';
  }, [crowdMood]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-border bg-black" style={{ aspectRatio: '16/10' }}>
      {/* Stage area — top 55% */}
      <div className="absolute top-0 left-0 right-0" style={{ height: '55%' }}>
        <TopDownStage
          members={members}
          intensity={intensity}
          songEnergy={songEnergy}
          lightingColor={lightingColor}
        />
      </div>

      {/* Crowd area — bottom 45% */}
      <div className="absolute bottom-0 left-0 right-0" style={{ height: '45%' }}>
        <TopDownCrowd
          attendancePercent={attendancePercent}
          mood={crowdMood}
          intensity={intensity}
        />
      </div>

      {/* HUD overlay */}
      <TopDownHUD
        songTitle={currentSong?.songs?.title || 'Waiting...'}
        songIndex={currentSongIndex}
        totalSongs={setlistSongs.length}
        crowdMood={crowdMood}
        attendancePercent={attendancePercent}
        venueName={gig?.venues?.name || 'Unknown Venue'}
        attendance={attendance}
        venueCapacity={capacity}
        isLive={isLive}
      />

      {/* Commentary overlay */}
      <TopDownCommentary entries={commentary} />
    </div>
  );
};

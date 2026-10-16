import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RecordingStage, RecordingStatus } from "@/lib/workflows/recording";


export interface RecordingProducer {
  id: string;
  name: string;
  specialty_genre: string;
  quality_bonus: number;
  mixing_skill: number;
  arrangement_skill: number;
  cost_per_hour: number;
  tier: 'budget' | 'mid' | 'premium' | 'legendary';
  bio: string | null;
  past_works: string[];
}

export interface RecordingSession {
  id: string;
  user_id: string;
  profile_id: string | null;
  band_id: string | null;
  studio_id: string;
  producer_id: string | null;
  song_id: string;
  recording_version: string | null;
  duration_hours: number;
  total_cost: number;
  quality_improvement: number;
  status: RecordingStatus;
  stage?: RecordingStage | null;
  scheduled_start: string;
  scheduled_end: string;
  started_at?: string | null;
  completed_at: string | null;
  session_data: any;
  total_takes?: number | null;
  quality_gain?: number | null;
  notes?: string | null;
  engineer_id?: string | null;
  engineer_name?: string | null;
  created_at: string;
  updated_at: string;
  city_studios?: { name?: string | null; quality_rating?: number | null } | null;
  recording_producers?: { name?: string | null; tier?: string | null } | null;
  songs?: { title?: string | null; genre?: string | null } | null;
}

export interface OrchestraOption {
  size: 'chamber' | 'small' | 'full';
  cost: number;
  bonus: number;
  musicians: number;
}

export const ORCHESTRA_OPTIONS: OrchestraOption[] = [
  { size: 'chamber', cost: 1500, bonus: 10, musicians: 15 },
  { size: 'small', cost: 4000, bonus: 17, musicians: 30 },
  { size: 'full', cost: 12000, bonus: 25, musicians: 80 },
];

export const useRecordingProducers = (genreFilter?: string, tierFilter?: string) => {
  return useQuery({
    queryKey: ['recording-producers', genreFilter, tierFilter],
    queryFn: async () => {
      let query = supabase
        .from('recording_producers')
        .select('id, name, specialty_genre, quality_bonus, mixing_skill, arrangement_skill, cost_per_hour, tier, bio, past_works')
        .order('tier', { ascending: false })
        .order('quality_bonus', { ascending: false });

      if (genreFilter) {
        // Use ilike for flexible matching (case-insensitive partial match)
        query = query.ilike('specialty_genre', `%${genreFilter}%`);
      }
      if (tierFilter) {
        query = query.eq('tier', tierFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as RecordingProducer[];
    },
  });
};

const recordingSessionSelect = `
  id, user_id, profile_id, band_id, studio_id, producer_id, song_id, recording_version, duration_hours, total_cost, quality_improvement, status, scheduled_start, scheduled_end, completed_at, session_data, created_at, updated_at,
  city_studios (name, quality_rating),
  recording_producers (name, tier),
  songs:songs!recording_sessions_song_id_fkey (title, genre)
` as string;

const normalizeRecordingSession = (row: any): RecordingSession => ({
  ...row,
  stage: row.session_data?.stage ?? "recording",
  started_at: row.session_data?.started_at ?? null,
  total_takes: row.session_data?.total_takes ?? null,
  quality_gain: row.session_data?.quality_gain ?? row.quality_improvement ?? null,
  notes: row.session_data?.notes ?? null,
  engineer_id: row.session_data?.engineer_id ?? null,
  engineer_name: row.session_data?.engineer_name ?? null,
});

export const useRecordingSessions = (profileId?: string | null, userId?: string | null) => {
  return useQuery({
    queryKey: ['recording-sessions', profileId, userId],
    queryFn: async () => {
      if (!profileId && !userId) return [];

      const membershipQueries = [
        profileId
          ? supabase
              .from('band_members')
              .select('band_id')
              .eq('profile_id', profileId)
              .eq('member_status', 'active')
          : Promise.resolve({ data: [], error: null } as any),
        userId
          ? profileId
            // Legacy membership rows only count when no character owns them,
            // otherwise another character's band sessions would leak in.
            ? supabase
                .from('band_members')
                .select('band_id')
                .eq('user_id', userId)
                .is('profile_id', null)
                .eq('member_status', 'active')
            : supabase
                .from('band_members')
                .select('band_id')
                .eq('user_id', userId)
                .eq('member_status', 'active')
          : Promise.resolve({ data: [], error: null } as any),
      ];

      const [membershipByProfile, membershipByUser] = await Promise.all(membershipQueries);

      if (membershipByProfile.error) throw membershipByProfile.error;
      if (membershipByUser.error) throw membershipByUser.error;

      const bandIds = Array.from(new Set([
        ...((membershipByProfile.data || []) as any[]).map(row => row.band_id),
        ...((membershipByUser.data || []) as any[]).map(row => row.band_id),
      ].filter(Boolean)));

      const [byProfile, byLegacyUser, byBand] = await Promise.all([
        profileId
          ? supabase
              .from('recording_sessions')
              .select(recordingSessionSelect)
              .eq('profile_id', profileId)
              .order('created_at', { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [], error: null } as any),
        userId
          ? profileId
            ? supabase
                .from('recording_sessions')
                .select(recordingSessionSelect)
                .eq('user_id', userId)
                .is('profile_id', null)
                .order('created_at', { ascending: false })
                .limit(100)
            : supabase
                .from('recording_sessions')
                .select(recordingSessionSelect)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(100)
          : Promise.resolve({ data: [], error: null } as any),
        bandIds.length > 0
          ? supabase
              .from('recording_sessions')
              .select(recordingSessionSelect)
              .in('band_id', bandIds)
              .order('created_at', { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (byProfile.error) throw byProfile.error;
      if (byLegacyUser.error) throw byLegacyUser.error;
      if (byBand.error) throw byBand.error;

      const merged = new Map<string, any>();
      for (const row of (byProfile.data || []) as any[]) merged.set(row.id, row);
      for (const row of (byLegacyUser.data || []) as any[]) merged.set(row.id, row);
      for (const row of (byBand.data || []) as any[]) merged.set(row.id, row);

      return Array.from(merged.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).map(normalizeRecordingSession);
    },
    enabled: !!profileId || !!userId,
  });
};

interface CreateRecordingSessionInput {
  user_id: string;
  profile_id?: string | null;
  band_id?: string;
  studio_id: string;
  producer_id: string;
  song_id: string;
  duration_hours: number;
  orchestra_size?: 'chamber' | 'small' | 'full';
  recording_version?: 'standard' | 'remix' | 'acoustic';
  recording_type?: 'demo' | 'professional';
  rehearsal_bonus?: number;
  session_type?: string;
  parent_recording_id?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  payment_source?: 'band' | 'personal';
  /** Members (profile ids) the leader chose to book without. */
  skip_profile_ids?: string[];
}

export const calculateRecordingQuality = (
  baseSongQuality: number,
  studioQuality: number,
  producerBonus: number,
  durationHours: number,
  orchestraBonus?: number,
  rehearsalBonus?: number,
  skillBonusPercent?: number,
  genreBonusPercent?: number
): { finalQuality: number; breakdown: any } => {
  // Studio multiplier (quality_rating 0-100 gives 1.0-1.2x)
  const studioMultiplier = 1 + (studioQuality / 100) * 0.2;
  
  // Producer multiplier (quality_bonus 1-30 gives 1.01-1.30x)
  const producerMultiplier = 1 + (producerBonus / 100);
  
  // Duration multiplier
  const durationMultiplier = durationHours === 2 ? 0.95 : durationHours === 4 ? 1.05 : 1.0;
  
  // Orchestra multiplier (10-25% bonus)
  const orchestraMultiplier = orchestraBonus ? 1 + (orchestraBonus / 100) : 1;

  // Rehearsal multiplier (-20%, 0%, +10%)
  const rehearsalMultiplier = rehearsalBonus ? 1 + (rehearsalBonus / 100) : 1;

  // Player skill multiplier (0-30% bonus from mixing, DAW, production, theory skills)
  const skillMultiplier = skillBonusPercent ? 1 + (skillBonusPercent / 100) : 1;

  // Genre skill multiplier (0-20% bonus from training in this song's genre)
  const genreMultiplier = genreBonusPercent ? 1 + (genreBonusPercent / 100) : 1;
  
  const rawQuality = baseSongQuality * studioMultiplier * producerMultiplier * durationMultiplier * orchestraMultiplier * rehearsalMultiplier * skillMultiplier * genreMultiplier;
  
  // Soft cap: diminishing returns only near the very top of the scale.
  // Below 850: linear (recording bonuses apply in full).
  // Above 850: gentle curve so a great song with great conditions can hit 1000.
  // raw 900 → ~896, raw 1000 → ~942, raw 1150 → ~1000, raw 1300+ → 1000
  let finalQuality: number;
  if (rawQuality <= 850) {
    finalQuality = Math.round(rawQuality);
  } else {
    finalQuality = Math.round(850 + ((rawQuality - 850) * 1200) / (rawQuality - 850 + 1200));
  }
  // Recording must never make a song worse than it was written
  finalQuality = Math.max(0, Math.min(1000, Math.max(finalQuality, Math.round(baseSongQuality))));

  const breakdown = {
    base: baseSongQuality,
    studioBonus: Math.round((studioMultiplier - 1) * 100),
    producerBonus: Math.round((producerMultiplier - 1) * 100),
    durationBonus: Math.round((durationMultiplier - 1) * 100),
    orchestraBonus: orchestraBonus || 0,
    rehearsalBonus: rehearsalBonus || 0,
    skillBonus: Math.round((skillMultiplier - 1) * 100),
    genreBonus: Math.round((genreMultiplier - 1) * 100),
    totalMultiplier: studioMultiplier * producerMultiplier * durationMultiplier * orchestraMultiplier * rehearsalMultiplier * skillMultiplier * genreMultiplier,
  };

  return { finalQuality, breakdown };
};

/**
 * Historical direct-debit recording booking is intentionally disabled.
 * All paid sessions must use useRecordingDataAtomic and the finance RPC.
 */
export const useCreateRecordingSession = () => {
  return useMutation<never, Error, CreateRecordingSessionInput>({
    mutationFn: async () => {
      throw new Error("Legacy recording booking is disabled. Update this caller to use the atomic recording booking hook.");
    },
  });
};

// Historical direct client completion was removed. Recording outcomes, XP,
// credits and versions can only be completed by complete-recording-sessions
// (server-authoritative worker). Do not reintroduce a browser-side write path.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RecordingStage, RecordingStatus } from "@/lib/workflows/recording";
import { logGameActivity } from "./useGameActivityLog";
import { createScheduledActivity } from "./useActivityBooking";
import { 
  createBandScheduledActivities, 
  checkBandAvailability, 
  formatConflictMessage 
} from "@/utils/bandActivityScheduling";

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
  songs (title, genre)
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
          ? supabase
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
  
  // Soft cap: diminishing returns above 600
  // Below 600: linear. Above 600: gentler curve that allows masterpiece songs 
  // (800-950 base) to reach 900-1000 with perfect recording conditions.
  // raw 700 → ~680, raw 800 → ~750, raw 900 → ~830, raw 1000 → ~900, raw 1150 → ~1000
  let finalQuality: number;
  if (rawQuality <= 600) {
    finalQuality = Math.round(rawQuality);
  } else {
    // Gentler curve: k=600 instead of 400, allowing masterpieces to shine through
    finalQuality = Math.round(600 + ((rawQuality - 600) * 600) / (rawQuality - 600 + 600));
  }
  finalQuality = Math.max(0, Math.min(1000, finalQuality));

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

export const useCreateRecordingSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRecordingSessionInput) => {
      // Check for scheduling conflicts before starting
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Use scheduled times if provided, otherwise use now
      const now = input.scheduled_start ? new Date(input.scheduled_start) : new Date();
      const sessionEnd = input.scheduled_end ? new Date(input.scheduled_end) : new Date(now.getTime() + input.duration_hours * 60 * 60 * 1000);
      let actingProfileId = input.profile_id ?? null;

      // If band session, check availability for ALL band members first
      if (input.band_id) {
        const { available, conflicts } = await checkBandAvailability(
          input.band_id,
          now,
          sessionEnd
        );

        if (!available) {
          throw new Error(formatConflictMessage(conflicts));
        }
      } else {
        // Solo artist - just check the user's schedule
        const { data: hasConflict } = await (supabase as any).rpc('check_scheduling_conflict', {
          p_user_id: user.id,
          p_start: now.toISOString(),
          p_end: sessionEnd.toISOString(),
          p_exclude_id: null,
        });

        if (hasConflict) {
          throw new Error('You have another activity scheduled during this time. Please check your schedule.');
        }
      }
      
      // Fetch required data
      const [songResult, studioResult, producerResult] = await Promise.all([
        supabase.from('songs').select('quality_score').eq('id', input.song_id).single(),
        supabase.from('city_studios').select('quality_rating, hourly_rate').eq('id', input.studio_id).single(),
        input.producer_id === 'self-produce'
          ? Promise.resolve({ data: { quality_bonus: -10, cost_per_hour: 0 }, error: null } as any)
          : supabase.from('recording_producers').select('quality_bonus, cost_per_hour').eq('id', input.producer_id).single(),
      ]);

      if (songResult.error || !songResult.data) {
        throw new Error('Failed to fetch song data');
      }
      if (studioResult.error || !studioResult.data) {
        throw new Error('Failed to fetch studio data');
      }
      if (producerResult.error || !producerResult.data) {
        console.error('Producer fetch error:', producerResult.error);
        throw new Error('Failed to fetch producer data');
      }

      const song = songResult.data;
      const studio = studioResult.data;
      const producer = producerResult.data;

      const orchestraOption = input.orchestra_size 
        ? ORCHESTRA_OPTIONS.find(o => o.size === input.orchestra_size)
        : undefined;

      const { finalQuality, breakdown } = calculateRecordingQuality(
        song.quality_score,
        studio.quality_rating,
        producer.quality_bonus,
        input.duration_hours,
        orchestraOption?.bonus,
        input.rehearsal_bonus
      );

      const studioCost = studio.hourly_rate * input.duration_hours;
      const producerCost = producer.cost_per_hour * input.duration_hours;
      const orchestraCost = orchestraOption?.cost || 0;
      const totalCost = studioCost + producerCost + orchestraCost;

      const sessionScheduledEnd = sessionEnd;

      // If band_id is provided, check band balance and insert earnings (trigger handles balance)
      if (input.band_id) {
        const { data: band } = await supabase
          .from('bands')
          .select('band_balance')
          .eq('id', input.band_id)
          .single();

        const currentBalance = band?.band_balance || 0;
        if (currentBalance < totalCost) {
          throw new Error(`Insufficient band balance. Need $${totalCost.toLocaleString()}, have $${currentBalance.toLocaleString()}`);
        }

        // Insert negative earnings - trigger will update band_balance automatically
        await supabase
          .from('band_earnings')
          .insert({
            band_id: input.band_id,
            amount: -totalCost,
            source: 'recording',
            description: `Recording session at studio`,
            earned_by_user_id: input.user_id,
            metadata: {
              studio_cost: studioCost,
              producer_cost: producerCost,
              orchestra_cost: orchestraCost
            }
          });
      } else {
        // Solo artist - deduct from personal cash via profile_id
        const { data: profile } = actingProfileId
          ? await supabase
              .from('profiles')
              .select('id, cash')
              .eq('id', actingProfileId)
              .maybeSingle()
          : await supabase
              .from('profiles')
              .select('id, cash')
              .eq('user_id', input.user_id)
              .eq('is_active', true)
              .is('died_at', null)
              .maybeSingle();

        const currentCash = profile?.cash || 0;
        if (currentCash < totalCost) {
          throw new Error(`Insufficient cash. Need $${totalCost.toLocaleString()}, have $${currentCash.toLocaleString()}`);
        }

        // Deduct from personal cash
        await supabase
          .from('profiles')
          .update({ cash: currentCash - totalCost })
          .eq('id', profile?.id);

        actingProfileId = profile?.id ?? actingProfileId;
      }

      // Create recording session - use null for self-produce since producer_id is a uuid column
      // Get studio's city_id for location validation
      const { data: studioInfo } = await supabase
        .from('city_studios')
        .select('city_id')
        .eq('id', input.studio_id)
        .single();

      const { data: session, error: sessionError } = await supabase
        .from('recording_sessions')
        .insert({
          user_id: input.user_id,
          profile_id: actingProfileId,
          band_id: input.band_id || null,
          studio_id: input.studio_id,
          producer_id: input.producer_id === 'self-produce' ? null : input.producer_id,
          song_id: input.song_id,
          recording_version: input.recording_version || null,
          recording_type: input.recording_type || 'professional',
          duration_hours: input.duration_hours,
          total_cost: totalCost,
          quality_improvement: finalQuality - song.quality_score,
          status: input.scheduled_start ? 'scheduled' : 'in_progress',
          scheduled_start: now.toISOString(),
          scheduled_end: sessionScheduledEnd.toISOString(),
          city_id: studioInfo?.city_id || null,
        } as any)
        .select()
        .single() as any;

      if (sessionError) throw sessionError;
      
      const sessionData = session as any;

      // Create orchestra booking if needed
      if (orchestraOption) {
        await supabase.from('orchestra_bookings' as any).insert({
          recording_session_id: sessionData.id,
          orchestra_size: orchestraOption.size,
          orchestra_cost: orchestraOption.cost,
          quality_bonus: orchestraOption.bonus,
        });
      }

      // Schedule activity for all band members or just the user
      const { data: studioData } = await supabase
        .from('city_studios')
        .select('name')
        .eq('id', input.studio_id)
        .single();
      
      const studioName = studioData?.name || 'Recording Studio';

      // Fetch song title for notifications
      const { data: songInfo } = await supabase
        .from('songs')
        .select('title')
        .eq('id', input.song_id)
        .single();
      const songTitle = (songInfo as any)?.title || 'a song';

      if (input.band_id) {
        // Band session - schedule for ALL band members
        await createBandScheduledActivities({
          bandId: input.band_id,
          activityType: 'recording',
          scheduledStart: now,
          scheduledEnd: sessionEnd,
          title: 'Recording Session',
          description: `Recording at ${studioName}`,
          location: studioName,
          linkedRecordingId: sessionData.id,
          metadata: {
            sessionId: sessionData.id,
            studioId: input.studio_id,
            songId: input.song_id,
          },
        });

        // Notify all band members via inbox
        try {
          const { data: bandInfo } = await supabase
            .from('bands')
            .select('name')
            .eq('id', input.band_id)
            .single();
          const bandName = (bandInfo as any)?.name || 'Your band';

          const { data: members } = await supabase
            .from('band_members')
            .select('user_id')
            .eq('band_id', input.band_id)
            .eq('member_status', 'active');

          const startStr = now.toLocaleString();
          const inboxRows = (members || [])
            .map((m: any) => m.user_id)
            .filter((uid: string | null) => !!uid)
            .map((uid: string) => ({
              user_id: uid,
              category: 'system' as any,
              priority: 'normal' as any,
              title: `Recording session booked: ${songTitle}`,
              message: `${bandName} has a recording session for "${songTitle}" at ${studioName} starting ${startStr} (${input.duration_hours}h).`,
              action_type: 'view_recording_session',
              action_data: { session_id: sessionData.id } as any,
              metadata: { source: 'recording_booking', session_id: sessionData.id, band_id: input.band_id } as any,
            }));

          if (inboxRows.length > 0) {
            await supabase.from('player_inbox').insert(inboxRows as any);
          }
        } catch (notifyErr) {
          console.error('Failed to notify band members of recording booking:', notifyErr);
        }
      } else {
        // Solo artist - schedule just for the user
        await createScheduledActivity({
          userId: input.user_id,
          activityType: 'recording',
          scheduledStart: now,
          scheduledEnd: sessionEnd,
          title: 'Recording Session',
          description: `Recording at ${studioName}`,
          location: studioName,
          linkedRecordingId: sessionData.id,
          metadata: {
            sessionId: sessionData.id,
            studioId: input.studio_id,
            songId: input.song_id,
          },
        });

        // Notify solo artist
        try {
          const startStr = now.toLocaleString();
          await supabase.from('player_inbox').insert({
            user_id: input.user_id,
            category: 'system' as any,
            priority: 'normal' as any,
            title: `Recording session booked: ${songTitle}`,
            message: `Your recording session for "${songTitle}" at ${studioName} starts ${startStr} (${input.duration_hours}h).`,
            action_type: 'view_recording_session',
            action_data: { session_id: sessionData.id } as any,
            metadata: { source: 'recording_booking', session_id: sessionData.id } as any,
          } as any);
        } catch (notifyErr) {
          console.error('Failed to notify artist of recording booking:', notifyErr);
        }
      }

      return sessionData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recording-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['recorded-songs-list'] });
      toast.success('Recording session started!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to start recording: ${error.message}`);
    },
  });
};

export const useCompleteRecordingSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      // Get session data with full song details for version handling
      const { data: session, error: fetchError } = await supabase
        .from('recording_sessions')
        .select('song_id, quality_improvement, recording_version, band_id, user_id')
        .eq('id', sessionId)
        .single();

      if (fetchError) throw fetchError;
      if (!session) throw new Error('Session not found');

      // Get current song with all needed fields
      const { data: song, error: songFetchError } = await supabase
        .from('songs')
        .select('id, quality_score, title, genre, lyrics, user_id, band_id, duration_seconds, duration_display, songwriting_project_id')
        .eq('id', session.song_id)
        .single();

      if (songFetchError) throw songFetchError;
      if (!song) throw new Error('Song not found');

      const currentQuality = song.quality_score || 0;
      const qualityImprovement = session.quality_improvement || 0;
      const newQuality = currentQuality + qualityImprovement;
      const recordingVersion = session.recording_version || 'standard';

      // Update session status
      const { error: updateError } = await supabase
        .from('recording_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      let finalSongId = session.song_id;

      // Handle acoustic/remix versions - create new song entry
      if (recordingVersion !== 'standard') {
        // Check if this version already exists
        const { data: existingVersion } = await supabase
          .from('songs')
          .select('id')
          .eq('parent_song_id', session.song_id)
          .eq('version', recordingVersion)
          .single();
        
        if (existingVersion) {
          // Update existing version
          finalSongId = existingVersion.id;
          const { error: versionError } = await supabase
            .from('songs')
            .update({ 
              quality_score: newQuality,
              status: 'recorded'
            })
            .eq('id', existingVersion.id);
          
          if (versionError) throw versionError;
        } else {
          // Create new version song
          const versionLabel = recordingVersion === 'acoustic' ? 'Acoustic' : 'Remix';
          const newTitle = `${song.title} (${versionLabel})`;
          
          const { data: newSong, error: createError } = await supabase
            .from('songs')
            .insert({
              user_id: song.user_id,
              band_id: session.band_id || song.band_id,
              title: newTitle,
              genre: song.genre,
              lyrics: song.lyrics,
              quality_score: newQuality,
              status: 'recorded',
              parent_song_id: session.song_id,
              version: recordingVersion,
              duration_seconds: song.duration_seconds,
              duration_display: song.duration_display,
              songwriting_project_id: song.songwriting_project_id,
            })
            .select('id')
            .single();
          
          if (createError) throw createError;
          if (newSong) {
            finalSongId = newSong.id;
            
            // Update session to point to new song
            await supabase
              .from('recording_sessions')
              .update({ song_id: newSong.id })
              .eq('id', sessionId);
          }
        }
      } else {
        // Standard recording - update existing song
        const { error: songError } = await supabase
          .from('songs')
          .update({ 
            quality_score: newQuality,
            status: 'recorded'
          })
          .eq('id', session.song_id);

        if (songError) throw songError;
      }

      // Log the activity and award XP
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) {
        await logGameActivity({
          userId: userData.user.id,
          activityType: 'recording_complete',
          activityCategory: 'recording',
          description: `Completed recording session, song quality improved from ${currentQuality} to ${newQuality}`,
          metadata: { sessionId, songId: session.song_id, qualityBefore: currentQuality, qualityAfter: newQuality },
          beforeState: { quality_score: currentQuality },
          afterState: { quality_score: newQuality },
        });
        
        // Award XP based on quality improvement (50-200 XP range)
        const xpAmount = Math.min(200, Math.max(50, Math.round(qualityImprovement * 3)));
        
        // Get profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', userData.user.id)
          .single();
        
        if (profile) {
          // Add to experience ledger
          await supabase
            .from('experience_ledger')
            .insert({
              user_id: userData.user.id,
              profile_id: profile.id,
              activity_type: 'recording_complete',
              xp_amount: xpAmount,
              metadata: {
                session_id: sessionId,
                song_id: session.song_id,
                quality_before: currentQuality,
                quality_after: newQuality,
                quality_improvement: qualityImprovement
              }
            });
          
          // Update XP wallet
          const { data: wallet } = await supabase
            .from('player_xp_wallet')
            .select('xp_balance, lifetime_xp')
            .eq('profile_id', profile.id)
            .single();
          
          if (wallet) {
            await supabase
              .from('player_xp_wallet')
              .update({
                xp_balance: (wallet.xp_balance || 0) + xpAmount,
                lifetime_xp: (wallet.lifetime_xp || 0) + xpAmount
              })
              .eq('profile_id', profile.id);
          } else {
            await supabase
              .from('player_xp_wallet')
              .insert({
                profile_id: profile.id,
                xp_balance: xpAmount,
                lifetime_xp: xpAmount,
                xp_spent: 0
              });
          }
          
          console.log(`Awarded ${xpAmount} XP for recording completion`);
        }
      }

      return { ...session, qualityBefore: currentQuality, qualityAfter: newQuality };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recording-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      toast.success('Recording completed successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to complete recording: ${error.message}`);
    },
  });
};

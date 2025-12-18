// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RecordingStage, RecordingStatus } from "@/lib/workflows/recording";
import { logGameActivity } from "./useGameActivityLog";

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
  band_id: string | null;
  studio_id: string;
  producer_id: string;
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
        .select('*')
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
      
      if (error) {
        console.error('Error fetching producers:', error);
        throw error;
      }
      return (data || []) as RecordingProducer[];
    },
  });
};

export const useRecordingSessions = (userId: string) => {
  return useQuery({
    queryKey: ['recording-sessions', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recording_sessions')
        .select(`
          *,
          city_studios (name, quality_rating),
          recording_producers (name, tier),
          songs (title, genre)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching recording sessions:', error);
        throw error;
      }
      return (data || []) as RecordingSession[];
    },
  });
};

interface CreateRecordingSessionInput {
  user_id: string;
  band_id?: string;
  studio_id: string;
  producer_id: string;
  song_id: string;
  duration_hours: number;
  orchestra_size?: 'chamber' | 'small' | 'full';
  recording_version?: 'standard' | 'remix' | 'acoustic';
  rehearsal_bonus?: number;
  session_type?: string;
  parent_recording_id?: string;
}

export const calculateRecordingQuality = (
  baseSongQuality: number,
  studioQuality: number,
  producerBonus: number,
  durationHours: number,
  orchestraBonus?: number,
  rehearsalBonus?: number
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
  
  const finalQuality = Math.round(
    baseSongQuality * studioMultiplier * producerMultiplier * durationMultiplier * orchestraMultiplier * rehearsalMultiplier
  );

  const breakdown = {
    base: baseSongQuality,
    studioBonus: Math.round((studioMultiplier - 1) * 100),
    producerBonus: Math.round((producerMultiplier - 1) * 100),
    durationBonus: Math.round((durationMultiplier - 1) * 100),
    orchestraBonus: orchestraBonus || 0,
    rehearsalBonus: rehearsalBonus || 0,
    totalMultiplier: studioMultiplier * producerMultiplier * durationMultiplier * orchestraMultiplier * rehearsalMultiplier,
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

      const now = new Date();
      const sessionEnd = new Date(now.getTime() + input.duration_hours * 60 * 60 * 1000);

      const { data: hasConflict } = await (supabase as any).rpc('check_scheduling_conflict', {
        p_user_id: user.id,
        p_start: now.toISOString(),
        p_end: sessionEnd.toISOString(),
        p_exclude_id: null,
      });

      if (hasConflict) {
        throw new Error('You have another activity scheduled during this time. Please check your schedule.');
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

      const scheduledEnd = new Date();
      scheduledEnd.setHours(scheduledEnd.getHours() + input.duration_hours);

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
        // Solo artist - deduct from personal cash
        const { data: profile } = await supabase
          .from('profiles')
          .select('cash')
          .eq('user_id', input.user_id)
          .single();

        const currentCash = profile?.cash || 0;
        if (currentCash < totalCost) {
          throw new Error(`Insufficient cash. Need $${totalCost.toLocaleString()}, have $${currentCash.toLocaleString()}`);
        }

        // Deduct from personal cash
        await supabase
          .from('profiles')
          .update({ cash: currentCash - totalCost })
          .eq('user_id', input.user_id);
      }

      // Create recording session
      const { data: session, error: sessionError } = await supabase
        .from('recording_sessions')
        .insert({
          user_id: input.user_id,
          band_id: input.band_id || null,
          studio_id: input.studio_id,
          producer_id: input.producer_id,
          song_id: input.song_id,
          recording_version: input.recording_version || null,
          duration_hours: input.duration_hours,
          total_cost: totalCost,
          quality_improvement: finalQuality - song.quality_score,
          status: 'in_progress',
          scheduled_end: scheduledEnd.toISOString(),
        })
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

      return sessionData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recording-sessions'] });
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
      // Get session data
      const { data: session, error: fetchError } = await supabase
        .from('recording_sessions')
        .select('song_id, quality_improvement')
        .eq('id', sessionId)
        .single();

      if (fetchError) throw fetchError;
      if (!session) throw new Error('Session not found');

      // Get current song quality
      const { data: song, error: songFetchError } = await supabase
        .from('songs')
        .select('quality_score')
        .eq('id', session.song_id)
        .single();

      if (songFetchError) throw songFetchError;

      const currentQuality = song?.quality_score || 0;
      const qualityImprovement = session.quality_improvement || 0;
      const newQuality = currentQuality + qualityImprovement;

      // Update session status
      const { error: updateError } = await supabase
        .from('recording_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      // Update song quality and status to 'recorded'
      const { error: songError } = await supabase
        .from('songs')
        .update({ 
          quality_score: newQuality,
          status: 'recorded'
        })
        .eq('id', session.song_id);

      if (songError) throw songError;

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

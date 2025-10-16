import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  session_type: string;
  is_parent_version: boolean;
  parent_recording_id: string | null;
  duration_hours: number;
  studio_cost: number;
  producer_cost: number;
  orchestra_cost: number;
  total_cost: number;
  quality_before: number;
  quality_after: number;
  quality_improvement: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_start: string;
  scheduled_end: string;
  completed_at: string | null;
  session_data: any;
  created_at: string;
  updated_at: string;
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
        .from('recording_producers' as any)
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
      
      if (error) throw error;
      return data as any as RecordingProducer[];
    },
  });
};

export const useRecordingSessions = (userId: string) => {
  return useQuery({
    queryKey: ['recording-sessions', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recording_sessions' as any)
        .select(`
          *,
          city_studios (name, quality_rating),
          recording_producers (name, tier),
          songs (title, genre)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
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
  session_type?: string;
  parent_recording_id?: string;
}

export const calculateRecordingQuality = (
  baseSongQuality: number,
  studioQuality: number,
  producerBonus: number,
  durationHours: number,
  orchestraBonus?: number
): { finalQuality: number; breakdown: any } => {
  // Studio multiplier (quality_rating 0-100 gives 1.0-1.2x)
  const studioMultiplier = 1 + (studioQuality / 100) * 0.2;
  
  // Producer multiplier (quality_bonus 1-30 gives 1.01-1.30x)
  const producerMultiplier = 1 + (producerBonus / 100);
  
  // Duration multiplier
  const durationMultiplier = durationHours === 2 ? 0.95 : durationHours === 4 ? 1.05 : 1.0;
  
  // Orchestra multiplier (10-25% bonus)
  const orchestraMultiplier = orchestraBonus ? 1 + (orchestraBonus / 100) : 1;
  
  const finalQuality = Math.round(
    baseSongQuality * studioMultiplier * producerMultiplier * durationMultiplier * orchestraMultiplier
  );

  const breakdown = {
    base: baseSongQuality,
    studioBonus: Math.round((studioMultiplier - 1) * 100),
    producerBonus: Math.round((producerMultiplier - 1) * 100),
    durationBonus: Math.round((durationMultiplier - 1) * 100),
    orchestraBonus: orchestraBonus || 0,
    totalMultiplier: studioMultiplier * producerMultiplier * durationMultiplier * orchestraMultiplier,
  };

  return { finalQuality, breakdown };
};

export const useCreateRecordingSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRecordingSessionInput) => {
      // Fetch required data
      const [{ data: song }, { data: studio }, { data: producer }] = await Promise.all([
        supabase.from('songs').select('quality_score').eq('id', input.song_id).single(),
        supabase.from('city_studios').select('quality_rating, hourly_rate').eq('id', input.studio_id).single(),
        supabase.from('recording_producers' as any).select('quality_bonus, cost_per_hour').eq('id', input.producer_id).single(),
      ]) as any;

      if (!song || !studio || !producer) {
        throw new Error('Failed to fetch session data');
      }

      const orchestraOption = input.orchestra_size 
        ? ORCHESTRA_OPTIONS.find(o => o.size === input.orchestra_size)
        : undefined;

      const { finalQuality, breakdown } = calculateRecordingQuality(
        song.quality_score,
        studio.quality_rating,
        producer.quality_bonus,
        input.duration_hours,
        orchestraOption?.bonus
      );

      const studioCost = studio.hourly_rate * input.duration_hours;
      const producerCost = producer.cost_per_hour * input.duration_hours;
      const orchestraCost = orchestraOption?.cost || 0;
      const totalCost = studioCost + producerCost + orchestraCost;

      const scheduledEnd = new Date();
      scheduledEnd.setHours(scheduledEnd.getHours() + input.duration_hours);

      // If band_id is provided, check band balance and deduct
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

        // Deduct from band balance
        await supabase
          .from('bands')
          .update({ band_balance: currentBalance - totalCost })
          .eq('id', input.band_id);

        // Record expense in band_earnings
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
        .from('recording_sessions' as any)
        .insert({
          user_id: input.user_id,
          band_id: input.band_id || null,
          studio_id: input.studio_id,
          producer_id: input.producer_id,
          song_id: input.song_id,
          session_type: input.session_type || 'full_recording',
          is_parent_version: !input.parent_recording_id,
          parent_recording_id: input.parent_recording_id || null,
          duration_hours: input.duration_hours,
          studio_cost: studioCost,
          producer_cost: producerCost,
          orchestra_cost: orchestraCost,
          total_cost: totalCost,
          quality_before: song.quality_score,
          quality_after: finalQuality,
          quality_improvement: finalQuality - song.quality_score,
          status: 'in_progress',
          scheduled_end: scheduledEnd.toISOString(),
          session_data: breakdown,
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
        .from('recording_sessions' as any)
        .select('song_id, quality_after')
        .eq('id', sessionId)
        .single() as any;

      if (fetchError) throw fetchError;

      // Update session status
      const { error: updateError } = await supabase
        .from('recording_sessions' as any)
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      // Update song quality
      const { error: songError } = await supabase
        .from('songs')
        .update({ quality_score: session.quality_after })
        .eq('id', session.song_id);

      if (songError) throw songError;

      return session;
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

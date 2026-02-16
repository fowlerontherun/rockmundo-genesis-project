import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/hooks/use-toast";

export interface MajorEvent {
  id: string;
  name: string;
  description: string | null;
  category: string;
  month: number;
  audience_size: number;
  min_fame_required: number;
  base_cash_reward: number;
  max_cash_reward: number;
  fame_multiplier: number;
  fan_multiplier: number;
  image_url: string | null;
  is_active: boolean;
}

export interface MajorEventInstance {
  id: string;
  event_id: string;
  year: number;
  event_date: string | null;
  status: string;
  invited_band_ids: string[];
  event?: MajorEvent;
}

export interface MajorEventPerformance {
  id: string;
  instance_id: string;
  user_id: string;
  band_id: string | null;
  song_1_id: string | null;
  song_2_id: string | null;
  song_3_id: string | null;
  status: string;
  current_song_position: number;
  overall_rating: number | null;
  cash_earned: number;
  fame_gained: number;
  fans_gained: number;
  started_at: string | null;
  completed_at: string | null;
  instance?: MajorEventInstance & { event?: MajorEvent };
  song_1?: { id: string; title: string; duration_seconds: number; quality_score: number; genre: string };
  song_2?: { id: string; title: string; duration_seconds: number; quality_score: number; genre: string };
  song_3?: { id: string; title: string; duration_seconds: number; quality_score: number; genre: string };
}

export interface MajorEventSongPerformance {
  id: string;
  performance_id: string;
  song_id: string;
  position: number;
  performance_score: number | null;
  crowd_response: string | null;
  commentary: string[] | null;
}

export function useMajorEvents() {
  return useQuery({
    queryKey: ['major-events'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('major_event_instances')
        .select(`
          *,
          event:major_events(*)
        `)
        .eq('status', 'upcoming')
        .order('event_date');

      if (error) throw error;
      return data as MajorEventInstance[];
    },
  });
}

export function useMajorEventHistory() {
  return useQuery({
    queryKey: ['major-event-history'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('major_event_instances')
        .select(`
          *,
          event:major_events(*)
        `)
        .in('status', ['completed', 'past'])
        .order('event_date', { ascending: false });

      if (error) throw error;
      return data as MajorEventInstance[];
    },
  });
}

export function useMajorEventPerformances(userId?: string) {
  return useQuery({
    queryKey: ['major-event-performances', userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('major_event_performances')
        .select(`
          *,
          instance:major_event_instances(*, event:major_events(*)),
          song_1:songs!major_event_performances_song_1_id_fkey(id, title, duration_seconds, quality_score, genre),
          song_2:songs!major_event_performances_song_2_id_fkey(id, title, duration_seconds, quality_score, genre),
          song_3:songs!major_event_performances_song_3_id_fkey(id, title, duration_seconds, quality_score, genre)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MajorEventPerformance[];
    },
    enabled: !!userId,
  });
}

export function useMajorEventPerformance(performanceId: string | null) {
  return useQuery({
    queryKey: ['major-event-performance', performanceId],
    queryFn: async () => {
      if (!performanceId) return null;

      const { data, error } = await (supabase as any)
        .from('major_event_performances')
        .select(`
          *,
          instance:major_event_instances(*, event:major_events(*)),
          song_1:songs!major_event_performances_song_1_id_fkey(id, title, duration_seconds, quality_score, genre),
          song_2:songs!major_event_performances_song_2_id_fkey(id, title, duration_seconds, quality_score, genre),
          song_3:songs!major_event_performances_song_3_id_fkey(id, title, duration_seconds, quality_score, genre)
        `)
        .eq('id', performanceId)
        .single();

      if (error) throw error;
      return data as MajorEventPerformance;
    },
    enabled: !!performanceId,
  });
}

export function useMajorEventSongPerformances(performanceId: string | null) {
  return useQuery({
    queryKey: ['major-event-song-performances', performanceId],
    queryFn: async () => {
      if (!performanceId) return [];

      const { data, error } = await (supabase as any)
        .from('major_event_song_performances')
        .select('*')
        .eq('performance_id', performanceId)
        .order('position');

      if (error) throw error;
      return data as MajorEventSongPerformance[];
    },
    enabled: !!performanceId,
  });
}

export function useAcceptMajorEvent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      instanceId,
      bandId,
      song1Id,
      song2Id,
      song3Id,
    }: {
      instanceId: string;
      bandId: string;
      song1Id: string;
      song2Id: string;
      song3Id: string;
    }) => {
      if (!user) throw new Error('Must be logged in');

      const { data, error } = await (supabase as any)
        .from('major_event_performances')
        .insert({
          instance_id: instanceId,
          user_id: user.id,
          band_id: bandId,
          song_1_id: song1Id,
          song_2_id: song2Id,
          song_3_id: song3Id,
          status: 'accepted',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Invitation Accepted!",
        description: "You've accepted the major event invitation. Get ready to perform!",
      });
      queryClient.invalidateQueries({ queryKey: ['major-event-performances'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to accept",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useStartMajorEventPerformance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (performanceId: string) => {
      const { data, error } = await (supabase as any)
        .from('major_event_performances')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
          current_song_position: 1,
        })
        .eq('id', performanceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['major-event-performances'] });
      queryClient.invalidateQueries({ queryKey: ['major-event-performance'] });
    },
  });
}

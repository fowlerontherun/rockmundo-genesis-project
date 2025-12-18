import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/hooks/use-toast";
import { checkTimeSlotAvailable, createScheduledActivity } from "@/hooks/useActivityBooking";

export interface OpenMicVenue {
  id: string;
  city_id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  capacity: number;
  description: string | null;
  image_url: string | null;
  city?: {
    id: string;
    name: string;
    country: string;
  };
}

export interface OpenMicPerformance {
  id: string;
  user_id: string;
  band_id: string | null;
  venue_id: string;
  scheduled_date: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  song_1_id: string | null;
  song_2_id: string | null;
  current_song_position: number;
  overall_rating: number | null;
  fame_gained: number;
  fans_gained: number;
  started_at: string | null;
  completed_at: string | null;
  venue?: OpenMicVenue;
  song_1?: { id: string; title: string; duration_seconds: number };
  song_2?: { id: string; title: string; duration_seconds: number };
}

export interface OpenMicSongPerformance {
  id: string;
  performance_id: string;
  song_id: string;
  position: number;
  performance_score: number | null;
  crowd_response: string | null;
  commentary: string[] | null;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getDayName(dayOfWeek: number): string {
  return DAYS_OF_WEEK[dayOfWeek] || 'Unknown';
}

export function getNextOpenMicDate(dayOfWeek: number): Date {
  const today = new Date();
  const currentDay = today.getDay();
  let daysUntil = dayOfWeek - currentDay;
  
  if (daysUntil < 0) {
    daysUntil += 7;
  } else if (daysUntil === 0) {
    // If it's today, check if it's past 8pm
    const now = new Date();
    if (now.getHours() >= 20) {
      daysUntil = 7; // Next week
    }
  }
  
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);
  nextDate.setHours(20, 0, 0, 0);
  return nextDate;
}

export function useOpenMicVenues(cityId?: string) {
  return useQuery({
    queryKey: ['open-mic-venues', cityId],
    queryFn: async () => {
      let query = supabase
        .from('open_mic_venues')
        .select(`
          *,
          city:cities(id, name, country)
        `)
        .order('day_of_week');
      
      if (cityId) {
        query = query.eq('city_id', cityId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as OpenMicVenue[];
    },
  });
}

export function useOpenMicPerformances(userId?: string) {
  return useQuery({
    queryKey: ['open-mic-performances', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('open_mic_performances')
        .select(`
          *,
          venue:open_mic_venues(*, city:cities(id, name, country)),
          song_1:songs!open_mic_performances_song_1_id_fkey(id, title, duration_seconds),
          song_2:songs!open_mic_performances_song_2_id_fkey(id, title, duration_seconds)
        `)
        .eq('user_id', userId)
        .order('scheduled_date', { ascending: false });
      
      if (error) throw error;
      return data as OpenMicPerformance[];
    },
    enabled: !!userId,
  });
}

export function useOpenMicPerformance(performanceId: string | null) {
  return useQuery({
    queryKey: ['open-mic-performance', performanceId],
    queryFn: async () => {
      if (!performanceId) return null;
      
      const { data, error } = await supabase
        .from('open_mic_performances')
        .select(`
          *,
          venue:open_mic_venues(*, city:cities(id, name, country)),
          song_1:songs!open_mic_performances_song_1_id_fkey(id, title, duration_seconds, quality_score, genre),
          song_2:songs!open_mic_performances_song_2_id_fkey(id, title, duration_seconds, quality_score, genre)
        `)
        .eq('id', performanceId)
        .single();
      
      if (error) throw error;
      return data as OpenMicPerformance;
    },
    enabled: !!performanceId,
  });
}

export function useOpenMicSongPerformances(performanceId: string | null) {
  return useQuery({
    queryKey: ['open-mic-song-performances', performanceId],
    queryFn: async () => {
      if (!performanceId) return [];
      
      const { data, error } = await supabase
        .from('open_mic_song_performances')
        .select('*')
        .eq('performance_id', performanceId)
        .order('position');
      
      if (error) throw error;
      return data as OpenMicSongPerformance[];
    },
    enabled: !!performanceId,
  });
}

export function useSignUpForOpenMic() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      venueId,
      bandId,
      song1Id,
      song2Id,
      scheduledDate,
      venueName,
    }: {
      venueId: string;
      bandId: string;
      song1Id: string;
      song2Id: string;
      scheduledDate: Date;
      venueName: string;
    }) => {
      if (!user) throw new Error('Must be logged in');

      // Check if time slot is available (open mic is ~30 min for 2 songs)
      const endDate = new Date(scheduledDate.getTime() + 30 * 60 * 1000);
      const { available, conflictingActivity } = await checkTimeSlotAvailable(
        user.id,
        scheduledDate,
        endDate
      );

      if (!available) {
        throw new Error(`Time slot conflicts with: ${conflictingActivity?.title || 'another activity'}`);
      }

      // Create the open mic performance record
      const { data, error } = await supabase
        .from('open_mic_performances')
        .insert({
          user_id: user.id,
          band_id: bandId,
          venue_id: venueId,
          song_1_id: song1Id,
          song_2_id: song2Id,
          scheduled_date: scheduledDate.toISOString(),
          status: 'scheduled',
        })
        .select()
        .single();

      if (error) throw error;

      // Create scheduled activity to block the time slot
      await createScheduledActivity({
        userId: user.id,
        bandId,
        activityType: 'open_mic',
        scheduledStart: scheduledDate,
        scheduledEnd: endDate,
        title: `Open Mic at ${venueName}`,
        description: 'Open mic night performance - 2 songs',
        linkedOpenMicId: data.id,
      });

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Signed up!",
        description: "You're registered for open mic night. It's been added to your schedule.",
      });
      queryClient.invalidateQueries({ queryKey: ['open-mic-performances'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });
    },
    onError: (error) => {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useStartOpenMicPerformance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (performanceId: string) => {
      const { data, error } = await supabase
        .from('open_mic_performances')
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
      queryClient.invalidateQueries({ queryKey: ['open-mic-performances'] });
      queryClient.invalidateQueries({ queryKey: ['open-mic-performance'] });
    },
  });
}

export function useCancelOpenMicPerformance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (performanceId: string) => {
      const { error } = await supabase
        .from('open_mic_performances')
        .update({ status: 'cancelled' })
        .eq('id', performanceId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Cancelled",
        description: "Your open mic spot has been cancelled.",
      });
      queryClient.invalidateQueries({ queryKey: ['open-mic-performances'] });
    },
  });
}

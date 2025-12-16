import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { startOfDay, endOfDay, addDays } from "date-fns";

export type ActivityType = 
  | 'songwriting' | 'gig' | 'rehearsal' | 'busking' | 'recording' 
  | 'travel' | 'work' | 'university' | 'reading' | 'mentorship' 
  | 'youtube_video' | 'health' | 'skill_practice' | 'other';

export type ActivityStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'missed';

export interface ScheduledActivity {
  id: string;
  user_id: string;
  profile_id: string;
  activity_type: ActivityType;
  scheduled_start: string;
  scheduled_end: string;
  duration_minutes?: number;
  status: ActivityStatus;
  started_at?: string | null;
  completed_at?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  linked_gig_id?: string | null;
  linked_rehearsal_id?: string | null;
  linked_recording_id?: string | null;
  linked_job_shift_id?: string | null;
  metadata?: Record<string, any>;
  reminder_minutes_before?: number;
  reminder_sent?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateActivityData {
  activity_type: ActivityType;
  scheduled_start: Date;
  scheduled_end: Date;
  title: string;
  description?: string;
  location?: string;
  metadata?: Record<string, any>;
  reminder_minutes_before?: number;
}

export function useScheduledActivities(date: Date, userId?: string) {
  return useQuery({
    queryKey: ['scheduled-activities', date.toISOString().split('T')[0], userId],
    queryFn: async () => {
      if (!userId) return [];

      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      // Fetch scheduled activities
      const { data: scheduledData } = await (supabase as any)
        .from('player_scheduled_activities')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_start', dayStart.toISOString())
        .lte('scheduled_start', dayEnd.toISOString())
        .in('status', ['scheduled', 'in_progress', 'completed']);

      // Fetch gigs
      const { data: gigs } = await supabase
        .from('gigs')
        .select('*, venues:venue_id(name, cities(name)), bands:band_id(name)')
        .or(`user_id.eq.${userId},band_id.in.(select band_id from band_members where user_id='${userId}')`)
        .gte('performance_date', dayStart.toISOString())
        .lte('performance_date', dayEnd.toISOString())
        .in('status', ['scheduled', 'in_progress', 'completed']);

      // Fetch rehearsals
      const { data: rehearsals } = await supabase
        .from('band_rehearsals')
        .select('*, rehearsal_rooms(name, location), bands:band_id(name)')
        .gte('scheduled_start', dayStart.toISOString())
        .lte('scheduled_start', dayEnd.toISOString())
        .in('status', ['scheduled', 'in_progress', 'completed']);

      // Fetch recordings
      const { data: recordings } = await supabase
        .from('recording_sessions')
        .select('*, city_studios(name), songs:song_id(title)')
        .eq('user_id', userId)
        .gte('scheduled_start', dayStart.toISOString())
        .lte('scheduled_start', dayEnd.toISOString())
        .in('status', ['scheduled', 'in_progress', 'completed']);

      // Convert to unified format
      const activities: ScheduledActivity[] = [
        ...(scheduledData || []),
        ...(gigs || []).map((g: any) => ({ id: g.id, user_id: userId, profile_id: userId, activity_type: 'gig' as const, scheduled_start: g.performance_date, scheduled_end: g.performance_date, status: g.status, title: `Gig: ${g.venues?.name}`, linked_gig_id: g.id })),
        ...(rehearsals || []).map((r: any) => ({ id: r.id, user_id: userId, profile_id: userId, activity_type: 'rehearsal' as const, scheduled_start: r.scheduled_start, scheduled_end: r.scheduled_end, status: r.status, title: `Rehearsal: ${r.bands?.name}`, linked_rehearsal_id: r.id })),
        ...(recordings || []).map((s: any) => ({ id: s.id, user_id: userId, profile_id: userId, activity_type: 'recording' as const, scheduled_start: s.scheduled_start, scheduled_end: s.scheduled_end, status: s.status, title: `Recording: ${s.songs?.title}`, linked_recording_id: s.id })),
      ];

      return activities.sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());
    },
    enabled: !!userId,
    staleTime: 60000,
  });
}

export function useWeekScheduledActivities(startDate: Date, userId?: string) {
  return useQuery({
    queryKey: ['week-scheduled-activities', startDate.toISOString().split('T')[0], userId],
    queryFn: async () => {
      if (!userId) return [];

      const weekStart = startOfDay(startDate);
      const weekEnd = endOfDay(addDays(startDate, 6));

      const { data, error } = await (supabase as any)
        .from('player_scheduled_activities')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_start', weekStart.toISOString())
        .lte('scheduled_start', weekEnd.toISOString())
        .in('status', ['scheduled', 'in_progress', 'completed'])
        .order('scheduled_start', { ascending: true });

      if (error) throw error;
      return (data || []) as ScheduledActivity[];
    },
    enabled: !!userId,
    staleTime: 1000 * 60,
  });
}

export function useCreateScheduledActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateActivityData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Check for conflicts
      const { data: hasConflict } = await (supabase as any).rpc('check_scheduling_conflict', {
        p_user_id: user.id,
        p_start: data.scheduled_start.toISOString(),
        p_end: data.scheduled_end.toISOString(),
      });

      if (hasConflict) {
        throw new Error('Time slot already occupied. Please choose a different time.');
      }

      const { data: activity, error } = await (supabase as any)
        .from('player_scheduled_activities')
        .insert({
          user_id: user.id,
          profile_id: profile.id,
          activity_type: data.activity_type,
          scheduled_start: data.scheduled_start.toISOString(),
          scheduled_end: data.scheduled_end.toISOString(),
          title: data.title,
          description: data.description,
          location: data.location,
          metadata: data.metadata || {},
          reminder_minutes_before: data.reminder_minutes_before || 15,
        })
        .select()
        .single();

      if (error) throw error;
      return activity as ScheduledActivity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });
      queryClient.invalidateQueries({ queryKey: ['week-scheduled-activities'] });
      toast({
        title: "Activity Scheduled",
        description: "Your activity has been added to your schedule.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Scheduling Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useStartActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activityId: string) => {
      const { data, error } = await (supabase as any)
        .from('player_scheduled_activities')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', activityId)
        .select()
        .single();

      if (error) throw error;
      return data as ScheduledActivity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });
      queryClient.invalidateQueries({ queryKey: ['activity-status'] });
      toast({
        title: "Activity Started",
        description: "Your activity is now in progress.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Start",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCompleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activityId: string) => {
      const { data, error } = await (supabase as any)
        .from('player_scheduled_activities')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', activityId)
        .select()
        .single();

      if (error) throw error;
      return data as ScheduledActivity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });
      queryClient.invalidateQueries({ queryKey: ['activity-status'] });
      toast({
        title: "Activity Completed",
        description: "Great job! Your activity is marked as complete.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Complete",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteScheduledActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await (supabase as any)
        .from('player_scheduled_activities')
        .delete()
        .eq('id', activityId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });
      queryClient.invalidateQueries({ queryKey: ['week-scheduled-activities'] });
      toast({
        title: "Activity Deleted",
        description: "The activity has been removed from your schedule.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

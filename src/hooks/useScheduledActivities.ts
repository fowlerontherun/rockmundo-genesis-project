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
      const allActivities: ScheduledActivity[] = [];

      // Fetch profile first
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!profile) return [];

      // 1. Fetch regular scheduled activities from player_scheduled_activities table
      const { data: scheduledData } = await (supabase as any)
        .from('player_scheduled_activities')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_start', dayStart.toISOString())
        .lte('scheduled_start', dayEnd.toISOString())
        .in('status', ['scheduled', 'in_progress', 'completed'])
        .order('scheduled_start', { ascending: true });

      if (scheduledData) {
        allActivities.push(...scheduledData);
      }

      // 2. Fetch gigs (both solo and band)
      const { data: bandMemberships } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('user_id', userId);

      const bandIds = bandMemberships?.map(m => m.band_id) || [];

      // Solo gigs
      const { data: soloGigs } = await supabase
        .from('gigs')
        .select(`
          *,
          venue:venues(name)
        `)
        .eq('user_id', userId)
        .gte('scheduled_date', dayStart.toISOString())
        .lte('scheduled_date', dayEnd.toISOString())
        .in('status', ['scheduled', 'in_progress', 'completed']);

      // Band gigs
      let bandGigs: any[] = [];
      if (bandIds.length > 0) {
        const { data } = await supabase
          .from('gigs')
          .select(`
            *,
            venue:venues(name)
          `)
          .in('band_id', bandIds)
          .gte('scheduled_date', dayStart.toISOString())
          .lte('scheduled_date', dayEnd.toISOString())
          .in('status', ['scheduled', 'in_progress', 'completed']);
        bandGigs = data || [];
      }

      // Convert gigs to scheduled activities (don't duplicate if already in player_scheduled_activities)
      const existingGigIds = allActivities
        .filter(a => a.linked_gig_id)
        .map(a => a.linked_gig_id);

      [...(soloGigs || []), ...bandGigs].forEach(gig => {
        if (!existingGigIds.includes(gig.id)) {
          const gigEnd = new Date(gig.scheduled_date);
          gigEnd.setHours(gigEnd.getHours() + 3);
          
          allActivities.push({
            id: `gig-${gig.id}`,
            user_id: userId,
            profile_id: profile.id,
            activity_type: 'gig' as ActivityType,
            scheduled_start: gig.scheduled_date,
            scheduled_end: gigEnd.toISOString(),
            status: gig.status as ActivityStatus,
            title: `Gig at ${(gig.venue as any)?.name || 'Venue'}`,
            location: (gig.venue as any)?.name,
            linked_gig_id: gig.id,
            metadata: { type: 'gig', gigId: gig.id },
            created_at: gig.created_at,
          });
        }
      });

      // 3. Fetch rehearsals
      if (bandIds.length > 0) {
        const { data: rehearsalsData } = await supabase
          .from('band_rehearsals')
          .select(`
            *,
            band:bands(name),
            room:rehearsal_rooms(name)
          `)
          .in('band_id', bandIds)
          .gte('scheduled_start', dayStart.toISOString())
          .lte('scheduled_start', dayEnd.toISOString())
          .in('status', ['scheduled', 'in_progress', 'completed']);

        const existingRehearsalIds = allActivities
          .filter(a => a.linked_rehearsal_id)
          .map(a => a.linked_rehearsal_id);

        rehearsalsData?.forEach(rehearsal => {
          if (!existingRehearsalIds.includes(rehearsal.id)) {
            allActivities.push({
              id: `rehearsal-${rehearsal.id}`,
              user_id: userId,
              profile_id: profile.id,
              activity_type: 'rehearsal' as ActivityType,
              scheduled_start: rehearsal.scheduled_start,
              scheduled_end: rehearsal.scheduled_end,
              status: rehearsal.status as ActivityStatus,
              title: `Rehearsal - ${(rehearsal.band as any)?.name || 'Band'}`,
              location: (rehearsal.room as any)?.name,
              linked_rehearsal_id: rehearsal.id,
              metadata: { type: 'rehearsal', rehearsalId: rehearsal.id },
              created_at: rehearsal.created_at,
            });
          }
        });
      }

      // 4. Fetch recording sessions
      const { data: recordingsData } = await supabase
        .from('recording_sessions')
        .select(`
          *,
          song:songs(title),
          studio:city_studios(name)
        `)
        .eq('user_id', userId)
        .gte('scheduled_start', dayStart.toISOString())
        .lte('scheduled_start', dayEnd.toISOString())
        .in('status', ['scheduled', 'in_progress', 'completed']);

      const existingRecordingIds = allActivities
        .filter(a => a.linked_recording_id)
        .map(a => a.linked_recording_id);

      recordingsData?.forEach(recording => {
        if (!existingRecordingIds.includes(recording.id)) {
          allActivities.push({
            id: `recording-${recording.id}`,
            user_id: userId,
            profile_id: profile.id,
            activity_type: 'recording' as ActivityType,
            scheduled_start: recording.scheduled_start,
            scheduled_end: recording.scheduled_end,
            status: recording.status as ActivityStatus,
            title: `Recording - ${(recording.song as any)?.title || 'Song'}`,
            location: (recording.studio as any)?.name,
            linked_recording_id: recording.id,
            metadata: { type: 'recording', recordingId: recording.id },
            created_at: recording.created_at,
          });
        }
      });

      // 5. Fetch travel activities
      const { data: travelData } = await supabase
        .from('player_travel_history')
        .select(`
          *,
          from_city:cities!player_travel_history_from_city_id_fkey(name),
          to_city:cities!player_travel_history_to_city_id_fkey(name)
        `)
        .eq('user_id', userId)
        .gte('scheduled_departure_time', dayStart.toISOString())
        .lte('scheduled_departure_time', dayEnd.toISOString())
        .in('status', ['scheduled', 'in_progress']);

      travelData?.forEach(travel => {
        const travelId = `travel-${travel.id}`;
        if (!allActivities.some(a => a.id === travelId)) {
          allActivities.push({
            id: travelId,
            user_id: travel.user_id,
            profile_id: profile.id,
            activity_type: 'travel' as ActivityType,
            scheduled_start: travel.scheduled_departure_time || travel.departure_time,
            scheduled_end: travel.arrival_time,
            duration_minutes: travel.travel_duration_hours * 60,
            status: travel.status as ActivityStatus,
            title: `Travel to ${(travel.to_city as any)?.name || 'Unknown'}`,
            description: `${travel.transport_type}`,
            location: `${(travel.from_city as any)?.name || 'Unknown'} → ${(travel.to_city as any)?.name || 'Unknown'}`,
            metadata: { type: 'travel', travelId: travel.id },
            created_at: travel.created_at,
          });
        }
      });

      // 6. Fetch work shifts (auto-scheduled)
      const { data: employment } = await supabase
        .from('player_employment')
        .select(`
          *,
          jobs (
            title,
            shift_start_hour,
            shift_duration_hours,
            work_days
          )
        `)
        .eq('profile_id', profile.id)
        .eq('status', 'employed')
        .eq('auto_clock_in', true)
        .maybeSingle();

      if (employment?.jobs) {
        const job = employment.jobs as any;
        const dayOfWeek = date.getDay();
        const workDays = job.work_days || [];
        
        if (workDays.includes(dayOfWeek)) {
          const shiftStart = new Date(date);
          shiftStart.setHours(job.shift_start_hour || 9, 0, 0, 0);
          
          const shiftEnd = new Date(shiftStart);
          shiftEnd.setHours(shiftStart.getHours() + (job.shift_duration_hours || 8), 0, 0, 0);

          const workId = `work-shift-${employment.id}-${date.toISOString().split('T')[0]}`;
          if (!allActivities.some(a => a.id === workId)) {
            allActivities.push({
              id: workId,
              user_id: userId,
              profile_id: profile.id,
              activity_type: 'work' as ActivityType,
              scheduled_start: shiftStart.toISOString(),
              scheduled_end: shiftEnd.toISOString(),
              status: 'scheduled' as ActivityStatus,
              title: `Work: ${job.title}`,
              description: `Auto-scheduled work shift`,
              metadata: { auto_scheduled: true, employment_id: employment.id },
              created_at: new Date().toISOString(),
            });
          }
        }
      }

      // Sort by scheduled_start
      allActivities.sort((a, b) => 
        new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
      );

      return allActivities;
    },
    enabled: !!userId,
    staleTime: 1000 * 60, // 1 minute
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

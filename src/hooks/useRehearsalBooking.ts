import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createScheduledActivity } from '@/hooks/useActivityBooking';
import { useQueryClient } from '@tanstack/react-query';

interface BookRehearsalParams {
  bandId: string;
  roomId: string;
  duration: number;
  songId: string | null;
  setlistId: string | null;
  scheduledStart: Date;
  totalCost: number;
  chemistryGain: number;
  xpEarned: number;
  familiarityGained: number;
  roomName: string;
  roomLocation: string;
}

// Helper to manually complete rehearsal (since cron may not trigger)
async function completeRehearsalDirectly(
  rehearsalId: string,
  bandId: string,
  songId: string | null,
  durationMinutes: number
) {
  if (!songId) return;
  
  // Fetch existing familiarity
  const { data: existing } = await supabase
    .from('band_song_familiarity')
    .select('familiarity_minutes')
    .eq('band_id', bandId)
    .eq('song_id', songId)
    .maybeSingle();
  
  const currentMinutes = existing?.familiarity_minutes || 0;
  const newMinutes = currentMinutes + durationMinutes;
  
  // Upsert familiarity record
  await supabase
    .from('band_song_familiarity')
    .upsert({
      band_id: bandId,
      song_id: songId,
      familiarity_minutes: newMinutes,
      last_rehearsed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'band_id,song_id',
    });
    
  console.log(`Updated familiarity for song ${songId}: ${currentMinutes} -> ${newMinutes} minutes`);
}

export function useRehearsalBooking() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isBooking, setIsBooking] = useState(false);

  const bookRehearsal = async (params: BookRehearsalParams) => {
    setIsBooking(true);
    
    try {
      const scheduledEnd = new Date(params.scheduledStart);
      scheduledEnd.setHours(scheduledEnd.getHours() + params.duration);

      // Create rehearsal record
      const { data: rehearsalData, error: rehearsalError } = await supabase
        .from('band_rehearsals')
        .insert({
          band_id: params.bandId,
          rehearsal_room_id: params.roomId,
          duration_hours: params.duration,
          total_cost: params.totalCost,
          scheduled_start: params.scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          selected_song_id: params.songId,
          status: 'scheduled',
          chemistry_gain: params.chemistryGain,
          xp_earned: params.xpEarned,
          familiarity_gained: params.familiarityGained,
        })
        .select()
        .single();

      if (rehearsalError) throw rehearsalError;

      // Deduct cost from band balance
      const { data: bandData } = await supabase
        .from('bands')
        .select('band_balance')
        .eq('id', params.bandId)
        .single();

      if (bandData) {
        await supabase
          .from('bands')
          .update({ band_balance: (bandData.band_balance || 0) - params.totalCost })
          .eq('id', params.bandId);
      }

      // Create scheduled activity entry
      await createScheduledActivity({
        activityType: 'rehearsal',
        scheduledStart: params.scheduledStart,
        scheduledEnd,
        title: `Band Rehearsal - ${params.roomName}`,
        location: params.roomLocation,
        linkedRehearsalId: rehearsalData.id,
        metadata: {
          rehearsalId: rehearsalData.id,
          bandId: params.bandId,
          roomId: params.roomId,
          songId: params.songId,
          setlistId: params.setlistId,
        },
      });

      toast({
        title: 'Rehearsal Booked!',
        description: `${params.duration}-hour rehearsal scheduled at ${params.roomName}`,
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['all-rehearsals'] });
      queryClient.invalidateQueries({ queryKey: ['user-bands'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });

      return rehearsalData.id;
    } catch (error) {
      console.error('Failed to book rehearsal:', error);
      toast({
        title: 'Booking Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsBooking(false);
    }
  };

  return {
    bookRehearsal,
    isBooking,
  };
}

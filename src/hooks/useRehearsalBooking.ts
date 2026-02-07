import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { logGameActivity } from '@/hooks/useGameActivityLog';
import { 
  createBandScheduledActivities, 
  checkBandAvailability, 
  formatConflictMessage 
} from '@/utils/bandActivityScheduling';
import { validateFutureTime } from '@/utils/timeSlotValidation';
import { calculateRehearsalEfficiency } from '@/utils/skillRehearsalEfficiency';
import type { SkillProgressEntry } from '@/utils/skillGearPerformance';

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

// Helper to manually complete rehearsal with skill efficiency
async function completeRehearsalDirectly(
  rehearsalId: string,
  bandId: string,
  songId: string | null,
  durationMinutes: number
) {
  if (!songId) return;

  // Fetch band members' skill progress for efficiency calculation
  let efficiencyMultiplier = 1.0;
  try {
    const { data: members } = await supabase
      .from('band_members')
      .select('user_id, instrument_role')
      .eq('band_id', bandId)
      .eq('is_touring_member', false);

    if (members && members.length > 0) {
      const memberUserIds = members.map(m => m.user_id).filter(Boolean) as string[];
      const roles = members.map(m => m.instrument_role || 'Vocals');

      // Get profile IDs for band members
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .in('user_id', memberUserIds);

      if (profiles && profiles.length > 0) {
        const profileIds = profiles.map(p => p.id);
        const { data: skillData } = await supabase
          .from('skill_progress')
          .select('skill_slug, current_level')
          .in('profile_id', profileIds);

        const efficiency = calculateRehearsalEfficiency(
          (skillData || []) as SkillProgressEntry[],
          roles
        );
        efficiencyMultiplier = efficiency.multiplier;
        console.log(`Rehearsal efficiency: ${efficiencyMultiplier.toFixed(2)}x (instrument: +${efficiency.instrumentBonus}, theory: +${efficiency.theoryBonus})`);
      }
    }
  } catch (e) {
    console.warn('Could not calculate rehearsal efficiency, using baseline:', e);
  }

  // Apply efficiency multiplier to effective minutes
  const effectiveMinutes = Math.round(durationMinutes * efficiencyMultiplier);
  
  // Fetch existing familiarity
  const { data: existing } = await supabase
    .from('band_song_familiarity')
    .select('familiarity_minutes')
    .eq('band_id', bandId)
    .eq('song_id', songId)
    .maybeSingle();
  
  const currentMinutes = existing?.familiarity_minutes || 0;
  const newMinutes = currentMinutes + effectiveMinutes;
  
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
    
  console.log(`Updated familiarity for song ${songId}: ${currentMinutes} -> ${newMinutes} minutes (${durationMinutes}min × ${efficiencyMultiplier.toFixed(2)}x efficiency)`);
}

export function useRehearsalBooking() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isBooking, setIsBooking] = useState(false);

  const bookRehearsal = async (params: BookRehearsalParams) => {
    setIsBooking(true);
    
    try {
      // Validate that the time is in the future
      const timeValidation = validateFutureTime(params.scheduledStart);
      if (!timeValidation.valid) {
        throw new Error(timeValidation.message);
      }

      const scheduledEnd = new Date(params.scheduledStart);
      scheduledEnd.setHours(scheduledEnd.getHours() + params.duration);

      // Check availability for ALL band members before booking
      const { available, conflicts } = await checkBandAvailability(
        params.bandId,
        params.scheduledStart,
        scheduledEnd
      );

      if (!available) {
        throw new Error(formatConflictMessage(conflicts));
      }

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
          setlist_id: params.setlistId,
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

      // Create scheduled activity entries for ALL band members
      await createBandScheduledActivities({
        bandId: params.bandId,
        activityType: 'rehearsal',
        scheduledStart: params.scheduledStart,
        scheduledEnd,
        title: `Band Rehearsal - ${params.roomName}`,
        location: params.roomLocation,
        linkedRehearsalId: rehearsalData.id,
        metadata: {
          rehearsalId: rehearsalData.id,
          roomId: params.roomId,
          songId: params.songId,
          setlistId: params.setlistId,
        },
      });

      // Log activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        logGameActivity({
          userId: user.id,
          bandId: params.bandId,
          activityType: 'rehearsal_booked',
          activityCategory: 'rehearsal',
          description: `Booked ${params.duration}-hour rehearsal at ${params.roomName}`,
          amount: -params.totalCost,
          metadata: {
            rehearsalId: rehearsalData.id,
            roomId: params.roomId,
            songId: params.songId,
            setlistId: params.setlistId,
            duration: params.duration,
            chemistryGain: params.chemistryGain,
            xpEarned: params.xpEarned
          }
        });
      }

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

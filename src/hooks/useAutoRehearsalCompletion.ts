import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook to automatically complete rehearsals that have passed their scheduled end time.
 * This does the work directly instead of relying on edge functions/cron.
 */
export const useAutoRehearsalCompletion = (userId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const completeRehearsals = useCallback(async () => {
    if (!userId) return;

    try {
      // Get user's bands
      const { data: bandIds } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);

      if (!bandIds || bandIds.length === 0) return;

      const now = new Date().toISOString();
      const bandIdList = bandIds.map(b => b.band_id);

      // First transition scheduled -> in_progress if start time has passed
      await supabase
        .from('band_rehearsals')
        .update({ status: 'in_progress' })
        .in('band_id', bandIdList)
        .eq('status', 'scheduled')
        .lt('scheduled_start', now);

      // Fetch in_progress rehearsals that have ended
      const { data: overdueRehearsals, error } = await supabase
        .from('band_rehearsals')
        .select('*')
        .in('band_id', bandIdList)
        .eq('status', 'in_progress')
        .lt('scheduled_end', now);

      if (error) {
        console.error('Error fetching overdue rehearsals:', error);
        return;
      }

      if (!overdueRehearsals || overdueRehearsals.length === 0) return;

      console.log(`[AutoRehearsal] Found ${overdueRehearsals.length} overdue rehearsals to complete`);

      let completedCount = 0;

      for (const rehearsal of overdueRehearsals) {
        try {
          // Calculate duration in minutes
          const startTime = new Date(rehearsal.scheduled_start);
          const endTime = new Date(rehearsal.scheduled_end);
          const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
          const durationHours = durationMinutes / 60;

          // Calculate rewards
          const baseXpPerHour = 10 + Math.floor(Math.random() * 10);
          const xpEarned = Math.floor(baseXpPerHour * durationHours);
          const chemistryGain = Math.floor(durationHours * 2) + 1;

          // Update rehearsal as completed
          const { error: updateError } = await supabase
            .from('band_rehearsals')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              xp_earned: xpEarned,
              chemistry_gain: chemistryGain,
              familiarity_gained: Math.floor(durationMinutes),
            })
            .eq('id', rehearsal.id);

          if (updateError) {
            console.error(`Error updating rehearsal ${rehearsal.id}:`, updateError);
            continue;
          }

          // Update song familiarity if a song was selected
          if (rehearsal.selected_song_id) {
            console.log(`[AutoRehearsal] Updating familiarity for song ${rehearsal.selected_song_id}, band ${rehearsal.band_id}`);
            
            const { data: existing, error: fetchError } = await supabase
              .from('band_song_familiarity')
              .select('id, familiarity_minutes')
              .eq('band_id', rehearsal.band_id)
              .eq('song_id', rehearsal.selected_song_id)
              .maybeSingle();

            if (fetchError) {
              console.error(`[AutoRehearsal] Error fetching existing familiarity:`, fetchError);
            }

            const currentMinutes = existing?.familiarity_minutes || 0;
            const newMinutes = currentMinutes + Math.floor(durationMinutes);
            console.log(`[AutoRehearsal] Familiarity: ${currentMinutes} -> ${newMinutes} mins`);

            if (existing?.id) {
              // Update existing record
              const { error: updateError } = await supabase
                .from('band_song_familiarity')
                .update({
                  familiarity_minutes: newMinutes,
                  last_rehearsed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

              if (updateError) {
                console.error(`[AutoRehearsal] Error updating familiarity:`, updateError);
              } else {
                console.log(`[AutoRehearsal] Successfully updated familiarity for song ${rehearsal.selected_song_id}`);
              }
            } else {
              // Insert new record
              const { error: insertError } = await supabase
                .from('band_song_familiarity')
                .insert({
                  band_id: rehearsal.band_id,
                  song_id: rehearsal.selected_song_id,
                  familiarity_minutes: newMinutes,
                  last_rehearsed_at: new Date().toISOString(),
                });

              if (insertError) {
                console.error(`[AutoRehearsal] Error inserting familiarity:`, insertError);
              } else {
                console.log(`[AutoRehearsal] Successfully created familiarity for song ${rehearsal.selected_song_id}`);
              }
            }
          }

          // Update band chemistry using direct update
          if (chemistryGain > 0) {
            const { data: band } = await supabase
              .from('bands')
              .select('chemistry_level')
              .eq('id', rehearsal.band_id)
              .single();
            
            if (band) {
              const newChemistry = Math.min(100, (band.chemistry_level || 0) + chemistryGain);
              await supabase
                .from('bands')
                .update({ chemistry_level: newChemistry })
                .eq('id', rehearsal.band_id);
            }
          }

          completedCount++;
        } catch (err) {
          console.error(`Error completing rehearsal ${rehearsal.id}:`, err);
        }
      }

      if (completedCount > 0) {
        toast({
          title: 'Rehearsal Completed!',
          description: `${completedCount} rehearsal(s) finished. Song familiarity and chemistry updated!`,
        });

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ['all-rehearsals'] });
        queryClient.invalidateQueries({ queryKey: ['band-rehearsals'] });
        queryClient.invalidateQueries({ queryKey: ['band-song-familiarity'] });
        queryClient.invalidateQueries({ queryKey: ['user-bands'] });
      }
    } catch (err) {
      console.error('Error in auto-complete rehearsals:', err);
    }
  }, [userId, toast, queryClient]);

  useEffect(() => {
    if (!userId) return;

    // Check on mount
    completeRehearsals();

    // Check every 2 minutes
    const interval = setInterval(completeRehearsals, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId, completeRehearsals]);
};

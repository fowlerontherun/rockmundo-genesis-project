import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { logGameActivity } from "./useGameActivityLog";

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

          // Update song familiarity - check for setlist or single song
          const songsToUpdate: string[] = [];
          
          if (rehearsal.selected_song_id) {
            // Single song rehearsal
            songsToUpdate.push(rehearsal.selected_song_id);
          }
          
          // Check if there's a setlist_id for full setlist rehearsal
          if ((rehearsal as any).setlist_id) {
            console.log(`[AutoRehearsal] Full setlist rehearsal detected, fetching songs from setlist`);
            const { data: setlistSongs } = await supabase
              .from('setlist_songs')
              .select('song_id')
              .eq('setlist_id', (rehearsal as any).setlist_id)
              .not('song_id', 'is', null);
            
            if (setlistSongs && setlistSongs.length > 0) {
              setlistSongs.forEach(ss => {
                if (ss.song_id && !songsToUpdate.includes(ss.song_id)) {
                  songsToUpdate.push(ss.song_id);
                }
              });
              console.log(`[AutoRehearsal] Found ${songsToUpdate.length} songs in setlist`);
            }
          }
          
          if (songsToUpdate.length > 0) {
            // Split familiarity minutes across all songs
            const minutesPerSong = Math.floor(durationMinutes / songsToUpdate.length);
            
            for (const songId of songsToUpdate) {
              console.log(`[AutoRehearsal] Updating familiarity for song ${songId}, band ${rehearsal.band_id}`);
              
              const { data: existing, error: fetchError } = await supabase
                .from('band_song_familiarity')
                .select('id, familiarity_minutes')
                .eq('band_id', rehearsal.band_id)
                .eq('song_id', songId)
                .maybeSingle();

              if (fetchError) {
                console.error(`[AutoRehearsal] Error fetching existing familiarity:`, fetchError);
                continue;
              }

              const currentMinutes = existing?.familiarity_minutes || 0;
              const newMinutes = currentMinutes + minutesPerSong;
              console.log(`[AutoRehearsal] Familiarity for ${songId}: ${currentMinutes} -> ${newMinutes} mins`);

              if (existing?.id) {
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
                }
              } else {
                const { error: insertError } = await supabase
                  .from('band_song_familiarity')
                  .insert({
                    band_id: rehearsal.band_id,
                    song_id: songId,
                    familiarity_minutes: newMinutes,
                    last_rehearsed_at: new Date().toISOString(),
                  });

                if (insertError) {
                  console.error(`[AutoRehearsal] Error inserting familiarity:`, insertError);
                }
              }
            }
            console.log(`[AutoRehearsal] Updated familiarity for ${songsToUpdate.length} songs`);
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

          // Log activity
          logGameActivity({
            userId,
            bandId: rehearsal.band_id,
            activityType: 'rehearsal_completed',
            activityCategory: 'rehearsal',
            description: `Rehearsal completed (${durationHours.toFixed(1)} hours) - +${xpEarned} XP, +${chemistryGain} chemistry`,
            amount: xpEarned,
            metadata: {
              rehearsalId: rehearsal.id,
              durationMinutes,
              xpEarned,
              chemistryGain,
              songId: rehearsal.selected_song_id
            }
          });

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

        // Invalidate queries to refresh UI immediately
        queryClient.invalidateQueries({ queryKey: ['all-rehearsals'] });
        queryClient.invalidateQueries({ queryKey: ['band-rehearsals'] });
        queryClient.invalidateQueries({ queryKey: ['band-song-familiarity'] });
        queryClient.invalidateQueries({ queryKey: ['user-bands'] });
        queryClient.invalidateQueries({ queryKey: ['songs'] });
        queryClient.invalidateQueries({ queryKey: ['band-songs'] });
        queryClient.invalidateQueries({ queryKey: ['setlist-songs'] });
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

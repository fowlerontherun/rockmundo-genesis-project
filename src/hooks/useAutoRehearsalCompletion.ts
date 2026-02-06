import { useEffect, useCallback, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { logGameActivity } from "./useGameActivityLog";
import { calculateRehearsalStage } from "@/utils/rehearsalStageCalculation";
import type { SongRehearsalResult } from "@/components/rehearsal/RehearsalCompletionReport";

export interface RehearsalCompletionData {
  results: SongRehearsalResult[];
  chemistryGain: number;
  xpGained: number;
  durationHours: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Hook to automatically complete rehearsals that have passed their scheduled end time.
 * Uses edge function with service role for guaranteed familiarity updates.
 * Falls back to direct database writes if edge function fails.
 */
export const useAutoRehearsalCompletion = (userId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingReport, setPendingReport] = useState<RehearsalCompletionData | null>(null);
  const processingRef = useRef(false);

  const clearPendingReport = useCallback(() => {
    setPendingReport(null);
  }, []);

  // Direct database fallback for when edge function fails
  const directDatabaseUpdate = useCallback(async (
    bandId: string,
    songId: string,
    addedMinutes: number
  ) => {
    try {
      console.log(`[AutoRehearsal] Fallback: Direct update for ${songId}`);
      
      const { data: existing } = await supabase
        .from('band_song_familiarity')
        .select('familiarity_minutes')
        .eq('band_id', bandId)
        .eq('song_id', songId)
        .maybeSingle();

      const currentMinutes = existing?.familiarity_minutes || 0;
      const newMinutes = currentMinutes + addedMinutes;
      const stage = calculateRehearsalStage(newMinutes);

      const { error } = await supabase
        .from('band_song_familiarity')
        .upsert({
          band_id: bandId,
          song_id: songId,
          familiarity_minutes: newMinutes,
          rehearsal_stage: stage,
          last_rehearsed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'band_id,song_id',
        });

      if (error) {
        console.error(`[AutoRehearsal] Fallback failed:`, error);
        return false;
      }
      
      console.log(`[AutoRehearsal] Fallback succeeded for ${songId}`);
      return true;
    } catch (err) {
      console.error(`[AutoRehearsal] Fallback error:`, err);
      return false;
    }
  }, []);

  const completeRehearsalsViaEdgeFunction = useCallback(async (retryCount = 0): Promise<boolean> => {
    if (!userId) return false;

    try {
      console.log(`[AutoRehearsal] Calling edge function (attempt ${retryCount + 1})`);
      
      const { data, error } = await supabase.functions.invoke('complete-rehearsals', {
        body: { userId }
      });

      if (error) {
        console.error(`[AutoRehearsal] Edge function error:`, error);
        throw error;
      }

      if (data?.completed && data.completed.length > 0) {
        console.log(`[AutoRehearsal] Edge function completed ${data.completed.length} rehearsals`);
        
        // Build report from edge function response
        const allResults: SongRehearsalResult[] = [];
        let totalChemistry = 0;
        let totalXp = 0;
        let totalHours = 0;

        for (const completed of data.completed) {
          totalChemistry += completed.chemistryGain || 0;
          totalXp += completed.xpEarned || 0;
          totalHours += completed.durationHours || 0;

          for (const song of completed.songResults || []) {
            allResults.push({
              songId: song.songId,
              songTitle: song.songTitle,
              previousMinutes: song.previousMinutes,
              addedMinutes: song.addedMinutes,
              newMinutes: song.newMinutes,
            });
          }

          // Log activity
          logGameActivity({
            userId,
            bandId: completed.bandId,
            activityType: 'rehearsal_completed',
            activityCategory: 'rehearsal',
            description: `Rehearsal completed (${completed.durationHours.toFixed(1)} hours) - +${completed.xpEarned} XP, +${completed.chemistryGain} chemistry`,
            amount: completed.xpEarned,
            metadata: {
              rehearsalId: completed.rehearsalId,
              songCount: completed.songResults?.length || 0,
            }
          });
        }

        if (allResults.length > 0) {
          setPendingReport({
            results: allResults,
            chemistryGain: totalChemistry,
            xpGained: totalXp,
            durationHours: totalHours,
          });
        } else {
          toast({
            title: 'Rehearsal Completed!',
            description: `${data.completed.length} rehearsal(s) finished. Chemistry updated!`,
          });
        }

        return true;
      }

      return true; // No rehearsals to complete is still success
    } catch (err) {
      console.error(`[AutoRehearsal] Attempt ${retryCount + 1} failed:`, err);

      if (retryCount < MAX_RETRIES - 1) {
        // Exponential backoff
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * Math.pow(2, retryCount)));
        return completeRehearsalsViaEdgeFunction(retryCount + 1);
      }

      return false;
    }
  }, [userId, toast]);

  const completeRehearsalsFallback = useCallback(async () => {
    if (!userId) return;

    try {
      console.log(`[AutoRehearsal] Using client-side fallback`);

      // Get user's bands
      const { data: bandIds } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);

      if (!bandIds || bandIds.length === 0) return;

      const now = new Date().toISOString();
      const bandIdList = bandIds.map(b => b.band_id);

      // Transition scheduled -> in_progress
      await supabase
        .from('band_rehearsals')
        .update({ status: 'in_progress' })
        .in('band_id', bandIdList)
        .eq('status', 'scheduled')
        .lt('scheduled_start', now);

      // Fetch overdue rehearsals
      const { data: overdueRehearsals, error } = await supabase
        .from('band_rehearsals')
        .select('*')
        .in('band_id', bandIdList)
        .eq('status', 'in_progress')
        .lt('scheduled_end', now);

      if (error || !overdueRehearsals || overdueRehearsals.length === 0) return;

      console.log(`[AutoRehearsal] Fallback: ${overdueRehearsals.length} rehearsals`);

      let allSongResults: SongRehearsalResult[] = [];
      let totalChemistryGain = 0;
      let totalXpGained = 0;
      let totalDurationHours = 0;

      for (const rehearsal of overdueRehearsals) {
        const startTime = new Date(rehearsal.scheduled_start);
        const endTime = new Date(rehearsal.scheduled_end);
        const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
        const durationHours = durationMinutes / 60;

        const baseXpPerHour = 10 + Math.floor(Math.random() * 10);
        const xpEarned = Math.floor(baseXpPerHour * durationHours);
        const chemistryGain = Math.floor(durationHours * 2) + 1;

        totalChemistryGain += chemistryGain;
        totalXpGained += xpEarned;
        totalDurationHours += durationHours;

        // Update rehearsal status
        await supabase
          .from('band_rehearsals')
          .update({
            status: 'completed',
            completed_at: now,
            xp_earned: xpEarned,
            chemistry_gain: chemistryGain,
            familiarity_gained: Math.floor(durationMinutes),
          })
          .eq('id', rehearsal.id);

        // Get songs
        const songsToUpdate: string[] = [];
        if (rehearsal.selected_song_id) songsToUpdate.push(rehearsal.selected_song_id);
        
        if ((rehearsal as any).setlist_id) {
          const { data: setlistSongs } = await supabase
            .from('setlist_songs')
            .select('song_id')
            .eq('setlist_id', (rehearsal as any).setlist_id)
            .not('song_id', 'is', null);
          
          setlistSongs?.forEach(ss => {
            if (ss.song_id && !songsToUpdate.includes(ss.song_id)) {
              songsToUpdate.push(ss.song_id);
            }
          });
        }

        if (songsToUpdate.length > 0) {
          const minutesPerSong = Math.floor(durationMinutes / songsToUpdate.length);
          
          const { data: songsData } = await supabase
            .from('songs')
            .select('id, title')
            .in('id', songsToUpdate);
          
          const songTitleMap = new Map((songsData || []).map(s => [s.id, s.title]));

          for (const songId of songsToUpdate) {
            const { data: existing } = await supabase
              .from('band_song_familiarity')
              .select('familiarity_minutes')
              .eq('band_id', rehearsal.band_id)
              .eq('song_id', songId)
              .maybeSingle();

            const currentMinutes = existing?.familiarity_minutes || 0;
            const newMinutes = currentMinutes + minutesPerSong;

            allSongResults.push({
              songId,
              songTitle: songTitleMap.get(songId) || 'Unknown Song',
              previousMinutes: currentMinutes,
              addedMinutes: minutesPerSong,
              newMinutes,
            });

            // Direct update (DB trigger should also fire)
            await directDatabaseUpdate(rehearsal.band_id, songId, minutesPerSong);
          }
        }

        // Update chemistry
        if (chemistryGain > 0) {
          const { data: band } = await supabase
            .from('bands')
            .select('chemistry_level')
            .eq('id', rehearsal.band_id)
            .single();
          
          if (band) {
            await supabase
              .from('bands')
              .update({ chemistry_level: Math.min(100, (band.chemistry_level || 0) + chemistryGain) })
              .eq('id', rehearsal.band_id);
          }
        }

        logGameActivity({
          userId,
          bandId: rehearsal.band_id,
          activityType: 'rehearsal_completed',
          activityCategory: 'rehearsal',
          description: `Rehearsal completed (${durationHours.toFixed(1)} hours)`,
          amount: xpEarned,
          metadata: { rehearsalId: rehearsal.id }
        });
      }

      if (allSongResults.length > 0) {
        setPendingReport({
          results: allSongResults,
          chemistryGain: totalChemistryGain,
          xpGained: totalXpGained,
          durationHours: totalDurationHours,
        });
      }

    } catch (err) {
      console.error('[AutoRehearsal] Fallback error:', err);
    }
  }, [userId, directDatabaseUpdate]);

  const completeRehearsals = useCallback(async () => {
    if (!userId || processingRef.current) return;
    
    processingRef.current = true;
    
    try {
      // Try edge function first
      const success = await completeRehearsalsViaEdgeFunction();
      
      if (!success) {
        console.log('[AutoRehearsal] Edge function failed, using fallback');
        await completeRehearsalsFallback();
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['all-rehearsals'] });
      queryClient.invalidateQueries({ queryKey: ['band-rehearsals'] });
      queryClient.invalidateQueries({ queryKey: ['band-song-familiarity'] });
      queryClient.invalidateQueries({ queryKey: ['user-bands'] });
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      queryClient.invalidateQueries({ queryKey: ['band-songs'] });
      queryClient.invalidateQueries({ queryKey: ['setlist-songs'] });
    } finally {
      processingRef.current = false;
    }
  }, [userId, completeRehearsalsViaEdgeFunction, completeRehearsalsFallback, queryClient]);

  useEffect(() => {
    if (!userId) return;

    // Check on mount
    completeRehearsals();

    // Check every 2 minutes
    const interval = setInterval(completeRehearsals, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId, completeRehearsals]);

  return {
    pendingReport,
    clearPendingReport,
  };
};

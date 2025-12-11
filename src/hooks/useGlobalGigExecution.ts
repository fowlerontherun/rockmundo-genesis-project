import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Global hook that processes ALL user's gigs that are in_progress
 * Runs every 30 seconds to advance songs and complete gigs
 */
export const useGlobalGigExecution = (userId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const processGigs = useCallback(async () => {
    if (!userId) return;

    try {
      // Get user's bands
      const { data: bandIds } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);

      if (!bandIds || bandIds.length === 0) return;

      const bandIdList = bandIds.map(b => b.band_id);

      // Find gigs that are in_progress
      const { data: activeGigs, error } = await supabase
        .from('gigs')
        .select(`
          *,
          bands!gigs_band_id_fkey(name),
          venues!gigs_venue_id_fkey(name, capacity)
        `)
        .in('band_id', bandIdList)
        .eq('status', 'in_progress')
        .not('setlist_id', 'is', null);

      if (error) {
        console.error('[GlobalGigExecution] Error fetching active gigs:', error);
        return;
      }

      if (!activeGigs || activeGigs.length === 0) return;

      console.log(`[GlobalGigExecution] Found ${activeGigs.length} active gig(s) to process`);

      for (const gig of activeGigs) {
        try {
          // Get gig outcome
          const { data: outcome } = await supabase
            .from('gig_outcomes')
            .select('id')
            .eq('gig_id', gig.id)
            .maybeSingle();

          if (!outcome) {
            console.log(`[GlobalGigExecution] Creating outcome for gig ${gig.id}`);
            // Outcome should be created by trigger, but create if missing
            const { data: newOutcome } = await supabase
              .from('gig_outcomes')
              .insert({
                gig_id: gig.id,
                actual_attendance: Math.floor((gig.venues?.capacity || 100) * 0.7),
                venue_name: gig.venues?.name || 'Unknown Venue',
                venue_capacity: gig.venues?.capacity || 100,
                attendance_percentage: 70,
                ticket_revenue: 0,
                merch_revenue: 0,
                total_revenue: 0,
                venue_cost: 0,
                crew_cost: 0,
                equipment_cost: 0,
                total_costs: 0,
                net_profit: 0,
                overall_rating: 0,
                performance_grade: 'pending'
              })
              .select('id')
              .single();
            
            if (!newOutcome) continue;
          }

          const outcomeId = outcome?.id;
          if (!outcomeId) continue;

          // Get setlist songs
          const { data: setlistSongs } = await supabase
            .from('setlist_songs')
            .select('*, songs!inner(id, title, duration_seconds)')
            .eq('setlist_id', gig.setlist_id)
            .order('position');

          if (!setlistSongs || setlistSongs.length === 0) continue;

          // Calculate elapsed time
          const startedAt = new Date(gig.started_at);
          const now = new Date();
          const elapsedSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

          // Get existing performances
          const { data: existingPerformances } = await supabase
            .from('gig_song_performances')
            .select('song_id, position')
            .eq('gig_outcome_id', outcomeId);

          const performedPositions = new Set(existingPerformances?.map(p => p.position) || []);

          // Calculate which songs should have been performed
          let cumulativeDuration = 0;
          let songsToPerform: Array<typeof setlistSongs[0] & { position: number }> = [];

          for (let i = 0; i < setlistSongs.length; i++) {
            const song = setlistSongs[i];
            const songDuration = song.songs?.duration_seconds || 180;
            
            if (elapsedSeconds >= cumulativeDuration && !performedPositions.has(i)) {
              songsToPerform.push({ ...song, position: i });
            }
            cumulativeDuration += songDuration;
          }

          // Process songs that should have been performed
          for (const song of songsToPerform) {
            console.log(`[GlobalGigExecution] Processing song: ${song.songs?.title} at position ${song.position}`);
            
            // Call edge function to process song
            const { error: processError } = await supabase.functions.invoke('process-gig-song', {
              body: {
                gigId: gig.id,
                outcomeId: outcomeId,
                songId: song.song_id,
                position: song.position
              }
            });

            if (processError) {
              console.error(`[GlobalGigExecution] Error processing song:`, processError);
            }

            // Update gig's current_song_position
            await supabase
              .from('gigs')
              .update({ current_song_position: song.position + 1 })
              .eq('id', gig.id);
          }

          // Check if gig should complete
          const totalDuration = setlistSongs.reduce((sum, s) => 
            sum + (s.songs?.duration_seconds || 180), 0
          );

          if (elapsedSeconds >= totalDuration && performedPositions.size + songsToPerform.length >= setlistSongs.length) {
            console.log(`[GlobalGigExecution] Completing gig ${gig.id}`);
            
            await supabase.functions.invoke('complete-gig', {
              body: { gigId: gig.id }
            });

            toast({
              title: "Gig Completed!",
              description: `${gig.bands?.name}'s performance has finished!`
            });

            queryClient.invalidateQueries({ queryKey: ['gigs'] });
            queryClient.invalidateQueries({ queryKey: ['gig-outcomes'] });
          }
        } catch (gigError) {
          console.error(`[GlobalGigExecution] Error processing gig ${gig.id}:`, gigError);
        }
      }
    } catch (error) {
      console.error('[GlobalGigExecution] Error:', error);
    }
  }, [userId, toast, queryClient]);

  useEffect(() => {
    if (!userId) return;

    // Process immediately
    processGigs();

    // Then every 30 seconds
    const interval = setInterval(processGigs, 30 * 1000);

    return () => clearInterval(interval);
  }, [userId, processGigs]);
};

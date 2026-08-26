import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Global hook that orchestrates active gigs while the server remains authoritative
 * for outcome creation, song processing, timeline advancement and completion.
 * Runs every 30 seconds to request any due song processing and completion.
 */
export const useGlobalGigExecution = (userId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const completingGigsRef = useRef(new Set<string>());

  const processGigs = useCallback(async () => {
    if (!userId) return;

    try {
      const { data: activeProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .is("died_at", null)
        .maybeSingle();

      if (!activeProfile) return;

      const { data: bandIds } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("profile_id", activeProfile.id)
        .eq("member_status", "active");

      if (!bandIds || bandIds.length === 0) return;

      const bandIdList = bandIds.map((band) => band.band_id);

      const { data: activeGigs, error } = await supabase
        .from("gigs")
        .select(`
          *,
          bands!gigs_band_id_fkey(name),
          venues!gigs_venue_id_fkey(name, capacity)
        `)
        .in("band_id", bandIdList)
        .eq("status", "in_progress")
        .not("setlist_id", "is", null);

      if (error) {
        console.error("[GlobalGigExecution] Error fetching active gigs:", error);
        return;
      }

      if (!activeGigs || activeGigs.length === 0) return;

      console.log(`[GlobalGigExecution] Found ${activeGigs.length} active gig(s) to process`);

      for (const gig of activeGigs) {
        try {
          // Outcome creation belongs to the database trigger fired when the gig
          // enters in_progress. If that server-owned row is not visible yet, do
          // not fabricate a browser fallback; leave the gig retryable.
          const { data: outcome, error: outcomeError } = await supabase
            .from("gig_outcomes")
            .select("id")
            .eq("gig_id", gig.id)
            .maybeSingle();

          if (outcomeError) {
            console.error(`[GlobalGigExecution] Error fetching outcome for gig ${gig.id}:`, outcomeError);
            continue;
          }

          if (!outcome?.id) {
            console.warn(`[GlobalGigExecution] Server-created outcome not ready for gig ${gig.id}; will retry`);
            continue;
          }

          const outcomeId = outcome.id;

          // Get every setlist entry. Inner-joining songs used to silently drop
          // performance items such as stage dives from live progression.
          const { data: setlistSongs } = await supabase
            .from("setlist_songs")
            .select("id,song_id,performance_item_id,item_type,position,songs(id,title,duration_seconds),performance_items_catalog(id,name,duration_seconds)")
            .eq("setlist_id", gig.setlist_id)
            .order("position");

          if (!setlistSongs || setlistSongs.length === 0) continue;

          const startedAt = new Date(gig.started_at);
          const now = new Date();
          const elapsedSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

          const { data: existingPerformances } = await supabase
            .from("gig_song_performances")
            .select("song_id, position")
            .eq("gig_outcome_id", outcomeId);

          const performedPositions = new Set(existingPerformances?.map((performance) => performance.position) || []);

          let cumulativeDuration = 0;
          const songsToPerform: Array<typeof setlistSongs[0] & { position: number }> = [];

          for (let i = 0; i < setlistSongs.length; i++) {
            const song = setlistSongs[i];
            const songDuration = song.songs?.duration_seconds || song.performance_items_catalog?.duration_seconds || 180;

            if (elapsedSeconds >= cumulativeDuration && !performedPositions.has(i)) {
              songsToPerform.push({ ...song, position: i });
            }
            cumulativeDuration += songDuration;
          }

          for (const song of songsToPerform) {
            const isPerformanceItem = song.item_type === "performance_item" || (!song.song_id && !!song.performance_item_id);
            console.log(
              `[GlobalGigExecution] Processing setlist item: ${song.songs?.title ?? song.performance_items_catalog?.name ?? "Unknown item"} at position ${song.position}`,
            );

            const { error: processError } = await supabase.functions.invoke("process-gig-song", {
              body: {
                gigId: gig.id,
                outcomeId,
                songId: song.song_id,
                performanceItemId: song.performance_item_id,
                itemType: isPerformanceItem ? "performance_item" : "song",
                position: song.position,
              },
            });

            if (processError) {
              console.error("[GlobalGigExecution] Error processing song:", processError);
            }
            // process-gig-song advances current_song_position through the
            // service-only mark_gig_position_processed RPC.
          }

          const totalDuration = setlistSongs.reduce(
            (sum, setlistItem) =>
              sum + (setlistItem.songs?.duration_seconds || setlistItem.performance_items_catalog?.duration_seconds || 180),
            0,
          );

          if (
            elapsedSeconds >= totalDuration &&
            performedPositions.size + songsToPerform.length >= setlistSongs.length
          ) {
            if (completingGigsRef.current.has(gig.id)) continue;
            completingGigsRef.current.add(gig.id);
            console.log(`[GlobalGigExecution] Completing gig ${gig.id}`);

            const { data: completionData, error: completionError } = await supabase.functions.invoke("complete-gig", {
              body: { gigId: gig.id },
            });

            if (completionError) {
              completingGigsRef.current.delete(gig.id);
              console.error("[GlobalGigExecution] complete-gig failed:", completionError);
              continue;
            }

            if (!(completionData as any)?.alreadyCompleted) {
              toast({
                title: "Gig Completed!",
                description: `${gig.bands?.name}'s performance has finished!`,
              });
            }

            queryClient.invalidateQueries({ queryKey: ["gigs"] });
            queryClient.invalidateQueries({ queryKey: ["gig-outcomes"] });
          }
        } catch (gigError) {
          console.error(`[GlobalGigExecution] Error processing gig ${gig.id}:`, gigError);
        }
      }
    } catch (error) {
      console.error("[GlobalGigExecution] Error:", error);
    }
  }, [userId, toast, queryClient]);

  useEffect(() => {
    if (!userId) return;

    processGigs();

    const interval = setInterval(processGigs, 30 * 1000);

    return () => clearInterval(interval);
  }, [userId, processGigs]);
};

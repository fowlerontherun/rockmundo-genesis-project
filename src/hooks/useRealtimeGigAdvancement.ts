import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { differenceInSeconds } from "date-fns";

interface Song {
  id: string;
  song_id: string;
  duration_seconds?: number | null;
  songs: {
    duration_seconds?: number | null;
  };
}

export const useRealtimeGigAdvancement = (gigId: string | null, enabled: boolean = true) => {
  const { toast } = useToast();

  const processNextSong = useCallback(async (
    gig: any,
    setlistSongs: Song[],
    outcomeId: string
  ) => {
    const currentPosition = gig.current_song_position || 0;
    
    console.log(`[Gig Advancement] Processing position ${currentPosition} of ${setlistSongs.length} songs`);
    
    if (currentPosition >= setlistSongs.length) {
      // All songs completed - finalize the gig
      console.log('[Gig Advancement] All songs completed, finalizing gig');
      
      const { data, error: completeError } = await supabase.functions.invoke('complete-gig', {
        body: { gigId: gig.id }
      });

      if (completeError) {
        console.error('[Gig Advancement] Error completing gig:', completeError);
        toast({
          title: "Error completing gig",
          description: completeError.message,
          variant: "destructive"
        });
      } else {
        console.log('[Gig Advancement] Gig completed successfully:', data);
        toast({
          title: "Gig Completed!",
          description: "Check your gig history for the results"
        });
      }
      return;
    }

    const nextSong = setlistSongs[currentPosition];
    console.log(`[Gig Advancement] Processing song: ${nextSong.song_id} at position ${currentPosition}`);
    
    // Call edge function to process this song's performance
    const { data, error } = await supabase.functions.invoke('process-gig-song', {
      body: {
        gigId: gig.id,
        outcomeId: outcomeId,
        songId: nextSong.song_id,
        position: currentPosition
      }
    });

    if (error) {
      console.error('[Gig Advancement] Error processing song:', error);
      toast({
        title: "Error processing song",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    console.log('[Gig Advancement] Processed song performance:', data);

    // Advance to next song
    const { error: advanceError } = await supabase.rpc('advance_gig_song', { p_gig_id: gig.id });
    
    if (advanceError) {
      console.error('[Gig Advancement] Error advancing song position:', advanceError);
    } else {
      console.log('[Gig Advancement] Advanced to next song position');
    }
  }, [toast]);

  useEffect(() => {
    if (!gigId || !enabled) {
      console.log('[Gig Advancement] Hook disabled or no gigId');
      return;
    }

    console.log('[Gig Advancement] Starting monitoring for gig:', gigId);

    let timeoutId: NodeJS.Timeout | null = null;
    let currentGig: any = null;
    let songs: Song[] = [];
    let outcomeId: string | null = null;

    const checkAndAdvance = async () => {
      try {
        // Get current gig state
        const { data: gig, error: gigError } = await supabase
          .from('gigs')
          .select('*')
          .eq('id', gigId)
          .single();

        if (gigError || !gig) {
          console.error('[Gig Advancement] Error fetching gig:', gigError);
          return;
        }

        currentGig = gig;

        // Only process if gig is in progress
        if (gig.status !== 'in_progress' || !gig.started_at) {
          console.log(`[Gig Advancement] Gig not in progress. Status: ${gig.status}, Started: ${gig.started_at}`);
          return;
        }

        // Get setlist songs if not loaded
        if (songs.length === 0 && gig.setlist_id) {
          const { data: setlistData } = await supabase
            .from('setlist_songs')
            .select('*, songs!inner(id, duration_seconds)')
            .eq('setlist_id', gig.setlist_id)
            .order('position');

          songs = setlistData || [];
          console.log(`[Gig Advancement] Loaded ${songs.length} songs from setlist`);
        }

        // Get outcome (should be created by trigger when gig starts)
        if (!outcomeId) {
          const { data: existingOutcome } = await supabase
            .from('gig_outcomes')
            .select('id')
            .eq('gig_id', gig.id)
            .maybeSingle();

          if (existingOutcome) {
            outcomeId = existingOutcome.id;
            console.log('[Gig Advancement] Found outcome:', outcomeId);
          } else {
            console.error('[Gig Advancement] No outcome found for gig:', gig.id);
            return;
          }
        }

        if (!outcomeId || songs.length === 0) {
          console.log('[Gig Advancement] Missing outcome or songs');
          return;
        }

        // Check if current song has completed based on duration
        const currentPosition = gig.current_song_position || 0;
        const elapsedSeconds = differenceInSeconds(new Date(), new Date(gig.started_at));
        
        // Calculate total duration of completed songs
        let totalCompletedDuration = 0;
        for (let i = 0; i < currentPosition; i++) {
          const song = songs[i];
          const duration = song.duration_seconds || song.songs?.duration_seconds || 180;
          totalCompletedDuration += duration;
        }

        console.log(`[Gig Advancement] Elapsed: ${elapsedSeconds}s, Completed duration: ${totalCompletedDuration}s, Position: ${currentPosition}/${songs.length}`);

        // Check if it's time for the next song
        if (currentPosition < songs.length && elapsedSeconds >= totalCompletedDuration) {
          console.log('[Gig Advancement] ✅ Time to process next song!');
          await processNextSong(gig, songs, outcomeId);
          
          // Schedule next check for after current song
          const currentSong = songs[currentPosition];
          const songDuration = (currentSong?.duration_seconds || currentSong?.songs?.duration_seconds || 180) * 1000;
          console.log(`[Gig Advancement] Next check in ${songDuration}ms`);
          timeoutId = setTimeout(checkAndAdvance, songDuration);
        } else if (currentPosition >= songs.length) {
          console.log('[Gig Advancement] All songs processed, waiting for completion');
          timeoutId = setTimeout(checkAndAdvance, 5000);
        } else {
          const timeUntilNext = totalCompletedDuration - elapsedSeconds;
          console.log(`[Gig Advancement] Next song in ${timeUntilNext} seconds`);
          // Check again in 3 seconds
          timeoutId = setTimeout(checkAndAdvance, 3000);
        }
      } catch (error) {
        console.error('[Gig Advancement] Error in gig advancement:', error);
        timeoutId = setTimeout(checkAndAdvance, 10000); // Retry in 10 seconds
      }
    };

    // Start checking
    checkAndAdvance();

    // Subscribe to gig updates
    const channel = supabase
      .channel(`gig-advancement-${gigId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'gigs',
          filter: `id=eq.${gigId}`
        },
        (payload) => {
          console.log('[Gig Advancement] Received gig update:', payload);
          if (timeoutId) clearTimeout(timeoutId);
          checkAndAdvance();
        }
      )
      .subscribe();

    return () => {
      console.log('[Gig Advancement] Cleaning up monitoring for gig:', gigId);
      if (timeoutId) clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [gigId, enabled, processNextSong]);
};

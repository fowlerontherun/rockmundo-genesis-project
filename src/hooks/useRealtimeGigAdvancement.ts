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
    
    if (currentPosition >= setlistSongs.length) {
      // All songs completed - finalize the gig
      console.log('All songs completed, finalizing gig');
      
      const { error: completeError } = await supabase.functions.invoke('complete-gig', {
        body: { gigId: gig.id }
      });

      if (completeError) {
        console.error('Error completing gig:', completeError);
      } else {
        console.log('Gig completed successfully');
      }
      return;
    }

    const nextSong = setlistSongs[currentPosition];
    
    // Call edge function to process this song's performance
    const { data, error } = await supabase.functions.invoke('process-gig-song', {
      body: {
        gigId: gig.id,
        outcomeId,
        songId: nextSong.song_id,
        position: currentPosition + 1
      }
    });

    if (error) {
      console.error('Error processing song:', error);
      return;
    }

    console.log('Processed song performance:', data);

    // Advance to next song
    await supabase.rpc('advance_gig_song', { p_gig_id: gig.id });
  }, []);

  useEffect(() => {
    if (!gigId || !enabled) return;

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

        if (gigError || !gig) return;

        currentGig = gig;

        // Only process if gig is in progress
        if (gig.status !== 'in_progress' || !gig.started_at) return;

        // Get setlist songs if not loaded
        if (songs.length === 0 && gig.setlist_id) {
          const { data: setlistData } = await supabase
            .from('setlist_songs')
            .select('*, songs!inner(id, duration_seconds)')
            .eq('setlist_id', gig.setlist_id)
            .order('position');

          songs = setlistData || [];
        }

        // Get or create outcome
        if (!outcomeId) {
          const { data: existingOutcome } = await supabase
            .from('gig_outcomes')
            .select('id, actual_attendance')
            .eq('gig_id', gig.id)
            .maybeSingle();

          if (existingOutcome) {
            outcomeId = existingOutcome.id;
          } else {
            // Create initial outcome
            const { data: venue } = await supabase
              .from('venues')
              .select('capacity')
              .eq('id', gig.venue_id)
              .single();

            const venueCapacity = venue?.capacity || 100;
            const actualAttendance = Math.floor(venueCapacity * (0.6 + Math.random() * 0.3));

            const { data: newOutcome } = await supabase
              .from('gig_outcomes')
              .insert({
                gig_id: gig.id,
                actual_attendance: actualAttendance,
                attendance_percentage: (actualAttendance / venueCapacity) * 100,
                ticket_revenue: actualAttendance * (gig.ticket_price || 20),
                merch_revenue: 0,
                total_revenue: actualAttendance * (gig.ticket_price || 20),
                venue_cost: 0,
                crew_cost: 0,
                equipment_cost: 0,
                total_costs: 0,
                net_profit: actualAttendance * (gig.ticket_price || 20),
                overall_rating: 0
              })
              .select()
              .single();

            outcomeId = newOutcome?.id || null;
          }
        }

        if (!outcomeId || songs.length === 0) return;

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

        // Check if it's time for the next song
        if (currentPosition < songs.length && elapsedSeconds >= totalCompletedDuration) {
          await processNextSong(gig, songs, outcomeId);
          
          // Schedule next check for after current song
          const currentSong = songs[currentPosition];
          const songDuration = (currentSong?.duration_seconds || currentSong?.songs?.duration_seconds || 180) * 1000;
          timeoutId = setTimeout(checkAndAdvance, songDuration);
        } else {
          // Check again in 5 seconds
          timeoutId = setTimeout(checkAndAdvance, 5000);
        }
      } catch (error) {
        console.error('Error in gig advancement:', error);
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
        () => {
          if (timeoutId) clearTimeout(timeoutId);
          checkAndAdvance();
        }
      )
      .subscribe();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [gigId, enabled, processNextSong]);
};
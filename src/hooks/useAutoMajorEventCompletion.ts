import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGameCalendar } from "@/hooks/useGameCalendar";
import { useGameData } from "@/hooks/useGameData";

/**
 * Auto-completes major event performances when the in-game date
 * has passed the event's scheduled month. Processes all 3 songs
 * and calls complete-major-event for each accepted performance.
 */
export function useAutoMajorEventCompletion(userId: string | null) {
  const queryClient = useQueryClient();
  const { profile } = useGameData();
  const { data: calendar } = useGameCalendar();
  const processingRef = useRef(false);

  useEffect(() => {
    if (!userId || !calendar || processingRef.current) return;

    const checkAndAutoComplete = async () => {
      processingRef.current = true;
      
      try {
        // Get all accepted (not yet performed) performances for this user
        const { data: pendingPerformances, error } = await (supabase as any)
          .from('major_event_performances')
          .select(`
            *,
            instance:major_event_instances(*, event:major_events(*)),
            song_1:songs!major_event_performances_song_1_id_fkey(id, quality_score, genre),
            song_2:songs!major_event_performances_song_2_id_fkey(id, quality_score, genre),
            song_3:songs!major_event_performances_song_3_id_fkey(id, quality_score, genre)
          `)
          .eq('user_id', userId)
          .eq('status', 'accepted');

        if (error || !pendingPerformances?.length) {
          processingRef.current = false;
          return;
        }

        const currentMonth = calendar.gameMonth;
        const currentYear = calendar.gameYear;

        for (const perf of pendingPerformances) {
          const eventMonth = perf.instance?.event?.month;
          if (!eventMonth) continue;

          // Check if the event date has passed in game time
          // Event is past if we're in a later month of the same year, or a later year
          const instanceYear = perf.instance?.year || currentYear;
          const isPast = (currentYear > instanceYear) || 
                         (currentYear === instanceYear && currentMonth > eventMonth);

          if (!isPast) continue;

          console.log(`Auto-completing major event: ${perf.instance?.event?.name}`);

          // Start the performance
          await (supabase as any)
            .from('major_event_performances')
            .update({
              status: 'in_progress',
              started_at: new Date().toISOString(),
              current_song_position: 1,
            })
            .eq('id', perf.id);

          // Process all 3 songs
          const songs = [perf.song_1, perf.song_2, perf.song_3];
          for (let i = 0; i < songs.length; i++) {
            const song = songs[i];
            if (!song) continue;

            try {
              await supabase.functions.invoke('process-major-event-song', {
                body: {
                  performanceId: perf.id,
                  songId: song.id,
                  position: i + 1,
                },
              });

              // Update position
              await (supabase as any)
                .from('major_event_performances')
                .update({ current_song_position: i + 2 })
                .eq('id', perf.id);
            } catch (err) {
              console.error(`Error processing song ${i + 1}:`, err);
            }
          }

          // Complete the event
          try {
            await supabase.functions.invoke('complete-major-event', {
              body: { performanceId: perf.id },
            });
          } catch (err) {
            console.error('Error completing major event:', err);
          }
        }

        // Refresh queries
        queryClient.invalidateQueries({ queryKey: ['major-event-performances'] });
        queryClient.invalidateQueries({ queryKey: ['major-events'] });

      } catch (err) {
        console.error('Auto major event completion error:', err);
      } finally {
        processingRef.current = false;
      }
    };

    checkAndAutoComplete();
  }, [userId, calendar?.gameMonth, calendar?.gameYear]);
}
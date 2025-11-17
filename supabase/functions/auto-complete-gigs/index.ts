import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-triggered-by",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get("x-triggered-by") ?? undefined;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let runId: string | null = null;
  const startedAt = Date.now();

  try {
    runId = await startJobRun({
      jobName: "auto-complete-gigs",
      functionName: "auto-complete-gigs",
      supabaseClient,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    console.log('[auto-complete-gigs] Checking for gigs to complete...');

    // Find in-progress gigs that should be completed
    const { data: inProgressGigs, error: gigsError } = await supabaseClient
      .from('gigs')
      .select(`
        id,
        started_at,
        setlist_id,
        current_song_position,
        setlists!inner(id)
      `)
      .eq('status', 'in_progress')
      .not('started_at', 'is', null);

    if (gigsError) {
      console.error('[auto-complete-gigs] Error fetching gigs:', gigsError);
      throw gigsError;
    }

    console.log(`[auto-complete-gigs] Found ${inProgressGigs?.length || 0} in-progress gigs`);

    let completedCount = 0;
    let processedCount = 0;

    for (const gig of inProgressGigs || []) {
      try {
        // Get setlist songs count and total duration
        const { data: setlistSongs, error: songsError } = await supabaseClient
          .from('setlist_songs')
          .select('id, song_id, songs!inner(id, duration_seconds)')
          .eq('setlist_id', gig.setlist_id)
          .order('position');

        if (songsError || !setlistSongs || setlistSongs.length === 0) {
          console.log(`[auto-complete-gigs] Skipping gig ${gig.id}: no setlist songs`);
          continue;
        }

        const totalSongs = setlistSongs.length;
        const currentPosition = gig.current_song_position || 0;

        // Calculate total duration
        const totalDuration = setlistSongs.reduce((sum, ss) => {
          return sum + ((ss as any).songs?.duration_seconds || 180);
        }, 0);

        // Calculate elapsed time since start
        const startedAt = new Date(gig.started_at);
        const now = new Date();
        const elapsedSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

        console.log(`[auto-complete-gigs] Gig ${gig.id}: position ${currentPosition}/${totalSongs}, elapsed ${elapsedSeconds}s, total duration ${totalDuration}s`);

        // Check if all songs should be processed
        if (elapsedSeconds >= totalDuration) {
          // Get outcome
          const { data: outcome } = await supabaseClient
            .from('gig_outcomes')
            .select('id')
            .eq('gig_id', gig.id)
            .maybeSingle();

          if (!outcome) {
            console.log(`[auto-complete-gigs] Skipping gig ${gig.id}: no outcome found`);
            continue;
          }

          // Process any missing songs
          for (let pos = currentPosition; pos < totalSongs; pos++) {
            const song = setlistSongs[pos];
            
            console.log(`[auto-complete-gigs] Processing song at position ${pos} for gig ${gig.id}`);
            
            const { error: processSongError } = await supabaseClient.functions.invoke('process-gig-song', {
              body: {
                gigId: gig.id,
                outcomeId: outcome.id,
                songId: song.song_id,
                position: pos
              }
            });

            if (processSongError) {
              console.error(`[auto-complete-gigs] Error processing song:`, processSongError);
              continue;
            }

            // Advance position
            await supabaseClient.rpc('advance_gig_song', { p_gig_id: gig.id });
            processedCount++;
          }

          // Complete the gig
          console.log(`[auto-complete-gigs] Completing gig ${gig.id}`);
          
          const { error: completeError } = await supabaseClient.functions.invoke('complete-gig', {
            body: { gigId: gig.id }
          });

          if (completeError) {
            console.error(`[auto-complete-gigs] Error completing gig:`, completeError);
          } else {
            completedCount++;
            console.log(`[auto-complete-gigs] ✅ Completed gig ${gig.id}`);
          }
        }
      } catch (error) {
        console.error(`[auto-complete-gigs] Error processing gig ${gig.id}:`, error);
      }
    }

    console.log(`[auto-complete-gigs] Processed ${processedCount} songs, completed ${completedCount} gigs`);

    await completeJobRun({
      jobName: "auto-complete-gigs",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount: processedCount,
      resultSummary: { completedGigs: completedCount, totalChecked: inProgressGigs?.length || 0 },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        processedSongs: processedCount,
        completedGigs: completedCount,
        totalChecked: inProgressGigs?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in auto-complete-gigs:", error);

    await failJobRun({
      jobName: "auto-complete-gigs",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      error,
    });

    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

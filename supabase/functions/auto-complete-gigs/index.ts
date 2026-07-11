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
        // Get setlist songs and process every due position using server time.
        const { data: setlistSongs, error: songsError } = await supabaseClient
          .from('setlist_songs')
          .select('id, song_id, performance_item_id, item_type, songs(id, duration_seconds)')
          .eq('setlist_id', gig.setlist_id)
          .order('position');

        if (songsError || !setlistSongs || setlistSongs.length === 0) {
          console.log(`[auto-complete-gigs] Skipping gig ${gig.id}: no setlist songs`);
          continue;
        }

        const { data: outcome } = await supabaseClient
          .from('gig_outcomes')
          .select('id')
          .eq('gig_id', gig.id)
          .single();
        if (!outcome) continue;

        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(gig.started_at).getTime()) / 1000));
        let cumulative = 0;
        let duePositions = 0;
        for (const row of setlistSongs as any[]) {
          const duration = Math.max(1, Number(row.songs?.duration_seconds || 180));
          if (elapsedSeconds >= cumulative) duePositions++;
          cumulative += duration;
        }

        const { data: existing } = await supabaseClient
          .from('gig_song_performances')
          .select('position')
          .eq('gig_outcome_id', outcome.id);
        const existingPositions = new Set((existing || []).map((p: any) => p.position));

        for (let position = 0; position < Math.min(duePositions, setlistSongs.length); position++) {
          if (existingPositions.has(position)) continue;
          const item: any = setlistSongs[position];
          console.log(`[auto-complete-gigs] song_processing_started gig_id=${gig.id} position=${position}`);
          const { error: processError } = await supabaseClient.functions.invoke('process-gig-song', {
            body: { gigId: gig.id, outcomeId: outcome.id, songId: item.song_id, performanceItemId: item.performance_item_id, itemType: item.item_type, position }
          });
          if (processError) console.error(`[auto-complete-gigs] song processing failed`, processError);
          else processedCount++;
        }

        await supabaseClient
          .from('gigs')
          .update({ current_song_position: Math.min(duePositions, setlistSongs.length) })
          .eq('id', gig.id);

        if (elapsedSeconds >= cumulative) {
          console.log(`[auto-complete-gigs] completion_started gig_id=${gig.id}`);
          const { error: completeError } = await supabaseClient.functions.invoke('complete-gig', { body: { gigId: gig.id } });
          if (completeError) console.error(`[auto-complete-gigs] Error completing gig:`, completeError);
          else { completedCount++; console.log(`[auto-complete-gigs] completion_succeeded gig_id=${gig.id}`); }
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

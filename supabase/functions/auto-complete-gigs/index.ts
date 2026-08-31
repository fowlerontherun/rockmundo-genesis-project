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

    console.log("[auto-complete-gigs] Checking for gigs to complete...");

    let normalizationSummary = { gigsUpdated: 0, activitiesUpdated: 0 };
    try {
      const { data: normalization, error: normalizationError } = await supabaseClient.rpc(
        "normalize_legacy_gig_schedules"
      );

      if (normalizationError) throw normalizationError;

      normalizationSummary = {
        gigsUpdated: Number(normalization?.gigsUpdated ?? 0),
        activitiesUpdated: Number(normalization?.activitiesUpdated ?? 0),
      };

      if (normalizationSummary.gigsUpdated > 0 || normalizationSummary.activitiesUpdated > 0) {
        console.log(
          `[auto-complete-gigs] Normalized ${normalizationSummary.gigsUpdated} gig schedules and ${normalizationSummary.activitiesUpdated} linked activities`
        );
      }
    } catch (normalizationError) {
      // Do not block healthy gigs if schedule repair has an isolated failure.
      console.error("[auto-complete-gigs] Legacy schedule normalization failed:", normalizationError);
    }

    // Include rows with a missing started_at so legacy/stuck in-progress gigs can self-repair.
    const { data: inProgressGigs, error: gigsError } = await supabaseClient
      .from("gigs")
      .select(`
        id,
        started_at,
        scheduled_date,
        setlist_id,
        current_song_position,
        setlists!inner(id)
      `)
      .eq("status", "in_progress");

    if (gigsError) {
      console.error("[auto-complete-gigs] Error fetching gigs:", gigsError);
      throw gigsError;
    }

    console.log(`[auto-complete-gigs] Found ${inProgressGigs?.length || 0} in-progress gigs`);

    let completedCount = 0;
    let processedCount = 0;
    let repairedStartCount = 0;

    for (const gig of inProgressGigs || []) {
      try {
        const effectiveStartValue = gig.started_at ?? gig.scheduled_date;
        if (!effectiveStartValue) {
          console.log(`[auto-complete-gigs] Skipping gig ${gig.id}: no start timestamp`);
          continue;
        }

        const effectiveStartedAt = new Date(effectiveStartValue);
        const now = new Date();

        if (Number.isNaN(effectiveStartedAt.getTime())) {
          console.log(`[auto-complete-gigs] Skipping gig ${gig.id}: invalid start timestamp`);
          continue;
        }

        // A legacy gig can be marked in_progress before its corrected slot begins. Do not advance it early.
        if (effectiveStartedAt.getTime() > now.getTime()) {
          console.log(`[auto-complete-gigs] Skipping gig ${gig.id}: corrected start is still in the future`);
          continue;
        }

        if (!gig.started_at) {
          const { error: repairStartError } = await supabaseClient
            .from("gigs")
            .update({ started_at: effectiveStartedAt.toISOString() })
            .eq("id", gig.id)
            .eq("status", "in_progress")
            .is("started_at", null);

          if (repairStartError) {
            console.error(`[auto-complete-gigs] Failed to repair started_at for ${gig.id}:`, repairStartError);
          } else {
            repairedStartCount++;
            console.log(`[auto-complete-gigs] Repaired missing started_at for ${gig.id}`);
          }
        }

        // Get setlist songs count and total duration
        const { data: setlistSongs, error: songsError } = await supabaseClient
          .from("setlist_songs")
          .select("id,song_id,performance_item_id,item_type,position,songs(id,title,duration_seconds),performance_items_catalog(id,name,duration_seconds)")
          .eq("setlist_id", gig.setlist_id)
          .order("position");

        if (songsError || !setlistSongs || setlistSongs.length === 0) {
          console.log(`[auto-complete-gigs] Skipping gig ${gig.id}: no setlist songs`);
          continue;
        }

        const totalSongs = setlistSongs.length;
        const currentPosition = gig.current_song_position || 0;

        const totalDuration = setlistSongs.reduce((sum, ss) => {
          return sum + (ss.songs?.duration_seconds || ss.performance_items_catalog?.duration_seconds || 180);
        }, 0);

        const elapsedSeconds = Math.floor((now.getTime() - effectiveStartedAt.getTime()) / 1000);

        console.log(
          `[auto-complete-gigs] Gig ${gig.id}: position ${currentPosition}/${totalSongs}, elapsed ${elapsedSeconds}s, total duration ${totalDuration}s`
        );

        let dueDuration = 0;
        for (let position = 0; position < totalSongs; position++) {
          const song = setlistSongs[position];
          if (elapsedSeconds >= dueDuration && position >= currentPosition) {
            const { data: outcome } = await supabaseClient
              .from("gig_outcomes")
              .select("id")
              .eq("gig_id", gig.id)
              .single();

            if (outcome?.id) {
              const isPerformanceItem =
                song.item_type === "performance_item" || (!song.song_id && !!song.performance_item_id);
              const { error: processError } = await supabaseClient.functions.invoke("process-gig-song", {
                body: {
                  gigId: gig.id,
                  outcomeId: outcome.id,
                  songId: song.song_id,
                  performanceItemId: song.performance_item_id,
                  itemType: isPerformanceItem ? "performance_item" : "song",
                  position,
                },
              });

              if (processError) {
                console.error(`[auto-complete-gigs] Error processing setlist item ${position}:`, processError);
              } else {
                processedCount++;
              }
            }
          }

          dueDuration += song.songs?.duration_seconds || song.performance_items_catalog?.duration_seconds || 180;
        }

        if (elapsedSeconds >= totalDuration) {
          console.log(`[auto-complete-gigs] Gig ${gig.id} duration exceeded, completing...`);

          const { error: completeError } = await supabaseClient.functions.invoke("complete-gig", {
            body: { gigId: gig.id },
          });

          if (completeError) {
            console.error("[auto-complete-gigs] Error completing gig:", completeError);
          } else {
            completedCount++;
            console.log(`[auto-complete-gigs] ✅ Completed gig ${gig.id}`);
          }
        }
      } catch (error) {
        console.error(`[auto-complete-gigs] Error processing gig ${gig.id}:`, error);
      }
    }

    console.log(
      `[auto-complete-gigs] Processed ${processedCount} songs, repaired ${repairedStartCount} starts, completed ${completedCount} gigs`
    );

    // ---- Automatic retry workflow for gigs that failed to complete ----
    const retrySummary = {
      candidates: 0,
      retried: 0,
      recovered: 0,
      failed: 0,
      skipped: 0,
      exhausted: 0,
    };

    try {
      const { data: candidates, error: candidatesError } = await supabaseClient.rpc(
        "list_gig_completion_retry_candidates",
        { p_limit: 25, p_overdue_minutes: 10 }
      );

      if (candidatesError) throw candidatesError;

      retrySummary.candidates = candidates?.length ?? 0;

      for (const candidate of candidates ?? []) {
        const attemptWindow = Math.floor(Date.now() / 60000);
        const idempotencyKey = `gig-completion:${candidate.gig_id}:${candidate.attempt_count + 1}:${attemptWindow}`;

        const { data: claim, error: claimError } = await supabaseClient.rpc(
          "claim_gig_completion_attempt",
          { p_gig_id: candidate.gig_id, p_idempotency_key: idempotencyKey }
        );

        if (claimError) {
          console.error("[auto-complete-gigs] Retry claim failed:", candidate.gig_id, claimError);
          retrySummary.skipped++;
          continue;
        }

        if (!claim?.claimed) {
          console.log(`[auto-complete-gigs] Retry skipped for ${candidate.gig_id}: ${claim?.reason}`);
          if (claim?.reason === "attempts_exhausted") retrySummary.exhausted++;
          else retrySummary.skipped++;
          continue;
        }

        retrySummary.retried++;

        let attemptError: string | null = null;
        try {
          const { data: retryResult, error: retryError } = await supabaseClient.functions.invoke(
            "complete-gig",
            { body: { gigId: candidate.gig_id, idempotencyKey } }
          );
          if (retryError) attemptError = getErrorMessage(retryError);
          else if (retryResult?.error) attemptError = String(retryResult.error);
        } catch (invokeError) {
          attemptError = getErrorMessage(invokeError);
        }

        const { data: recorded, error: recordError } = await supabaseClient.rpc(
          "record_gig_completion_attempt",
          {
            p_attempt_id: claim.attemptId,
            p_success: attemptError === null,
            p_error: attemptError,
          }
        );

        if (recordError) {
          console.error("[auto-complete-gigs] Failed to record retry outcome:", recordError);
        }

        if (attemptError === null) {
          retrySummary.recovered++;
          console.log(
            `[auto-complete-gigs] ✅ Recovered gig ${candidate.gig_id} on attempt ${claim.attemptNumber}`
          );
        } else {
          retrySummary.failed++;
          if (recorded?.exhausted) retrySummary.exhausted++;
          console.error(
            `[auto-complete-gigs] Retry ${claim.attemptNumber} failed for gig ${candidate.gig_id}: ${attemptError}` +
              (recorded?.retryAt ? ` — next retry ${recorded.retryAt}` : " — no further retries")
          );
        }
      }
    } catch (retryPassError) {
      console.error("[auto-complete-gigs] Retry pass error:", retryPassError);
    }

    const resultSummary = {
      completedGigs: completedCount,
      totalChecked: inProgressGigs?.length || 0,
      processedSongs: processedCount,
      repairedStarts: repairedStartCount,
      normalization: normalizationSummary,
      retry: retrySummary,
    };

    await completeJobRun({
      jobName: "auto-complete-gigs",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount,
      itemsAffected: completedCount + repairedStartCount,
      resultSummary,
    });

    return new Response(
      JSON.stringify({
        success: true,
        ...resultSummary,
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

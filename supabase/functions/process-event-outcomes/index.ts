import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  startJobRun,
  completeJobRun,
  failJobRun,
  safeJson,
} from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JOB_NAME = "process-event-outcomes";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const startTime = Date.now();
  const runId = await startJobRun({
    jobName: JOB_NAME,
    functionName: "process-event-outcomes",
    supabaseClient: supabase,
    triggeredBy: "cron",
    requestPayload: await safeJson(req),
  });

  try {
    console.log(`[${JOB_NAME}] Processing event outcomes...`);

    // Get events awaiting outcome where choice was made before today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: pendingOutcomes, error: fetchError } = await supabase
      .from("player_events")
      .select(`
        *,
        random_events (*)
      `)
      .eq("status", "awaiting_outcome")
      // Quarantine choices made before the atomic engine went live.
      // Old worker executions might already have applied effects without
      // recording completion, so replaying these is unsafe.
      .gte("choice_made_at", "2026-10-09T00:00:00Z")
      .lt("choice_made_at", today.toISOString());

    if (fetchError) throw fetchError;

    console.log(`[${JOB_NAME}] Found ${pendingOutcomes?.length || 0} pending outcomes`);

    let outcomesProcessed = 0;
    let lowHealthOutcomes = 0;
    const skippedReasons: Record<string, number> = {};

    for (const playerEvent of pendingOutcomes || []) {
      const event = playerEvent.random_events;
      if (!event) {
        skippedReasons.missing_catalogue_event = (skippedReasons.missing_catalogue_event ?? 0) + 1;
        continue;
      }

      // Core effects and completion are an atomic, event-locked DB transaction.
      // If another worker processed this event, no rewards are repeated.
      const { data: result, error: applyError } = await supabase.rpc(
        "apply_random_event_outcome",
        { p_player_event_id: playerEvent.id },
      );
      if (applyError) {
        console.error(`[${JOB_NAME}] Failed to apply event ${playerEvent.id}`, applyError);
        skippedReasons.rpc_error = (skippedReasons.rpc_error ?? 0) + 1;
        continue;
      }
      if (!result?.applied) {
        const reason = String(result?.reason ?? 'unknown');
        skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
        continue;
      }

      // Database trigger delivers the inbox item, activity feed record and any
      // hospitalization atomically with the outcome. No extra writes here.
      outcomesProcessed++;
      if (result.health_after != null && Number(result.health_after) < 10) {
        // Counts low-health outcomes, not necessarily successful admissions.
        lowHealthOutcomes++;
      }
    }

    // Also expire old pending_choice events (older than 3 days)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiredEvents } = await supabase
      .from("player_events")
      .update({ status: "expired" })
      .eq("status", "pending_choice")
      .lt("triggered_at", threeDaysAgo)
      .select();

    const expiredCount = expiredEvents?.length || 0;
    if (expiredCount > 0) {
      console.log(`[${JOB_NAME}] Expired ${expiredCount} old events`);
    }

    console.log(`[${JOB_NAME}] Complete. Processed ${outcomesProcessed} outcomes, ${lowHealthOutcomes} hospitalizations`);

    await completeJobRun({
      jobName: JOB_NAME,
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startTime,
      processedCount: outcomesProcessed,
      resultSummary: { outcomesProcessed, lowHealthOutcomes, expiredCount, skippedReasons },
    });

    return new Response(
      JSON.stringify({ success: true, outcomesProcessed, lowHealthOutcomes, expiredCount, skippedReasons }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[${JOB_NAME}] Error:`, error);
    await failJobRun({
      jobName: JOB_NAME,
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startTime,
      error,
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

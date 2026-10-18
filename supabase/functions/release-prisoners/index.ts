import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startJobRun, completeJobRun, failJobRun, getErrorMessage } from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const runId = await startJobRun({
    jobName: "release-prisoners",
    functionName: "release-prisoners",
    supabaseClient: supabase,
  });

  try {
    console.log("[release-prisoners] Starting prisoner release check...");
    
    let prisonersReleased = 0;
    let earlyReleases = 0;

    const now = new Date();

    // Find all prisoners due for release
    const { data: prisoners, error: prisonerError } = await supabase
      .from("player_imprisonments")
      .select("*, prisons(name)")
      .eq("status", "imprisoned")
      .lte("release_date", now.toISOString());

    if (prisonerError) throw prisonerError;
    console.log(`[release-prisoners] Found ${prisoners?.length || 0} prisoners due for release`);

    let skippedUnattributed = 0;
    let skippedFinalized = 0;
    let releaseErrors = 0;

    for (const prisoner of prisoners || []) {
      // Historical account-only rows cannot be attributed to a character without
      // evidence. Never clear every profile for an auth user as a fallback.
      if (!prisoner.profile_id) {
        skippedUnattributed++;
        console.error(`[release-prisoners] Manual character attribution required for imprisonment ${prisoner.id}`);
        continue;
      }

      try {
        // Database function locks this imprisonment + its owning character and
        // atomically finalizes sentence, criminal record, message, and morale.
        // Concurrent cron runs return released:false for the already settled row.
        const { data: settlement, error: releaseError } = await supabase.rpc(
          "release_due_prisoner_atomic",
          { p_imprisonment_id: prisoner.id },
        );
        if (releaseError) throw releaseError;

        if (settlement?.released !== true) {
          skippedFinalized++;
          console.log(`[release-prisoners] Skipped imprisonment ${prisoner.id}: ${settlement?.reason ?? "not due"}`);
          continue;
        }

        prisonersReleased++;
        if (settlement.early_release === true) earlyReleases++;
        console.log(`[release-prisoners] Released character ${settlement.profile_id} (imprisonment ${prisoner.id})`);
      } catch (err) {
        releaseErrors++;
        console.error(`[release-prisoners] Settlement failed for imprisonment ${prisoner.id}; will retry next run`, err);
      }
    }

    // Also decrement remaining_sentence_days for active prisoners
    const { data: activePrisoners } = await supabase
      .from("player_imprisonments")
      .select("id, remaining_sentence_days, behavior_score, original_sentence_days")
      .eq("status", "imprisoned")
      .gt("remaining_sentence_days", 0);

    for (const prisoner of activePrisoners || []) {
      // Calculate early release days based on behavior
      let earlyReleaseDays = 0;
      if (prisoner.behavior_score >= 90) {
        earlyReleaseDays = Math.ceil(prisoner.original_sentence_days * 0.25);
      } else if (prisoner.behavior_score >= 75) {
        earlyReleaseDays = Math.ceil(prisoner.original_sentence_days * 0.15);
      } else if (prisoner.behavior_score >= 60) {
        earlyReleaseDays = Math.ceil(prisoner.original_sentence_days * 0.10);
      }

      const newRemainingDays = Math.max(0, prisoner.remaining_sentence_days - 1);
      const newReleaseDate = new Date();
      newReleaseDate.setDate(newReleaseDate.getDate() + Math.max(0, newRemainingDays - earlyReleaseDays));

      await supabase
        .from("player_imprisonments")
        .update({
          remaining_sentence_days: newRemainingDays,
          good_behavior_days_earned: earlyReleaseDays,
          release_date: newReleaseDate.toISOString()
        })
        .eq("id", prisoner.id);
    }

    await completeJobRun({
      jobName: "release-prisoners",
      runId: runId!,
      supabaseClient: supabase,
      processedCount: prisoners?.length || 0,
      details: { prisonersReleased, earlyReleases, skippedUnattributed, skippedFinalized, releaseErrors, activePrisonersUpdated: activePrisoners?.length || 0 }
    });

    return new Response(
      JSON.stringify({
        success: true,
        prisonersReleased,
        earlyReleases,
        skippedUnattributed,
        skippedFinalized,
        releaseErrors,
        activePrisonersUpdated: activePrisoners?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[release-prisoners] Error:", error);
    await failJobRun({
      jobName: "release-prisoners",
      runId: runId!,
      supabaseClient: supabase,
      error
    });
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

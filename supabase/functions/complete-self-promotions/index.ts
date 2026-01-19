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

const JOB_NAME = "complete-self-promotions";

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
    functionName: "complete-self-promotions",
    supabaseClient: supabase,
    triggeredBy: "cron",
    requestPayload: await safeJson(req),
  });

  try {
    console.log(`[${JOB_NAME}] Starting self-promotion completion check...`);

    // Find all in_progress self_promotion_activities that have passed their scheduled_end
    const now = new Date().toISOString();
    const { data: pendingActivities, error: fetchError } = await supabase
      .from("self_promotion_activities")
      .select("id, band_id, activity_type, scheduled_end, status, bands(id, fame, total_fans)")
      .eq("status", "in_progress")
      .lt("scheduled_end", now);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`[${JOB_NAME}] Found ${pendingActivities?.length || 0} pending activities to complete`);

    let completed = 0;
    let failed = 0;

    for (const activity of pendingActivities || []) {
      try {
        console.log(`[${JOB_NAME}] Processing activity ${activity.id} (type: ${activity.activity_type})`);

        // Get catalog entry for rewards calculation
        const { data: catalogEntry, error: catalogError } = await supabase
          .from("self_promotion_catalog")
          .select("*")
          .eq("activity_type", activity.activity_type)
          .single();

        if (catalogError || !catalogEntry) {
          console.error(`[${JOB_NAME}] No catalog entry for type ${activity.activity_type}`);
          failed++;
          continue;
        }

        // Calculate rewards based on band fame
        const bandFame = activity.bands?.fame || 0;
        const fameMultiplier = 1 + Math.min(bandFame / 1000, 0.5);

        const fameGained = Math.floor(
          (Math.random() * (catalogEntry.base_fame_max - catalogEntry.base_fame_min) + 
           catalogEntry.base_fame_min) * fameMultiplier
        );

        const fansGained = Math.floor(
          (Math.random() * (catalogEntry.base_fan_max - catalogEntry.base_fan_min) + 
           catalogEntry.base_fan_min) * fameMultiplier
        );

        // Update activity to completed
        const { error: updateError } = await supabase
          .from("self_promotion_activities")
          .update({
            status: "completed",
            fame_gained: fameGained,
            fans_gained: fansGained,
          })
          .eq("id", activity.id);

        if (updateError) {
          console.error(`[${JOB_NAME}] Failed to update activity ${activity.id}:`, updateError);
          failed++;
          continue;
        }

        // Update band's fame and fans
        const newFame = (activity.bands?.fame || 0) + fameGained;
        const newFans = (activity.bands?.total_fans || 0) + fansGained;

        await supabase
          .from("bands")
          .update({
            fame: newFame,
            total_fans: newFans,
          })
          .eq("id", activity.band_id);

        // Record fame event
        await supabase.from("band_fame_events").insert({
          band_id: activity.band_id,
          event_type: "self_promotion",
          fame_gained: fameGained,
          event_data: {
            activity_type: activity.activity_type,
            activity_name: catalogEntry.name,
            fans_gained: fansGained,
          },
        });

        // Set cooldown
        const cooldownExpires = new Date();
        cooldownExpires.setDate(cooldownExpires.getDate() + (catalogEntry.cooldown_days || 1));

        await supabase
          .from("self_promotion_cooldowns")
          .upsert({
            band_id: activity.band_id,
            activity_type: activity.activity_type,
            cooldown_expires_at: cooldownExpires.toISOString(),
          }, { onConflict: "band_id,activity_type" });

        completed++;
        console.log(`[${JOB_NAME}] Completed activity ${activity.id}: +${fameGained} fame, +${fansGained} fans`);

      } catch (activityError) {
        console.error(`[${JOB_NAME}] Error processing activity ${activity.id}:`, activityError);
        failed++;
      }
    }

    console.log(`[${JOB_NAME}] Done. Completed: ${completed}, Failed: ${failed}`);

    await completeJobRun({
      jobName: JOB_NAME,
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startTime,
      processedCount: completed,
      resultSummary: { completed, failed, total: pendingActivities?.length || 0 },
    });

    return new Response(
      JSON.stringify({ success: true, completed, failed }),
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
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

interface EventEffects {
  fans?: number;
  cash?: number;
  health?: number;
  energy?: number;
  fame?: number;
  xp?: number;
}

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
      .lt("choice_made_at", today.toISOString());

    if (fetchError) throw fetchError;

    console.log(`[${JOB_NAME}] Found ${pendingOutcomes?.length || 0} pending outcomes`);

    let outcomesProcessed = 0;
    let hospitalizationsTriggered = 0;

    for (const playerEvent of pendingOutcomes || []) {
      const event = playerEvent.random_events;
      if (!event) continue;

      // Get effects based on choice
      const effects: EventEffects = playerEvent.choice_made === "a"
        ? (event.option_a_effects as EventEffects)
        : (event.option_b_effects as EventEffects);

      const outcomeMessage = playerEvent.choice_made === "a"
        ? event.option_a_outcome_text
        : event.option_b_outcome_text;

      console.log(`[${JOB_NAME}] Processing outcome for player ${playerEvent.user_id}: ${JSON.stringify(effects)}`);

      // Get current player stats
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("cash, health, energy, fame, experience")
        .eq("user_id", playerEvent.user_id)
        .single();

      if (profileError || !profile) {
        console.error(`[${JOB_NAME}] Failed to get profile for ${playerEvent.user_id}`);
        continue;
      }

      // Calculate new values
      const newHealth = Math.max(0, Math.min(100, (profile.health ?? 100) + (effects.health ?? 0)));
      const newEnergy = Math.max(0, Math.min(100, (profile.energy ?? 100) + (effects.energy ?? 0)));
      const newCash = Math.max(0, (profile.cash ?? 0) + (effects.cash ?? 0));
      const newFame = Math.max(0, (profile.fame ?? 0) + (effects.fame ?? 0));
      const newXp = Math.max(0, (profile.experience ?? 0) + (effects.xp ?? 0));

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          health: newHealth,
          energy: newEnergy,
          cash: newCash,
          fame: newFame,
          experience: newXp,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", playerEvent.user_id);

      if (updateError) {
        console.error(`[${JOB_NAME}] Failed to update profile:`, updateError);
        continue;
      }

      // Handle fans effect on band if any
      if (effects.fans && effects.fans !== 0) {
        const { data: bandMember } = await supabase
          .from("band_members")
          .select("band_id")
          .eq("user_id", playerEvent.user_id)
          .limit(1)
          .single();

        if (bandMember) {
          await supabase.rpc("increment", {
            table_name: "bands",
            row_id: bandMember.band_id,
            column_name: "total_fans",
            increment_by: effects.fans,
          }).catch(() => {
            // RPC might not exist, try direct update
            supabase
              .from("bands")
              .update({ total_fans: effects.fans })
              .eq("id", bandMember.band_id);
          });
        }
      }

      // Mark event as completed
      const { error: completeError } = await supabase
        .from("player_events")
        .update({
          status: "completed",
          outcome_applied: true,
          outcome_applied_at: new Date().toISOString(),
          outcome_effects: effects,
          outcome_message: outcomeMessage,
        })
        .eq("id", playerEvent.id);

      if (completeError) {
        console.error(`[${JOB_NAME}] Failed to complete event:`, completeError);
        continue;
      }

      // Log activity
      await supabase.from("activity_feed").insert({
        user_id: playerEvent.user_id,
        activity_type: "random_event_outcome",
        message: `Event outcome: ${outcomeMessage}`,
        metadata: { event_id: event.id, effects },
      });

      outcomesProcessed++;

      // Check for hospitalization (health < 10)
      if (newHealth < 10) {
        console.log(`[${JOB_NAME}] Player ${playerEvent.user_id} health dropped to ${newHealth}, triggering hospitalization`);
        
        // Get player's current city
        const { data: playerProfile } = await supabase
          .from("profiles")
          .select("current_city_id")
          .eq("user_id", playerEvent.user_id)
          .single();

        if (playerProfile?.current_city_id) {
          // Find hospital in that city
          const { data: hospital } = await supabase
            .from("hospitals")
            .select("*")
            .eq("city_id", playerProfile.current_city_id)
            .limit(1)
            .single();

          if (hospital) {
            // Calculate recovery days based on effectiveness
            const recoveryDays = Math.max(1, Math.min(3, Math.ceil((100 - hospital.effectiveness_rating) / 50) + 1));
            const dischargeDate = new Date();
            dischargeDate.setDate(dischargeDate.getDate() + recoveryDays);

            // Create hospitalization record
            await supabase.from("player_hospitalizations").insert({
              user_id: playerEvent.user_id,
              hospital_id: hospital.id,
              reason: `Health emergency from event: ${event.title}`,
              daily_cost: hospital.cost_per_day,
              estimated_discharge_at: dischargeDate.toISOString(),
            });

            // Log hospitalization
            await supabase.from("activity_feed").insert({
              user_id: playerEvent.user_id,
              activity_type: "hospitalized",
              message: `Rushed to ${hospital.name} for emergency treatment`,
              metadata: { hospital_id: hospital.id, recovery_days: recoveryDays },
            });

            hospitalizationsTriggered++;
          }
        }
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

    console.log(`[${JOB_NAME}] Complete. Processed ${outcomesProcessed} outcomes, ${hospitalizationsTriggered} hospitalizations`);

    await completeJobRun({
      jobName: JOB_NAME,
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startTime,
      processedCount: outcomesProcessed,
      resultSummary: { outcomesProcessed, hospitalizationsTriggered, expiredCount },
    });

    return new Response(
      JSON.stringify({ success: true, outcomesProcessed, hospitalizationsTriggered, expiredCount }),
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

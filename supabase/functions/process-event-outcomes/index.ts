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
  skill_xp?: number;
  skill_slug?: string;
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

      // Core effects and completion are an atomic, event-locked DB transaction.
      // If another worker processed this event, no rewards are repeated.
      const { data: result, error: applyError } = await supabase.rpc(
        "apply_random_event_outcome",
        { p_player_event_id: playerEvent.id },
      );
      if (applyError) {
        console.error(`[${JOB_NAME}] Failed to apply event ${playerEvent.id}`, applyError);
        continue;
      }
      if (!result?.applied) continue;

      const appliedEffects: EventEffects = result.effects ?? {};
      const effects = appliedEffects;
      const outcomeMessage = String(result.outcome_message ?? "");
      const newHealth = Number(result.health_after ?? 100);

      // Log activity
      await supabase.from("activity_feed").insert({
        user_id: playerEvent.user_id,
        activity_type: "random_event_outcome",
        message: `Event outcome: ${outcomeMessage}`,
        metadata: { event_id: event.id, effects: appliedEffects },
      });

      // Create inbox message with outcome details
      const effectsSummary: string[] = [];
      if (effects.cash && effects.cash !== 0) effectsSummary.push(`${effects.cash > 0 ? '+' : ''}$${effects.cash}`);
      if (effects.fame && effects.fame !== 0) effectsSummary.push(`${effects.fame > 0 ? '+' : ''}${effects.fame} fame`);
      if (effects.fans && effects.fans !== 0) effectsSummary.push(`${effects.fans > 0 ? '+' : ''}${effects.fans} fans`);
      if (effects.health && effects.health !== 0) effectsSummary.push(`${effects.health > 0 ? '+' : ''}${effects.health} health`);
      if (effects.energy && effects.energy !== 0) effectsSummary.push(`${effects.energy > 0 ? '+' : ''}${effects.energy} energy`);
      if (effects.xp && effects.xp !== 0) effectsSummary.push(`${effects.xp > 0 ? '+' : ''}${effects.xp} XP`);
      if (appliedEffects.skill_xp && appliedEffects.skill_slug) {
        effectsSummary.push(`+${appliedEffects.skill_xp} ${appliedEffects.skill_slug.replace(/_/g, " ")} skill XP`);
      }
      
      const effectsText = effectsSummary.length > 0 ? `\n\nEffects: ${effectsSummary.join(', ')}` : '';
      
      await supabase.from("player_inbox").insert({
        user_id: playerEvent.user_id,
        category: "random_event",
        priority: "normal",
        title: `📋 Event Outcome: ${event.title}`,
        message: `${outcomeMessage}${effectsText}`,
        metadata: { event_id: event.id, player_event_id: playerEvent.id, effects: appliedEffects },
        related_entity_type: "random_event",
        related_entity_id: event.id,
        action_type: null,
        action_data: null,
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

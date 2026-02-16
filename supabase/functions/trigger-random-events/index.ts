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

const JOB_NAME = "trigger-random-events";
const TRIGGER_CHANCE = 15; // 1 in 15 chance (~6.7%)
const CRAVING_TRIGGER_CHANCE = 5; // 1 in 5 chance (20%) for addicted players

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
    functionName: "trigger-random-events",
    supabaseClient: supabase,
    triggeredBy: "cron",
    requestPayload: await safeJson(req),
  });

  try {
    console.log(`[${JOB_NAME}] Starting random event trigger...`);

    // Get active players (logged in within last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: activePlayers, error: playersError } = await supabase
      .from("profiles")
      .select("user_id, health")
      .gte("updated_at", sevenDaysAgo);

    if (playersError) throw playersError;

    console.log(`[${JOB_NAME}] Found ${activePlayers?.length || 0} active players`);

    // Get all active events (non-craving)
    const { data: allEvents, error: eventsError } = await supabase
      .from("random_events")
      .select("*")
      .eq("is_active", true)
      .or("category.is.null,category.neq.addiction_craving");

    if (eventsError) throw eventsError;

    // Get all active craving events
    const { data: cravingEvents, error: cravingError } = await supabase
      .from("random_events")
      .select("*")
      .eq("is_active", true)
      .eq("category", "addiction_craving");

    if (cravingError) throw cravingError;

    console.log(`[${JOB_NAME}] Found ${allEvents?.length || 0} active events, ${cravingEvents?.length || 0} craving events`);

    if ((!allEvents || allEvents.length === 0) && (!cravingEvents || cravingEvents.length === 0)) {
      console.log(`[${JOB_NAME}] No events available, skipping`);
      await completeJobRun({
        jobName: JOB_NAME,
        runId,
        supabaseClient: supabase,
        durationMs: Date.now() - startTime,
        processedCount: 0,
        resultSummary: { message: "No events available" },
      });
      return new Response(JSON.stringify({ success: true, eventsTriggered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let eventsTriggered = 0;
    let playersProcessed = 0;

    for (const player of activePlayers || []) {
      playersProcessed++;

      // Check if player already has a pending event
      const { data: pendingEvents } = await supabase
        .from("player_events")
        .select("id")
        .eq("user_id", player.user_id)
        .in("status", ["pending_choice", "awaiting_outcome"])
        .limit(1);

      if (pendingEvents && pendingEvents.length > 0) {
        console.log(`[${JOB_NAME}] Player ${player.user_id} already has pending event, skipping`);
        continue;
      }

      // Check if player has an active addiction for craving events
      const { data: activeAddictions } = await supabase
        .from("player_addictions")
        .select("addiction_type")
        .eq("user_id", player.user_id)
        .eq("status", "active")
        .limit(1);

      const hasActiveAddiction = activeAddictions && activeAddictions.length > 0;
      const addictionType = hasActiveAddiction ? activeAddictions[0].addiction_type : null;

      // Bonus craving roll for addicted players
      if (hasActiveAddiction && cravingEvents && cravingEvents.length > 0) {
        const cravingRoll = Math.floor(Math.random() * CRAVING_TRIGGER_CHANCE) + 1;
        if (cravingRoll === 1) {
          // Filter craving events matching addiction type
          const matchingCravings = cravingEvents.filter((e) => {
            try {
              const choiceAEffects = typeof e.choice_a_effects === "string" ? JSON.parse(e.choice_a_effects) : e.choice_a_effects;
              return choiceAEffects?.addiction_type === addictionType;
            } catch {
              return false;
            }
          });

          const eligibleCravings = matchingCravings.length > 0 ? matchingCravings : cravingEvents;
          const selectedCraving = eligibleCravings[Math.floor(Math.random() * eligibleCravings.length)];

          const { error: insertError } = await supabase.from("player_events").insert({
            user_id: player.user_id,
            event_id: selectedCraving.id,
            status: "pending_choice",
          });

          if (!insertError) {
            eventsTriggered++;
            console.log(`[${JOB_NAME}] Triggered craving event "${selectedCraving.title}" for addicted player ${player.user_id}`);
            continue; // Skip normal roll since craving triggered
          }
        }
      }

      // Normal 1 in 15 chance
      const roll = Math.floor(Math.random() * TRIGGER_CHANCE) + 1;
      if (roll !== 1) {
        continue;
      }

      console.log(`[${JOB_NAME}] Player ${player.user_id} rolled ${roll}, triggering event`);

      // Get player's event history (non-common events they've seen)
      const { data: history } = await supabase
        .from("player_event_history")
        .select("event_id")
        .eq("user_id", player.user_id);

      const seenEventIds = new Set(history?.map((h) => h.event_id) || []);

      // Filter eligible events
      const eligibleEvents = (allEvents || []).filter((event) => {
        // Skip non-common events already seen
        if (!event.is_common && seenEventIds.has(event.id)) {
          return false;
        }

        // Check health conditions
        const playerHealth = player.health ?? 100;
        if (event.health_min !== null && playerHealth < event.health_min) {
          return false;
        }
        if (event.health_max !== null && playerHealth > event.health_max) {
          return false;
        }

        return true;
      });

      if (eligibleEvents.length === 0) {
        console.log(`[${JOB_NAME}] No eligible events for player ${player.user_id}`);
        continue;
      }

      // Pick random event
      const selectedEvent = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];

      // Create player_event record
      const { error: insertError } = await supabase.from("player_events").insert({
        user_id: player.user_id,
        event_id: selectedEvent.id,
        status: "pending_choice",
      });

      if (insertError) {
        console.error(`[${JOB_NAME}] Failed to create event for player ${player.user_id}:`, insertError);
        continue;
      }

      eventsTriggered++;
      console.log(`[${JOB_NAME}] Triggered event "${selectedEvent.title}" for player ${player.user_id}`);
    }

    console.log(`[${JOB_NAME}] Complete. Triggered ${eventsTriggered} events for ${playersProcessed} players`);

    await completeJobRun({
      jobName: JOB_NAME,
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startTime,
      processedCount: playersProcessed,
      resultSummary: { eventsTriggered, playersProcessed },
    });

    return new Response(
      JSON.stringify({ success: true, eventsTriggered, playersProcessed }),
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

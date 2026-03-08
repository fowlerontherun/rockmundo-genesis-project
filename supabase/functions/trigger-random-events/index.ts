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

    // Get active players (logged in within last 7 days) with travel status
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: activePlayers, error: playersError } = await supabase
      .from("profiles")
      .select("user_id, health, is_traveling")
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

    // Pre-fetch band morale for all active players (v1.0.959)
    const playerUserIds = (activePlayers || []).map(p => p.user_id);
    const playerMoraleMap = new Map<string, number>();
    if (playerUserIds.length > 0) {
      const { data: memberMorales } = await supabase
        .from('band_members')
        .select('user_id, band_id')
        .in('user_id', playerUserIds)
        .eq('is_touring_member', false);

      if (memberMorales && memberMorales.length > 0) {
        const bandIds = [...new Set(memberMorales.map(m => m.band_id))];
        const { data: bandsM } = await supabase
          .from('bands')
          .select('id, morale')
          .in('id', bandIds);

        const bandMoraleMap = new Map<string, number>();
        for (const b of bandsM || []) {
          bandMoraleMap.set(b.id, (b as any).morale ?? 50);
        }
        for (const m of memberMorales) {
          if (m.user_id) {
            playerMoraleMap.set(m.user_id, bandMoraleMap.get(m.band_id) ?? 50);
          }
        }
      }
    }
    console.log(`[${JOB_NAME}] Pre-fetched morale for ${playerMoraleMap.size} players`);

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

      // Normal trigger chance — modified by band morale (v1.0.959)
      // Low morale (<30) increases drama chance: trigger chance drops from 15 to as low as 6
      // High morale (>75) decreases drama chance: trigger chance rises from 15 to 20
      const playerMorale = playerMoraleMap.get(player.user_id) ?? 50;
      let effectiveTriggerChance = TRIGGER_CHANCE;
      if (playerMorale <= 30) {
        // Scale 15 → 6 as morale goes from 30 → 0 (more events when miserable)
        effectiveTriggerChance = Math.round(TRIGGER_CHANCE - ((30 - playerMorale) / 30) * 9);
      } else if (playerMorale >= 75) {
        // Scale 15 → 20 as morale goes from 75 → 100 (fewer events when euphoric)
        effectiveTriggerChance = Math.round(TRIGGER_CHANCE + ((playerMorale - 75) / 25) * 5);
      }
      effectiveTriggerChance = Math.max(3, Math.min(25, effectiveTriggerChance));

      const roll = Math.floor(Math.random() * effectiveTriggerChance) + 1;
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

      // Compute current game season from epoch for season filtering
      const GAME_EPOCH_MS = new Date("2026-01-01T00:00:00Z").getTime();
      const nowMs = Date.now();
      const realDaysElapsed = Math.max(0, Math.floor((nowMs - GAME_EPOCH_MS) / (1000 * 60 * 60 * 24)));
      const gameDaysElapsed = Math.floor((realDaysElapsed / 10) * 30);
      const remainingDays = gameDaysElapsed % (30 * 12);
      const currentGameMonth = Math.floor(remainingDays / 30) + 1;
      const currentSeason = currentGameMonth >= 3 && currentGameMonth <= 5 ? "spring"
        : currentGameMonth >= 6 && currentGameMonth <= 8 ? "summer"
        : currentGameMonth >= 9 && currentGameMonth <= 11 ? "autumn"
        : "winter";

      // Filter eligible events
      const eligibleEvents = (allEvents || []).filter((event) => {
        // Skip non-common events already seen
        if (!event.is_common && seenEventIds.has(event.id)) {
          return false;
        }

        // Season filter: only allow events with no season or matching current season
        if (event.season && event.season !== currentSeason) {
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

        // Boost travel_hazard events for traveling players
        if (event.category === "travel_hazard" && !player.is_traveling) {
          return false; // Only traveling players get travel hazards
        }

        // Boost mental_health events (always eligible)
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

      // === SCANDAL SENTIMENT IMPACT (v1.0.946) ===
      // Scandal/negative events hurt fan sentiment
      if (selectedEvent.category === 'scandal' || selectedEvent.category === 'controversy') {
        try {
          const { data: bandMember } = await supabase
            .from('band_members')
            .select('band_id')
            .eq('user_id', player.user_id)
            .eq('is_touring_member', false)
            .limit(1)
            .maybeSingle();

          if (bandMember?.band_id) {
            const { data: band } = await supabase
              .from('bands')
              .select('fan_sentiment_score, media_intensity, media_fatigue, morale, reputation_score')
              .eq('id', bandMember.band_id)
              .single();

            if (band) {
              const curSentiment = (band as any).fan_sentiment_score ?? 0;
              const curIntensity = (band as any).media_intensity ?? 0;
              const curFatigue = (band as any).media_fatigue ?? 0;
              const curMorale = (band as any).morale ?? 50;
              const curRep = (band as any).reputation_score ?? 0;
              const newSentiment = Math.max(-100, curSentiment - 20);
              // v1.0.959: Scandals also hurt morale (-8 to -12 depending on severity)
              const moralePenalty = selectedEvent.category === 'scandal' ? 12 : 8;
              const newMorale = Math.max(0, curMorale - moralePenalty);
              // === SCANDAL → REPUTATION (v1.0.982) ===
              const repPenalty = selectedEvent.category === 'scandal' ? -10 : -5;
              const newRep = Math.max(-100, curRep + repPenalty);
              // Scandals: big negative sentiment, big positive media (scandals generate buzz)
              await supabase.from('bands').update({
                fan_sentiment_score: newSentiment,
                media_intensity: Math.min(100, curIntensity + 40),
                media_fatigue: Math.min(100, curFatigue + 20),
                morale: newMorale,
                reputation_score: newRep,
              } as any).eq('id', bandMember.band_id);

              await supabase.from('band_sentiment_events').insert({
                band_id: bandMember.band_id,
                event_type: 'scandal',
                sentiment_change: -20,
                media_intensity_change: 40,
                media_fatigue_change: 20,
                sentiment_after: newSentiment,
                source: 'trigger-random-events',
                description: `Scandal: sentiment -20, media +40, morale -${moralePenalty}, rep ${repPenalty}.`,
              });

              console.log(`[${JOB_NAME}] Scandal: sentiment -20, media +40, morale -${moralePenalty}, rep ${repPenalty} for band ${bandMember.band_id}`);
            }
          }
        } catch (sentErr) {
          console.error(`[${JOB_NAME}] Error applying scandal sentiment:`, sentErr);
        }
      }
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

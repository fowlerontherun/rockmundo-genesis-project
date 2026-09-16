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
const TRIGGER_CHANCE = 6; // 1 in 6 chance (~16.7%)
const CRAVING_TRIGGER_CHANCE = 5; // 1 in 5 chance (20%) for addicted players
const DAY_MS = 24 * 60 * 60 * 1000;

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

    // Profiles are the character boundary. Keep user_id for auth/inbox compatibility,
    // but retain profile_id so band-gated events target the correct character/band.
    const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS).toISOString();
    const { data: activePlayers, error: playersError } = await supabase
      .from("profiles")
      .select("id, user_id, health, is_traveling")
      .gte("updated_at", thirtyDaysAgo);

    if (playersError) throw playersError;

    console.log(`[${JOB_NAME}] Found ${activePlayers?.length || 0} active profiles`);

    const { data: allEvents, error: eventsError } = await supabase
      .from("random_events")
      .select("*")
      .eq("is_active", true)
      .or("category.is.null,category.neq.addiction_craving");

    if (eventsError) throw eventsError;

    const { data: cravingEvents, error: cravingError } = await supabase
      .from("random_events")
      .select("*")
      .eq("is_active", true)
      .eq("category", "addiction_craving");

    if (cravingError) throw cravingError;

    console.log(`[${JOB_NAME}] Found ${allEvents?.length || 0} active events, ${cravingEvents?.length || 0} craving events`);

    if ((!allEvents || allEvents.length === 0) && (!cravingEvents || cravingEvents.length === 0)) {
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

    // Pre-fetch character band context so fame/fan-gated events are cheap to evaluate.
    const playerUserIds = [...new Set((activePlayers || []).map((p) => p.user_id).filter(Boolean))];
    const { data: memberRows, error: membersError } = playerUserIds.length > 0
      ? await supabase
          .from("band_members")
          .select("user_id, profile_id, band_id")
          .in("user_id", playerUserIds)
          .eq("is_touring_member", false)
      : { data: [], error: null };

    if (membersError) throw membersError;

    const memberByProfile = new Map<string, string>();
    const fallbackMemberByUser = new Map<string, string>();
    for (const member of memberRows || []) {
      if (member.profile_id) memberByProfile.set(member.profile_id, member.band_id);
      if (member.user_id && !fallbackMemberByUser.has(member.user_id)) {
        fallbackMemberByUser.set(member.user_id, member.band_id);
      }
    }

    const bandIds = [...new Set((memberRows || []).map((m) => m.band_id).filter(Boolean))];
    const { data: bandRows, error: bandsError } = bandIds.length > 0
      ? await supabase
          .from("bands")
          .select("id, morale, fame, total_fans, fan_sentiment_score, media_intensity, media_fatigue, reputation_score")
          .in("id", bandIds)
      : { data: [], error: null };

    if (bandsError) throw bandsError;

    const bandMap = new Map<string, any>();
    for (const band of bandRows || []) bandMap.set(band.id, band);

    // Pre-fetch released catalogue once. This is also used to attach a concrete
    // release to events such as film placements and back-catalogue rediscovery.
    const { data: releasedMusic, error: releasesError } = bandIds.length > 0
      ? await supabase
          .from("releases")
          .select("id, band_id, release_type, release_status, manufacturing_complete_at, created_at, hype_score, title")
          .in("band_id", bandIds)
          .eq("release_status", "released")
      : { data: [], error: null };

    if (releasesError) throw releasesError;

    const releasesByBand = new Map<string, any[]>();
    for (const release of releasedMusic || []) {
      const list = releasesByBand.get(release.band_id) || [];
      list.push(release);
      releasesByBand.set(release.band_id, list);
    }

    const resolveBand = (player: any) => {
      const bandId = memberByProfile.get(player.id) || fallbackMemberByUser.get(player.user_id);
      return bandId ? bandMap.get(bandId) || null : null;
    };

    const eligibleReleasesForEvent = (event: any, bandId?: string | null) => {
      if (!bandId) return [];
      const releases = releasesByBand.get(bandId) || [];
      return releases.filter((release) => {
        if (event.target_release_type && release.release_type !== event.target_release_type) return false;
        const releaseDate = release.manufacturing_complete_at || release.created_at;
        if (!releaseDate) return false;
        const ageDays = Math.max(0, (Date.now() - new Date(releaseDate).getTime()) / DAY_MS);
        if (event.release_age_min_days !== null && event.release_age_min_days !== undefined && ageDays < event.release_age_min_days) return false;
        if (event.release_age_max_days !== null && event.release_age_max_days !== undefined && ageDays > event.release_age_max_days) return false;
        return true;
      });
    };

    let eventsTriggered = 0;
    let playersProcessed = 0;

    for (const player of activePlayers || []) {
      playersProcessed++;

      // Keep one pending event per account, matching existing behaviour, while
      // storing profile_id on newly-triggered events for character-safe targeting.
      const { data: pendingEvents } = await supabase
        .from("player_events")
        .select("id")
        .eq("user_id", player.user_id)
        .in("status", ["pending_choice", "awaiting_outcome"])
        .limit(1);

      if (pendingEvents && pendingEvents.length > 0) continue;

      const { data: activeAddictions } = await supabase
        .from("player_addictions")
        .select("addiction_type")
        .eq("user_id", player.user_id)
        .eq("status", "active")
        .limit(1);

      const hasActiveAddiction = activeAddictions && activeAddictions.length > 0;
      const addictionType = hasActiveAddiction ? activeAddictions[0].addiction_type : null;

      if (hasActiveAddiction && cravingEvents && cravingEvents.length > 0) {
        const cravingRoll = Math.floor(Math.random() * CRAVING_TRIGGER_CHANCE) + 1;
        if (cravingRoll === 1) {
          const matchingCravings = cravingEvents.filter((event) => {
            try {
              const effects = typeof event.choice_a_effects === "string" ? JSON.parse(event.choice_a_effects) : event.choice_a_effects;
              return effects?.addiction_type === addictionType;
            } catch {
              return false;
            }
          });

          const eligibleCravings = matchingCravings.length > 0 ? matchingCravings : cravingEvents;
          const selectedCraving = eligibleCravings[Math.floor(Math.random() * eligibleCravings.length)];

          const { error: insertError } = await supabase.from("player_events").insert({
            user_id: player.user_id,
            profile_id: player.id,
            event_id: selectedCraving.id,
            status: "pending_choice",
          });

          if (!insertError) {
            eventsTriggered++;
            console.log(`[${JOB_NAME}] Triggered craving event "${selectedCraving.title}" for ${player.id}`);
            continue;
          }
        }
      }

      const playerBand = resolveBand(player);
      const playerMorale = playerBand?.morale ?? 50;
      let effectiveTriggerChance = TRIGGER_CHANCE;
      if (playerMorale <= 30) {
        effectiveTriggerChance = Math.round(TRIGGER_CHANCE - ((30 - playerMorale) / 30) * 9);
      } else if (playerMorale >= 75) {
        effectiveTriggerChance = Math.round(TRIGGER_CHANCE + ((playerMorale - 75) / 25) * 5);
      }
      effectiveTriggerChance = Math.max(3, Math.min(25, effectiveTriggerChance));

      const roll = Math.floor(Math.random() * effectiveTriggerChance) + 1;
      if (roll !== 1) continue;

      const { data: history } = await supabase
        .from("player_event_history")
        .select("event_id")
        .eq("user_id", player.user_id);

      const seenEventIds = new Set(history?.map((h) => h.event_id) || []);

      const GAME_EPOCH_MS = new Date("2026-01-01T00:00:00Z").getTime();
      const realDaysElapsed = Math.max(0, Math.floor((Date.now() - GAME_EPOCH_MS) / DAY_MS));
      const gameDaysElapsed = Math.floor((realDaysElapsed / 10) * 30);
      const remainingDays = gameDaysElapsed % (30 * 12);
      const currentGameMonth = Math.floor(remainingDays / 30) + 1;
      const currentSeason = currentGameMonth >= 3 && currentGameMonth <= 5 ? "spring"
        : currentGameMonth >= 6 && currentGameMonth <= 8 ? "summer"
        : currentGameMonth >= 9 && currentGameMonth <= 11 ? "autumn"
        : "winter";

      const eligibleEvents = (allEvents || []).filter((event) => {
        if (!event.is_common && seenEventIds.has(event.id)) return false;
        if (event.season && event.season !== currentSeason) return false;

        const playerHealth = player.health ?? 100;
        if (event.health_min !== null && playerHealth < event.health_min) return false;
        if (event.health_max !== null && playerHealth > event.health_max) return false;

        if (event.category === "travel_hazard" && !player.is_traveling) return false;

        const hasBandGate =
          event.band_fame_min !== null || event.band_fame_max !== null ||
          event.band_fans_min !== null || event.band_fans_max !== null ||
          event.requires_released_music || event.release_age_min_days !== null ||
          event.release_age_max_days !== null || !!event.target_release_type;

        if (hasBandGate && !playerBand) return false;

        if (playerBand) {
          const fame = Number(playerBand.fame || 0);
          const fans = Number(playerBand.total_fans || 0);
          if (event.band_fame_min !== null && fame < event.band_fame_min) return false;
          if (event.band_fame_max !== null && fame > event.band_fame_max) return false;
          if (event.band_fans_min !== null && fans < event.band_fans_min) return false;
          if (event.band_fans_max !== null && fans > event.band_fans_max) return false;

          if (event.requires_released_music || event.release_age_min_days !== null || event.release_age_max_days !== null || event.target_release_type) {
            if (eligibleReleasesForEvent(event, playerBand.id).length === 0) return false;
          }
        }

        return true;
      });

      if (eligibleEvents.length === 0) continue;

      const selectedEvent = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
      const releaseCandidates = playerBand ? eligibleReleasesForEvent(selectedEvent, playerBand.id) : [];
      const needsReleaseTarget =
        selectedEvent.requires_released_music || selectedEvent.release_age_min_days !== null ||
        selectedEvent.release_age_max_days !== null || !!selectedEvent.target_release_type;
      const selectedRelease = needsReleaseTarget && releaseCandidates.length > 0
        ? releaseCandidates[Math.floor(Math.random() * releaseCandidates.length)]
        : null;

      const { error: insertError } = await supabase.from("player_events").insert({
        user_id: player.user_id,
        profile_id: player.id,
        event_id: selectedEvent.id,
        target_release_id: selectedRelease?.id ?? null,
        status: "pending_choice",
      });

      if (insertError) {
        console.error(`[${JOB_NAME}] Failed to create event for ${player.id}:`, insertError);
        continue;
      }

      eventsTriggered++;
      console.log(`[${JOB_NAME}] Triggered event "${selectedEvent.title}" for ${player.id}${selectedRelease ? ` targeting release "${selectedRelease.title}"` : ""}`);

      if ((selectedEvent.category === "scandal" || selectedEvent.category === "controversy") && playerBand) {
        try {
          const curSentiment = playerBand.fan_sentiment_score ?? 0;
          const curIntensity = playerBand.media_intensity ?? 0;
          const curFatigue = playerBand.media_fatigue ?? 0;
          const curMorale = playerBand.morale ?? 50;
          const curRep = playerBand.reputation_score ?? 0;
          const newSentiment = Math.max(-100, curSentiment - 20);
          const moralePenalty = selectedEvent.category === "scandal" ? 12 : 8;
          const newMorale = Math.max(0, curMorale - moralePenalty);
          const repPenalty = selectedEvent.category === "scandal" ? -10 : -5;
          const newRep = Math.max(-100, curRep + repPenalty);

          await supabase.from("bands").update({
            fan_sentiment_score: newSentiment,
            media_intensity: Math.min(100, curIntensity + 40),
            media_fatigue: Math.min(100, curFatigue + 20),
            morale: newMorale,
            reputation_score: newRep,
          } as any).eq("id", playerBand.id);

          await supabase.from("band_sentiment_events").insert({
            band_id: playerBand.id,
            event_type: "scandal",
            sentiment_change: -20,
            media_intensity_change: 40,
            media_fatigue_change: 20,
            sentiment_after: newSentiment,
            source: "trigger-random-events",
            description: `Scandal: sentiment -20, media +40, morale -${moralePenalty}, rep ${repPenalty}.`,
          });
        } catch (sentErr) {
          console.error(`[${JOB_NAME}] Error applying scandal sentiment:`, sentErr);
        }
      }
    }

    console.log(`[${JOB_NAME}] Complete. Triggered ${eventsTriggered} events for ${playersProcessed} profiles`);

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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from "../_shared/job-logger.ts";

// Attribute-based learning speed multiplier
const MAX_ATTRIBUTE_VALUE = 1000;
const MAX_BONUS_MULTIPLIER = 0.5;

function calculateLearningMultiplier(skillSlug: string, attributes: Record<string, number> | null): number {
  if (!attributes) return 1.0;

  let relevantAttribute = 0;

  if (skillSlug.includes("instruments_") || skillSlug.includes("guitar") || skillSlug.includes("bass") || skillSlug.includes("keyboard")) {
    relevantAttribute = attributes.musical_ability ?? 0;
  } else if (skillSlug.includes("singing") || skillSlug.includes("vocal") || skillSlug.includes("rapping")) {
    relevantAttribute = attributes.vocal_talent ?? 0;
  } else if (skillSlug.includes("drums") || skillSlug.includes("percussion") || skillSlug.includes("beatmaking")) {
    relevantAttribute = attributes.rhythm_sense ?? 0;
  } else if (skillSlug.includes("songwriting_") || skillSlug.includes("lyrics") || skillSlug.includes("composing")) {
    relevantAttribute = attributes.creative_insight ?? 0;
  } else if (skillSlug.includes("production") || skillSlug.includes("mixing") || skillSlug.includes("daw")) {
    relevantAttribute = attributes.technical_mastery ?? 0;
  } else if (skillSlug.includes("stage_") || skillSlug.includes("showmanship") || skillSlug.includes("crowd")) {
    relevantAttribute = attributes.stage_presence ?? 0;
  } else if (skillSlug.includes("genres_")) {
    relevantAttribute = Math.max(attributes.musical_ability ?? 0, attributes.creative_insight ?? 0);
  }

  const bonus = (Math.min(relevantAttribute, MAX_ATTRIBUTE_VALUE) / MAX_ATTRIBUTE_VALUE) * MAX_BONUS_MULTIPLIER;
  return 1.0 + bonus;
}

async function getSkillMaxLevel(client: any, skillSlug: string): Promise<number> {
  const { data, error } = await client.rpc("progression_skill_max_level", {
    p_skill_slug: skillSlug,
  });
  if (error) throw error;
  const value = Number(data);
  return Number.isFinite(value) && value > 0 ? value : 20;
}

async function getRequiredSkillXp(client: any, level: number): Promise<number> {
  const { data, error } = await client.rpc("progression_skill_required_xp", {
    p_level: level,
  });
  if (error) throw error;
  const value = Number(data);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-triggered-by, x-cron-secret",
};

async function processAttendance(supabaseClient: any, profileId?: string) {
  console.log("Starting book reading attendance processing...");

  let sessionsQuery = supabaseClient
    .from("player_book_reading_sessions")
    .select(`
      *,
      skill_books (skill_slug, skill_percentage_gain, base_reading_days)
    `)
    .eq("status", "reading");
  if (profileId) sessionsQuery = sessionsQuery.eq("profile_id", profileId);
  const { data: sessions, error: sessionsError } = await sessionsQuery;

  if (sessionsError) throw sessionsError;

  console.log(`Found ${sessions?.length || 0} active reading sessions`);

  const today = new Date().toISOString().split("T")[0];
  const records: Array<Record<string, unknown>> = [];
  let processedCount = 0;
  let errorCount = 0;
  let totalXpAwarded = 0;

  for (const session of sessions || []) {
    try {
      const { data: existing } = await supabaseClient
        .from("player_book_reading_attendance")
        .select("id")
        .eq("reading_session_id", session.id)
        .eq("reading_date", today)
        .maybeSingle();

      if (existing) {
        console.log(`Attendance already recorded for session ${session.id}`);
        records.push({ session_id: session.id, reason: "already_recorded" });
        continue;
      }

      const book = session.skill_books;
      if (!book?.skill_slug) throw new Error("Book skill is missing");

      // Higher-tier and specialist books only award progress once their actual
      // prerequisite is met. skill_tier_unlocked is the canonical gate.
      const { data: tierUnlocked, error: tierError } = await supabaseClient.rpc("skill_tier_unlocked", {
        p_profile_id: session.profile_id,
        p_slug: book.skill_slug,
      });
      if (tierError) throw tierError;
      if (tierUnlocked === false) {
        console.log(`[Books] Skipping locked tier ${book.skill_slug} on profile ${session.profile_id}`);
        records.push({ session_id: session.id, error: "This book\u0027s skill prerequisites are not unlocked yet." });
        errorCount += 1;
        continue;
      }

      const totalDays = Math.max(1, Number(book.base_reading_days) || 1);
      const skillGainPercentage = Number(book.skill_percentage_gain) || 0;
      const maxLevel = await getSkillMaxLevel(supabaseClient, book.skill_slug);

      const { data: skillProgress } = await supabaseClient
        .from("skill_progress")
        .select("current_level, current_xp, required_xp")
        .eq("profile_id", session.profile_id)
        .eq("skill_slug", book.skill_slug)
        .maybeSingle();

      const { data: playerAttrs } = await supabaseClient
        .from("player_attributes")
        .select("musical_ability, vocal_talent, rhythm_sense, creative_insight, technical_mastery, stage_presence")
        .eq("profile_id", session.profile_id)
        .maybeSingle();

      const learningMultiplier = calculateLearningMultiplier(book.skill_slug, playerAttrs);
      console.log(`Learning multiplier for ${book.skill_slug}: ${learningMultiplier.toFixed(2)}x`);

      let currentLevel = Math.min(Math.max(Number(skillProgress?.current_level ?? 0), 0), maxLevel);
      const currentXp = Math.max(0, Number(skillProgress?.current_xp ?? 0));
      let requiredXp = Number(skillProgress?.required_xp ?? 0);
      if (currentLevel < maxLevel && requiredXp <= 0) {
        requiredXp = await getRequiredSkillXp(supabaseClient, currentLevel);
      }

      const totalSkillXp = currentLevel >= maxLevel
        ? 0
        : Math.round(requiredXp * skillGainPercentage);
      const baseXpPerDay = Math.round(totalSkillXp / totalDays);
      // Stable per session/day: retries must never reroll an XP reward.
      const bonusSeed = new TextEncoder().encode(`${session.id}:${today}:book-reading-v1`);
      const bonusDigest = new Uint8Array(await crypto.subtle.digest("SHA-256", bonusSeed));
      const randomBonus = (((bonusDigest[0] << 8) | bonusDigest[1]) % 200) + 1;
      const dailyXp = currentLevel >= maxLevel
        ? 0
        : Math.floor(Math.max(1, Math.min(200, baseXpPerDay + randomBonus)) * learningMultiplier);

      let remainingXp = currentXp + dailyXp;
      let newLevel = currentLevel;
      let newRequiredXp = requiredXp;

      while (newLevel < maxLevel && remainingXp >= newRequiredXp) {
        remainingXp -= newRequiredXp;
        newLevel += 1;
        newRequiredXp = newLevel < maxLevel
          ? await getRequiredSkillXp(supabaseClient, newLevel)
          : 0;
      }

      if (newLevel >= maxLevel) {
        newLevel = maxLevel;
        remainingXp = 0;
        newRequiredXp = 0;
      }

      // The RPC owns the attendance claim and every critical XP/progress write.
      // A failed RPC rolls back the whole day; no partial attendance can block retries.
      const { data: applied, error: applyError } = await supabaseClient.rpc("apply_book_reading_day", {
        p_session_id: session.id,
        p_reading_date: today,
        p_skill_slug: book.skill_slug,
        p_daily_xp: dailyXp,
        p_current_level: newLevel,
        p_current_xp: remainingXp,
        p_required_xp: newRequiredXp,
        p_total_days: totalDays,
        p_expected_level: Number(skillProgress?.current_level ?? 0),
        p_expected_xp: Number(skillProgress?.current_xp ?? 0),
      });
      if (applyError) {
        // Serialization failures mean another writer changed the skill after
        // our read. Do not reuse the stale XP calculation or reroll rewards.
        // A fresh request can recompute progression safely.
        if (applyError.code === "40001") {
          records.push({ session_id: session.id, reason: "progress_changed_retry", error: "Skill progress changed during reading. Please retry." });
          errorCount += 1;
          continue;
        }
        throw applyError;
      }
      if (applied?.reason) {
        records.push({ session_id: session.id, reason: applied.reason });
        continue;
      }
      const newDaysRead = Number(applied.days_read);
      const isComplete = applied.completed === true;
      totalXpAwarded += dailyXp;

      records.push({
        session_id: session.id,
        xp_awarded: dailyXp,
        days_read: newDaysRead,
        total_days: totalDays,
        completed: isComplete,
        skill_level: newLevel,
        skill_max_level: maxLevel,
      });

      // === BOOK READING → MORALE (v1.0.974) ===
      if (session.user_id) {
        try {
          const { data: bm } = await supabaseClient
            .from("band_members")
            .select("band_id")
            .eq("user_id", session.user_id)
            .eq("is_touring_member", false)
            .limit(1)
            .maybeSingle();
          if (bm?.band_id) {
            const { data: bd } = await supabaseClient
              .from("bands")
              .select("morale")
              .eq("id", bm.band_id)
              .single();
            if (bd) {
              const moraleBoost = isComplete ? 4 : 1;
              const newMorale = Math.min(100, ((bd as any).morale ?? 50) + moraleBoost);
              await supabaseClient.from("bands").update({ morale: newMorale } as any).eq("id", bm.band_id);
              if (isComplete) console.log(`Book completed morale boost: +${moraleBoost} for band ${bm.band_id}`);
              try {
                await supabaseClient.from("band_health_events").insert({
                  band_id: bm.band_id,
                  event_type: "morale",
                  delta: moraleBoost,
                  new_value: newMorale,
                  source: "book_reading",
                  description: isComplete ? "Finished reading a skill book" : "Daily book reading session",
                });
              } catch (_) {}
            }
          }
        } catch (_e) {
          // Non-critical morale integration.
        }
      }

      processedCount += 1;
      console.log(`Processed session ${session.id}: ${dailyXp} XP, day ${newDaysRead}/${totalDays}`);
    } catch (error: any) {
      console.error(`Error processing session ${session.id}:`, error);
      records.push({ session_id: session.id, error: error.message });
      errorCount += 1;
    }
  }

  console.log("Book reading attendance processing complete");
  return { records, processedCount, errorCount, totalXpAwarded };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null; manual?: boolean; profileId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get("x-triggered-by") ?? undefined;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Manual button presses must only process the authenticated player\u0027s active profile.
  // Scheduled jobs without a user token retain the existing all-session behaviour.
  const authorization = req.headers.get("authorization");
  let manualProfileId: string | undefined;
  if (payload?.manual !== true) {
    // Scheduled/global processing is privileged. The public anon key and
    // caller-supplied trigger metadata must never grant access to all profiles.
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const bearer = authorization?.replace(/^Bearer\\s+/i, "").trim();
    // Database cron cannot safely embed a service-role key. Reuse the
    // existing internal cron secret verifier, with the secret held in Vault.
    let cronAuthorized = false;
    const cronSecret = req.headers.get("x-cron-secret");
    if (cronSecret) {
      const { data, error } = await supabaseClient.rpc("verify_internal_cron_secret", {
        p_secret: cronSecret,
      });
      cronAuthorized = !error && data === true;
    }
    if ((!serviceRoleKey || bearer !== serviceRoleKey) && !cronAuthorized) {
      return new Response(JSON.stringify({ error: "Scheduled reading processing requires service authentication." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
  if (payload?.manual === true) {
    if (!authorization) return new Response(JSON.stringify({ error: "Please sign in again." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: auth, error: authError } = await supabaseClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
    if (authError || !auth.user) return new Response(JSON.stringify({ error: "Please sign in again." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!payload?.profileId) return new Response(JSON.stringify({ error: "Select an active player character before recording reading." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("id", payload.profileId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (profileError || !profile) return new Response(JSON.stringify({ error: "The selected player character could not be verified." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    manualProfileId = profile.id;
  }

  let runId: string | null = null;
  const startedAt = Date.now();

  try {
    runId = await startJobRun({
      jobName: "book-reading-attendance",
      functionName: "book-reading-attendance",
      supabaseClient,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    const { records, processedCount, errorCount, totalXpAwarded } = await processAttendance(supabaseClient, manualProfileId);

    await completeJobRun({
      jobName: "book-reading-attendance",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount,
      errorCount,
      resultSummary: { processedCount, errorCount, totalXpAwarded },
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        errors: errorCount,
        totalXpAwarded,
        results: records,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error in book-reading-attendance:", error);

    await failJobRun({
      jobName: "book-reading-attendance",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      error,
    });

    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});

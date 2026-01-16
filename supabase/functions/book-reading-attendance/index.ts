import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from "../_shared/job-logger.ts";

// Define MAX_SKILL_LEVEL locally (edge functions can't import from src/)
const MAX_SKILL_LEVEL = 100;

// Attribute-based learning speed multiplier
const MAX_ATTRIBUTE_VALUE = 1000;
const MAX_BONUS_MULTIPLIER = 0.5;

function calculateLearningMultiplier(skillSlug: string, attributes: Record<string, number> | null): number {
  if (!attributes) return 1.0;
  
  let relevantAttribute = 0;
  
  if (skillSlug.includes('instruments_') || skillSlug.includes('guitar') || skillSlug.includes('bass') || skillSlug.includes('keyboard')) {
    relevantAttribute = attributes.musical_ability ?? 0;
  } else if (skillSlug.includes('singing') || skillSlug.includes('vocal') || skillSlug.includes('rapping')) {
    relevantAttribute = attributes.vocal_talent ?? 0;
  } else if (skillSlug.includes('drums') || skillSlug.includes('percussion') || skillSlug.includes('beatmaking')) {
    relevantAttribute = attributes.rhythm_sense ?? 0;
  } else if (skillSlug.includes('songwriting_') || skillSlug.includes('lyrics') || skillSlug.includes('composing')) {
    relevantAttribute = attributes.creative_insight ?? 0;
  } else if (skillSlug.includes('production') || skillSlug.includes('mixing') || skillSlug.includes('daw')) {
    relevantAttribute = attributes.technical_mastery ?? 0;
  } else if (skillSlug.includes('stage_') || skillSlug.includes('showmanship') || skillSlug.includes('crowd')) {
    relevantAttribute = attributes.stage_presence ?? 0;
  } else if (skillSlug.includes('genres_')) {
    relevantAttribute = Math.max(attributes.musical_ability ?? 0, attributes.creative_insight ?? 0);
  }
  
  const bonus = (Math.min(relevantAttribute, MAX_ATTRIBUTE_VALUE) / MAX_ATTRIBUTE_VALUE) * MAX_BONUS_MULTIPLIER;
  return 1.0 + bonus;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-triggered-by",
};

async function processAttendance(supabaseClient: any) {
  console.log("Starting book reading attendance processing...");

  const { data: sessions, error: sessionsError } = await supabaseClient
    .from("player_book_reading_sessions")
    .select(`
      *,
      skill_books (skill_slug, skill_percentage_gain, base_reading_days)
    `)
    .eq("status", "reading");

  if (sessionsError) {
    throw sessionsError;
  }

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
        continue;
      }

      const book = session.skill_books;
      const totalDays = book.base_reading_days;
      const skillGainPercentage = Number(book.skill_percentage_gain);

      const { data: skillProgress } = await supabaseClient
        .from("skill_progress")
        .select("current_level, current_xp, required_xp")
        .eq("profile_id", session.profile_id)
        .eq("skill_slug", book.skill_slug)
        .maybeSingle();

      // Fetch player attributes for learning speed bonus
      const { data: playerAttrs } = await supabaseClient
        .from("player_attributes")
        .select("musical_ability, vocal_talent, rhythm_sense, creative_insight, technical_mastery, stage_presence")
        .eq("profile_id", session.profile_id)
        .single();

      const learningMultiplier = calculateLearningMultiplier(book.skill_slug, playerAttrs);
      console.log(`Learning multiplier for ${book.skill_slug}: ${learningMultiplier.toFixed(2)}x`);

      const currentLevel = Math.min(skillProgress?.current_level || 1, MAX_SKILL_LEVEL);
      const currentXp = skillProgress?.current_xp || 0;
      const requiredXp = skillProgress?.required_xp || 100;

      const totalSkillXp = Math.round(requiredXp * skillGainPercentage);
      const baseXpPerDay = Math.round(totalSkillXp / totalDays);
      const randomBonus = Math.floor(Math.random() * 200) + 1;
      const dailyXp = Math.floor(Math.max(1, Math.min(200, baseXpPerDay + randomBonus)) * learningMultiplier);
      totalXpAwarded += dailyXp;

      const { error: attendanceError } = await supabaseClient
        .from("player_book_reading_attendance")
        .insert({
          reading_session_id: session.id,
          reading_date: today,
          skill_xp_earned: dailyXp,
          was_locked_out: false,
        });

      if (attendanceError) {
        throw attendanceError;
      }

      const newXp = (skillProgress?.current_xp || 0) + dailyXp;
      let newLevel = currentLevel;
      let newRequiredXp = requiredXp;
      let remainingXp = newXp;

      while (newLevel < MAX_SKILL_LEVEL && remainingXp >= newRequiredXp) {
        remainingXp -= newRequiredXp;
        newLevel += 1;
        newRequiredXp = Math.floor(newRequiredXp * 1.5);
      }

      if (newLevel >= MAX_SKILL_LEVEL) {
        newLevel = MAX_SKILL_LEVEL;
        remainingXp = Math.min(remainingXp, currentXp);
      }

      const { error: skillError } = await supabaseClient
        .from("skill_progress")
        .upsert(
          {
            profile_id: session.profile_id,
            skill_slug: book.skill_slug,
            current_xp: remainingXp,
            current_level: newLevel,
            required_xp: newRequiredXp,
            last_practiced_at: new Date().toISOString(),
          },
          {
            onConflict: "profile_id,skill_slug",
          }
        );

      if (skillError) {
        throw skillError;
      }

      const newDaysRead = session.days_read + 1;
      const isComplete = newDaysRead >= totalDays;

      const { error: updateError } = await supabaseClient
        .from("player_book_reading_sessions")
        .update({
          days_read: newDaysRead,
          total_skill_xp_earned: session.total_skill_xp_earned + dailyXp,
          status: isComplete ? "completed" : "reading",
          actual_completion_date: isComplete ? new Date().toISOString() : null,
        })
        .eq("id", session.id);

      if (updateError) {
        throw updateError;
      }

      if (isComplete) {
        await supabaseClient
          .from("player_book_purchases")
          .update({ is_read: true })
          .eq("id", session.purchase_id);
      }

      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("experience")
        .eq("id", session.profile_id)
        .maybeSingle();

      if (profile) {
        await supabaseClient
          .from("profiles")
          .update({
            experience: (profile.experience || 0) + dailyXp,
          })
          .eq("id", session.profile_id);
      }

      await supabaseClient
        .from("experience_ledger")
        .insert({
          user_id: session.user_id,
          profile_id: session.profile_id,
          activity_type: "book_reading",
          skill_slug: book.skill_slug,
          xp_amount: dailyXp,
          metadata: {
            book_id: session.book_id,
            day: newDaysRead,
            total_days: totalDays,
            completed: isComplete,
          },
        });

      records.push({
        session_id: session.id,
        xp_awarded: dailyXp,
        days_read: newDaysRead,
        total_days: totalDays,
        completed: isComplete,
      });

      processedCount += 1;
      console.log(`Processed session ${session.id}: ${dailyXp} XP, day ${newDaysRead}/${totalDays}`);
    } catch (error: any) {
      console.error(`Error processing session ${session.id}:`, error);
      records.push({
        session_id: session.id,
        error: error.message,
      });
      errorCount += 1;
    }
  }

  console.log("Book reading attendance processing complete");
  return {
    records,
    processedCount,
    errorCount,
    totalXpAwarded,
  };
}

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
      jobName: "book-reading-attendance",
      functionName: "book-reading-attendance",
      supabaseClient,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    const { records, processedCount, errorCount, totalXpAwarded } = await processAttendance(supabaseClient);

    await completeJobRun({
      jobName: "book-reading-attendance",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount,
      errorCount,
      resultSummary: {
        processedCount,
        errorCount,
        totalXpAwarded,
      },
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
      }
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
      }
    );
  }
});

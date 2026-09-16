import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from "../_shared/job-logger.ts";

const MAX_ATTRIBUTE_VALUE = 1000;
const MAX_BONUS_MULTIPLIER = 0.5;
const REMOTE_LEARNING_XP_PENALTY = 0.10;
const CONNECTION_FAILURE_CHANCE = 0.25;
const CONNECTION_FAILURE_XP_PENALTY = 0.50;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-triggered-by",
};

interface Enrollment {
  id: string;
  profile_id: string;
  course_id: string;
  university_id: string;
  scheduled_end_date: string;
  status: string;
  days_attended: number;
  total_xp_earned: number;
}

interface Course {
  skill_slug: string;
  name?: string;
  xp_per_day_min: number;
  xp_per_day_max: number;
  class_start_hour?: number | null;
  class_end_hour?: number | null;
}

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

async function getRequiredXp(client: any, level: number): Promise<number> {
  const { data, error } = await client.rpc("progression_skill_required_xp", {
    p_level: level,
  });
  if (error) throw error;
  const value = Number(data);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

async function awardSkillXp(client: any, profileId: string, skillSlug: string, xpEarned: number) {
  const maxLevel = await getSkillMaxLevel(client, skillSlug);
  const { data: progress, error: progressError } = await client
    .from("skill_progress")
    .select("id, current_xp, current_level, required_xp")
    .eq("profile_id", profileId)
    .eq("skill_slug", skillSlug)
    .maybeSingle();

  if (progressError) throw progressError;

  let level = Math.min(Math.max(Number(progress?.current_level ?? 0), 0), maxLevel);
  let currentXp = Math.max(Number(progress?.current_xp ?? 0), 0);

  if (level >= maxLevel) return;

  currentXp += xpEarned;
  let requiredXp = Number(progress?.required_xp ?? 0) || await getRequiredXp(client, level);

  while (level < maxLevel && currentXp >= requiredXp) {
    currentXp -= requiredXp;
    level += 1;
    requiredXp = level < maxLevel ? await getRequiredXp(client, level) : 0;
  }

  if (level >= maxLevel) {
    level = maxLevel;
    currentXp = 0;
    requiredXp = 0;
  }

  const { error: upsertError } = await client
    .from("skill_progress")
    .upsert({
      profile_id: profileId,
      skill_slug: skillSlug,
      current_xp: currentXp,
      current_level: level,
      required_xp: requiredXp,
      last_practiced_at: new Date().toISOString(),
    }, { onConflict: "profile_id,skill_slug" });

  if (upsertError) throw upsertError;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get("x-triggered-by") ?? undefined;
  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  let runId: string | null = null;
  const startedAt = Date.now();
  let processedCount = 0;
  let skippedCount = 0;
  let remoteCount = 0;
  let connectionFailedCount = 0;
  let totalXpAwarded = 0;

  try {
    runId = await startJobRun({
      jobName: "university-attendance",
      functionName: "university-attendance",
      supabaseClient: client,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const { data: enrollments, error: enrollError } = await client
      .from("player_university_enrollments")
      .select("id, profile_id, course_id, university_id, scheduled_end_date, status, days_attended, total_xp_earned")
      .in("status", ["enrolled", "in_progress"])
      .eq("auto_attend", true)
      .returns<Enrollment[]>();

    if (enrollError) throw enrollError;

    for (const enrollment of enrollments ?? []) {
      try {
        const { data: existingAttendance } = await client
          .from("player_university_attendance")
          .select("id")
          .eq("enrollment_id", enrollment.id)
          .eq("attendance_date", today)
          .maybeSingle();
        if (existingAttendance) {
          skippedCount += 1;
          continue;
        }

        const { data: course, error: courseError } = await client
          .from("university_courses")
          .select("skill_slug, name, xp_per_day_min, xp_per_day_max, class_start_hour, class_end_hour")
          .eq("id", enrollment.course_id)
          .single<Course>();
        if (courseError || !course) throw courseError ?? new Error("University course not found");

        const { data: university, error: uniError } = await client
          .from("universities")
          .select("city")
          .eq("id", enrollment.university_id)
          .single();
        if (uniError) throw uniError;

        const { data: playerProfile, error: playerError } = await client
          .from("profiles")
          .select("current_city_id, user_id, experience, cities:current_city_id(name)")
          .eq("id", enrollment.profile_id)
          .single();
        if (playerError || !playerProfile) throw playerError ?? new Error("Profile not found");

        const playerCity = (playerProfile.cities as any)?.name ?? null;
        const universityCity = university?.city ?? null;
        const isRemote = Boolean(playerCity && universityCity && playerCity !== universityCity);

        if (isRemote) {
          const { data: activeActivity } = await client
            .from("player_scheduled_activities")
            .select("id")
            .eq("profile_id", enrollment.profile_id)
            .eq("status", "active")
            .lte("scheduled_start", now.toISOString())
            .gte("scheduled_end", now.toISOString())
            .maybeSingle();
          if (activeActivity) {
            skippedCount += 1;
            continue;
          }
        }

        const { data: unlocked, error: unlockError } = await client.rpc("skill_tier_unlocked", {
          p_profile_id: enrollment.profile_id,
          p_slug: course.skill_slug,
        });
        if (unlockError) throw unlockError;
        if (unlocked === false) {
          skippedCount += 1;
          continue;
        }

        const { data: playerAttrs } = await client
          .from("player_attributes")
          .select("musical_ability, vocal_talent, rhythm_sense, creative_insight, technical_mastery, stage_presence")
          .eq("profile_id", enrollment.profile_id)
          .maybeSingle();

        const learningMultiplier = calculateLearningMultiplier(course.skill_slug, playerAttrs);
        const minXp = Math.max(1, Number(course.xp_per_day_min ?? 1));
        const maxXp = Math.max(minXp, Number(course.xp_per_day_max ?? minXp));
        const baseXp = Math.floor(Math.random() * (maxXp - minXp + 1) + minXp);
        let xpEarned = Math.max(1, Math.floor(baseXp * learningMultiplier));
        let connectionFailed = false;

        if (isRemote) {
          remoteCount += 1;
          xpEarned = Math.max(1, Math.floor(xpEarned * (1 - REMOTE_LEARNING_XP_PENALTY)));
          if (Math.random() < CONNECTION_FAILURE_CHANCE) {
            connectionFailed = true;
            connectionFailedCount += 1;
            xpEarned = Math.max(1, Math.floor(xpEarned * CONNECTION_FAILURE_XP_PENALTY));
          }
        }

        const { error: attendanceError } = await client
          .from("player_university_attendance")
          .insert({
            enrollment_id: enrollment.id,
            attendance_date: today,
            xp_earned: xpEarned,
            was_locked_out: false,
            was_remote: isRemote,
            connection_failed: connectionFailed,
          });
        if (attendanceError) throw attendanceError;

        const newDaysAttended = Number(enrollment.days_attended ?? 0) + 1;
        const isCompleted = new Date(enrollment.scheduled_end_date) <= now;
        const { error: enrollmentError } = await client
          .from("player_university_enrollments")
          .update({
            status: isCompleted ? "completed" : "in_progress",
            days_attended: newDaysAttended,
            total_xp_earned: Number(enrollment.total_xp_earned ?? 0) + xpEarned,
            actual_completion_date: isCompleted ? now.toISOString() : null,
          })
          .eq("id", enrollment.id);
        if (enrollmentError) throw enrollmentError;

        await awardSkillXp(client, enrollment.profile_id, course.skill_slug, xpEarned);

        await client
          .from("profiles")
          .update({ experience: Number(playerProfile.experience ?? 0) + xpEarned })
          .eq("id", enrollment.profile_id);

        await client.from("experience_ledger").insert({
          user_id: playerProfile.user_id,
          profile_id: enrollment.profile_id,
          activity_type: "university_attendance",
          xp_amount: xpEarned,
          skill_slug: course.skill_slug,
          metadata: {
            enrollment_id: enrollment.id,
            completed: isCompleted,
            was_remote: isRemote,
            connection_failed: connectionFailed,
          },
        });

        const classStart = new Date(now);
        classStart.setHours(course.class_start_hour || 10, 0, 0, 0);
        const classEnd = new Date(now);
        classEnd.setHours(course.class_end_hour || 14, 0, 0, 0);
        const dayStart = new Date(classStart);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const { data: existingSchedule } = await client
          .from("player_scheduled_activities")
          .select("id")
          .eq("profile_id", enrollment.profile_id)
          .eq("activity_type", "university")
          .gte("scheduled_start", dayStart.toISOString())
          .lt("scheduled_start", dayEnd.toISOString())
          .maybeSingle();

        if (!existingSchedule) {
          await client.from("player_scheduled_activities").insert({
            user_id: playerProfile.user_id,
            profile_id: enrollment.profile_id,
            activity_type: "university",
            title: `University: ${course.name ?? "Course"}`,
            scheduled_start: classStart.toISOString(),
            scheduled_end: classEnd.toISOString(),
            status: "completed",
            metadata: {
              enrollment_id: enrollment.id,
              course_id: enrollment.course_id,
              xp_earned: xpEarned,
              auto_attended: true,
              was_remote: isRemote,
              connection_failed: connectionFailed,
            },
          });
        }

        if (playerProfile.user_id) {
          const { data: membership } = await client
            .from("band_members")
            .select("band_id")
            .eq("user_id", playerProfile.user_id)
            .eq("is_touring_member", false)
            .limit(1)
            .maybeSingle();
          if (membership?.band_id) {
            const { data: band } = await client
              .from("bands")
              .select("morale")
              .eq("id", membership.band_id)
              .single();
            if (band) {
              const moraleBoost = isCompleted ? 5 : 1;
              const newMorale = Math.min(100, Number((band as any).morale ?? 50) + moraleBoost);
              await client.from("bands").update({ morale: newMorale } as any).eq("id", membership.band_id);
              await client.from("band_health_events").insert({
                band_id: membership.band_id,
                event_type: "morale",
                delta: moraleBoost,
                new_value: newMorale,
                source: "university",
                description: isCompleted ? "University course graduated" : "University class attended",
              });
            }
          }
        }

        processedCount += 1;
        totalXpAwarded += xpEarned;
      } catch (enrollmentError) {
        console.error(`[university-attendance] Failed enrollment ${enrollment.id}`, enrollmentError);
        skippedCount += 1;
      }
    }

    await completeJobRun({
      jobName: "university-attendance",
      runId,
      supabaseClient: client,
      durationMs: Date.now() - startedAt,
      processedCount,
      resultSummary: {
        processedCount,
        skippedCount,
        remoteCount,
        connectionFailedCount,
        totalXpAwarded,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      skipped: skippedCount,
      remote: remoteCount,
      connectionFailed: connectionFailedCount,
      totalXpAwarded,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[university-attendance] Fatal error", error);
    await failJobRun({
      jobName: "university-attendance",
      runId,
      supabaseClient: client,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: {
        processedCount,
        skippedCount,
        remoteCount,
        connectionFailedCount,
        totalXpAwarded,
      },
    });

    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

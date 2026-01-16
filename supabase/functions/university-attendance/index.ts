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

interface Enrollment {
  id: string;
  profile_id: string;
  course_id: string;
  scheduled_end_date: string;
  status: string;
  days_attended: number;
  total_xp_earned: number;
}

interface Course {
  skill_slug: string;
  xp_per_day_min: number;
  xp_per_day_max: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get("x-triggered-by") ?? undefined;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      auth: {
        persistSession: false,
      },
    }
  );

  let runId: string | null = null;
  const startedAt = Date.now();

  let processedCount = 0;
  let skippedCount = 0;
  let totalXpAwarded = 0;

  try {
    console.log(`=== University Auto-Attendance Started at ${new Date().toISOString()} ===`);

    runId = await startJobRun({
      jobName: "university-attendance",
      functionName: "university-attendance",
      supabaseClient,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    console.log(`Processing attendance for date: ${today}`);

    // Find active enrollments with auto_attend enabled
    const { data: enrollments, error: enrollError } = await supabaseClient
      .from("player_university_enrollments")
      .select("id, profile_id, course_id, scheduled_end_date, status, days_attended, total_xp_earned")
      .in("status", ["enrolled", "in_progress"])
      .eq("auto_attend", true)
      .returns<Enrollment[]>();

    if (enrollError) {
      console.error('Error fetching enrollments:', enrollError);
      throw enrollError;
    }

    console.log(`Found ${enrollments?.length || 0} enrollments with auto_attend=true`);

    for (const enrollment of enrollments || []) {
      console.log(`\n--- Processing enrollment ${enrollment.id} for profile ${enrollment.profile_id} ---`);
      
      // Check if already attended today
      const { data: existingAttendance } = await supabaseClient
        .from("player_university_attendance")
        .select("id")
        .eq("enrollment_id", enrollment.id)
        .eq("attendance_date", today)
        .single();

      if (existingAttendance) {
        console.log(`Already attended today for enrollment ${enrollment.id}, skipping`);
        skippedCount++;
        continue;
      }

      // Get course details
      const { data: course, error: courseError } = await supabaseClient
        .from("university_courses")
        .select("skill_slug, xp_per_day_min, xp_per_day_max")
        .eq("id", enrollment.course_id)
        .single<Course>();

      if (courseError) {
        console.error(`Error fetching course: ${courseError.message}`);
        continue;
      }

      // Fetch player attributes for learning speed bonus
      const { data: playerAttrs } = await supabaseClient
        .from("player_attributes")
        .select("musical_ability, vocal_talent, rhythm_sense, creative_insight, technical_mastery, stage_presence")
        .eq("profile_id", enrollment.profile_id)
        .single();

      const learningMultiplier = calculateLearningMultiplier(course.skill_slug, playerAttrs);
      console.log(`Learning multiplier for ${course.skill_slug}: ${learningMultiplier.toFixed(2)}x`);

      console.log(`Course XP range: ${course.xp_per_day_min}-${course.xp_per_day_max}`);

      // Random XP between min and max, then apply learning multiplier
      const baseXp = Math.floor(
        Math.random() * (course.xp_per_day_max - course.xp_per_day_min + 1) +
          course.xp_per_day_min
      );
      const xpEarned = Math.floor(baseXp * learningMultiplier);

      console.log(`Generated XP: ${baseXp} base * ${learningMultiplier.toFixed(2)} = ${xpEarned}`);
      totalXpAwarded += xpEarned;

      // Create attendance record - set was_locked_out to false so activity feed logs it
      console.log('Creating attendance record...');
      const { error: attendanceError } = await supabaseClient
        .from("player_university_attendance")
        .insert({
          enrollment_id: enrollment.id,
          attendance_date: today,
          xp_earned: xpEarned,
          was_locked_out: false, // Changed to false so activity feed trigger fires
        });

      if (attendanceError) {
        console.error(`Error creating attendance: ${attendanceError.message}`);
        continue;
      }
      
      console.log('Attendance record created successfully');

      // Update enrollment
      const newDaysAttended = enrollment.days_attended + 1;
      const newTotalXp = enrollment.total_xp_earned + xpEarned;
      const isCompleted = new Date(enrollment.scheduled_end_date) <= now;

      const { error: updateError } = await supabaseClient
        .from("player_university_enrollments")
        .update({
          status: isCompleted ? "completed" : "in_progress",
          days_attended: newDaysAttended,
          total_xp_earned: newTotalXp,
          actual_completion_date: isCompleted ? now.toISOString() : null,
        })
        .eq("id", enrollment.id);

      if (updateError) {
        console.error(`Error updating enrollment: ${updateError.message}`);
        continue;
      }

      // Award XP to skill and player
      const { data: skillProgress } = await supabaseClient
        .from("skill_progress")
        .select("id, current_xp, current_level, required_xp")
        .eq("profile_id", enrollment.profile_id)
        .eq("skill_slug", course.skill_slug)
        .single();

      if (skillProgress) {
        let newCurrentXp = skillProgress.current_xp + xpEarned;
        let newLevel = Math.min(skillProgress.current_level, MAX_SKILL_LEVEL);
        let newRequiredXp = skillProgress.required_xp;

        // Handle multiple level-ups
        while (newLevel < MAX_SKILL_LEVEL && newCurrentXp >= newRequiredXp) {
          newCurrentXp -= newRequiredXp;
          newLevel += 1;
          newRequiredXp = Math.floor(newRequiredXp * 1.5);
        }

        if (newLevel >= MAX_SKILL_LEVEL) {
          newLevel = MAX_SKILL_LEVEL;
          newCurrentXp = Math.min(newCurrentXp, skillProgress.current_xp);
        }

        await supabaseClient
          .from("skill_progress")
          .update({
            current_xp: newCurrentXp,
            current_level: newLevel,
            required_xp: newRequiredXp,
            last_practiced_at: now.toISOString(),
          })
          .eq("id", skillProgress.id);
      } else {
        // Create new skill progress with multi-level handling
        let newCurrentXp = xpEarned;
        let newLevel = 0;
        let newRequiredXp = 100;

        while (newLevel < MAX_SKILL_LEVEL && newCurrentXp >= newRequiredXp) {
          newCurrentXp -= newRequiredXp;
          newLevel += 1;
          newRequiredXp = Math.floor(newRequiredXp * 1.5);
        }

        if (newLevel >= MAX_SKILL_LEVEL) {
          newLevel = MAX_SKILL_LEVEL;
          newCurrentXp = Math.min(newCurrentXp, newRequiredXp);
        }

        await supabaseClient.from("skill_progress").upsert({
          profile_id: enrollment.profile_id,
          skill_slug: course.skill_slug,
          current_xp: newCurrentXp,
          current_level: newLevel,
          required_xp: newRequiredXp,
          last_practiced_at: now.toISOString(),
        }, { onConflict: 'profile_id,skill_slug' });
      }

      // Update player profile XP and log to experience ledger
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("experience, user_id")
        .eq("id", enrollment.profile_id)
        .single();

      if (profile) {
        await supabaseClient
          .from("profiles")
          .update({
            experience: (profile.experience || 0) + xpEarned,
          })
          .eq("id", enrollment.profile_id);

        // Log to experience ledger
        await supabaseClient.from("experience_ledger").insert({
          user_id: profile.user_id,
          profile_id: enrollment.profile_id,
          activity_type: "university_attendance",
          xp_amount: xpEarned,
          skill_slug: course.skill_slug,
          metadata: {
            enrollment_id: enrollment.id,
            completed: isCompleted,
          },
        });

        // Create player_scheduled_activities entry to block the player's schedule
        // Fetch course with class hours
        const { data: courseWithHours } = await supabaseClient
          .from("university_courses")
          .select("name, class_start_hour, class_end_hour")
          .eq("id", enrollment.course_id)
          .single();

        if (courseWithHours) {
          const classStart = new Date(now);
          classStart.setHours(courseWithHours.class_start_hour || 10, 0, 0, 0);
          const classEnd = new Date(now);
          classEnd.setHours(courseWithHours.class_end_hour || 14, 0, 0, 0);

          // Check if schedule entry already exists for today
          const { data: existingSchedule } = await supabaseClient
            .from("player_scheduled_activities")
            .select("id")
            .eq("user_id", profile.user_id)
            .eq("activity_type", "university")
            .gte("scheduled_start", classStart.toISOString().split('T')[0])
            .lt("scheduled_start", new Date(classStart.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .single();

          if (!existingSchedule) {
            await supabaseClient
              .from("player_scheduled_activities")
              .insert({
                user_id: profile.user_id,
                profile_id: enrollment.profile_id,
                activity_type: 'university',
                title: `University: ${courseWithHours.name}`,
                scheduled_start: classStart.toISOString(),
                scheduled_end: classEnd.toISOString(),
                status: 'completed', // Already attended via auto-attend
                metadata: {
                  enrollment_id: enrollment.id,
                  course_id: enrollment.course_id,
                  xp_earned: xpEarned,
                  auto_attended: true,
                },
              });
            console.log(`Created schedule entry for auto-attended class: ${courseWithHours.name}`);
          }
        }
      }

      processedCount++;
      console.log(
        `✓ Completed enrollment ${enrollment.id}: ${xpEarned} XP, days: ${newDaysAttended}, completed: ${isCompleted}`
      );
    }

    console.log(`\n=== University Auto-Attendance Complete ===`);
    console.log(`Processed: ${processedCount}, Skipped: ${skippedCount}`);

    await completeJobRun({
      jobName: "university-attendance",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount,
      resultSummary: {
        processedCount,
        skippedCount,
        totalXpAwarded,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        skipped: skippedCount,
        totalXpAwarded,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);

    await failJobRun({
      jobName: "university-attendance",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: {
        processedCount,
        skippedCount,
        totalXpAwarded,
      },
    });

    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

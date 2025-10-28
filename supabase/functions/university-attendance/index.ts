import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

  try {
    console.log(`=== University Auto-Attendance Started at ${new Date().toISOString()} ===`);
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

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

    let processedCount = 0;
    let skippedCount = 0;

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

      console.log(`Course XP range: ${course.xp_per_day_min}-${course.xp_per_day_max}`);

      // Random XP between min and max
      const xpEarned = Math.floor(
        Math.random() * (course.xp_per_day_max - course.xp_per_day_min + 1) +
          course.xp_per_day_min
      );
      
      console.log(`Generated XP: ${xpEarned}`);

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
        let newLevel = skillProgress.current_level;
        let newRequiredXp = skillProgress.required_xp;

        // Handle multiple level-ups
        while (newCurrentXp >= newRequiredXp) {
          newCurrentXp -= newRequiredXp;
          newLevel += 1;
          newRequiredXp = Math.floor(newRequiredXp * 1.5);
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
        
        while (newCurrentXp >= newRequiredXp) {
          newCurrentXp -= newRequiredXp;
          newLevel += 1;
          newRequiredXp = Math.floor(newRequiredXp * 1.5);
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
      }

      processedCount++;
      console.log(
        `✓ Completed enrollment ${enrollment.id}: ${xpEarned} XP, days: ${newDaysAttended}, completed: ${isCompleted}`
      );
    }

    console.log(`\n=== University Auto-Attendance Complete ===`);
    console.log(`Processed: ${processedCount}, Skipped: ${skippedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: enrollments?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

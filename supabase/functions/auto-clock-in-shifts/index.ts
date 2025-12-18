import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  startJobRun,
  completeJobRun,
  failJobRun,
  type Json,
} from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Employment {
  id: string;
  profile_id: string;
  job_id: string;
  auto_clock_in: boolean;
  profiles: {
    id: string;
    user_id: string;
    current_city_id: string | null;
    health: number;
    energy: number;
  };
  jobs: {
    id: string;
    title: string;
    city_id: string | null;
    work_days: string[];
    start_time: string;
    end_time: string;
    hourly_wage: number;
    health_impact_per_shift: number;
    fame_impact_per_shift: number;
    energy_cost_per_shift: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const jobName = "auto-clock-in-shifts";
  const startTime = Date.now();
  let runId: string | null = null;
  let processedCount = 0;
  let errorCount = 0;
  const results: Json[] = [];

  try {
    runId = await startJobRun({
      jobName,
      functionName: jobName,
      supabaseClient: supabase,
      triggeredBy: "cron",
    });

    console.log(`[${jobName}] Starting auto-clock-in check...`);

    // Get current day and time
    const now = new Date();
    const currentDay = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    console.log(`[${jobName}] Current: ${currentDay} ${currentHour}:${currentMinute}`);

    // Get all employed players with auto_clock_in enabled
    const { data: employments, error: empError } = await supabase
      .from("player_employment")
      .select(`
        id,
        profile_id,
        job_id,
        auto_clock_in,
        profiles!player_employment_profile_id_fkey (
          id,
          user_id,
          current_city_id,
          health,
          energy
        ),
        jobs (
          id,
          title,
          city_id,
          work_days,
          start_time,
          end_time,
          hourly_wage,
          health_impact_per_shift,
          fame_impact_per_shift,
          energy_cost_per_shift
        )
      `)
      .eq("status", "employed")
      .eq("auto_clock_in", true);

    if (empError) {
      throw new Error(`Failed to fetch employments: ${empError.message}`);
    }

    console.log(`[${jobName}] Found ${employments?.length || 0} employees with auto_clock_in`);

    for (const emp of (employments || []) as unknown as Employment[]) {
      try {
        const profile = emp.profiles;
        const job = emp.jobs;

        if (!profile || !job) {
          console.log(`[${jobName}] Skipping emp ${emp.id}: missing profile or job`);
          continue;
        }

        // Check if today is a work day
        const workDays = Array.isArray(job.work_days) ? job.work_days : [];
        if (!workDays.includes(currentDay)) {
          console.log(`[${jobName}] ${profile.id}: Not a work day (${currentDay})`);
          continue;
        }

        // Check if shift is starting within 15 minutes
        const [startHour, startMin] = job.start_time.split(":").map(Number);
        const shiftStartMinutes = startHour * 60 + startMin;
        const minutesUntilShift = shiftStartMinutes - currentTimeMinutes;

        if (minutesUntilShift < 0 || minutesUntilShift > 15) {
          console.log(`[${jobName}] ${profile.id}: Not shift time (${minutesUntilShift} mins away)`);
          continue;
        }

        // Check if player is in the correct city
        if (job.city_id && job.city_id !== profile.current_city_id) {
          console.log(`[${jobName}] ${profile.id}: Not in job city`);
          results.push({ profile_id: profile.id, status: "skipped", reason: "not_in_city" });
          continue;
        }

        // Check health and energy
        if ((profile.health || 100) < 20) {
          console.log(`[${jobName}] ${profile.id}: Health too low (${profile.health})`);
          results.push({ profile_id: profile.id, status: "skipped", reason: "low_health" });
          continue;
        }

        if ((profile.energy || 100) < 10) {
          console.log(`[${jobName}] ${profile.id}: Energy too low (${profile.energy})`);
          results.push({ profile_id: profile.id, status: "skipped", reason: "low_energy" });
          continue;
        }

        // Check for conflicting activities
        const { data: activeActivities } = await supabase
          .from("profile_activity_statuses")
          .select("id, activity_type")
          .eq("profile_id", profile.id)
          .eq("status", "active")
          .limit(1);

        if (activeActivities && activeActivities.length > 0) {
          console.log(`[${jobName}] ${profile.id}: Has active activity (${activeActivities[0].activity_type})`);
          results.push({ profile_id: profile.id, status: "skipped", reason: "conflicting_activity" });
          continue;
        }

        // Check if already worked today
        const today = now.toISOString().split("T")[0];
        const { data: todayShift } = await supabase
          .from("shift_history")
          .select("id")
          .eq("profile_id", profile.id)
          .eq("job_id", job.id)
          .eq("shift_date", today)
          .limit(1);

        if (todayShift && todayShift.length > 0) {
          console.log(`[${jobName}] ${profile.id}: Already worked today`);
          results.push({ profile_id: profile.id, status: "skipped", reason: "already_worked_today" });
          continue;
        }

        // All checks passed - clock in the player
        const [endHour, endMin] = job.end_time.split(":").map(Number);
        const hours = (endHour + endMin / 60) - (startHour + startMin / 60);
        const earnings = Math.round(job.hourly_wage * hours);

        // Create shift history
        const { data: shift, error: shiftError } = await supabase
          .from("shift_history")
          .insert({
            employment_id: emp.id,
            profile_id: profile.id,
            job_id: job.id,
            shift_date: today,
            clock_in_time: now.toISOString(),
            earnings: earnings,
            health_impact: job.health_impact_per_shift,
            fame_impact: job.fame_impact_per_shift,
            xp_earned: Math.round(earnings / 10),
            status: "in_progress",
          })
          .select()
          .single();

        if (shiftError) {
          throw new Error(`Failed to create shift: ${shiftError.message}`);
        }

        // Create activity status
        const endTime = new Date(now);
        endTime.setHours(endHour, endMin, 0, 0);

        const { error: statusError } = await supabase
          .from("profile_activity_statuses")
          .insert({
            profile_id: profile.id,
            activity_type: "work_shift",
            status: "active",
            started_at: now.toISOString(),
            ends_at: endTime.toISOString(),
            metadata: {
              job_id: job.id,
              shift_history_id: shift.id,
              earnings_pending: earnings,
              auto_clocked_in: true,
            },
          });

        if (statusError) {
          throw new Error(`Failed to create activity status: ${statusError.message}`);
        }

        // Apply health/energy drain
        const newHealth = Math.max(0, (profile.health || 100) + (job.health_impact_per_shift || 0));
        const newEnergy = Math.max(0, (profile.energy || 100) - (job.energy_cost_per_shift || 0));
        
        await supabase
          .from("profiles")
          .update({ health: newHealth, energy: newEnergy })
          .eq("id", profile.id);

        console.log(`[${jobName}] ✓ Auto-clocked in ${profile.id} at ${job.title}`);
        results.push({
          profile_id: profile.id,
          status: "clocked_in",
          job: job.title,
          earnings: earnings,
        });
        processedCount++;
      } catch (empErr) {
        console.error(`[${jobName}] Error processing ${emp.id}:`, empErr);
        errorCount++;
        results.push({
          profile_id: emp.profile_id,
          status: "error",
          error: String(empErr),
        });
      }
    }

    const durationMs = Date.now() - startTime;
    await completeJobRun({
      jobName,
      runId,
      supabaseClient: supabase,
      durationMs,
      processedCount,
      errorCount,
      resultSummary: { results },
    });

    console.log(`[${jobName}] Completed: ${processedCount} clocked in, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        errors: errorCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[${jobName}] Fatal error:`, error);
    
    await failJobRun({
      jobName,
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startTime,
      processedCount,
      errorCount,
      error,
    });

    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

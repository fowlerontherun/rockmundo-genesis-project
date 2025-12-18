import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startJobRun, completeJobRun, failJobRun, getErrorMessage } from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CELLMATE_NAMES = [
  "Big Tony", "Silent Mike", "The Professor", "Guitar Pete", "Harmonica Joe",
  "Rhythm Rick", "Sax Sam", "Piano Paul", "Bass Bill", "Drum Dave"
];

const CELLMATE_SKILLS = [
  { skill: "songwriting", bonus: 5 },
  { skill: "guitar", bonus: 5 },
  { skill: "vocals", bonus: 5 },
  { skill: "performance", bonus: 3 },
  { skill: "creativity", bonus: 5 }
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const runId = await startJobRun({
    jobName: "community-service-check",
    functionName: "community-service-check",
    supabaseClient: supabase,
  });

  try {
    console.log("[community-service-check] Starting community service check...");
    
    let completedCount = 0;
    let failedCount = 0;

    const now = new Date();

    // Get all active community service assignments
    const { data: assignments, error: assignError } = await supabase
      .from("community_service_assignments")
      .select("*")
      .eq("status", "active");

    if (assignError) throw assignError;
    console.log(`[community-service-check] Processing ${assignments?.length || 0} active assignments`);

    for (const assignment of assignments || []) {
      const deadline = new Date(assignment.deadline);

      // Check if assignment is complete
      if (assignment.completed_sessions >= assignment.required_busking_sessions) {
        await supabase
          .from("community_service_assignments")
          .update({ status: "completed" })
          .eq("id", assignment.id);

        // Clear debt
        await supabase
          .from("profiles")
          .update({ cash: 0, debt_started_at: null })
          .eq("user_id", assignment.user_id);

        await supabase.from("activity_feed").insert({
          user_id: assignment.user_id,
          activity_type: "community_service_completed",
          message: `✅ Community service completed! Your $${assignment.debt_amount} debt has been cleared with no criminal record.`,
          metadata: { sessions_completed: assignment.completed_sessions }
        });

        completedCount++;
        console.log(`[community-service-check] User ${assignment.user_id} completed community service`);
      }
      // Check if deadline has passed
      else if (now > deadline) {
        await supabase
          .from("community_service_assignments")
          .update({ status: "failed" })
          .eq("id", assignment.id);

        // Get player's current city for prison assignment
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, current_city_id, total_imprisonments")
          .eq("user_id", assignment.user_id)
          .single();

        // Find a prison
        let prisonId: string | null = null;
        if (profile?.current_city_id) {
          const { data: cityPrison } = await supabase
            .from("prisons")
            .select("id")
            .eq("city_id", profile.current_city_id)
            .limit(1)
            .single();
          prisonId = cityPrison?.id;
        }

        if (!prisonId) {
          const { data: anyPrison } = await supabase
            .from("prisons")
            .select("id")
            .limit(1)
            .single();
          prisonId = anyPrison?.id;
        }

        if (prisonId) {
          // Extended sentence for failing community service
          const sentenceDays = Math.min(14, 3 + Math.floor(assignment.debt_amount / 10000) + 3);
          const releaseDate = new Date();
          releaseDate.setDate(releaseDate.getDate() + sentenceDays);

          const cellmateName = CELLMATE_NAMES[Math.floor(Math.random() * CELLMATE_NAMES.length)];
          const cellmateSkill = CELLMATE_SKILLS[Math.floor(Math.random() * CELLMATE_SKILLS.length)];

          await supabase.from("player_imprisonments").insert({
            user_id: assignment.user_id,
            prison_id: prisonId,
            original_sentence_days: sentenceDays,
            remaining_sentence_days: sentenceDays,
            release_date: releaseDate.toISOString(),
            debt_amount_cleared: assignment.debt_amount,
            reason: "community_service_failure",
            status: "imprisoned",
            behavior_score: 40, // Lower starting score for failing CS
            bail_amount: Math.floor(assignment.debt_amount * 0.5) + (sentenceDays * 500),
            cellmate_name: cellmateName,
            cellmate_skill: cellmateSkill.skill,
            cellmate_skill_bonus: cellmateSkill.bonus
          });

          await supabase
            .from("profiles")
            .update({
              cash: 0,
              debt_started_at: null,
              is_imprisoned: true,
              total_imprisonments: (profile?.total_imprisonments || 0) + 1
            })
            .eq("user_id", assignment.user_id);

          await supabase.from("activity_feed").insert({
            user_id: assignment.user_id,
            activity_type: "community_service_failed",
            message: `❌ Community service failed! Only ${assignment.completed_sessions}/${assignment.required_busking_sessions} sessions completed. Sentenced to ${sentenceDays} days in prison.`,
            metadata: {
              sessions_completed: assignment.completed_sessions,
              sessions_required: assignment.required_busking_sessions,
              sentence_days: sentenceDays
            }
          });

          failedCount++;
          console.log(`[community-service-check] User ${assignment.user_id} failed community service, imprisoned for ${sentenceDays} days`);
        }
      }
    }

    await completeJobRun({
      jobName: "community-service-check",
      runId: runId!,
      supabaseClient: supabase,
      processedCount: assignments?.length || 0,
      details: { completedCount, failedCount }
    });

    return new Response(
      JSON.stringify({
        success: true,
        assignmentsProcessed: assignments?.length || 0,
        completedCount,
        failedCount
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[community-service-check] Error:", error);
    await failJobRun({
      jobName: "community-service-check",
      runId: runId!,
      supabaseClient: supabase,
      error
    });
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startJobRun, completeJobRun, failJobRun, getErrorMessage } from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CELLMATE_NAMES = [
  "Big Tony", "Silent Mike", "The Professor", "Guitar Pete", "Harmonica Joe",
  "Rhythm Rick", "Sax Sam", "Piano Paul", "Bass Bill", "Drum Dave",
  "Blues Bobby", "Jazz Jack", "Rock Randy", "Folk Fred", "Soul Steve"
];

const CELLMATE_SKILLS = [
  { skill: "songwriting", bonus: 5 },
  { skill: "guitar", bonus: 5 },
  { skill: "vocals", bonus: 5 },
  { skill: "performance", bonus: 3 },
  { skill: "creativity", bonus: 5 },
  { skill: "composition", bonus: 5 }
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const runId = await startJobRun({
    jobName: "check-player-debt",
    functionName: "check-player-debt",
    supabaseClient: supabase,
  });

  try {
    console.log("[check-player-debt] Starting debt check...");
    
    let playersImprisoned = 0;
    let communityServiceOffered = 0;
    let debtWarningsSent = 0;

    // Find all players in debt
    const { data: debtors, error: debtError } = await supabase
      .from("profiles")
      .select("id, user_id, cash, debt_started_at, total_imprisonments, display_name, username")
      .lt("cash", 0)
      .eq("is_imprisoned", false);

    if (debtError) throw debtError;
    console.log(`[check-player-debt] Found ${debtors?.length || 0} players in debt`);

    for (const debtor of debtors || []) {
      const now = new Date();
      const debtAmount = Math.abs(debtor.cash);

      // If debt_started_at is null, set it now
      if (!debtor.debt_started_at) {
        await supabase
          .from("profiles")
          .update({ debt_started_at: now.toISOString() })
          .eq("id", debtor.id);
        
        // Send first warning notification
        await supabase.from("activity_feed").insert({
          user_id: debtor.user_id,
          activity_type: "debt_warning",
          message: `⚠️ You are in debt ($${debtAmount})! Clear within 5 days or face imprisonment.`,
          metadata: { debt_amount: debtAmount, days_remaining: 5 }
        });
        debtWarningsSent++;
        continue;
      }

      // Calculate days in debt
      const debtStarted = new Date(debtor.debt_started_at);
      const daysInDebt = Math.floor((now.getTime() - debtStarted.getTime()) / (1000 * 60 * 60 * 24));

      // Send warnings at 3 days and 1 day
      if (daysInDebt === 3) {
        await supabase.from("activity_feed").insert({
          user_id: debtor.user_id,
          activity_type: "debt_warning",
          message: `🚨 URGENT: 2 days until imprisonment! Clear your $${debtAmount} debt now.`,
          metadata: { debt_amount: debtAmount, days_remaining: 2 }
        });
        debtWarningsSent++;
      } else if (daysInDebt === 4) {
        await supabase.from("activity_feed").insert({
          user_id: debtor.user_id,
          activity_type: "debt_warning_final",
          message: `🔴 FINAL WARNING: Pay $${debtAmount} TODAY or go to prison tomorrow!`,
          metadata: { debt_amount: debtAmount, days_remaining: 1 }
        });
        debtWarningsSent++;
      }

      // Imprison after 5 days
      if (daysInDebt >= 5) {
        // First-time offender gets community service option if debt < $50,000
        if (debtor.total_imprisonments === 0 && debtAmount < 50000) {
          // Check if community service already offered
          const { data: existingCS } = await supabase
            .from("community_service_assignments")
            .select("id")
            .eq("user_id", debtor.user_id)
            .eq("status", "active")
            .single();

          if (!existingCS) {
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + 7);

            await supabase.from("community_service_assignments").insert({
              user_id: debtor.user_id,
              debt_amount: debtAmount,
              required_busking_sessions: 10,
              completed_sessions: 0,
              deadline: deadline.toISOString(),
              status: "active"
            });

            await supabase.from("activity_feed").insert({
              user_id: debtor.user_id,
              activity_type: "community_service_offered",
              message: `⚖️ Community Service Offered! Complete 10 busking sessions in 7 days to avoid prison.`,
              metadata: { debt_amount: debtAmount, sessions_required: 10, deadline: deadline.toISOString() }
            });
            communityServiceOffered++;
            continue;
          }
        }

        // Calculate sentence (base 3 days + 1 day per $10,000, max 14 days)
        let sentenceDays = Math.min(14, 3 + Math.floor(debtAmount / 10000));
        
        // Recidivism multiplier: 1.5x per prior imprisonment
        if (debtor.total_imprisonments > 0) {
          sentenceDays = Math.min(21, Math.ceil(sentenceDays * Math.pow(1.5, debtor.total_imprisonments)));
        }

        // Get player's current city for prison assignment
        const { data: profile } = await supabase
          .from("profiles")
          .select("current_city_id")
          .eq("id", debtor.id)
          .single();

        // Find a prison in their city or any prison
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

        if (!prisonId) {
          console.error(`[check-player-debt] No prison found for user ${debtor.user_id}`);
          continue;
        }

        // Generate random cellmate
        const cellmateName = CELLMATE_NAMES[Math.floor(Math.random() * CELLMATE_NAMES.length)];
        const cellmateSkill = CELLMATE_SKILLS[Math.floor(Math.random() * CELLMATE_SKILLS.length)];

        const releaseDate = new Date();
        releaseDate.setDate(releaseDate.getDate() + sentenceDays);

        // Create imprisonment record
        const { data: imprisonment } = await supabase
          .from("player_imprisonments")
          .insert({
            user_id: debtor.user_id,
            prison_id: prisonId,
            original_sentence_days: sentenceDays,
            remaining_sentence_days: sentenceDays,
            release_date: releaseDate.toISOString(),
            debt_amount_cleared: debtAmount,
            reason: "debt_default",
            status: "imprisoned",
            behavior_score: 50,
            bail_amount: Math.floor(debtAmount * 0.5) + (sentenceDays * 500),
            cellmate_name: cellmateName,
            cellmate_skill: cellmateSkill.skill,
            cellmate_skill_bonus: cellmateSkill.bonus
          })
          .select("id")
          .single();

        // Update profile: clear debt, mark imprisoned
        await supabase
          .from("profiles")
          .update({
            cash: 0,
            debt_started_at: null,
            is_imprisoned: true,
            total_imprisonments: (debtor.total_imprisonments || 0) + 1
          })
          .eq("id", debtor.id);

        // Send imprisonment notification
        await supabase.from("activity_feed").insert({
          user_id: debtor.user_id,
          activity_type: "imprisoned",
          message: `🔒 You have been imprisoned for debt default! Sentence: ${sentenceDays} days. Your $${debtAmount} debt has been cleared.`,
          metadata: { 
            imprisonment_id: imprisonment?.id,
            sentence_days: sentenceDays, 
            debt_cleared: debtAmount,
            cellmate: cellmateName
          }
        });

        playersImprisoned++;
        console.log(`[check-player-debt] Imprisoned ${debtor.display_name || debtor.username} for ${sentenceDays} days (debt: $${debtAmount})`);
      }
    }

    await completeJobRun({
      jobName: "check-player-debt",
      runId: runId!,
      supabaseClient: supabase,
      processedCount: debtors?.length || 0,
      details: {
        playersImprisoned,
        communityServiceOffered,
        debtWarningsSent
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        playersImprisoned,
        communityServiceOffered,
        debtWarningsSent,
        totalChecked: debtors?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[check-player-debt] Error:", error);
    await failJobRun({
      jobName: "check-player-debt",
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

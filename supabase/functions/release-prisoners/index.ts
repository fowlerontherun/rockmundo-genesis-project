import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startJobRun, completeJobRun, failJobRun, getErrorMessage } from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const runId = await startJobRun({
    jobName: "release-prisoners",
    functionName: "release-prisoners",
    supabaseClient: supabase,
  });

  try {
    console.log("[release-prisoners] Starting prisoner release check...");
    
    let prisonersReleased = 0;
    let earlyReleases = 0;

    const now = new Date();

    // Find all prisoners due for release
    const { data: prisoners, error: prisonerError } = await supabase
      .from("player_imprisonments")
      .select("*, prisons(name)")
      .eq("status", "imprisoned")
      .lte("release_date", now.toISOString());

    if (prisonerError) throw prisonerError;
    console.log(`[release-prisoners] Found ${prisoners?.length || 0} prisoners due for release`);

    for (const prisoner of prisoners || []) {
      // Calculate behavior rating
      let behaviorRating: string;
      if (prisoner.behavior_score >= 90) {
        behaviorRating = "exemplary";
      } else if (prisoner.behavior_score >= 70) {
        behaviorRating = "good";
      } else if (prisoner.behavior_score >= 50) {
        behaviorRating = "average";
      } else {
        behaviorRating = "poor";
      }

      // Check for early release eligibility
      const earlyReleaseDays = prisoner.good_behavior_days_earned;
      const wasEarlyRelease = earlyReleaseDays > 0;

      // Update imprisonment record
      await supabase
        .from("player_imprisonments")
        .update({
          status: "released",
          released_at: now.toISOString(),
          remaining_sentence_days: 0
        })
        .eq("id", prisoner.id);

      // Create criminal record entry
      await supabase.from("player_criminal_record").insert({
        user_id: prisoner.user_id,
        imprisonment_id: prisoner.id,
        offense_type: prisoner.reason,
        sentence_served_days: prisoner.original_sentence_days - earlyReleaseDays,
        behavior_rating: behaviorRating,
        escaped: false,
        pardoned: false
      });

      // Update profile
      await supabase
        .from("profiles")
        .update({ is_imprisoned: false })
        .eq("user_id", prisoner.user_id);

      // Send release notification
      const releaseMessage = wasEarlyRelease
        ? `🔓 You have been released early for good behavior! (${earlyReleaseDays} days off) Songs written: ${prisoner.songs_written}`
        : `🔓 You have been released from prison. Stay out of debt! Songs written: ${prisoner.songs_written}`;

      await supabase.from("activity_feed").insert({
        user_id: prisoner.user_id,
        activity_type: "released",
        message: releaseMessage,
        metadata: {
          imprisonment_id: prisoner.id,
          behavior_rating: behaviorRating,
          songs_written: prisoner.songs_written,
          early_release: wasEarlyRelease,
          days_reduced: earlyReleaseDays
        }
      });

      // === PRISON RELEASE → MORALE (v1.0.972) ===
      // Getting out of prison is a huge relief; good behavior = bigger morale recovery
      try {
        const { data: bm } = await supabase
          .from('band_members')
          .select('band_id')
          .eq('user_id', prisoner.user_id)
          .eq('is_touring_member', false)
          .limit(1)
          .maybeSingle();
        if (bm?.band_id) {
          const { data: bd } = await supabase.from('bands').select('morale, reputation_score').eq('id', bm.band_id).single();
          if (bd) {
            const curM = (bd as any).morale ?? 50;
            const curR = (bd as any).reputation_score ?? 0;
            // Good behavior = bigger recovery; poor behavior = minimal
            const moraleBoost = prisoner.behavior_score >= 90 ? 10 : prisoner.behavior_score >= 70 ? 7 : prisoner.behavior_score >= 50 ? 4 : 2;
            // Slight rep recovery for completing sentence (paid their debt to society)
            const repBoost = prisoner.behavior_score >= 70 ? 3 : 1;
            const newMorale = Math.min(100, curM + moraleBoost);
            const newRep = Math.min(100, curR + repBoost);
            await supabase.from('bands').update({
              morale: newMorale,
              reputation_score: newRep,
            } as any).eq('id', bm.band_id);
            console.log(`[release-prisoners] Release morale: behavior ${prisoner.behavior_score} → morale +${moraleBoost}, rep +${repBoost}`);
            // Health event logs
            try {
              await supabase.from('band_health_events').insert([
                { band_id: bm.band_id, event_type: 'morale', delta: moraleBoost, new_value: newMorale, source: 'prison_release', description: `Released from prison (behavior: ${behaviorRating})` },
                { band_id: bm.band_id, event_type: 'reputation', delta: repBoost, new_value: newRep, source: 'prison_release', description: `Served sentence, debt to society paid` },
              ]);
            } catch (_) {}
          }
        }
      } catch (_e) { /* non-critical */ }

      prisonersReleased++;
      if (wasEarlyRelease) earlyReleases++;

      console.log(`[release-prisoners] Released prisoner ${prisoner.user_id} (behavior: ${behaviorRating})`);
    }

    // Also decrement remaining_sentence_days for active prisoners
    const { data: activePrisoners } = await supabase
      .from("player_imprisonments")
      .select("id, remaining_sentence_days, behavior_score, original_sentence_days")
      .eq("status", "imprisoned")
      .gt("remaining_sentence_days", 0);

    for (const prisoner of activePrisoners || []) {
      // Calculate early release days based on behavior
      let earlyReleaseDays = 0;
      if (prisoner.behavior_score >= 90) {
        earlyReleaseDays = Math.ceil(prisoner.original_sentence_days * 0.25);
      } else if (prisoner.behavior_score >= 75) {
        earlyReleaseDays = Math.ceil(prisoner.original_sentence_days * 0.15);
      } else if (prisoner.behavior_score >= 60) {
        earlyReleaseDays = Math.ceil(prisoner.original_sentence_days * 0.10);
      }

      const newRemainingDays = Math.max(0, prisoner.remaining_sentence_days - 1);
      const newReleaseDate = new Date();
      newReleaseDate.setDate(newReleaseDate.getDate() + Math.max(0, newRemainingDays - earlyReleaseDays));

      await supabase
        .from("player_imprisonments")
        .update({
          remaining_sentence_days: newRemainingDays,
          good_behavior_days_earned: earlyReleaseDays,
          release_date: newReleaseDate.toISOString()
        })
        .eq("id", prisoner.id);
    }

    await completeJobRun({
      jobName: "release-prisoners",
      runId: runId!,
      supabaseClient: supabase,
      processedCount: prisoners?.length || 0,
      details: { prisonersReleased, earlyReleases, activePrisonersUpdated: activePrisoners?.length || 0 }
    });

    return new Response(
      JSON.stringify({
        success: true,
        prisonersReleased,
        earlyReleases,
        activePrisonersUpdated: activePrisoners?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[release-prisoners] Error:", error);
    await failJobRun({
      jobName: "release-prisoners",
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

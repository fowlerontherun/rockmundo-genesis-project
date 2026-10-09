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

const JOB_NAME = "process-event-outcomes";

interface EventEffects {
  fans?: number;
  cash?: number;
  health?: number;
  energy?: number;
  fame?: number;
  xp?: number;
  skill_xp?: number;
  skill_slug?: string;
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

async function findEligibleSkill(client: any, profileId: string, preferredSlug?: string | null): Promise<string | null> {
  const { data: rows, error } = await client
    .from("skill_progress")
    .select("skill_slug, current_level")
    .eq("profile_id", profileId)
    .gte("current_level", 1);
  if (error) throw error;

  const ordered = [...(rows || [])].sort((a, b) => {
    if (a.skill_slug === preferredSlug) return -1;
    if (b.skill_slug === preferredSlug) return 1;
    return Math.random() - 0.5;
  });

  for (const row of ordered) {
    const maxLevel = await getSkillMaxLevel(client, row.skill_slug);
    if (Number(row.current_level || 0) < maxLevel) return row.skill_slug;
  }
  return null;
}

async function grantSkillXp(client: any, profileId: string, skillSlug: string, amount: number): Promise<number> {
  if (amount <= 0) return 0;

  const maxLevel = await getSkillMaxLevel(client, skillSlug);
  const { data: skill, error: skillLoadError } = await client
    .from("skill_progress")
    .select("id, current_xp, current_level, required_xp")
    .eq("profile_id", profileId)
    .eq("skill_slug", skillSlug)
    .maybeSingle();
  if (skillLoadError) throw skillLoadError;
  if (!skill || Number(skill.current_level || 0) < 1 || Number(skill.current_level || 0) >= maxLevel) return 0;

  let level = Math.min(Math.max(Number(skill.current_level ?? 0), 0), maxLevel);
  let remaining = Math.max(Number(skill.current_xp ?? 0), 0);
  let required = Number(skill.required_xp ?? 0);

  if (required <= 0) required = await getRequiredSkillXp(client, level);
  remaining += amount;

  while (level < maxLevel && remaining >= required) {
    remaining -= required;
    level += 1;
    required = level < maxLevel ? await getRequiredSkillXp(client, level) : 0;
  }

  if (level >= maxLevel) {
    level = maxLevel;
    remaining = 0;
    required = 0;
  }

  const { error: updateError } = await client
    .from("skill_progress")
    .update({
      current_level: level,
      current_xp: remaining,
      required_xp: required,
      last_practiced_at: new Date().toISOString(),
    })
    .eq("id", skill.id);
  if (updateError) throw updateError;

  return amount;
}

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
    functionName: "process-event-outcomes",
    supabaseClient: supabase,
    triggeredBy: "cron",
    requestPayload: await safeJson(req),
  });

  try {
    console.log(`[${JOB_NAME}] Processing event outcomes...`);

    // Get events awaiting outcome where choice was made before today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: pendingOutcomes, error: fetchError } = await supabase
      .from("player_events")
      .select(`
        *,
        random_events (*)
      `)
      .eq("status", "awaiting_outcome")
      .lt("choice_made_at", today.toISOString());

    if (fetchError) throw fetchError;

    console.log(`[${JOB_NAME}] Found ${pendingOutcomes?.length || 0} pending outcomes`);

    let outcomesProcessed = 0;
    let hospitalizationsTriggered = 0;

    for (const playerEvent of pendingOutcomes || []) {
      const event = playerEvent.random_events;
      if (!event) continue;

      // Get effects based on choice
      const effects: EventEffects = playerEvent.choice_made === "a"
        ? (event.option_a_effects as EventEffects)
        : (event.option_b_effects as EventEffects);

      const outcomeMessage = playerEvent.choice_made === "a"
        ? event.option_a_outcome_text
        : event.option_b_outcome_text;

      console.log(`[${JOB_NAME}] Processing outcome for player ${playerEvent.user_id}: ${JSON.stringify(effects)}`);

      // Get current player stats
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, cash, health, energy, fame, experience")
        .eq("user_id", playerEvent.user_id)
        .single();

      if (profileError || !profile) {
        console.error(`[${JOB_NAME}] Failed to get profile for ${playerEvent.user_id}`);
        continue;
      }

      const appliedEffects: EventEffects = { ...effects };

      if (event.awards_random_skill_xp) {
        const minXp = Math.max(100, Math.min(500, Number(event.skill_xp_min ?? 100)));
        const maxXp = Math.max(minXp, Math.min(500, Number(event.skill_xp_max ?? 500)));
        const targetSkill = await findEligibleSkill(
          supabase,
          profile.id,
          playerEvent.target_skill_slug,
        );

        if (targetSkill) {
          const skillXp = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;
          const awarded = await grantSkillXp(supabase, profile.id, targetSkill, skillXp);
          if (awarded > 0) {
            appliedEffects.skill_xp = awarded;
            appliedEffects.skill_slug = targetSkill;
          }
        }
      }

      // Calculate new values
      const newHealth = Math.max(0, Math.min(100, (profile.health ?? 100) + (effects.health ?? 0)));
      const newEnergy = Math.max(0, Math.min(100, (profile.energy ?? 100) + (effects.energy ?? 0)));
      const newCash = Math.max(0, (profile.cash ?? 0) + (effects.cash ?? 0));
      const newFame = Math.max(0, (profile.fame ?? 0) + (effects.fame ?? 0));
      const newXp = Math.max(0, (profile.experience ?? 0) + (effects.xp ?? 0));

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          health: newHealth,
          energy: newEnergy,
          cash: newCash,
          fame: newFame,
          experience: newXp,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", playerEvent.user_id);

      if (updateError) {
        console.error(`[${JOB_NAME}] Failed to update profile:`, updateError);
        continue;
      }

      // Handle fans effect on band if any + MORALE/REPUTATION from event outcomes (v1.0.963)
      const { data: bandMember } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", playerEvent.user_id)
        .eq("is_touring_member", false)
        .limit(1)
        .maybeSingle();

      if (bandMember?.band_id) {
        const { data: currentBand } = await supabase
          .from("bands")
          .select("total_fans, morale, reputation_score")
          .eq("id", bandMember.band_id)
          .single();

        if (currentBand) {
          const bandUpdate: Record<string, any> = {};

          // Fan effect
          if (effects.fans && effects.fans !== 0) {
            bandUpdate.total_fans = Math.max(0, (currentBand.total_fans || 0) + effects.fans);
          }

          // === MORALE FROM EVENT OUTCOMES (v1.0.963) ===
          // Net positive effects boost morale; net negative effects hurt it
          const netEffect = (effects.cash ?? 0) + (effects.fans ?? 0) * 10 + (effects.fame ?? 0) * 5 + (effects.health ?? 0) * 2;
          let moraleShift = 0;
          if (netEffect > 200) moraleShift = 6;
          else if (netEffect > 50) moraleShift = 3;
          else if (netEffect > 0) moraleShift = 1;
          else if (netEffect < -200) moraleShift = -8;
          else if (netEffect < -50) moraleShift = -4;
          else if (netEffect < 0) moraleShift = -2;

          // === REPUTATION FROM HEALTH-DAMAGING EVENTS (v1.0.963) ===
          // Events that hurt health significantly damage public reputation (scandals, arrests, etc.)
          let repShift = 0;
          if ((effects.health ?? 0) <= -20) repShift = -8;
          else if ((effects.health ?? 0) <= -10) repShift = -4;
          else if ((effects.fame ?? 0) > 50) repShift = 3;

          const curMorale = (currentBand as any).morale ?? 50;
          const curRep = (currentBand as any).reputation_score ?? 0;

          if (moraleShift !== 0) bandUpdate.morale = Math.max(0, Math.min(100, curMorale + moraleShift));
          if (repShift !== 0) bandUpdate.reputation_score = Math.max(-100, Math.min(100, curRep + repShift));

          if (Object.keys(bandUpdate).length > 0) {
            await supabase.from("bands").update(bandUpdate as any).eq("id", bandMember.band_id);
            if (moraleShift !== 0 || repShift !== 0) {
              console.log(`[${JOB_NAME}] Band ${bandMember.band_id} health update: morale ${moraleShift > 0 ? '+' : ''}${moraleShift}, rep ${repShift > 0 ? '+' : ''}${repShift}`);
            }
          }
        }
      }

      // Mark event as completed
      const { error: completeError } = await supabase
        .from("player_events")
        .update({
          status: "completed",
          outcome_applied: true,
          outcome_applied_at: new Date().toISOString(),
          outcome_effects: appliedEffects,
          outcome_message: outcomeMessage,
        })
        .eq("id", playerEvent.id);

      if (completeError) {
        console.error(`[${JOB_NAME}] Failed to complete event:`, completeError);
        continue;
      }

      // Log activity
      await supabase.from("activity_feed").insert({
        user_id: playerEvent.user_id,
        activity_type: "random_event_outcome",
        message: `Event outcome: ${outcomeMessage}`,
        metadata: { event_id: event.id, effects: appliedEffects },
      });

      // Create inbox message with outcome details
      const effectsSummary: string[] = [];
      if (effects.cash && effects.cash !== 0) effectsSummary.push(`${effects.cash > 0 ? '+' : ''}$${effects.cash}`);
      if (effects.fame && effects.fame !== 0) effectsSummary.push(`${effects.fame > 0 ? '+' : ''}${effects.fame} fame`);
      if (effects.fans && effects.fans !== 0) effectsSummary.push(`${effects.fans > 0 ? '+' : ''}${effects.fans} fans`);
      if (effects.health && effects.health !== 0) effectsSummary.push(`${effects.health > 0 ? '+' : ''}${effects.health} health`);
      if (effects.energy && effects.energy !== 0) effectsSummary.push(`${effects.energy > 0 ? '+' : ''}${effects.energy} energy`);
      if (effects.xp && effects.xp !== 0) effectsSummary.push(`${effects.xp > 0 ? '+' : ''}${effects.xp} XP`);
      if (appliedEffects.skill_xp && appliedEffects.skill_slug) {
        effectsSummary.push(`+${appliedEffects.skill_xp} ${appliedEffects.skill_slug.replace(/_/g, " ")} skill XP`);
      }
      
      const effectsText = effectsSummary.length > 0 ? `\n\nEffects: ${effectsSummary.join(', ')}` : '';
      
      await supabase.from("player_inbox").insert({
        user_id: playerEvent.user_id,
        category: "random_event",
        priority: "normal",
        title: `📋 Event Outcome: ${event.title}`,
        message: `${outcomeMessage}${effectsText}`,
        metadata: { event_id: event.id, player_event_id: playerEvent.id, effects: appliedEffects },
        related_entity_type: "random_event",
        related_entity_id: event.id,
        action_type: null,
        action_data: null,
      });

      outcomesProcessed++;

      // Check for hospitalization (health < 10)
      if (newHealth < 10) {
        console.log(`[${JOB_NAME}] Player ${playerEvent.user_id} health dropped to ${newHealth}, triggering hospitalization`);
        
        // Get player's current city
        const { data: playerProfile } = await supabase
          .from("profiles")
          .select("current_city_id")
          .eq("user_id", playerEvent.user_id)
          .single();

        if (playerProfile?.current_city_id) {
          // Find hospital in that city
          const { data: hospital } = await supabase
            .from("hospitals")
            .select("*")
            .eq("city_id", playerProfile.current_city_id)
            .limit(1)
            .single();

          if (hospital) {
            // Calculate recovery days based on effectiveness
            const recoveryDays = Math.max(1, Math.min(3, Math.ceil((100 - hospital.effectiveness_rating) / 50) + 1));
            const dischargeDate = new Date();
            dischargeDate.setDate(dischargeDate.getDate() + recoveryDays);

            // Create hospitalization record
            await supabase.from("player_hospitalizations").insert({
              user_id: playerEvent.user_id,
              hospital_id: hospital.id,
              reason: `Health emergency from event: ${event.title}`,
              daily_cost: hospital.cost_per_day,
              estimated_discharge_at: dischargeDate.toISOString(),
            });

            // Log hospitalization
            await supabase.from("activity_feed").insert({
              user_id: playerEvent.user_id,
              activity_type: "hospitalized",
              message: `Rushed to ${hospital.name} for emergency treatment`,
              metadata: { hospital_id: hospital.id, recovery_days: recoveryDays },
            });

            hospitalizationsTriggered++;
          }
        }
      }
    }

    // Also expire old pending_choice events (older than 3 days)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiredEvents } = await supabase
      .from("player_events")
      .update({ status: "expired" })
      .eq("status", "pending_choice")
      .lt("triggered_at", threeDaysAgo)
      .select();

    const expiredCount = expiredEvents?.length || 0;
    if (expiredCount > 0) {
      console.log(`[${JOB_NAME}] Expired ${expiredCount} old events`);
    }

    console.log(`[${JOB_NAME}] Complete. Processed ${outcomesProcessed} outcomes, ${hospitalizationsTriggered} hospitalizations`);

    await completeJobRun({
      jobName: JOB_NAME,
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startTime,
      processedCount: outcomesProcessed,
      resultSummary: { outcomesProcessed, hospitalizationsTriggered, expiredCount },
    });

    return new Response(
      JSON.stringify({ success: true, outcomesProcessed, hospitalizationsTriggered, expiredCount }),
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

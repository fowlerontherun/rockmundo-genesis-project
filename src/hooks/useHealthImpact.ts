import { supabase } from "@/integrations/supabase/client";
import { getHealthStatus } from "@/utils/healthSystem";
import { autoHospitalize } from "@/hooks/useHospitalization";
import { aggregateConditionEffects, type ConditionEffects } from "@/utils/conditionSystem";

/**
 * Fetch active conditions for a user and return aggregated effects
 */
async function getActiveConditionEffects(userId: string): Promise<ConditionEffects> {
  const { data } = await (supabase as any)
    .from("player_conditions")
    .select("condition_name, severity, effects")
    .eq("user_id", userId)
    .in("status", ["active", "treating"]);

  if (!data || data.length === 0) return {};
  return aggregateConditionEffects(data);
}

/**
 * Check if user has enough health/energy for an activity
 * Returns error message if check fails, null if ok
 */
export async function checkHealthForActivity(
  userId: string,
  activityType: string,
  energyCost: number = 0
): Promise<{ canPerform: boolean; message: string | null; healthPenalty: number }> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("health, energy")
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    return { canPerform: false, message: "Could not verify health status", healthPenalty: 0 };
  }

  const health = profile.health ?? 100;
  const energy = profile.energy ?? 100;
  const healthStatus = getHealthStatus(health);

  // Critical health check
  if (!healthStatus.canPerform) {
    return {
      canPerform: false,
      message: "Your health is too low to perform this activity. Rest first!",
      healthPenalty: 0,
    };
  }

  // Check blocking conditions
  const conditionEffects = await getActiveConditionEffects(userId);

  if (conditionEffects.blocks_gigs && ["gig", "busking", "recording"].includes(activityType)) {
    return { canPerform: false, message: "A condition is blocking you from performing. Check your Wellness page.", healthPenalty: 0 };
  }
  if (conditionEffects.blocks_singing && activityType === "singing") {
    return { canPerform: false, message: "Vocal strain is preventing you from singing. Seek treatment!", healthPenalty: 0 };
  }
  if (conditionEffects.blocks_guitar_gigs && activityType === "guitar") {
    return { canPerform: false, message: "Your wrist/hand injury prevents you from playing guitar.", healthPenalty: 0 };
  }
  if (conditionEffects.blocks_travel && activityType === "travel") {
    return { canPerform: false, message: "You're too ill to travel. Get treatment first!", healthPenalty: 0 };
  }

  // Energy check (factor in energy cap from conditions)
  const effectiveEnergyCap = conditionEffects.energy_cap ?? 100;
  const effectiveEnergy = Math.min(energy, effectiveEnergyCap);
  if (effectiveEnergy < energyCost) {
    return {
      canPerform: false,
      message: `Not enough energy (need ${energyCost}, have ${effectiveEnergy}${effectiveEnergyCap < 100 ? ` — capped at ${effectiveEnergyCap}% by condition` : ""})`,
      healthPenalty: 0,
    };
  }

  // Calculate performance penalty from health + conditions
  let healthPenalty = 0;
  if (health <= 30) {
    healthPenalty = 50;
  } else if (health <= 50) {
    healthPenalty = 25;
  } else if (health <= 70) {
    healthPenalty = 10;
  }

  // Add condition XP penalty
  healthPenalty = Math.min(75, healthPenalty + (conditionEffects.xp_penalty || 0));

  return { canPerform: true, message: null, healthPenalty };
}

/**
 * Apply health drain after an activity
 */
export async function applyHealthDrain(
  userId: string,
  activityType: string,
  durationMinutes: number,
  energyCost: number = 0
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("health, energy")
    .eq("user_id", userId)
    .single();

  if (!profile) return;

  const healthCosts: Record<string, number> = {
    gig: 8,
    recording: 4,
    songwriting: 2,
    rehearsal: 3,
    travel: 6,
    busking: 5,
    release_promo: 4,
    default: 3,
  };

  const hourlyHealthDrain = healthCosts[activityType] || healthCosts.default;
  const hours = durationMinutes / 60;
  const healthDrain = Math.round(hourlyHealthDrain * hours);

  const newHealth = Math.max(0, (profile.health ?? 100) - healthDrain);
  const newEnergy = Math.max(0, (profile.energy ?? 100) - energyCost);

  await supabase
    .from("profiles")
    .update({
      health: newHealth,
      energy: newEnergy,
      last_health_update: new Date().toISOString(),
    })
    .eq("user_id", userId);

  // Check if user collapsed - auto-hospitalize
  if (newHealth === 0) {
    await autoHospitalize(userId);
  }
}

/**
 * Check for overwork effects (too many activities without rest)
 */
export async function checkOverworkEffects(userId: string): Promise<{
  isOverworked: boolean;
  message: string | null;
}> {
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const { data: activities, error } = await supabase
    .from("experience_ledger")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", oneDayAgo.toISOString())
    .in("activity_type", ["gig", "recording", "songwriting", "rehearsal", "busking"]);

  if (error || !activities) return { isOverworked: false, message: null };

  const activityCount = activities.length;
  const restCount = activities.filter((a) => a.activity_type === "rest").length;

  // More than 5 activities without rest
  if (activityCount > 5 && restCount === 0) {
    return {
      isOverworked: true,
      message: "You're working too hard! Take a break before your health suffers more.",
    };
  }

  // More than 8 activities even with rest
  if (activityCount > 8) {
    return {
      isOverworked: true,
      message: "You're overworking yourself! Slow down or risk burnout.",
    };
  }

  return { isOverworked: false, message: null };
}

/**
 * Apply health impact modifiers to activity outcomes
 */
export function applyHealthImpactToOutcome(
  baseValue: number,
  healthPenalty: number
): number {
  const modifier = 1 - healthPenalty / 100;
  return Math.round(baseValue * modifier);
}

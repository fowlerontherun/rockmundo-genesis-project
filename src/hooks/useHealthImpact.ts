import { supabase } from "@/integrations/supabase/client";
import { getHealthStatus } from "@/utils/healthSystem";
import { autoHospitalize } from "@/hooks/useHospitalization";
import { aggregateConditionEffects, type ConditionEffects } from "@/utils/conditionSystem";

/**
 * Fetch active conditions for a profile and return aggregated effects.
 * Now accepts profileId (the active character profile UUID).
 */
async function getActiveConditionEffects(profileId: string): Promise<ConditionEffects> {
  const { data } = await (supabase as any)
    .from("player_conditions")
    .select("condition_name, severity, effects")
    .eq("profile_id", profileId)
    .in("status", ["active", "treating"]);

  if (!data || data.length === 0) return {};
  return aggregateConditionEffects(data);
}

/**
 * Check if the active profile has enough health/energy for an activity.
 * profileId = the active character's profile UUID.
 */
export async function checkHealthForActivity(
  profileId: string,
  activityType: string,
  energyCost: number = 0
): Promise<{ canPerform: boolean; message: string | null; healthPenalty: number }> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("health, energy")
    .eq("id", profileId)
    .single();

  if (error || !profile) {
    return { canPerform: false, message: "Could not verify health status", healthPenalty: 0 };
  }

  const health = profile.health ?? 100;
  const energy = profile.energy ?? 100;
  const healthStatus = getHealthStatus(health);

  if (!healthStatus.canPerform) {
    return {
      canPerform: false,
      message: "Your health is too low to perform this activity. Rest first!",
      healthPenalty: 0,
    };
  }

  const conditionEffects = await getActiveConditionEffects(profileId);

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

  const effectiveEnergyCap = conditionEffects.energy_cap ?? 100;
  const effectiveEnergy = Math.min(energy, effectiveEnergyCap);
  if (effectiveEnergy < energyCost) {
    return {
      canPerform: false,
      message: `Not enough energy (need ${energyCost}, have ${effectiveEnergy}${effectiveEnergyCap < 100 ? ` — capped at ${effectiveEnergyCap}% by condition` : ""})`,
      healthPenalty: 0,
    };
  }

  let healthPenalty = 0;
  if (health <= 30) {
    healthPenalty = 50;
  } else if (health <= 50) {
    healthPenalty = 25;
  } else if (health <= 70) {
    healthPenalty = 10;
  }

  healthPenalty = Math.min(75, healthPenalty + (conditionEffects.xp_penalty || 0));

  return { canPerform: true, message: null, healthPenalty };
}

/**
 * Apply health drain after an activity.
 * profileId = the active character's profile UUID.
 */
export async function applyHealthDrain(
  profileId: string,
  activityType: string,
  durationMinutes: number,
  energyCost: number = 0
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("health, energy")
    .eq("id", profileId)
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
    .eq("id", profileId);

  // Check if user collapsed - auto-hospitalize
  if (newHealth === 0) {
    await autoHospitalize(profileId);
  }
}

/**
 * Check for overwork effects (too many activities without rest).
 * profileId = the active character's profile UUID.
 */
export async function checkOverworkEffects(profileId: string): Promise<{
  isOverworked: boolean;
  message: string | null;
}> {
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const { data: activities, error } = await supabase
    .from("experience_ledger")
    .select("*")
    .eq("profile_id", profileId)
    .gte("created_at", oneDayAgo.toISOString())
    .in("activity_type", ["gig", "recording", "songwriting", "rehearsal", "busking"]);

  if (error || !activities) return { isOverworked: false, message: null };

  const activityCount = activities.length;
  const restCount = activities.filter((a) => a.activity_type === "rest").length;

  if (activityCount > 5 && restCount === 0) {
    return {
      isOverworked: true,
      message: "You're working too hard! Take a break before your health suffers more.",
    };
  }

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

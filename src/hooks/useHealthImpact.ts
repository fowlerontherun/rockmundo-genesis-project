import { supabase } from "@/integrations/supabase/client";
import { getHealthStatus } from "@/utils/healthSystem";
import { autoHospitalize } from "@/hooks/useHospitalization";

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

  // Energy check
  if (energy < energyCost) {
    return {
      canPerform: false,
      message: `Not enough energy (need ${energyCost}, have ${energy})`,
      healthPenalty: 0,
    };
  }

  // Calculate performance penalty
  let healthPenalty = 0;
  if (health <= 30) {
    healthPenalty = 50; // 50% penalty
  } else if (health <= 50) {
    healthPenalty = 25; // 25% penalty
  } else if (health <= 70) {
    healthPenalty = 10; // 10% penalty
  }

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

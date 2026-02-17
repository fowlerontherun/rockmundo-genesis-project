import type { Tables } from "@/lib/supabase-types";

type Profile = Tables<"profiles">;

// Health drain rates per hour
const HEALTH_COSTS = {
  busking_session: 5,
  gig: 8,
  recording: 4,
  jam_session: 3,
  songwriting: 2,
  travel: 6,
  release_promo: 4,
  default: 3,
} as const;

export function calculateHealthDrain(
  activityType: string,
  durationMinutes: number
): number {
  const hourlyRate = HEALTH_COSTS[activityType as keyof typeof HEALTH_COSTS] || HEALTH_COSTS.default;
  const hours = durationMinutes / 60;
  return Math.round(hourlyRate * hours);
}

export interface BehaviorHealthModifiers {
  recoveryModifier: number; // -25 to +5 percent
  restEffectiveness: number; // -10 to +20 percent
}

export function calculateHealthRecovery(
  timeSinceLastActivityMs: number,
  isResting: boolean = false,
  behaviorModifiers?: BehaviorHealthModifiers
): number {
  const hours = timeSinceLastActivityMs / (1000 * 60 * 60);
  let rate = isResting ? 10 : 2; // Rest = 10/hr, passive = 2/hr
  
  // Apply behavior modifiers if provided
  if (behaviorModifiers) {
    const modifier = isResting 
      ? (behaviorModifiers.recoveryModifier + behaviorModifiers.restEffectiveness) / 100
      : behaviorModifiers.recoveryModifier / 100;
    rate = rate * (1 + modifier);
  }
  
  return Math.min(100, Math.round(rate * hours));
}

export function applyHealthPenalties(
  health: number,
  baseXp: number,
  baseCash: number
): { xp: number; cash: number; penalty: number } {
  let penalty = 0;
  
  if (health <= 10) {
    penalty = 0.5; // -50%
  } else if (health <= 30) {
    penalty = 0.25; // -25%
  } else if (health <= 50) {
    penalty = 0.1; // -10%
  }
  
  return {
    xp: Math.round(baseXp * (1 - penalty)),
    cash: Math.round(baseCash * (1 - penalty)),
    penalty: penalty * 100,
  };
}

export function getHealthStatus(health: number): {
  label: string;
  color: string;
  warning: string | null;
  canPerform: boolean;
} {
  if (health >= 80) {
    return {
      label: "Excellent",
      color: "text-green-600",
      warning: null,
      canPerform: true,
    };
  } else if (health >= 50) {
    return {
      label: "Good",
      color: "text-blue-600",
      warning: null,
      canPerform: true,
    };
  } else if (health >= 30) {
    return {
      label: "Tired",
      color: "text-yellow-600",
      warning: "You're getting tired. Consider resting soon to avoid penalties.",
      canPerform: true,
    };
  } else if (health >= 10) {
    return {
      label: "Exhausted",
      color: "text-orange-600",
      warning: "You're exhausted! Performance quality is significantly reduced. Rest immediately!",
      canPerform: true,
    };
  } else if (health > 0) {
    return {
      label: "Burned Out",
      color: "text-red-600",
      warning: "Critical burnout! You're at risk of collapsing. Cannot perform activities!",
      canPerform: false,
    };
  } else {
    return {
      label: "Collapsed",
      color: "text-red-800",
      warning: "You've collapsed from exhaustion. Mandatory rest period required!",
      canPerform: false,
    };
  }
}

export function calculateTimeToFullRecovery(currentHealth: number): number {
  const healthNeeded = 100 - currentHealth;
  const hoursNeeded = healthNeeded / 2; // 2 health per hour passive recovery
  return Math.ceil(hoursNeeded);
}

export function updateProfileHealth(
  profile: Profile,
  healthDrain: number = 0,
  healthGain: number = 0
): Partial<Profile> {
  const currentHealth = profile.health ?? 100;
  const newHealth = Math.max(0, Math.min(100, currentHealth - healthDrain + healthGain));
  
  return {
    health: newHealth,
    last_health_update: new Date().toISOString(),
  };
}

export function shouldForceRest(profile: Profile): boolean {
  const health = profile.health ?? 100;
  const restRequiredUntil = profile.rest_required_until;
  
  if (health === 0 && !restRequiredUntil) {
    return true;
  }
  
  if (restRequiredUntil) {
    const now = new Date();
    const restUntil = new Date(restRequiredUntil);
    return now < restUntil;
  }
  
  return false;
}

export function calculateForcedRestDuration(health: number): number {
  // If health hits 0, force rest for 24-48 hours
  if (health === 0) {
    return 24 + Math.random() * 24; // 24-48 hours
  }
  return 0;
}

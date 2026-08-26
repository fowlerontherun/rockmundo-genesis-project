export const LIVE_SETUP_WEIGHTS = {
  equipment: 0.6,
  crew: 0.4,
} as const;

export const PERFORMANCE_CREW_ROLES = [
  "Front of House Engineer",
  "Lighting Director",
  "Road Crew Chief",
  "Backline Technician",
] as const;

export const CREW_DEPARTMENTS = {
  show: {
    label: "Show Crew",
    description: "Directly improves your live sound and stage setup.",
    roles: PERFORMANCE_CREW_ROLES,
  },
  touring: {
    label: "Touring Operations",
    description: "Helps the band travel, organise shows and avoid operational problems.",
    roles: ["Tour Manager", "Security Lead"],
  },
  commercial: {
    label: "Commercial & Image",
    description: "Supports merchandise, presentation and other non-performance outcomes.",
    roles: ["Merch Director", "Wardrobe Stylist"],
  },
} as const;

export interface VenueSetupTarget {
  target: number;
  label: "Basic" | "Touring" | "Professional" | "Elite" | "World Class";
}

export interface LiveSetupInput {
  equipmentQuality: number;
  crewSkill: number;
  venueCapacity?: number | null;
  equipmentCondition?: number | null;
}

export interface LiveSetupResult {
  score: number;
  rating: string;
  equipmentScore: number;
  crewScore: number;
  venueTarget: VenueSetupTarget;
  gap: number;
  status: "ready" | "warning" | "critical";
  recommendation: string;
}

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));

export function isPerformanceCrewRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return PERFORMANCE_CREW_ROLES.includes(
    role as (typeof PERFORMANCE_CREW_ROLES)[number],
  );
}

export function getLiveSetupRating(score: number): string {
  const safeScore = clamp(score);
  if (safeScore >= 90) return "World Class";
  if (safeScore >= 80) return "Excellent";
  if (safeScore >= 65) return "Good";
  if (safeScore >= 50) return "Developing";
  return "Needs Work";
}

export function getVenueSetupTarget(capacity = 0): VenueSetupTarget {
  if (capacity <= 150) return { target: 45, label: "Basic" };
  if (capacity <= 500) return { target: 60, label: "Touring" };
  if (capacity <= 1500) return { target: 70, label: "Professional" };
  if (capacity <= 5000) return { target: 82, label: "Elite" };
  return { target: 90, label: "World Class" };
}

export function calculateLiveSetup(input: LiveSetupInput): LiveSetupResult {
  const rawEquipmentQuality = clamp(input.equipmentQuality);
  const equipmentScore =
    input.equipmentCondition == null
      ? rawEquipmentQuality
      : clamp(rawEquipmentQuality * 0.75 + clamp(input.equipmentCondition) * 0.25);
  const crewScore = clamp(input.crewSkill);
  const score = Math.round(
    equipmentScore * LIVE_SETUP_WEIGHTS.equipment +
      crewScore * LIVE_SETUP_WEIGHTS.crew,
  );
  const venueTarget = getVenueSetupTarget(input.venueCapacity ?? 0);
  const gap = score - venueTarget.target;

  let status: LiveSetupResult["status"] = "ready";
  if (gap < -15) status = "critical";
  else if (gap < 0) status = "warning";

  let recommendation = "Your live setup is suitable for this size of show.";
  if (status !== "ready") {
    if (equipmentScore + 5 < crewScore) {
      recommendation = "Upgrade or repair your shared stage equipment first.";
    } else if (crewScore + 5 < equipmentScore) {
      recommendation = "Improve your Show Crew first, especially sound and stage roles.";
    } else {
      recommendation = "Improve both shared equipment and Show Crew before larger shows.";
    }
  }

  return {
    score,
    rating: getLiveSetupRating(score),
    equipmentScore: Math.round(equipmentScore),
    crewScore: Math.round(crewScore),
    venueTarget,
    gap,
    status,
    recommendation,
  };
}

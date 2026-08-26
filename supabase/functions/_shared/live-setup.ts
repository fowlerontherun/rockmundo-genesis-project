export const LIVE_SETUP_WEIGHTS = {
  equipment: 0.6,
  crew: 0.4,
} as const;

export const PERFORMANCE_CREW_ROLES = [
  'Front of House Engineer',
  'Lighting Director',
  'Road Crew Chief',
  'Backline Technician',
] as const;

const PERFORMANCE_CREW_ROLE_ALIASES = new Set([
  ...PERFORMANCE_CREW_ROLES,
  'sound_engineer',
  'lighting_engineer',
  'stage_manager',
  'guitar_technician',
  'drum_technician',
  'keyboard_technician',
  'stage_crew',
]);

export type LiveSetupStatus = 'ready' | 'warning' | 'critical';

export interface LiveSetupInput {
  equipmentQuality: number;
  crewSkill: number;
  venueCapacity?: number | null;
}

export interface LiveSetupResult {
  score: number;
  equipmentScore: number;
  crewScore: number;
  rating: string;
  status: LiveSetupStatus;
  venueTarget: { target: number; label: string };
  gap: number;
  recommendation: string;
}

const clamp = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

export function isPerformanceCrewRole(role?: string | null): boolean {
  if (!role) return false;
  return PERFORMANCE_CREW_ROLE_ALIASES.has(role);
}

export function getVenueLiveSetupTarget(capacity?: number | null): { target: number; label: string } {
  const safeCapacity = Math.max(0, Number(capacity || 0));
  if (safeCapacity <= 250) return { target: 45, label: 'Basic' };
  if (safeCapacity <= 1_000) return { target: 60, label: 'Touring' };
  if (safeCapacity <= 5_000) return { target: 72, label: 'Professional' };
  if (safeCapacity <= 20_000) return { target: 84, label: 'Elite' };
  return { target: 92, label: 'World Class' };
}

function getRating(score: number): string {
  if (score >= 90) return 'World Class';
  if (score >= 80) return 'Elite';
  if (score >= 70) return 'Professional';
  if (score >= 55) return 'Touring';
  return 'Basic';
}

function getRecommendation(equipment: number, crew: number, target: number): string {
  const equipmentGap = target - equipment;
  const crewGap = target - crew;

  if (equipmentGap <= 0 && crewGap <= 0) {
    return 'Your Live Setup is suitable for this venue. Focus on setlist, rehearsal and soundcheck.';
  }

  if (equipmentGap >= crewGap) {
    return `Upgrade or repair shared band equipment first. Equipment is ${Math.max(0, Math.round(equipmentGap))} points below this venue's target.`;
  }

  return `Improve your Show Crew first. Crew capability is ${Math.max(0, Math.round(crewGap))} points below this venue's target.`;
}

export function calculateLiveSetup(input: LiveSetupInput): LiveSetupResult {
  const equipmentScore = Math.round(clamp(input.equipmentQuality));
  const crewScore = Math.round(clamp(input.crewSkill));
  const score = Math.round(
    equipmentScore * LIVE_SETUP_WEIGHTS.equipment + crewScore * LIVE_SETUP_WEIGHTS.crew,
  );
  const venueTarget = getVenueLiveSetupTarget(input.venueCapacity);
  const gap = score - venueTarget.target;

  return {
    score,
    equipmentScore,
    crewScore,
    rating: getRating(score),
    status: gap >= 0 ? 'ready' : gap >= -12 ? 'warning' : 'critical',
    venueTarget,
    gap,
    recommendation: getRecommendation(equipmentScore, crewScore, venueTarget.target),
  };
}

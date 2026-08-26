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
  if (safeCapacity <= 150) return { target: 45, label: 'Basic' };
  if (safeCapacity <= 500) return { target: 60, label: 'Touring' };
  if (safeCapacity <= 1_500) return { target: 70, label: 'Professional' };
  if (safeCapacity <= 5_000) return { target: 82, label: 'Elite' };
  return { target: 90, label: 'World Class' };
}

function getRating(score: number): string {
  if (score >= 90) return 'World Class';
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Developing';
  return 'Needs Work';
}

export function calculateLiveSetup(input: LiveSetupInput): LiveSetupResult {
  const equipmentScore = Math.round(clamp(input.equipmentQuality));
  const crewScore = Math.round(clamp(input.crewSkill));
  const score = Math.round(
    equipmentScore * LIVE_SETUP_WEIGHTS.equipment + crewScore * LIVE_SETUP_WEIGHTS.crew,
  );
  const venueTarget = getVenueLiveSetupTarget(input.venueCapacity);
  const gap = score - venueTarget.target;

  let status: LiveSetupStatus = 'ready';
  if (gap < -15) status = 'critical';
  else if (gap < 0) status = 'warning';

  let recommendation = 'Your live setup is suitable for this size of show.';
  if (status !== 'ready') {
    if (equipmentScore + 5 < crewScore) {
      recommendation = 'Upgrade or repair your shared stage equipment first.';
    } else if (crewScore + 5 < equipmentScore) {
      recommendation = 'Improve your Show Crew first, especially sound and stage roles.';
    } else {
      recommendation = 'Improve both shared equipment and Show Crew before larger shows.';
    }
  }

  return {
    score,
    equipmentScore,
    crewScore,
    rating: getRating(score),
    status,
    venueTarget,
    gap,
    recommendation,
  };
}

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
export type EquipmentSelectionMode = 'selected' | 'automatic' | 'baseline';

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

export interface BandStageEquipmentLike {
  id?: string | null;
  equipment_type?: string | null;
  quality_rating?: number | null;
  condition_rating?: number | null;
  is_active?: boolean | null;
}

export interface BandEquipmentResolution {
  score: number;
  selectionMode: EquipmentSelectionMode;
  selectedCount: number;
  ownedCount: number;
  selectedIds: string[];
}

const clamp = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

export function isPerformanceCrewRole(role?: string | null): boolean {
  if (!role) return false;
  return PERFORMANCE_CREW_ROLE_ALIASES.has(role);
}

export function getEquipmentEffectiveQuality(item: BandStageEquipmentLike): number {
  const quality = clamp(Number(item.quality_rating ?? 40));
  const condition = clamp(Number(item.condition_rating ?? 70));
  // Quality remains the main factor while maintenance now has a meaningful, bounded effect.
  return Math.round(quality * 0.75 + condition * 0.25);
}

/**
 * Resolve the shared Band Equipment that contributes to Live Setup.
 * - Explicitly selected (`is_active`) equipment always wins.
 * - Existing bands with no selection automatically use the best item of each equipment type.
 * - No owned equipment falls back to the historic 40/100 baseline.
 */
export function resolveBandEquipment(rows: BandStageEquipmentLike[] | null | undefined): BandEquipmentResolution {
  const equipment = rows || [];
  if (equipment.length === 0) {
    return { score: 40, selectionMode: 'baseline', selectedCount: 0, ownedCount: 0, selectedIds: [] };
  }

  const explicitlySelected = equipment.filter((item) => Boolean(item.is_active));
  let chosen: BandStageEquipmentLike[];
  let selectionMode: EquipmentSelectionMode;

  if (explicitlySelected.length > 0) {
    chosen = explicitlySelected;
    selectionMode = 'selected';
  } else {
    const bestByType = new Map<string, BandStageEquipmentLike>();
    equipment.forEach((item, index) => {
      const type = String(item.equipment_type || `equipment-${index}`).toLowerCase();
      const current = bestByType.get(type);
      if (!current || getEquipmentEffectiveQuality(item) > getEquipmentEffectiveQuality(current)) {
        bestByType.set(type, item);
      }
    });
    chosen = [...bestByType.values()];
    selectionMode = 'automatic';
  }

  const score = chosen.length > 0
    ? Math.round(chosen.reduce((sum, item) => sum + getEquipmentEffectiveQuality(item), 0) / chosen.length)
    : 40;

  return {
    score,
    selectionMode,
    selectedCount: chosen.length,
    ownedCount: equipment.length,
    selectedIds: chosen.map((item) => item.id).filter((id): id is string => Boolean(id)),
  };
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

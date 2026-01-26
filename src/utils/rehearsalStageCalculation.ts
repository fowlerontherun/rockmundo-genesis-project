/**
 * Shared utility for calculating rehearsal stage values that match database constraints.
 * The database CHECK constraint only allows: 'unlearned', 'learning', 'familiar', 'well_rehearsed', 'perfected'
 */

export type RehearsalStage = 'unlearned' | 'learning' | 'familiar' | 'well_rehearsed' | 'perfected';

export const STAGE_THRESHOLDS = {
  unlearned: { min: 0, max: 59 },
  learning: { min: 60, max: 299 },
  familiar: { min: 300, max: 899 },
  well_rehearsed: { min: 900, max: 1799 },
  perfected: { min: 1800, max: Infinity },
} as const;

/**
 * Calculate the rehearsal stage based on total minutes practiced.
 * Returns a database-compliant stage value.
 */
export function calculateRehearsalStage(totalMinutes: number): RehearsalStage {
  if (totalMinutes >= 1800) return 'perfected';
  if (totalMinutes >= 900) return 'well_rehearsed';
  if (totalMinutes >= 300) return 'familiar';
  if (totalMinutes >= 60) return 'learning';
  return 'unlearned';
}

/**
 * Get the display name for a rehearsal stage.
 */
export function getStageDisplayName(stage: RehearsalStage): string {
  switch (stage) {
    case 'perfected': return 'Perfected';
    case 'well_rehearsed': return 'Well Rehearsed';
    case 'familiar': return 'Familiar';
    case 'learning': return 'Learning';
    case 'unlearned': return 'Unlearned';
  }
}

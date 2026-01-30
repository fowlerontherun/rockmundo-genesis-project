/**
 * Shared utility for calculating rehearsal stage values that match database constraints.
 * The database CHECK constraint only allows: 'unlearned', 'learning', 'familiar', 'well_rehearsed', 'perfected'
 */

export type RehearsalStage = 'unlearned' | 'learning' | 'familiar' | 'well_rehearsed' | 'perfected';

// Thresholds aligned to user expectations: 4h = Familiar, 6h = Perfected
export const STAGE_THRESHOLDS = {
  unlearned: { min: 0, max: 59 },
  learning: { min: 60, max: 179 },      // 1-3 hours
  familiar: { min: 180, max: 299 },     // 3-5 hours
  well_rehearsed: { min: 300, max: 359 }, // 5-6 hours
  perfected: { min: 360, max: Infinity }, // 6+ hours
} as const;

/**
 * Calculate the rehearsal stage based on total minutes practiced.
 * Returns a database-compliant stage value.
 * Aligned with user expectations: 6 hours = Perfected
 */
export function calculateRehearsalStage(totalMinutes: number): RehearsalStage {
  if (totalMinutes >= 360) return 'perfected';
  if (totalMinutes >= 300) return 'well_rehearsed';
  if (totalMinutes >= 180) return 'familiar';
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

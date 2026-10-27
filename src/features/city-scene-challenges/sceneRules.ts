/** Pure City Scene Challenge rules. Server owns the authoritative cycle and totals. */
export type SceneCadence = 'daily' | 'weekly' | 'monthly';

export interface SceneCycleBounds {
  startsAt: string;
  endsAt: string;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getSceneCycleBounds(cadence: SceneCadence, at: Date): SceneCycleBounds {
  if (Number.isNaN(at.getTime())) throw new RangeError('Invalid cycle instant');
  const midnight = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  let start = midnight;
  let end: number;

  if (cadence === 'daily') {
    end = start + MILLISECONDS_PER_DAY;
  } else if (cadence === 'weekly') {
    // ISO weeks begin on Monday, including across month/year boundaries.
    const day = new Date(midnight).getUTCDay();
    start -= ((day + 6) % 7) * MILLISECONDS_PER_DAY;
    end = start + 7 * MILLISECONDS_PER_DAY;
  } else if (cadence === 'monthly') {
    start = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1);
    end = Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1);
  } else {
    throw new RangeError('Unsupported scene cadence');
  }

  return { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() };
}

export function getSceneTarget(cadence: SceneCadence, eligibleAccounts: number): number {
  if (!Number.isSafeInteger(eligibleAccounts) || eligibleAccounts < 0) {
    throw new RangeError('Eligible account count must be a non-negative integer');
  }
  const n = Math.max(1, eligibleAccounts);
  switch (cadence) {
    case 'daily': return Math.max(4, 3 * n);
    case 'weekly': return Math.max(12, 10 * n);
    case 'monthly': return Math.max(40, 35 * n);
    default: throw new RangeError('Unsupported scene cadence');
  }
}

/** Distribute a fixed target without losing points due to rounding. */
export function allocateSceneTarget(total: number, weights: readonly number[]): number[] {
  if (!Number.isSafeInteger(total) || total < weights.length || weights.length === 0 ||
      weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
    throw new RangeError('Invalid total or weights');
  }
  const minimums = weights.map(() => 1);
  const remainder = total - weights.length;
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const shares = weights.map((weight) => remainder * weight / weightSum);
  const result = shares.map((share, index) => Math.floor(share) + minimums[index]);
  let missing = total - result.reduce((sum, value) => sum + value, 0);
  const order = shares.map((share, index) => ({ index, fractional: share - Math.floor(share) }))
    .sort((left, right) => right.fractional - left.fractional || left.index - right.index);
  for (const { index } of order) {
    if (missing === 0) break;
    result[index] = (result[index] ?? 0) + 1;
    missing -= 1;
  }
  return result;
}

export type ScenePosterStage = 0 | 25 | 50 | 75 | 100;
export function getScenePosterStage(earned: number, target: number): ScenePosterStage {
  if (!Number.isFinite(earned) || !Number.isFinite(target) || target <= 0) return 0;
  const ratio = Math.max(0, earned) / target;
  if (ratio >= 1) return 100;
  if (ratio >= 0.75) return 75;
  if (ratio >= 0.5) return 50;
  if (ratio >= 0.25) return 25;
  return 0;
}

/** A rendered mural may only reveal stages persisted by the server.
 * Undefined preserves the offline/standalone preview behaviour. An explicitly
 * empty list means that no actual milestone has been granted yet.
 */
export function getConfirmedScenePosterStage(
  confirmedMilestones: readonly number[] | undefined,
  earned: number,
  target: number,
): ScenePosterStage {
  if (confirmedMilestones === undefined) return getScenePosterStage(earned, target);
  for (const threshold of [100, 75, 50, 25] as const) {
    if (confirmedMilestones.includes(threshold)) return threshold;
  }
  return 0;
}

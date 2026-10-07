export const FAME_SHARE_THRESHOLDS = [1_000, 10_000, 100_000, 1_000_000, 10_000_000] as const;
export const REVENUE_SHARE_THRESHOLDS = [10_000, 100_000, 1_000_000, 10_000_000] as const;
export const STREAM_SHARE_THRESHOLDS = [10_000, 100_000, 1_000_000, 10_000_000, 100_000_000] as const;
export const FAN_SHARE_THRESHOLDS = [1_000, 10_000, 100_000, 1_000_000, 10_000_000] as const;

export function highestReachedThreshold(value: number, thresholds: readonly number[]): number | null {
  let reached: number | null = null;
  for (const threshold of thresholds) {
    if (value >= threshold) reached = threshold;
  }
  return reached;
}

export function milestoneLabel(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

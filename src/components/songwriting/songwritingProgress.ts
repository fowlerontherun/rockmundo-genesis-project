/** Writing progress uses a 2,000 point scale; presentation is always 0–100%. */
export function songwritingProgressPercent(
  progress: number | null | undefined,
  target = 2000,
): number {
  if (!Number.isFinite(progress) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((progress ?? 0) / target) * 100)));
}

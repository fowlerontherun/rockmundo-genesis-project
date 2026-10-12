/** A maxed skill has no further XP requirement and should display a complete bar. */
export function skillXpProgressPercent(xp: number, requiredXp: number): number {
  if (!Number.isFinite(requiredXp) || requiredXp <= 0) return 100;
  if (!Number.isFinite(xp)) return 0;
  return Math.max(0, Math.min(100, (xp / requiredXp) * 100));
}

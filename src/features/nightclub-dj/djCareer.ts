/** Read-only DJ career projection. No payouts or client-supplied rewards. */
export type DjCareerPerformance = {
  id: string;
  booking_id: string | null;
  performance_score: number | null;
  cash_earned: number | null;
  fame_gained: number | null;
  xp_gained: number | null;
};

export type DjCareerSummary = {
  verifiedTotal: number;
  sampled: number;
  recentCash: number;
  recentFame: number;
  recentXp: number;
  averageScore: number | null;
  isPartial: boolean;
};

function safeNumber(input: number | null | undefined): number {
  return typeof input === "number" && Number.isFinite(input) ? input : 0;
}

/**
 * Only booked, server-sourced history rows count toward verified DJ metrics.
 * A capped history query cannot be called a lifetime earnings total.
 */
export function summarizeDjCareer(
  rows: DjCareerPerformance[], verifiedRowCount: number | null,
): DjCareerSummary {
  const verified = rows.filter((row) => Boolean(row.booking_id));
  const scores = verified
    .map((row) => row.performance_score)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  return {
    verifiedTotal: Math.max(verified.length,
      Number.isFinite(verifiedRowCount) && verifiedRowCount !== null
        ? Math.max(0, verifiedRowCount) : verified.length),
    sampled: verified.length,
    recentCash: verified.reduce((sum, row) => sum + safeNumber(row.cash_earned), 0),
    recentFame: verified.reduce((sum, row) => sum + safeNumber(row.fame_gained), 0),
    recentXp: verified.reduce((sum, row) => sum + safeNumber(row.xp_gained), 0),
    averageScore: scores.length
      ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
      : null,
    isPartial: verifiedRowCount !== null && verifiedRowCount > verified.length,
  };
}

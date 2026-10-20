// Canonical live-set duration contract: match the same 180-second fallback
// used by the browser and scheduled auto-completion workers.
export type TimedGigSetlistItem = {
  songs?: { duration_seconds?: number | null } | null;
  performance_items_catalog?: { duration_seconds?: number | null } | null;
};

export function gigSetlistDurationSeconds(items: readonly TimedGigSetlistItem[], endExclusive = items.length): number {
  return items.slice(0, endExclusive).reduce<number>((sum, item) => {
    const duration = Number(item.songs?.duration_seconds || item.performance_items_catalog?.duration_seconds || 180);
    return sum + (Number.isFinite(duration) && duration > 0 ? duration : 180);
  }, 0);
}

export function gigPositionIsDue(startedAt: string | null | undefined, items: readonly TimedGigSetlistItem[], position: number, nowMs: number): boolean {
  const startedMs = Date.parse(startedAt || '');
  if (!Number.isFinite(startedMs) || !Number.isInteger(position) || position < 0 || position >= items.length) return false;
  return nowMs >= startedMs + gigSetlistDurationSeconds(items, position) * 1000;
}

export function gigCompletionIsDue(startedAt: string | null | undefined, items: readonly TimedGigSetlistItem[], nowMs: number): boolean {
  const startedMs = Date.parse(startedAt || '');
  if (!Number.isFinite(startedMs) || items.length === 0) return false;
  return nowMs >= startedMs + gigSetlistDurationSeconds(items) * 1000;
}

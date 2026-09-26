import type { FestivalScheduleItem } from "./model";

/** Display-only warnings; the server remains authoritative for publication conflicts. */
export function getRunningOrderWarnings(items: FestivalScheduleItem[], defaultChangeoverMinutes = 30) {
  const ordered = [...items].filter(item => item.starts_at && item.ends_at)
    .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
  return ordered.map((item, index) => {
    const next = ordered[index + 1];
    if (!next) return { itemId: item.id, warning: null };
    const end = Date.parse(String(item.ends_at));
    const start = Date.parse(String(next.starts_at));
    if (!Number.isFinite(end) || !Number.isFinite(start)) return { itemId: item.id, warning: null };
    const gap = Math.round((start - end) / 60000);
    if (gap < 0) return { itemId: item.id, warning: `Overlaps next act by ${-gap} min` };
    const changeover = item.changeover_minutes ?? defaultChangeoverMinutes;
    if (gap < changeover) return { itemId: item.id, warning: `Only ${gap} min before next act; ${changeover} min changeover expected` };
    return { itemId: item.id, warning: null };
  });
}

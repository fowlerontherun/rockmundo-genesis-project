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

/** Preview a move without touching booked contracts or the published revision.
 * Preserve the first stage start and each act's duration; use each preceding
 * act's changeover when calculating the next start. */
export function previewRunningOrderMove(
  items: FestivalScheduleItem[],
  itemId: string,
  direction: -1 | 1,
  defaultChangeoverMinutes = 30,
) {
  const ordered = [...items].sort((a, b) => String(a.starts_at ?? "").localeCompare(String(b.starts_at ?? ""));
  const from = ordered.findIndex(item => item.id === itemId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ordered.length || ordered.some(item => item.locked || !item.starts_at || !item.ends_at)) return null;
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  let cursor = Date.parse(String(items.reduce((earliest, item) =>
    String(item.starts_at) < String(earliest.starts_at) ? item : earliest, items[0]).starts_at));
  if (!Number.isFinite(cursor)) return null;
  return ordered.map((item, index) => {
    const startsAt = new Date(cursor).toISOString();
    const duration = item.duration_minutes;
    if (!Number.isInteger(duration) || duration <= 0) return null;
    const end = cursor + duration * 60000;
    const endsAt = new Date(end).toISOString();
    cursor = end + (index < ordered.length - 1 ? Math.max(0, item.changeover_minutes ?? defaultChangeoverMinutes) * 60000 : 0);
    return { id: item.id, title: item.title, startsAt, endsAt, durationMinutes: duration };
  }).every(Boolean) ? (() => {
    let start = Math.min(...items.map(item => Date.parse(String(item.starts_at))));
    return ordered.map((item, index) => {
      const startsAt = new Date(start).toISOString();
      const endsAt = new Date(start + item.duration_minutes * 60000).toISOString();
      start += (item.duration_minutes + (index < ordered.length - 1 ? Math.max(0, item.changeover_minutes ?? defaultChangeoverMinutes) : 0)) * 60000;
      return { id: item.id, title: item.title, startsAt, endsAt, durationMinutes: item.duration_minutes };
    });
  })() : null;
}

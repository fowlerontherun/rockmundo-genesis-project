import type { VenueArchetype } from "./VenueSceneRegistry";

export const REPRESENTATIVE_CROWD_MIN = 12;
export const REPRESENTATIVE_CROWD_MAX = 72;
const FALLBACK: Record<VenueArchetype, number> = { pub: 18, club: 26, theatre: 34, arena: 48, stadium: 64, festival: 58, beach: 38 };

/** Presentation-only population; deliberately does not mirror attendee records one-for-one. */
export function representativeCrowdCount(input: { attendance?: number | null; capacity?: number | null; archetype: VenueArchetype }): number {
  const attendance = Number.isFinite(input.attendance) && (input.attendance ?? 0) > 0 ? input.attendance! : null;
  const capacity = Number.isFinite(input.capacity) && (input.capacity ?? 0) > 0 ? input.capacity! : null;
  if (attendance == null && capacity == null) return FALLBACK[input.archetype];
  const reference = attendance ?? capacity! * .65;
  const density = capacity ? Math.max(.15, Math.min(1, reference / capacity)) : .65;
  const apparent = Math.round(10 + Math.sqrt(Math.max(1, reference)) * .36 + density * 18);
  return Math.max(REPRESENTATIVE_CROWD_MIN, Math.min(REPRESENTATIVE_CROWD_MAX, apparent));
}

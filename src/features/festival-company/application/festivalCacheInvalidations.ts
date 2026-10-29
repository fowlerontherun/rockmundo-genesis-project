/**
 * Festival changes affect more than the owner editor. Public views, timetable,
 * ticket products and active artist opportunities must not keep older cache
 * entries after a successful server-authoritative mutation.
 */
export const festivalLaunchInvalidations = (festivalCompanyId?: string): readonly (readonly string[])[] => [
  ["festival-launch"],
  ["festival-sales-summary"],
  ["festival-player-sales-breakdown"],
  ["festival-directory"],
  ["public-festival"],
  ["public-festival-timetable"],
  ["public-festival-tickets"],
  ["festival-artist-programme"],
  ["festival-artist-opportunities"],
  ["festival-owner-npc-lineup"],
  ["festival-company-setup"],
  ["festival-company-editions", festivalCompanyId ?? ""],
  ["notifications"],
  ["mail"],
];

export const festivalBookingInvalidations: readonly (readonly string[])[] = [
  ["festival-artist-programme"],
  ["festival-artist-candidates"],
  ["festival-artist-opportunities"],
  ["festival-owner-npc-lineup"],
  ["festival-company-setup"],
  ["festival-company-editions"],
  ["festival-launch"],
  ["public-festival"],
  ["public-festival-timetable"],
  ["festival-directory"],
  ["notifications"],
  ["mail"],
];

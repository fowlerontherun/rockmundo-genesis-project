export const FESTIVAL_EDITION_STATUSES = [
  "concept",
  "planning",
  "applications_open",
  "booking",
  "announced",
  "on_sale",
  "setup",
  "live",
  "settling",
  "completed",
  "postponed",
  "cancelled",
  "abandoned",
] as const;

export type FestivalEditionStatus = (typeof FESTIVAL_EDITION_STATUSES)[number];

export const FESTIVAL_EDITION_STATUS_LABELS: Record<
  FestivalEditionStatus,
  string
> = {
  concept: "Concept",
  planning: "Planning",
  applications_open: "Applications open",
  booking: "Booking",
  announced: "Announced",
  on_sale: "On sale",
  setup: "Setup",
  live: "Live",
  settling: "Settling",
  completed: "Completed",
  postponed: "Postponed",
  cancelled: "Cancelled",
  abandoned: "Abandoned",
};

const PUBLIC_STATUSES = new Set<FestivalEditionStatus>([
  "applications_open",
  "booking",
  "announced",
  "on_sale",
  "setup",
  "live",
  "settling",
  "completed",
]);

const TERMINAL_STATUSES = new Set<FestivalEditionStatus>([
  "completed",
  "cancelled",
  "abandoned",
]);

const TRANSITIONS: Partial<
  Record<FestivalEditionStatus, FestivalEditionStatus[]>
> = {
  concept: ["planning", "cancelled", "abandoned"],
  planning: [
    "applications_open",
    "booking",
    "postponed",
    "cancelled",
    "abandoned",
  ],
  applications_open: ["booking", "postponed", "cancelled", "abandoned"],
  booking: ["announced", "postponed", "cancelled", "abandoned"],
  announced: ["on_sale", "setup", "postponed", "cancelled", "abandoned"],
  on_sale: ["setup", "postponed", "cancelled", "abandoned"],
  setup: ["live", "cancelled", "abandoned"],
  live: ["settling"],
  settling: ["completed"],
  postponed: ["planning", "announced", "cancelled", "abandoned"],
};

export function getFestivalEditionStatusLabel(
  status: FestivalEditionStatus,
): string {
  return FESTIVAL_EDITION_STATUS_LABELS[status];
}

export function isFestivalEditionTerminal(
  status: FestivalEditionStatus,
): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isFestivalEditionPubliclyVisible(
  status: FestivalEditionStatus,
): boolean {
  return PUBLIC_STATUSES.has(status);
}

/**
 * UI-only advisory transition check. The transition_festival_edition RPC is the
 * authoritative validator and also enforces permission, readiness and idempotency.
 */
export function canShowFestivalEditionTransition(
  from: FestivalEditionStatus,
  to: FestivalEditionStatus,
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

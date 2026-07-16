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
  if (from === to) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export type ManagedFestivalEditionLike = {
  id: string;
  status: FestivalEditionStatus;
  edition_number: number | null;
  start_at: string | null;
  end_at: string | null;
  completed_at?: string | null;
};

const UPCOMING_ACTIVE = new Set<FestivalEditionStatus>([
  "setup",
  "on_sale",
  "announced",
]);
const UPCOMING_PLANNING = new Set<FestivalEditionStatus>([
  "booking",
  "applications_open",
  "planning",
]);

const timeOrInfinity = (value: string | null | undefined) =>
  value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
const timeOrZero = (value: string | null | undefined) =>
  value ? new Date(value).getTime() : 0;

export function selectManagedFestivalEdition<T extends ManagedFestivalEditionLike>(
  editions: readonly T[],
  now: Date = new Date(),
): T | null {
  if (editions.length === 0) return null;
  const currentTime = now.getTime();
  const byStartAsc = (a: T, b: T) =>
    timeOrInfinity(a.start_at) - timeOrInfinity(b.start_at) ||
    Number(b.edition_number ?? 0) - Number(a.edition_number ?? 0);
  const byRecent = (a: T, b: T) =>
    timeOrZero(b.completed_at ?? b.end_at) - timeOrZero(a.completed_at ?? a.end_at) ||
    Number(b.edition_number ?? 0) - Number(a.edition_number ?? 0);
  const live = editions
    .filter((edition) => edition.status === "live")
    .sort(byStartAsc)[0];
  if (live) return live;
  const upcomingActive = editions
    .filter(
      (edition) =>
        UPCOMING_ACTIVE.has(edition.status) &&
        timeOrInfinity(edition.start_at) >= currentTime,
    )
    .sort(byStartAsc)[0];
  if (upcomingActive) return upcomingActive;
  const upcomingPlanning = editions
    .filter(
      (edition) =>
        UPCOMING_PLANNING.has(edition.status) &&
        timeOrInfinity(edition.start_at) >= currentTime,
    )
    .sort(byStartAsc)[0];
  if (upcomingPlanning) return upcomingPlanning;
  const completed = editions
    .filter((edition) => edition.status === "completed")
    .sort(byRecent)[0];
  if (completed) return completed;
  return [...editions].sort(
    (a, b) => Number(b.edition_number ?? 0) - Number(a.edition_number ?? 0),
  )[0];
}

export function getFestivalEditionActionLabel(
  status: FestivalEditionStatus | null | undefined,
): string {
  switch (status) {
    case "announced":
      return "Edition announced";
    case "on_sale":
      return "Tickets on sale";
    case "setup":
      return "Ready for live operations";
    case "live":
      return "Festival live";
    default:
      return "Announce edition";
  }
}

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

export type ManagedFestivalEdition = {
  id: string;
  edition_number: number;
  status: FestivalEditionStatus;
  start_at: string | null;
  end_at?: string | null;
  completed_at?: string | null;
};

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

export function canShowFestivalEditionTransition(
  from: FestivalEditionStatus,
  to: FestivalEditionStatus,
): boolean {
  if (from === to) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getFestivalEditionActionLabel(
  status?: FestivalEditionStatus | null,
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
    case "settling":
      return "Settling edition";
    case "completed":
      return "Edition completed";
    default:
      return "Announce edition";
  }
}

const timeValue = (
  value: string | null | undefined,
  fallback: number,
): number => (value ? new Date(value).getTime() : fallback);

export function selectManagedFestivalEdition<T extends ManagedFestivalEdition>(
  editions: T[],
  now: Date = new Date(),
): T | null {
  if (editions.length === 0) return null;
  const nowMs = now.getTime();
  const byEditionDesc = (a: T, b: T) => b.edition_number - a.edition_number;
  const live = editions
    .filter((e) => e.status === "live")
    .sort(
      (a, b) =>
        timeValue(b.start_at, 0) - timeValue(a.start_at, 0) ||
        byEditionDesc(a, b),
    )[0];
  if (live) return live;
  const upcomingActive = editions
    .filter(
      (e) =>
        ["setup", "on_sale", "announced"].includes(e.status) &&
        timeValue(e.start_at, Number.MAX_SAFE_INTEGER) >= nowMs,
    )
    .sort(
      (a, b) =>
        timeValue(a.start_at, Number.MAX_SAFE_INTEGER) -
          timeValue(b.start_at, Number.MAX_SAFE_INTEGER) || byEditionDesc(a, b),
    )[0];
  if (upcomingActive) return upcomingActive;
  const upcomingPlanning = editions
    .filter(
      (e) =>
        ["booking", "applications_open", "planning"].includes(e.status) &&
        timeValue(e.start_at, Number.MAX_SAFE_INTEGER) >= nowMs,
    )
    .sort(
      (a, b) =>
        timeValue(a.start_at, Number.MAX_SAFE_INTEGER) -
          timeValue(b.start_at, Number.MAX_SAFE_INTEGER) || byEditionDesc(a, b),
    )[0];
  if (upcomingPlanning) return upcomingPlanning;
  const completed = editions
    .filter((e) => e.status === "completed")
    .sort(
      (a, b) =>
        timeValue(b.completed_at ?? b.end_at, 0) -
          timeValue(a.completed_at ?? a.end_at, 0) || byEditionDesc(a, b),
    )[0];
  if (completed) return completed;
  return [...editions].sort(byEditionDesc)[0] ?? null;
}

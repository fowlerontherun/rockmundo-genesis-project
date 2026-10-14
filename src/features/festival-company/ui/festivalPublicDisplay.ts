import type { FestivalIssuedTicket, FestivalLaunchStatus, FestivalPublicSponsor } from "../domain/festivalLaunch";
import type { FestivalPublicEventPhase } from "./festivalEventPhase";

/** Stage and both endpoints are required before advertising a performance. */
export function isPublishedFestivalPerformance(entry: {
  startsAt: string | null;
  endsAt: string | null;
  stageName: string | null;
}): boolean {
  if (!entry.startsAt || !entry.endsAt || !entry.stageName?.trim()) return false;
  const start = Date.parse(entry.startsAt);
  const end = Date.parse(entry.endsAt);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

/** Never render cached eligibility messages after an authoritative query failure. */
export function canDisplayFestivalCheckInMessage(
  hasEligibility: boolean,
  walletError: boolean,
  eligibilityError: boolean,
): boolean {
  return hasEligibility && !walletError && !eligibilityError;
}

/**
 * "Used" admission means the character has checked in; it is not a
 * missing admission. Transfers and cancellations cease to belong to them.
 */
export function hasIssuedFestivalAdmission(
  tickets: readonly Pick<FestivalIssuedTicket, "productClass" | "status">[],
): boolean {
  return tickets.some((ticket) =>
    ticket.productClass === "admission" &&
    !["cancelled", "refunded", "transferred"].includes(ticket.status),
  );
}

/** Event dates override a stale ticket-sales lifecycle flag. */
export function festivalVisitorSalesLabel(
  phase: FestivalPublicEventPhase,
  launchStatus: FestivalLaunchStatus,
): string {
  // An edition cancellation is authoritative, even if dates have passed.
  if (launchStatus === "cancelled_before_event") return "Festival cancelled";
  if (phase === "dates_ended") return "Festival ended";
  return launchStatus === "tickets_on_sale" ? "On sale" : "Not currently on sale";
}

/**
 * Display the actual edition's date, not the visitor device's local day.
 * An unsupported timezone fails over to UTC instead of crashing the page.
 */
export function formatFestivalEditionDate(
  timestamp: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric", month: "long", year: "numeric",
  },
): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "Date to be confirmed";
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(date);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(date);
  }
}

/** Cancellation takes precedence over a date-derived Upcoming/Live/Ended badge. */
export function festivalVisitorEventLabel(
  phase: FestivalPublicEventPhase,
  launchStatus: FestivalLaunchStatus,
): string {
  if (launchStatus === "cancelled_before_event") return "Festival cancelled";
  return phase === "upcoming" ? "Upcoming Festival"
    : phase === "in_progress" ? "Festival dates under way"
    : "Festival dates ended";
}

/** Display-only ordering; original contract roles and identities stay untouched. */
export function isMainFestivalSponsor(
  sponsor: Pick<FestivalPublicSponsor, "relationshipLabel">,
): boolean {
  return /^(?:main|title|principal|headline)(?:\s+(?:sponsor|partner))?$/i
    .test(sponsor.relationshipLabel.trim());
}

export function orderFestivalPublicSponsors(
  sponsors: readonly FestivalPublicSponsor[],
): FestivalPublicSponsor[] {
  return [...sponsors].sort((a, b) =>
    Number(isMainFestivalSponsor(b)) - Number(isMainFestivalSponsor(a)));
}

/**
 * Show published performance times in festival-local time, without allowing an
 * invalid imported IANA timezone (or timestamp) to crash a public page.
 */
export function formatFestivalEditionTime(
  timestamp: string,
  timeZone: string,
): string {
  return formatFestivalEditionDate(timestamp, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).replace("Date to be confirmed", "Time to be announced");
}

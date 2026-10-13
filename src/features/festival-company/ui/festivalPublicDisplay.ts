import type { FestivalIssuedTicket, FestivalLaunchStatus } from "../domain/festivalLaunch";
import type { FestivalPublicEventPhase } from "./festivalEventPhase";

/** Stage and both endpoints are required before advertising a performance. */
export function isPublishedFestivalPerformance(entry: {
  startsAt: string | null;
  endsAt: string | null;
  stageName: string | null;
}): boolean {
  return Boolean(entry.startsAt && entry.endsAt && entry.stageName?.trim());
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

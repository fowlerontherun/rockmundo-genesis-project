import type { FestivalIssuedTicket, FestivalLaunchStatus, FestivalPublicSponsor } from "../domain/festivalLaunch";
import type { FestivalPublicEventPhase } from "./festivalEventPhase";
import { isSafeSponsorLogoReference } from "./SponsorIdentity";

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
  // A repeated projection row is the same sponsor, not an additional slot.
  // Do not mutate the signed roster; dedupe only the public display.
  const prioritized = [...sponsors].sort((a, b) =>
    Number(isMainFestivalSponsor(b)) - Number(isMainFestivalSponsor(a)));
  return prioritized.filter((sponsor, index) =>
    prioritized.findIndex((candidate) => candidate.id === sponsor.id) === index);
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


/** Public-only audit. Never hide real signed partners to cosmetically meet a cap. */
export function auditFestivalSponsorSlots(
  sponsors: readonly FestivalPublicSponsor[],
): { mainCount: number; supportingCount: number; duplicateIds: boolean; missingLogos: number; ready: boolean } {
  const mainCount = sponsors.filter(isMainFestivalSponsor).length;
  const supportingCount = sponsors.length - mainCount;
  return {
    mainCount, supportingCount,
    duplicateIds: new Set(sponsors.map(sponsor => sponsor.id)).size !== sponsors.length,
    // A syntactically present but unsafe legacy URL is still a missing usable
    // brand asset. Never advertise it as a completed sponsor identity.
    missingLogos: sponsors.filter(sponsor =>
      !sponsor.logoReference || !isSafeSponsorLogoReference(sponsor.logoReference)).length,
    ready: mainCount === 1 && supportingCount <= 4 &&
      new Set(sponsors.map(sponsor => sponsor.id)).size === sponsors.length,
  };
}

/** Derived only from published festival ticket products. Never imply an
 * add-on provides entry or that camping facilities exist without confirmation. */
export function getPublishedFestivalCampingTickets(
  products: readonly { name: string; ticketType: string; productClass: string; saleStatus: string }[],
): { name: string; saleStatus: string }[] {
  return products
    .filter(product => /\bcamp(?:ing)?\b/i.test(`${product.name} ${product.ticketType}`))
    .map(product => ({ name: product.name, saleStatus: product.saleStatus }));
}

/** Only link an exact organiser-published email or HTTPS destination.
 * Never reinterpret policy prose or free-text contact details as a URL. */
export function festivalVisitorContactLink(raw: string | null): string | null {
  const value = raw?.trim() ?? "";
  if (!value || /[\r\n]/.test(value)) return null;
  if (/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(value)) {
    return `mailto:${value}`;
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname && !url.username && !url.password &&
        !/[\s\\]/.test(value)) return url.href;
  } catch { /* unpublished text, not a link */ }
  return null;
}

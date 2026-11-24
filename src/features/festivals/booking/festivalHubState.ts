import type { PublicFestivalEdition } from "./domainTypes";

const APPLY_STATUSES = new Set([
  "accepting_applications",
  "booking",
  "announced",
  "on_sale",
]);

export function getFestivalApplicationAvailability(
  edition: PublicFestivalEdition,
  bandId?: string,
  now = Date.now(),
): { canApply: boolean; reason: string } {
  if (!bandId) return { canApply: false, reason: "Select a band first." };
  if (!APPLY_STATUSES.has(edition.status ?? "")) {
    return { canApply: false, reason: "This edition is not accepting applications." };
  }
  if (edition.application_open_at) {
    const opening = Date.parse(edition.application_open_at);
    if (!Number.isFinite(opening) || now < opening) {
      return { canApply: false, reason: "Applications have not opened yet." };
    }
  }
  if (edition.application_close_at) {
    const deadline = Date.parse(edition.application_close_at);
    if (!Number.isFinite(deadline) || now >= deadline) {
      return { canApply: false, reason: "The application deadline has passed." };
    }
  }
  // This is only a UI guard; the authoritative submission still verifies eligibility.
  return { canApply: true, reason: "Apply to perform." };
}

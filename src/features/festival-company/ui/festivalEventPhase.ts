/** Display phase inferred from the published Festival dates; never used for financial authority. */
export type FestivalPublicEventPhase = "upcoming" | "in_progress" | "dates_ended";

export function getFestivalPublicEventPhase(
  startsAt: string,
  endsAt: string,
  now = Date.now(),
): FestivalPublicEventPhase {
  const starts = Date.parse(startsAt);
  const ends = Date.parse(endsAt);
  if (!Number.isFinite(starts) || !Number.isFinite(ends) || ends < starts) {
    return "upcoming";
  }
  if (now < starts) return "upcoming";
  if (now <= ends) return "in_progress";
  return "dates_ended";
}

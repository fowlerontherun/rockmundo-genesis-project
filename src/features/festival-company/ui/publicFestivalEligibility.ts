/** A stale successful query must never override a later verification failure. */
export function canOfferFestivalCheckIn(
  eligibility: { canCheckIn: boolean } | null | undefined,
  walletError: unknown,
  eligibilityError: unknown,
): boolean {
  return Boolean(eligibility?.canCheckIn) && !walletError && !eligibilityError;
}

/** A ticket purchase belongs to an actual active character, not only a login. */
export function canStartFestivalTicketPurchase(
  authenticated: boolean,
  activeProfileId: string | null | undefined,
): boolean {
  return authenticated && Boolean(activeProfileId);
}

export interface FestivalPurchaseAttempt {
  festivalLaunchId: string;
  ticketProductId: string;
  quantity: number;
  idempotencyKey: string;
}

/**
 * Retry an uncertain payment only within the same character and exact cart.
 * A confirmed attempt releases its reserved key even when the active character
 * was switched while the network request was in flight.
 */
export class FestivalTicketPurchaseRetryKeys {
  private readonly outstanding = new Map<string, string>();
  private readonly submitted = new WeakMap<FestivalPurchaseAttempt, string>();

  prepare(profileId: string, attempt: FestivalPurchaseAttempt): string {
    if (!profileId) throw new Error("Select an active character before buying festival tickets.");
    const signature = [
      profileId, attempt.festivalLaunchId, attempt.ticketProductId, attempt.quantity,
    ].join(":");
    this.submitted.set(attempt, signature);

    const existing = this.outstanding.get(signature);
    if (existing) return existing;

    this.outstanding.set(signature, attempt.idempotencyKey);
    return attempt.idempotencyKey;
  }

  confirm(attempt: FestivalPurchaseAttempt): void {
    const signature = this.submitted.get(attempt);
    if (signature) this.outstanding.delete(signature);
    this.submitted.delete(attempt);
  }
}

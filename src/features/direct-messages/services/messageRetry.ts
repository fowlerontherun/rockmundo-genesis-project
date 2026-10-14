/**
 * One stable client message ID per pending logical send. Retrying an
 * uncertain failure uses the same ID, but completing message A must not
 * erase the retry identity of a different still-pending message B.
 */
export class DirectMessageRetryTracker {
  private readonly pending = new Map<string, string>();

  claim(identity: string, newId: () => string = () => crypto.randomUUID()): string {
    const existing = this.pending.get(identity);
    if (existing) return existing;
    const id = newId();
    this.pending.set(identity, id);
    return id;
  }

  complete(identity: string, id: string): void {
    if (this.pending.get(identity) === id) this.pending.delete(identity);
  }

  pendingId(identity: string): string | undefined {
    return this.pending.get(identity);
  }
}

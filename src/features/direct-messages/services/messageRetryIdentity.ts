/**
 * Message retries retain their own request ID until *that request* succeeds.
 * Another pending send cannot have its key erased by a different completion.
 */
export class MessageRetryIdentities {
  private readonly pending = new Map<string, string>();

  getOrCreate(identity: string, makeId: () => string): string {
    const existing = this.pending.get(identity);
    if (existing) return existing;
    const id = makeId();
    this.pending.set(identity, id);
    return id;
  }

  confirm(identity: string, id: string): void {
    if (this.pending.get(identity) === id) this.pending.delete(identity);
  }
}

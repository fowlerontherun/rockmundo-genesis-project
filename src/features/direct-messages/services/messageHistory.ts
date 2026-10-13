export interface TimestampedMessage {
  id: string;
  created_at: string;
}

/** The SQL/RPC returns each batch oldest-to-newest, newest page first. */
export function mergeMessagePages<T extends TimestampedMessage>(pages: ReadonlyArray<ReadonlyArray<T>>): T[] {
  const byId = new Map<string, T>();
  for (const page of pages) for (const message of page) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) =>
    a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

/** A full page means an older batch may exist. */
export function nextMessageCursor(messages: ReadonlyArray<TimestampedMessage>, pageSize: number): string | undefined {
  if (messages.length < pageSize) return undefined;
  return messages[0]?.created_at;
}

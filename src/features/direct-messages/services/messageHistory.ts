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


/** Direct history is sorted by (created_at DESC, id DESC).
 * A timestamp alone loses rows when many messages share the boundary instant. */
export interface DirectMessageCursor {
  created_at: string;
  id: string;
}

export function nextDirectMessageCursor(
  messages: ReadonlyArray<TimestampedMessage>, pageSize: number,
): DirectMessageCursor | undefined {
  if (messages.length < pageSize || !messages[0]) return undefined;
  return { created_at: messages[0].created_at, id: messages[0].id };
}

/** PostgREST OR grammar: combine thread membership AND the *same* keyset
 * predicate, so neither canonical nor legacy fallback messages bypass paging. */
export function directMessageHistoryPredicate(
  conversationId: string,
  channelId: string,
  cursor?: DirectMessageCursor | null,
): string {
  const keyset = cursor
    ? `,or(created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id}))`
    : "";
  return `and(conversation_id.eq.${conversationId}${keyset}),and(conversation_id.is.null,channel_id.eq.${channelId}${keyset})`;
}

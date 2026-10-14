import type { TimestampedMessage } from "./messageHistory";

export interface DirectMessageKeyset {
  createdAt: string;
  id: string;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The latest page is returned oldest-to-newest. Timestamp alone loses rows
 * when many messages share the page-boundary timestamp.
 */
export function nextDirectMessageCursor(
  messages: ReadonlyArray<TimestampedMessage>,
  pageSize: number,
): string | undefined {
  if (messages.length < pageSize || !messages.length) return undefined;
  return JSON.stringify({ createdAt: messages[0].created_at, id: messages[0].id });
}

export function parseDirectMessageCursor(value: string): DirectMessageKeyset {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Invalid direct-message page cursor.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid direct-message page cursor.");
  const cursor = parsed as Partial<DirectMessageKeyset>;
  if (
    typeof cursor.createdAt !== "string" ||
    !Number.isFinite(Date.parse(cursor.createdAt)) ||
    typeof cursor.id !== "string" ||
    !UUID.test(cursor.id)
  ) throw new Error("Invalid direct-message page cursor.");
  return { createdAt: cursor.createdAt, id: cursor.id };
}

/** A *single* PostgREST OR expression preserves conversation + keyset scope. */
export function directMessageHistoryFilter(
  conversationId: string | null,
  channelId: string,
  pageCursor: string | null,
): string {
  if (!channelId) throw new Error("Missing direct message channel.");
  const scope = conversationId
    ? `or(conversation_id.eq.${conversationId},and(conversation_id.is.null,channel_id.eq.${channelId}))`
    : `channel_id.eq.${channelId}`;
  if (!pageCursor) return scope;

  const { createdAt, id } = parseDirectMessageCursor(pageCursor);
  return `and(${scope},created_at.lt.${createdAt}),and(${scope},created_at.eq.${createdAt},id.lt.${id})`;
}

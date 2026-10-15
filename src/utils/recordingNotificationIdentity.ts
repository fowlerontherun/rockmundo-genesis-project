/**
 * Stable event IDs make recording notifications safe to replay after the
 * finance RPC has committed a booking, even across separate browser tabs.
 */
export function recordingAbsentEventKey(sessionId: string, profileOrUserId: string): string {
  return `recording:absent:${sessionId}:${profileOrUserId}`;
}

/**
 * Generate a deterministic UUIDv8 from the booking and recipient. The inbox
 * primary key prevents duplicate insertions even when recipients cannot read
 * each other's inbox because of RLS. No database migration is needed.
 */
export async function recordingInboxMessageId(sessionId: string, userId: string): Promise<string> {
  if (!sessionId || !userId) throw new Error("recording_notification_identity_missing");
  const input = new TextEncoder().encode(`rockmundo:recording:booking:${sessionId}:${userId}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  const bytes = hash.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80; // UUIDv8, custom SHA-256 digest
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

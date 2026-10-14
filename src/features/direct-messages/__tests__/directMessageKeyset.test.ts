import { describe, expect, it } from "vitest";
import {
  directMessageHistoryFilter,
  nextDirectMessageCursor,
  parseDirectMessageCursor,
} from "../services/directMessageKeyset";

const CONV = "10000000-0000-4000-8000-000000000001";
const A = "10000000-0000-4000-8000-000000000002";
const B = "10000000-0000-4000-8000-000000000003";
const STAMP = "2026-10-14T12:00:00.000Z";
const CHANNEL = A + ":" + B;

describe("direct history keyset pagination", () => {
  it("contains an immutable message ID even when all 100 messages have the same timestamp", () => {
    const page = Array.from({ length: 100 }, (_, index) => ({
      id: "10000000-0000-4000-8000-" + String(index).padStart(12, "0"),
      created_at: STAMP,
    }));
    const cursor = nextDirectMessageCursor(page, 100);
    expect(cursor).toBeDefined();
    expect(parseDirectMessageCursor(cursor!)).toEqual({
      createdAt: STAMP, id: page[0].id,
    });
    expect(nextDirectMessageCursor(page.slice(0, 99), 100)).toBeUndefined();
  });

  it("combines canonical plus unlinked fallback history with timestamp/id page boundaries", () => {
    const cursor = JSON.stringify({ createdAt: STAMP, id: CONV });
    const filter = directMessageHistoryFilter(CONV, CHANNEL, cursor);
    const scope = `or(conversation_id.eq.${CONV},and(conversation_id.is.null,channel_id.eq.${CHANNEL}))`;
    expect(filter).toBe(
      `and(${scope},created_at.lt.${STAMP}),and(${scope},created_at.eq.${STAMP},id.lt.${CONV})`,
    );
    expect(directMessageHistoryFilter(CONV, CHANNEL, null)).toBe(scope);
  });

  it("scopes a legacy-only history without an existing conversation", () => {
    const cursor = JSON.stringify({ createdAt: STAMP, id: A });
    expect(directMessageHistoryFilter(null, CHANNEL, cursor)).toBe(
      `and(channel_id.eq.${CHANNEL},created_at.lt.${STAMP}),and(channel_id.eq.${CHANNEL},created_at.eq.${STAMP},id.lt.${A})`,
    );
  });

  it("rejects fabricated cursors instead of interpolating arbitrary filters", () => {
    for (const value of [
      "{oops", "{}", "null",
      JSON.stringify({ createdAt: STAMP, id: "not-a-uuid" }),
      JSON.stringify({ createdAt: "no timestamp", id: A }),
    ]) {
      expect(() => directMessageHistoryFilter(CONV, CHANNEL, value)).toThrow("Invalid direct-message page cursor");
    }
  });
});

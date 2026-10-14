import { describe, expect, it } from "vitest";
import { directMessageHistoryPredicate, nextDirectMessageCursor } from "../services/messageHistory";

describe("direct-message keyset pagination with timestamp ties", () => {
  it("preserves all 150 messages with the same timestamp across a 100-row boundary", () => {
    const messages = Array.from({ length: 150 }, (_, i) => ({
      id: String(i).padStart(4, "0"),
      created_at: "2026-10-14T09:00:00.000Z",
    }));
    // The DB orders created_at DESC then id DESC; pages are reversed to ASC in the UI.
    const sorted = [...messages].sort((a, b) => b.id.localeCompare(a.id));
    const newest = [...sorted.slice(0, 100)].reverse();
    const cursor = nextDirectMessageCursor(newest, 100);
    expect(cursor).toEqual({ created_at: "2026-10-14T09:00:00.000Z", id: "0050" });
    const older = sorted.filter((row) =>
      row.created_at < cursor!.created_at ||
      (row.created_at === cursor!.created_at && row.id < cursor!.id));
    expect(older).toHaveLength(50);
    expect(nextDirectMessageCursor(older, 100)).toBeUndefined();
  });

  it("applies the same composite cursor to both canonical and fallback rows", () => {
    const result = directMessageHistoryPredicate("conv", "alice:bob", {
      created_at: "2026-10-14T09:00:00.000Z", id: "0050",
    });
    expect(result).toBe(
      "and(conversation_id.eq.conv,or(created_at.lt.2026-10-14T09:00:00.000Z," +
      "and(created_at.eq.2026-10-14T09:00:00.000Z,id.lt.0050)))," +
      "and(conversation_id.is.null,channel_id.eq.alice:bob," +
      "or(created_at.lt.2026-10-14T09:00:00.000Z," +
      "and(created_at.eq.2026-10-14T09:00:00.000Z,id.lt.0050)))"
    );
    expect(directMessageHistoryPredicate("conv","alice:bob")).toBe(
      "and(conversation_id.eq.conv),and(conversation_id.is.null,channel_id.eq.alice:bob)"
    );
  });
});

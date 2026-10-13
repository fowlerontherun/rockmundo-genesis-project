import { describe, expect, it } from "vitest";
import { mergeMessagePages, nextMessageCursor } from "../services/messageHistory";

describe("direct and group message paging", () => {
  const message = (id: number) => ({ id: String(id), created_at: new Date(Date.UTC(2026, 9, 13, 12, 0, id)).toISOString() });

  it("loads older pages before the newest 100 and removes duplicates", () => {
    const newest = Array.from({ length: 100 }, (_, i) => message(i + 100));
    const older = Array.from({ length: 100 }, (_, i) => message(i));
    expect(nextMessageCursor(newest, 100)).toBe(newest[0].created_at);
    const result = mergeMessagePages([newest, older, [older[0]]]);
    expect(result).toHaveLength(200);
    expect(result[0].id).toBe("0");
    expect(result[199].id).toBe("199");
    expect(nextMessageCursor(older.slice(0, 10), 100)).toBeUndefined();
  });
});

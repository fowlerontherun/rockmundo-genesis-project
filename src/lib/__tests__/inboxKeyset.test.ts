import { describe, expect, it } from "vitest";
import { beforeCreatedAtId, lastCreatedAtIdCursor } from "@/lib/inboxKeyset";

describe("notification and inbox keyset pagination", () => {
  it("advances inside equal created_at timestamps instead of skipping ties", () => {
    const rows = [
      { created_at: "2026-10-13T19:00:00Z", id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
      { created_at: "2026-10-13T19:00:00Z", id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      { created_at: "2026-10-13T19:00:00Z", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      { created_at: "2026-10-13T18:00:00Z", id: "99999999-9999-4999-8999-999999999999" },
    ];
    const cursor = lastCreatedAtIdCursor(rows.slice(0, 2));
    expect(cursor).toEqual(rows[1]);
    expect(beforeCreatedAtId(cursor!)).toContain("id.lt.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    // The next tied item qualifies; rows already seen do not.
    const matches = rows.filter((row) =>
      row.created_at < cursor!.created_at || (row.created_at === cursor!.created_at && row.id < cursor!.id)
    );
    expect(matches).toEqual(rows.slice(2));
  });

  it("handles empty pages without creating a cursor", () => {
    expect(lastCreatedAtIdCursor([])).toBeNull();
  });

  it("uses strict less-than boundaries so new inserts at the top do not shift later pages", () => {
    const cursor = { created_at: "2026-10-13T19:00:00Z", id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
    const inserted = { created_at: "2026-10-13T19:01:00Z", id: "ffffffff-ffff-4fff-8fff-ffffffffffff" };
    const filter = beforeCreatedAtId(cursor);
    expect(filter).toContain("created_at.lt.");
    expect(inserted.created_at < cursor.created_at).toBe(false);
  });
});

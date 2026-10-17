import { describe, it, expect } from "vitest";
import { filterUnreadForCharacter } from "../unreadNotifications";

describe("filterUnreadForCharacter", () => {
  it("drops notifications the character deleted, archived or read", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const states = [
      { notification_id: "a", read_at: null, archived_at: null, deleted_at: "2026-10-17" },
      { notification_id: "b", read_at: "2026-10-17", archived_at: null, deleted_at: null },
      { notification_id: "c", read_at: null, archived_at: "2026-10-17", deleted_at: null },
    ];
    expect(filterUnreadForCharacter(rows, states).map((r) => r.id)).toEqual(["d"]);
  });
});

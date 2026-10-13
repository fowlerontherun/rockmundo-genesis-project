import { describe, expect, it, vi } from "vitest";
import { countUnreadConversations, type UnreadConversationPage } from "../services/unreadConversations";

describe("unread conversation pagination", () => {
  it("scans all 121 threads when the server caps a requested 100 to 50", async () => {
    const rows: UnreadConversationPage[] = Array.from({ length: 121 }, (_, index) => ({
      unread_count: index % 2,
      last_message_at: new Date(Date.UTC(2026, 0, 2) - index * 1000).toISOString(),
    }));
    const fetchPage = vi.fn(async ({ cursor }: { limit: number; cursor: string | null; skipContextSync: boolean }) => {
      const start = cursor ? rows.findIndex((row) => row.last_message_at === cursor) + 1 : 0;
      return rows.slice(start, start + 50);
    });
    const verify = vi.fn(async () => {});
    expect(await countUnreadConversations(fetchPage, verify)).toBe(60);
    expect(fetchPage).toHaveBeenCalledTimes(4);
    expect(fetchPage.mock.calls[0][0]).toEqual({ limit: 100, cursor: null, skipContextSync: false });
    for (const [index, [options]] of fetchPage.mock.calls.entries()) {
      if (index > 0) expect(options.skipContextSync).toBe(true);
    }
    expect(verify).toHaveBeenCalledTimes(5);
  });

  it("does not return results if the active character changes mid-scan", async () => {
    const fetchPage = vi.fn(async () => [{ unread_count: 3, last_message_at: "2026-10-13T20:00:00Z" }]);
    const verify = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Character switched"));
    await expect(countUnreadConversations(fetchPage, verify)).rejects.toThrow("Character switched");
  });

  it("returns zero for a new empty thread that has no message timestamp", async () => {
    const fetchPage = vi.fn(async () => [{ unread_count: 0, last_message_at: null }]);
    expect(await countUnreadConversations(fetchPage, async () => {})).toBe(0);
  });

  it("fails instead of undercounting when the cursor cannot be advanced", async () => {
    const fetchPage = vi.fn(async () => [{ unread_count: 2, last_message_at: null }]);
    await expect(countUnreadConversations(fetchPage, async () => {})).rejects.toThrow("Cannot paginate");
  });
});

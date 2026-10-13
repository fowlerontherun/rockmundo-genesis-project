import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const hook = readFileSync(resolve(process.cwd(), "src/hooks/useDirectMessages.ts"), "utf8");
const notifications = readFileSync(resolve(process.cwd(), "src/hooks/useNotificationsFeed.ts"), "utf8");
const inbox = readFileSync(resolve(process.cwd(), "src/hooks/useUnifiedInbox.ts"), "utf8");

describe("character-scoped messaging and inbox source contracts", () => {
  it("includes viewer identity in message queries and all invalidations", () => {
    expect(hook).not.toContain('["direct-messages", conversationId ?? channelId]');
    expect(hook.match(/\["direct-messages", myProfileId, conversationId \?\? channelId\]/g)).toHaveLength(6);
  });

  it("does not fetch or cache a different character's unread count", () => {
    expect(hook).toContain("activeProfileId === myProfileId");
    expect(hook).toContain("getActiveProfile(userId)");
    expect(hook).toContain("activeProfile?.id !== myProfileId");
    expect(hook).toContain('["dm-unread", myProfileId, activeProfileId]');
  });

  it("keeps direct-channel fallback history visible after a conversation exists", () => {
    expect(hook).toContain("conversation_id.eq.${conversationId},and(conversation_id.is.null,channel_id.eq.${directChannelId})");
    expect(hook).toContain('.is("conversation_id", null)');
  });

  it("marks only loaded visible notification IDs read", () => {
    expect(inbox).toContain("notifications.markAllRead(scopedNotifications.filter(");
    expect(notifications).toContain("mutationFn: (ids: string[]) => setState(eligible(ids), \"read\")");
    expect(notifications).toContain("const allowed = new Set((query.data ?? [])");
    expect(notifications).toContain("inActiveCharacter(n) && !n.deleted_at");
    expect(notifications).toContain("p_notification_ids: ids.slice(i, i + 100)");
    const markAll = notifications.split("const markAllRead = useMutation({")[1].split("const archive = useMutation({")[0];
    expect(markAll).not.toContain("profile_id.is.null");
  });
});

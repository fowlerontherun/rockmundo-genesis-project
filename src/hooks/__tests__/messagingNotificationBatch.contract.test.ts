import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const hooks = read("src/hooks/useDirectMessages.ts");
const events = read("src/hooks/useGameEventNotifications.ts");
const thread = read("src/features/social-hub/components/DirectMessageThread.tsx");
const panel = read("src/features/relationships/components/DirectMessagePanel.tsx");
const card = read("src/mobile/components/NotificationCard.tsx");
const mobileInbox = read("src/mobile/pages/MobileSocial.tsx");

describe("notification actions, character ownership and message history regressions", () => {
  it("requires an achievement unlock's profile to match the selected character", () => {
    expect(events).toContain("if (!payload.new.profile_id || payload.new.profile_id !== profileId) return;");
  });

  it("writes band invitations with actionable metadata rather than the generic bands list", () => {
    expect(events).toContain("type: 'band_invite'");
    expect(events).toContain("metadata: { band_id: invite.band_id, band_invitation_id: invite.id }");
    expect(events).toContain("actionPath: '/band/members'");
  });

  it("keeps mobile notification and inbox links actionable", () => {
    expect(card).toContain("resolveNotificationActionPath(n.action_path)");
    expect(mobileInbox).toContain("resolveNotificationActionPath(route)");
  });

  it("counts unread fallback rows that are not part of a conversation", () => {
    const unread = hooks.split("export function useUnreadDirectMessageCount(")[1];
    expect(unread).toContain('.eq("recipient_profile_id", myProfileId)');
    expect(unread).toContain('.is("conversation_id", null)');
    expect(unread).toContain('.is("read_at", null)');
    expect(unread).toContain("return conversationUnread + (count ?? 0)");
    expect(unread.match(/await verifyActiveProfile\(\)/g)?.length).toBe(2);
  });

  it("offers historical pagination for both group and direct DMs", () => {
    expect(hooks).toContain("useInfiniteQuery({");
    expect(hooks).toContain("getConversationMessages(groupConversationId, { limit: 100, cursor: pageParam })");
    expect(hooks).toContain('if (pageParam) query = query.lt("created_at", pageParam)');
    expect(hooks).toContain("getNextPageParam: (lastPage) => nextMessageCursor(lastPage, 100)");
    for (const component of [thread, panel]) {
      expect(component).toContain("hasOlderMessages");
      expect(component).toContain("loadOlderMessages()");
      expect(component).toContain("Load older messages");
    }
  });
});

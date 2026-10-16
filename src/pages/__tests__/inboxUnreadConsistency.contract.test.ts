import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("inbox unread and loading consistency (issue #4190)", () => {
  it("uses the unified visible inbox count for the bottom navigation badge", () => {
    const bar = read("src/components/fm/BottomActionBar.tsx");
    const otherBadges = [
      "src/components/FloatingAvatarWidget.tsx",
      "src/components/ui/HorizontalNavigation.tsx",
      "src/components/ui/navigation.tsx",
    ];
    for (const path of otherBadges) {
      const source = read(path);
      expect(source).toContain("useUnifiedInboxUnreadCount()");
      expect(source).not.toContain("useUnreadInboxCount()");
    }
    expect(bar).toContain("useUnifiedInboxUnreadCount()");
    expect(bar).not.toContain("useUnreadInboxCount()");
  });

  it("keeps notification and player inbox character scoping in the unified feed", () => {
    const inbox = read("src/hooks/useUnifiedInbox.ts");
    expect(inbox).toContain("profileId");
    expect(inbox).toContain("messages.filter((message) => !message.is_read).length");
  });

  it("does not describe a failed partial load as an empty inbox on desktop or mobile", () => {
    const desktop = read("src/pages/Inbox.tsx");
    const mobile = read("src/mobile/pages/MobileSocial.tsx");
    expect(desktop).toContain("!hasMessages && partialError");
    expect(mobile).toContain("inbox.messages.length === 0 && inbox.partialError");
    expect(mobile).toContain("onRetry={() => void inbox.refetch()}");
  });
});

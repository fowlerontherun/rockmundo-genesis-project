import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("FM chat dock layout regressions", () => {
  const dock = read("src/components/fm/chat/FMChatDock.tsx");
  const footer = read("src/components/fm/BottomActionBar.tsx");
  const directThread = read("src/features/social-hub/components/DirectMessageThread.tsx");
  const dockContext = read("src/components/fm/chat/ChatDockContext.tsx");

  it("keeps chat on the left and footer actions on the right", () => {
    expect(dock).toContain('className="fixed bottom-0 left-3');
    expect(footer.indexOf("ROCKMUNDO")).toBeLessThan(
      footer.indexOf('navigate("/version-history")'),
    );
  });

  it("includes every chat room in unread totals and room badges", () => {
    expect(dock).toContain(
      "unreadWorld + unreadRooms.help + unreadRooms.recruit + unreadRooms.band",
    );
    expect(dock).toContain("const totalUnread = totalRoomUnread + unreadDirectMessages");
    expect(dock).toContain("? unreadRooms.help");
    expect(dock).toContain("? unreadRooms.recruit");
    expect(dock).toContain(": unreadRooms.band");
  });

  it("preserves the selected room when the dock is reopened", () => {
    expect(dock).toContain("onClick={() => setOpen(!open)}");
    expect(dock).not.toContain('if (!open) setActiveRoom("world")');
  });

  it("renders docked direct messages compactly and scrolls the Radix viewport", () => {
    expect(dock).toContain("compact");
    expect(directThread).toContain(
      '"[data-radix-scroll-area-viewport]"',
    );
    expect(directThread).toContain('compact && "flex min-h-0 flex-col px-2 pb-2"');
    expect(directThread).toContain('compact ? "min-h-0 flex-1" : "h-[360px]"');
  });

  it("keeps the latest private chat visible without clipping narrower desktops", () => {
    expect(dock).toContain('"hidden xl:flex"');
    expect(dockContext).toContain(
      "const withoutThread = prev.filter((p) => p.profileId !== t.profileId)",
    );
    expect(dockContext).toContain("const next = [...withoutThread, t]");
  });
});

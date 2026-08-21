import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve("src/mobile/pages/MobileSocial.tsx"), "utf8");

describe("Mobile Social companion contract", () => {
  it("keeps quick communication flows on mobile", () => {
    for (const route of ["/mobile/social/messages", "/mobile/social/friends", "/mobile/social/twaater", "/mobile/social/notifications"]) {
      expect(source).toContain(route);
    }
    expect(source).toContain("useDirectMessages");
    expect(source).toContain("useFriendships");
    expect(source).toContain("useNotificationsFeed");
  });

  it("routes notification actions through the shared companion resolver", () => {
    expect(source).toContain('import { resolveCompanionPath } from "@/mobile/routeRegistry"');
    expect(source).toContain("navigate(resolveCompanionPath(n.action_path))");
    expect(source).not.toContain("location.assign(");
  });

  it("keeps long-form mail management behind a desktop boundary", () => {
    expect(source).toContain("Desktop-only communication");
    expect(source).toContain("Long-form mail management stays on desktop");
    expect(source).toContain("Compose, archive, flag and attachment-heavy mail workflows are desktop-only");
  });
});

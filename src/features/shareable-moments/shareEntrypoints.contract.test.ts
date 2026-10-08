import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(relativePath), "utf8");

describe("Shareable Moments migrated entrypoint contracts", () => {
  it("keeps Share Studio persistently visible across desktop and mobile navigation", () => {
    const dashboard = read("src/pages/Dashboard.tsx");
    const fmNavigation = read("src/config/fmNavigation.ts");
    const mobileFab = read("src/mobile/shell/FabMenu.tsx");
    const hubNavigation = read("src/config/hubNavigation.ts");

    expect(dashboard).toContain('to="/social/share-studio"');
    expect(dashboard).toContain(">Share</Button>");
    expect(fmNavigation).toContain('{ label: "Share Studio", path: "/social/share-studio", icon: Share2');
    expect(mobileFab).toContain('key: "share"');
    expect(mobileFab).toContain('to: "/social/share-studio"');
    expect(hubNavigation).toContain('id: "share-studio"');
  });

  it("keeps Dashboard achievement sharing on AvatarShareStudio", () => {
    const source = read("src/pages/Dashboard.tsx");
    expect(source).toContain('from "@/features/shareable-moments/CharacterShareStudio"');
    expect(source).toContain("Share milestone");
    expect(source).toContain('type: "achievement"');
    expect(source).toContain("<AvatarShareStudio");
  });

  it("keeps chart sharing on the shared sheet with a button-first #1 prompt", () => {
    const source = read("src/components/charts/MyChartPositions.tsx");
    expect(source).toContain('from "@/features/shareable-moments/ShareMomentSheet"');
    expect(source).toContain('promptOnly: true');
    expect(source).toContain('promptKind: "chart-number-one"');
    expect(source).toContain('promptLabel: "Share #1 milestone"');
    expect(source).toContain("Share chart result");
    expect(source).toContain("<ShareMomentSheet");
  });

  it("keeps release manual and milestone sharing on the shared sheet", () => {
    const source = read("src/components/releases/MyReleasesTab.tsx");
    expect(source).toContain('from "@/features/shareable-moments/ShareMomentSheet"');
    expect(source).toContain('promptOnly: true');
    expect(source).toContain('promptKind: "release-revenue-milestone"');
    expect(source).toContain('promptLabel: "Share release milestone"');
    expect(source).toContain('type: "release"');
    expect(source).toContain("<ShareMomentSheet");
  });
});

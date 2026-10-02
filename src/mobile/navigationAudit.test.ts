import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const bottom = readFileSync("src/mobile/shell/BottomNav.tsx", "utf8");
const top = readFileSync("src/mobile/shell/TopAppBar.tsx", "utf8");
const fab = readFileSync("src/mobile/shell/FabMenu.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
describe("stripped mobile navigation", () => {
  it("shows only schedule inbox chat and progression in primary nav", () => {
    for (const label of ["Schedule", "Inbox", "Chat", "XP / AP"]) expect(bottom).toContain(`label: "${label}"`);
    for (const removed of ["Career", "Social", "World", "Me"]) expect(bottom).not.toContain(`label: "${removed}"`);
  });
  it("removes unsupported top-bar and quick-action links", () => {
    expect(top).not.toContain("/mobile/world");
    expect(top).not.toContain("/mobile/me");
    expect(fab).not.toContain("Travel");
    expect(fab).not.toContain("Twaater");
    expect(fab).not.toContain("Recover");
  });
  it("only mounts supported dedicated mobile routes", () => {
    expect(app).toContain('path="inbox" element={<MobileSocial />}');
    expect(app).toContain('path="chat" element={<MobileSocial />}');
    expect(app).toContain('path="progression" element={<MobileProgression />}');
    expect(app).not.toContain('path="world" element={<MobileWorld');
    expect(app).not.toContain('path="me" element={<MobileMe');
  });
});
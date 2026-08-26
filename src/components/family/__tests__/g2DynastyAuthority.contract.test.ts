import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("G2 dynasty and family legacy authority contracts", () => {
  it("loads lineage, history and milestones from server projections", () => {
    const panel = read("src/components/social/FamilyLegacyPanel.tsx");
    expect(panel).toContain('rpc("get_family_legacy"');
    expect(panel).toContain("Hall of records");
    expect(panel).toContain("Dynasty milestones");
    expect(panel).toContain('node.relationship === "descendant"');
    expect(panel).toContain("Later generations");
    expect(panel).not.toMatch(/\.from\(["']family_(?:lineage|legacy|dynasty|social_capital)/);
  });

  it("keeps family announcement visibility behind an explicit RPC", () => {
    const panel = read("src/components/social/FamilyLegacyPanel.tsx");
    expect(panel).toContain('rpc("set_family_legacy_privacy"');
    expect(panel).toContain('rpc("get_public_family_announcements"');
    expect(panel).toContain("Shared family events require matching public opt-in from every participant");
  });

  it("presents inherited social capital as a bounded server value", () => {
    const panel = read("src/components/social/FamilyLegacyPanel.tsx");
    expect(panel).toContain("Inherited social capital");
    expect(panel).toContain("/25");
    expect(panel).toContain("Older client legacy estimates");
  });
});

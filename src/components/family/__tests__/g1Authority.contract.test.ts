import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("G1 child development authority contracts", () => {
  it("uses database-clock child progression instead of browser writes", () => {
    const source = read("src/hooks/useChildAgeProgression.ts");
    expect(source).toContain('rpc("sync_child_progression"');
    expect(source).not.toMatch(/from\(["']player_children["']\)[\s\S]{0,300}\.update\s*\(/);
    expect(source).not.toContain("calculateCurrentGameDate");
  });

  it("completes births through the authoritative RPC", () => {
    const hook = read("src/hooks/useAuthoritativeChildBirth.ts");
    const dashboard = read("src/components/family/FamilyDashboard.tsx");
    expect(hook).toContain('rpc("complete_child_birth_authoritative"');
    expect(hook).not.toMatch(/\.from\(["']player_children["']\)/);
    expect(dashboard).toContain("useAuthoritativeChildBirth");
    expect(dashboard).toContain("<BirthCompletionDialog");
  });

  it("exposes mutual co-parent decisions and adult playability at 18", () => {
    const hook = read("src/hooks/useChildParentingDecisions.ts");
    const card = read("src/components/family/ChildCard.tsx");
    expect(hook).toContain('rpc("propose_child_parenting_decision"');
    expect(hook).toContain('rpc("respond_child_parenting_decision"');
    expect(card).toContain("Playable (18+)");
    expect(card).toContain("ParentingDecisionDialog");
    expect(card).toContain("co_parent_harmony");
  });
});

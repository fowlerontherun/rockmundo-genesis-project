import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../../../../");
const hookSource = fs.readFileSync(path.join(repoRoot, "src/hooks/useSocialContracts.ts"), "utf8");
const panelSource = fs.readFileSync(path.join(repoRoot, "src/features/social-hub/components/SocialContractsPanel.tsx"), "utf8");

describe("D9 social contract authority", () => {
  it("keeps lifecycle mutations behind RPC boundaries", () => {
    expect(hookSource).toContain('rpc("get_my_social_contracts")');
    expect(hookSource).toContain('rpc("respond_to_social_contract"');
    expect(hookSource).toContain('rpc("offer_social_contract"');
    expect(hookSource).toContain('rpc("cancel_social_contract"');
    expect(hookSource).toContain('rpc("open_social_contract_dispute"');
    expect(hookSource).not.toMatch(/\.from\(["']social_contracts["']\)\.(insert|update|delete|upsert)/);
    expect(hookSource).not.toMatch(/\.from\(["']social_contract_escrow["']\)\.(insert|update|delete|upsert)/);
  });

  it("requires explicit player acceptance and exposes dispute recovery", () => {
    expect(panelSource).toContain("Accept obligations");
    expect(panelSource).toContain("Decline");
    expect(panelSource).toContain("Open dispute");
    expect(panelSource).toContain("server");
  });
});

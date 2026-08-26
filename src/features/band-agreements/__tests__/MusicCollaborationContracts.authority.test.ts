import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../../");
const hookSource = fs.readFileSync(path.join(repoRoot, "src/hooks/useMusicCollaborationContracts.ts"), "utf8");
const bandPageSource = fs.readFileSync(path.join(repoRoot, "src/pages/bands/[bandId]/agreements/index.tsx"), "utf8");
const characterPageSource = fs.readFileSync(path.join(repoRoot, "src/pages/character/agreements/index.tsx"), "utf8");

describe("D6 music collaboration contract authority", () => {
  it("keeps collaboration mutations behind domain RPCs", () => {
    expect(hookSource).toContain('rpc("create_music_collaboration_contract"');
    expect(hookSource).toContain('rpc("respond_to_music_collaboration_contract"');
    expect(hookSource).toContain('rpc("cancel_music_collaboration_contract"');
    expect(hookSource).toContain('rpc("settle_music_collaboration_contract"');
    expect(hookSource).not.toMatch(/\.from\(["']music_collaboration_contracts["']\)\.(insert|update|delete|upsert)/);
    expect(hookSource).not.toMatch(/\.from\(["']music_collaboration_credits["']\)\.(insert|update|delete|upsert)/);
    expect(hookSource).not.toMatch(/\.from\(["']social_contract_escrow["']\)\.(insert|update|delete|upsert)/);
  });

  it("shows exact obligations and split before explicit acceptance", () => {
    expect(characterPageSource).toContain("Your obligations");
    expect(characterPageSource).toContain("Royalty");
    expect(characterPageSource).toContain("Fixed fee");
    expect(characterPageSource).toContain("Accept obligations and split");
    expect(characterPageSource).toContain("Decline");
  });

  it("requires a linked authoritative activity for new collaboration offers", () => {
    expect(bandPageSource).toContain("Linked activity");
    expect(bandPageSource).toContain("recordingSessionId");
    expect(bandPageSource).toContain("songwritingProjectId");
    expect(bandPageSource).toContain("tourId");
    expect(bandPageSource).toContain("gigId");
    expect(bandPageSource).toContain("songId");
  });
});

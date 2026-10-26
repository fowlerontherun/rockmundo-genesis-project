import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Regression: one auth account may own multiple Rockmundo characters.
// Video royalties/fans must be credited only to the exact song creator.
const worker = readFileSync(resolve(process.cwd(), "supabase/functions/simulate-video-views/index.ts"), "utf8");

describe("video simulation profile ownership", () => {
  it("selects the owning song profile explicitly", () => {
    expect(worker).toContain("quality_score, hype, band_id, user_id, profile_id)");
    expect(worker).toContain('.eq("id", song.profile_id)');
    expect(worker).not.toContain('.eq("user_id", song.user_id)');
  });

  it("fails closed when the song has no attributable creator", () => {
    expect(worker).toContain("has no owning song profile to credit");
  });

  it("requires service-role or Vault-backed scheduler authentication", () => {
    expect(worker).toContain('req.headers.get("x-cron-secret")');
    expect(worker).toContain('verify_internal_cron_secret');
  });
});

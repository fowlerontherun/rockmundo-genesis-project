import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path: string) => readFileSync(
  fileURLToPath(new URL(path, import.meta.url)), "utf8",
);

const mar26 = read("../../../supabase/migrations/20260326103000_character_resurrection_lives.sql");
const mar27 = read("../../../supabase/migrations/20260327064907_4b76ce6d-5973-4b8b-8960-5fe066c80669.sql");
const oct13 = read("../../../supabase/migrations/20261013095500_resurrection_eligibility.sql");

describe("resurrection RPC reproducible historical migration replay", () => {
  it("never changes the return type of the existing UUID resurrection RPC", () => {
    for (const source of [mar26, mar27, oct13]) {
      expect(source).toMatch(/CREATE OR REPLACE FUNCTION public\.resurrect_character\(p_profile_id uuid\)[\s\S]*?RETURNS void/);
    }
    expect(mar26).not.toContain("RETURNS public.profiles");
    expect(mar26).not.toContain("RETURN target_profile;");
  });

  it("preserves user ownership and the canonical later coma-only restrictions", () => {
    expect(mar26).toContain("user_id = current_user_id");
    expect(oct13).toContain("Only characters in an inactivity coma can be revived");
    expect(oct13).toContain("v_profile.deleted_at IS NOT NULL");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261013095500_resurrection_eligibility.sql", import.meta.url)), "utf8");

describe("player resurrection rules", () => {
  it("#3858 rejects soft-deleted profiles", () => {
    expect(sql).toContain("IF v_profile.deleted_at IS NOT NULL THEN");
    expect(sql).toContain("Deleted characters cannot be resurrected");
  });
  it("#3859 only permits a recorded inactivity coma", () => {
    expect(sql).toContain("v_profile.coma_started_at IS NULL");
    expect(sql).toContain("v_profile.death_cause='neglect'");
    expect(sql).toContain("ILIKE '%inactivity%'");
    expect(sql).toContain("Only characters in an inactivity coma can be revived");
  });
  it("#3860 consumes one resurrection life instead of granting new lives", () => {
    expect(sql).toContain("IF coalesce(v_profile.resurrection_lives,0)<=0 THEN");
    expect(sql).toContain("resurrection_lives=greatest(coalesce(resurrection_lives,0)-1,0)");
    expect(sql).not.toMatch(/GREATEST\(COALESCE\(resurrection_lives, 0\), 3\)/);
  });
});

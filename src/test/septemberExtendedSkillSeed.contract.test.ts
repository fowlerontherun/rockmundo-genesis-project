import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../../supabase/migrations/20250918150110_add_extended_skill_definitions.sql", import.meta.url),
  "utf8",
);

describe("September 2025 extended skill seed fresh-replay compatibility", () => {
  it("only inserts into existing 2025 skill definition columns", () => {
    expect(sql).toContain(
      "INSERT INTO public.skill_definitions (slug, display_name, description, tier_caps)",
    );
    expect(sql).not.toContain("default_unlock_level = EXCLUDED.default_unlock_level");
    expect(sql).not.toContain("tier_caps, default_unlock_level, created_by_profile_id");
  });

  it("preserves the original zero-unlock seed values for later schema expansion", () => {
    const rows = sql.match(/, 0\),?\n/g) ?? [];
    expect(rows.length).toBeGreaterThan(60);
    expect(sql).toContain("('basic_dj_controller_skills'");
    expect(sql).toContain("('professional_djing'");
    expect(sql).toContain("ON CONFLICT (slug)");
  });
});

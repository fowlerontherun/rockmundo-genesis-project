import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sept = readFileSync(resolve(process.cwd(),
  "supabase/migrations/20250921113440_create_education_mentors_table.sql"), "utf8");
const oct = readFileSync(resolve(process.cwd(),
  "supabase/migrations/20251012072950_88cd5401-59df-4d99-8a34-cd4a10739395.sql"), "utf8");

describe("mentor migration clean replay compatibility", () => {
  it("recognizes the September 2025 preexisting mentors table", () => {
    expect(sept).toContain("CREATE TABLE IF NOT EXISTS public.education_mentors");
    expect(oct).toContain("CREATE TABLE IF NOT EXISTS public.education_mentors");
  });

  it("preserves September array values when migrating to JSONB", () => {
    expect(sept).toContain("attribute_keys text[]");
    expect(oct).toContain("TYPE jsonb USING to_jsonb(attribute_keys)");
    expect(oct).toContain("ALTER COLUMN attribute_keys DROP DEFAULT");
    expect(oct).toContain("ALTER COLUMN attribute_keys SET DEFAULT '[]'::jsonb");
  });

  it("adds the new status flag without recreating or truncating mentors", () => {
    expect(oct).toContain("ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true");
    expect(oct).not.toContain("DROP TABLE");
    expect(oct).not.toContain("TRUNCATE");
  });

  it("does not recreate preexisting mentor trigger or indexes", () => {
    expect(oct).toContain("tgname='update_education_mentors_updated_at'");
    expect(oct).toContain("CREATE INDEX IF NOT EXISTS idx_education_mentors_focus_skill");
    expect(oct).toContain("CREATE INDEX IF NOT EXISTS idx_education_mentors_difficulty");
  });
});

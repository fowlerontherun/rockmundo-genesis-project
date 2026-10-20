import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260401090000_create_universities_table.sql",
  "utf8",
);

const septemberBootstrap = readFileSync(
  "supabase/migrations/20250919084140_create_universities_table.sql",
  "utf8",
);

describe("legacy university migration compatibility", () => {
  it("adds missing course modifiers before the October seed without overwriting prices", () => {
    const modifier = septemberBootstrap.indexOf("ADD COLUMN IF NOT EXISTS course_cost_modifier");
    const description = septemberBootstrap.indexOf("ADD COLUMN IF NOT EXISTS description");
    const seed = septemberBootstrap.indexOf("-- Seed initial data used by the Education experience");
    expect(modifier).toBeGreaterThan(-1);
    expect(description).toBeGreaterThan(modifier);
    expect(seed).toBeGreaterThan(description);
    expect(septemberBootstrap).not.toMatch(/(?:DROP TABLE|TRUNCATE TABLE)\\s+public\\.universities/i);
  });
  it("handles both the old modifier and the standalone course-cost schemas", () => {
    expect(migration).toContain("column_name = 'course_cost_modifier'");
    expect(migration).toContain("column_name = 'course_cost'");
    expect(migration).toContain("IF EXISTS (");
    expect(migration).toContain("ELSIF EXISTS (");
  });
  it("does not change existing university prices while reseeding", () => {
    expect(migration.match(/ON CONFLICT \(name, city\) DO NOTHING;/g)).toHaveLength(2);
    expect(migration).not.toContain("course_cost = EXCLUDED.course_cost");
  });
  it("signals unexpected schema drift instead of silently passing", () => {
    expect(migration).toContain("RAISE EXCEPTION 'Universities seed: neither course_cost_modifier nor course_cost exists'");
  });
});

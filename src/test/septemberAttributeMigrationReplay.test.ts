import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (filename: string) =>
  readFileSync(new URL(`../../supabase/migrations/${filename}`, import.meta.url), "utf8");

const historicalResetMigrations = [
  "20250917154858_zero_skill_attribute_defaults.sql",
  "20250917154859_update_player_attribute_defaults.sql",
  "20250917154900_enforce_player_skills_minimum.sql",
  "20250917154901_handle_new_user_city_fallback.sql",
];

describe("September 2025 historical reset migration replay order", () => {
  it.each(historicalResetMigrations)("%s defers its composite reset function until attributes exist", (filename) => {
    const sql = read(filename);
    const guard = sql.indexOf("IF to_regclass('public.player_attributes') IS NOT NULL THEN");
    const func = sql.indexOf("CREATE OR REPLACE FUNCTION public.reset_player_character()");
    const grant = sql.indexOf("GRANT EXECUTE ON FUNCTION public.reset_player_character() TO authenticated");
    expect(guard).toBeGreaterThan(-1);
    expect(func).toBeGreaterThan(guard);
    expect(grant).toBeGreaterThan(func);
    expect(sql).toContain("EXECUTE $legacy_reset_source$");
    expect(sql).toContain("$legacy_reset_source$;");
    expect(sql).toContain("$legacy_reset_guard$;");
  });

  it.each([
    "20250917154859_update_player_attribute_defaults.sql",
    "20250917154900_enforce_player_skills_minimum.sql",
  ])("%s keeps the information_schema column and PL/pgSQL iterator distinct", (name) => {
    const sql = read(name);
    expect(sql).toContain("cols.column_name = v_column_name");
    expect(sql).not.toContain("cols.column_name = column_name");
  });

  it("creates the underlying table in the later September 18 migration", () => {
    const create = read("20250918075158_4a6d2968-3b91-4ba4-8192-a9a4ff3702ff.sql");
    expect(create).toContain("CREATE TABLE IF NOT EXISTS public.player_attributes");
    expect(Number("20250917154901")).toBeLessThan(Number("20250918075158"));
  });

  it("retains subsequent deployed reset implementations after attributes exist", () => {
    const later = read("20260922120000_add_player_attributes_and_update_skills.sql");
    expect(later).toContain("CREATE TABLE IF NOT EXISTS public.player_attributes");
    expect(later).toContain("CREATE OR REPLACE FUNCTION public.reset_player_character()");
  });
});

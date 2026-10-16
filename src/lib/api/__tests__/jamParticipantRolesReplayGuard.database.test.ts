import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migration = readFileSync(
  fileURLToPath(new URL(
    "../../../../supabase/migrations/20260401053159_e827b2ff-0369-446f-9cd4-b38e30a7375c.sql",
    import.meta.url,
  )),
  "utf8",
);

describe("historical jam participant roles migration replay", () => {
  it("only alters the optional legacy participant table when it exists", () => {
    const gate = migration.indexOf("to_regclass('public.jam_session_participants') IS NOT NULL");
    const alter = migration.indexOf("ALTER TABLE public.jam_session_participants");
    expect(gate).toBeGreaterThan(-1);
    expect(alter).toBeGreaterThan(gate);
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS session_role");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS instrument");
    expect(migration).toMatch(/IF to_regclass\('public\.jam_session_participants'\) IS NOT NULL THEN[\s\S]+?ALTER TABLE public\.jam_session_participants[\s\S]+?END IF;/);
  });

  it("does not manufacture a partial legacy participant table or rewrite records", () => {
    expect(migration).not.toMatch(/CREATE TABLE(?: IF NOT EXISTS)? public\.jam_session_participants/);
    expect(migration).not.toMatch(/(?:DELETE FROM|UPDATE|TRUNCATE) public\.jam_session_participants/);
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.jam_session_challenges");
  });
});

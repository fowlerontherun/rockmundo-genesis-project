import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20251221151541_4146e81d-48fa-4eda-9e6e-7d4a9d46b6a8.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");

describe("legacy songwriting repair clean-bootstrap guard", () => {
  it("checks the legacy table and column shape before resolving removed columns", () => {
    expect(sql).toContain("to_regclass('public.songwriting_sessions')");
    expect(sql).toContain("to_regclass('public.songwriting_projects')");
    expect(sql).toContain("information_schema.columns");
    expect(sql).toContain("expected legacy columns are not present");
    expect(sql).toContain("EXECUTE $repair$");

    const guardPosition = sql.indexOf("IF v_session_columns <> 10 OR v_project_columns <> 7");
    const legacyColumnPosition = sql.indexOf("ss.locked_until IS NOT NULL");
    expect(guardPosition).toBeGreaterThan(-1);
    expect(legacyColumnPosition).toBeGreaterThan(guardPosition);
  });

  it("preserves the historical repair when the legacy schema is present", () => {
    expect(sql).toContain("450 + FLOOR(RANDOM() * 150)");
    expect(sql).toContain("Auto-completed by migration fix");
    expect(sql).toContain("ready_for_completion");
    expect(sql).toContain("locked_until = NULL");
  });
});

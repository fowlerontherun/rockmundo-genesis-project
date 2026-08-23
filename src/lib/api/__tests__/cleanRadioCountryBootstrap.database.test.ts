import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260116095432_a5eff885-c671-4f35-8d9f-ffc1055cdad5.sql",
);

const sql = fs.readFileSync(migrationPath, "utf8");

describe("radio country clean-bootstrap compatibility", () => {
  it("removes duplicate UK national seeds before canonicalising the country", () => {
    const deleteIndex = sql.indexOf("legacy.country = 'UK'");
    const updateIndex = sql.indexOf("SET country = 'United Kingdom'");

    expect(deleteIndex).toBeGreaterThanOrEqual(0);
    expect(updateIndex).toBeGreaterThan(deleteIndex);
    expect(sql).toContain("canonical.country = 'United Kingdom'");
    expect(sql).toContain("legacy.name = canonical.name");
    expect(sql).toContain("legacy.station_type = 'national'");
  });

  it("applies the same collision-safe ordering to USA normalisation", () => {
    const deleteIndex = sql.indexOf("legacy.country = 'USA'");
    const updateIndex = sql.indexOf("SET country = 'United States'");

    expect(deleteIndex).toBeGreaterThanOrEqual(0);
    expect(updateIndex).toBeGreaterThan(deleteIndex);
    expect(sql).toContain("canonical.country = 'United States'");
  });

  it("does not broadly delete local stations", () => {
    expect(sql).not.toContain("legacy.station_type = 'local'");
  });
});

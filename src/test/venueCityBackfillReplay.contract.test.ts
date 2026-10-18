import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const migration = readFileSync(new URL("../../supabase/migrations/20250918212424_replace_venue_city_id_with_city.sql", import.meta.url),"utf8");
describe("legacy venue city schema migration quoting",()=>{
  it("uses a different delimiter for the inner conditional update",()=>{
    expect(migration).toContain("DO $$");
    expect(migration).toContain("EXECUTE $venue_city_backfill$");
    expect(migration).toContain("$venue_city_backfill$;");
    expect(migration).not.toContain("EXECUTE $$");
    expect(migration).toContain("SET city = city_id");
  });
});
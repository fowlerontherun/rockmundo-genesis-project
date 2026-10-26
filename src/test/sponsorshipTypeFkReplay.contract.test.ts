import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrations = "supabase/migrations";
const sql = (name: string) => readFileSync(resolve(process.cwd(), migrations, name), "utf8");
const november = sql("20251125150703_create_sponsorship_offers.sql");
const april = sql("20260416161439_9be48bc5-b900-40ba-a6a2-49f0032b6a0a.sql");

describe("sponsorship type migration creation order", () => {
  it("does not reference a non-existent future sponsorship_types table in November 2025", () => {
    expect(november).toContain("CREATE TABLE IF NOT EXISTS public.sponsorship_offers");
    expect(november).not.toMatch(/REFERENCES\s+public\.sponsorship_types\s*\(/i);
    expect(november).not.toMatch(/ALTER TABLE\s+public\.sponsorship_offers[\s\S]*?ADD COLUMN IF NOT EXISTS sponsorship_type_id/);
  });
  it("adds an FK when the April 2026 migration creates its referenced type table", () => {
    expect(april).toContain("CREATE TABLE public.sponsorship_types");
    expect(april).toContain("to_regclass('public.sponsorship_offers')");
    expect(april).toContain("ADD COLUMN IF NOT EXISTS sponsorship_type_id UUID");
    expect(april).toContain("REFERENCES public.sponsorship_types(id)");
  });
});

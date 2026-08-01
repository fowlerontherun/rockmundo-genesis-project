import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const base = readFileSync(new URL("../../supabase/migrations/20251016084400_ee0afa77-eacf-408d-96ec-7e7ce39f3558.sql", import.meta.url), "utf8");
const catalogue = readFileSync(new URL("../../supabase/migrations/20251218145220_6eb9869d-ea30-4de9-95e6-454fcbdaec26.sql", import.meta.url), "utf8");
const expansion = readFileSync(new URL("../../supabase/migrations/20260416221940_b8a8632f-a7ba-4c7c-b83c-313bc40beed1.sql", import.meta.url), "utf8");

test("crew authorities exist before their first alteration", () => {
  assert.match(base, /CREATE TABLE IF NOT EXISTS public\.crew_catalog\s*\(/);
  assert.match(base, /\bid TEXT PRIMARY KEY\b/);
  assert.match(base, /CREATE TABLE IF NOT EXISTS public\.band_crew_members\s*\(/);
});

test("catalogue seeds preserve employment state", () => {
  assert.doesNotMatch(catalogue, /DELETE FROM (?:public\.)?crew_catalog/i);
  assert.match(catalogue, /ON CONFLICT \(id\) DO UPDATE SET/);
  assert.doesNotMatch(catalogue.split(/ON CONFLICT \(id\) DO UPDATE SET/)[1], /hired_by_band_id\s*=/);
  assert.match(expansion, /ON CONFLICT \(id\) DO UPDATE SET/);
});

test("catalogue NPC exclusivity is enforced at employment authority", () => {
  assert.doesNotMatch(catalogue, /ON public\.crew_catalog\s*\(id\)\s*WHERE hired_by_band_id/i);
  assert.match(catalogue, /UNIQUE INDEX IF NOT EXISTS band_crew_members_catalog_crew_active_uidx[\s\S]*ON public\.band_crew_members \(catalog_crew_id\)[\s\S]*WHERE catalog_crew_id IS NOT NULL/);
  assert.match(catalogue, /catalog_crew_id TEXT REFERENCES public\.crew_catalog\(id\) ON DELETE SET NULL/);
});

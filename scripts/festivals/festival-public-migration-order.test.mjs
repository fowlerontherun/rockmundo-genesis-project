import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
const root = new URL("../../supabase/migrations/", import.meta.url);
const files = readdirSync(root).filter(name => name.endsWith(".sql")).sort();
const named = part => {
  const matches = files.filter(name => name.includes(part));
  assert.equal(matches.length, 1, `Expected exactly one migration for ${part}, found ${matches.join(", ")}`);
  return matches[0];
};
test("public NPC projection follows NPC storage and original public projection", () => {
  const npc = named("festival_owner_npc_lineup.sql");
  const original = named("public_festival_pre_event_lineup_sales.sql");
  const projection = named("festival_public_curated_npc_lineup.sql");
  assert.ok(projection > npc, `${projection} must follow ${npc}`);
  assert.ok(projection > original, `${projection} must follow ${original}`);
  const sql = readFileSync(new URL(projection, root), "utf8");
  assert.match(sql, /festival_owner_npc_lineup_acts/);
  assert.match(sql, /n\.status='confirmed'/);
  assert.match(sql, /NULL::timestamptz starts_at,NULL::timestamptz ends_at/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.festival_public_projection_v2\(uuid\)/);
});

test("public page never promotes an explicitly empty lineup to confirmed acts", () => {
  const page = readFileSync(new URL("../../src/features/festival-company/ui/PublicFestivalPage.tsx", import.meta.url), "utf8");
  assert.match(page, /const confirmedLineup = f\.lineup \?\? f\.timetable\.map/);
  assert.doesNotMatch(page, /f\.lineup\?\.length\s*\?\s*f\.lineup/);
  assert.match(page, /startsAt: null,\s*endsAt: null/);
});
test("curated NPC public stage is scoped to the current company and edition", () => {
  const sql = readFileSync(new URL(named("festival_public_curated_npc_lineup.sql"), root), "utf8");
  assert.match(sql, /st\.festival_company_id=p_festival_company_id/);
  assert.match(sql, /sp\.festival_edition_id=v_edition_id/);
});

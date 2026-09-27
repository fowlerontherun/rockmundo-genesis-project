import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync(new URL("../../src/features/festivals/ui/CanonicalFestivalRoutes.tsx", import.meta.url), "utf8");
const parser = readFileSync(new URL("../../src/features/festival-company/domain/festivalLaunch.ts", import.meta.url), "utf8");
const sql = readFileSync(new URL("../../supabase/migrations/20291220103200_festival_public_edition_identity.sql", import.meta.url), "utf8");
test("current programme only appears for the exact public annual edition", () => {
  assert.match(route, /current\.data\?\.editionId === resolved\.editionId/);
  assert.match(route, /results\.isLoading \|\| current\.isLoading/);
  assert.match(route, /if \(!results\.data && current\.data\?\.editionId/);
  assert.match(route, /return <PublicFestivalPage \/>/);
  assert.match(parser, /editionId:uuid\(o,"editionId",c,true\)/);
  assert.match(sql, /'editionId',v_edition_id/);
  assert.match(sql, /'editionId',NULL/);
});
test("public projection never publishes an unassigned NPC slot time", () => {
  assert.match(sql, /NULL::timestamptz starts_at,NULL::timestamptz ends_at/);
  assert.match(sql, /slot\.public_status IN \('published','public'\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.festival_public_projection_v2\(uuid\)/);
  assert.doesNotMatch(sql, /\\\\n/);
});

// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
const sql = readFileSync("supabase/tests/festival_runtime_production_preflight.sql", "utf8");
let db: PGlite;
beforeEach(async () => {
  db = new PGlite();
  await db.exec("CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text);");
});
afterEach(async () => { await db.close(); });
const canonical = async () => {
  for (const table of ["festival_editions_v2", "festival_edition_runtimes", "festival_runtime_configuration_versions", "festival_runtime_evidence", "festival_stages"]) {
    await db.exec(`CREATE TABLE public.${table}(id uuid);`);
  }
  await db.exec("CREATE FUNCTION public.get_festival_edition_runtime_control_room(uuid,uuid) RETURNS jsonb LANGUAGE sql AS 'SELECT NULL::jsonb';");
};
type Report = { canonicalEditionRuntimeReady: boolean; canonicalPublicProjectionPresent: boolean; launchScopedDayCrowdPatchPermitted: boolean; decision: string };
const preflight = async () => (await db.query<{ festival_runtime_preflight: Report }>(sql)).rows[0].festival_runtime_preflight;
describe("festival runtime deployment preflight", () => {
  it("does not mistake migration history for installed objects", async () => {
    await db.exec("INSERT INTO supabase_migrations.schema_migrations VALUES ('20991231999999');");
    const result = await preflight();
    expect(result.canonicalEditionRuntimeReady).toBe(false);
    expect(result.canonicalPublicProjectionPresent).toBe(false);
    expect(result.launchScopedDayCrowdPatchPermitted).toBe(false);
    expect(result.decision).toMatch(/BLOCK deployment/);
  });
  it("identifies a canonical runtime without a public projection", async () => {
    await canonical(); const result = await preflight();
    expect(result.canonicalEditionRuntimeReady).toBe(true);
    expect(result.canonicalPublicProjectionPresent).toBe(false);
    expect(result.launchScopedDayCrowdPatchPermitted).toBe(false);
    expect(result.decision).toMatch(/design a privacy-safe public projection/);
  });
  it("recognises the deployed public projection instead of prescribing a duplicate", async () => {
    await canonical();
    await db.exec("CREATE FUNCTION public.get_public_festival_edition_live_status(text) RETURNS jsonb LANGUAGE sql AS 'SELECT NULL::jsonb';");
    const result = await preflight();
    expect(result.canonicalPublicProjectionPresent).toBe(true);
    expect(result.launchScopedDayCrowdPatchPermitted).toBe(false);
    expect(result.decision).toMatch(/Reuse existing canonical annual-edition runtime and public projection/);
  });
});

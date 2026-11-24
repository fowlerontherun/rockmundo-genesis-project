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
type Report = { canonicalEditionRuntimeReady: boolean; canonicalPublicProjectionPresent: boolean; canonicalLiveEvidencePrerequisitesPresent: boolean; missingCanonicalLiveEvidencePrerequisites: string[]; launchScopedDayCrowdPatchPermitted: boolean; decision: string };
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
    expect(result.canonicalLiveEvidencePrerequisitesPresent).toBe(false);
    expect(result.missingCanonicalLiveEvidencePrerequisites).toEqual([
      "festival_canonical_stage_audience_capture",
      "festival_runtime_ticks",
      "record_canonical_festival_stage_action(uuid,uuid,uuid,text,text,integer)",
    ]);
    expect(result.launchScopedDayCrowdPatchPermitted).toBe(false);
    expect(result.decision).toMatch(/Reuse existing canonical annual-edition runtime and public projection/);
  });
  it("requires the canonical crowd capture trigger to be enabled", async () => {
    await canonical();
    await db.exec(`
      CREATE SCHEMA private;
      CREATE TABLE public.festival_runtime_ticks(id uuid);
      CREATE FUNCTION public.get_public_festival_edition_live_status(text) RETURNS jsonb LANGUAGE sql AS 'SELECT NULL::jsonb';
      CREATE FUNCTION public.record_canonical_festival_stage_action(uuid,uuid,uuid,text,text,integer) RETURNS jsonb LANGUAGE sql AS 'SELECT NULL::jsonb';
      CREATE FUNCTION private.capture_canonical_festival_stage_audience_allocation() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END';
      CREATE TRIGGER festival_canonical_stage_audience_capture AFTER INSERT ON public.festival_runtime_evidence
        FOR EACH ROW EXECUTE FUNCTION private.capture_canonical_festival_stage_audience_allocation();
    `);
    expect((await preflight()).canonicalLiveEvidencePrerequisitesPresent).toBe(true);
    await db.exec("ALTER TABLE public.festival_runtime_evidence DISABLE TRIGGER festival_canonical_stage_audience_capture");
    const result = await preflight();
    expect(result.canonicalLiveEvidencePrerequisitesPresent).toBe(false);
    expect(result.missingCanonicalLiveEvidencePrerequisites).toEqual(["festival_canonical_stage_audience_capture"]);
  });

});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { certifyPerformanceEffectsHarness, lifecycleFunctions } from "./certify-performance-effects-harness.mjs";

const tables = ["festival_companies", "festivals", "festival_editions_v2", "festival_edition_runtimes", "festival_runtime_completion_digests", "festival_runtime_performances"];
const fixtures = tables.map((table) => `INSERT INTO public.${table} (id) VALUES ('10000000-0000-4000-8000-000000000001');`).join("\n");
const calls = lifecycleFunctions.map((fn) => `SELECT public.${fn}(fixture_id) INTO result;`).join("\n");
const valid = `\\set ON_ERROR_STOP on
BEGIN;
${fixtures}
DO $run$ DECLARE fixture_id uuid := '10000000-0000-4000-8000-000000000001'; result jsonb; claimed_effects integer; processed_effects integer; duplicate_canonical_records integer; BEGIN
${calls}
SELECT count(*) INTO claimed_effects FROM festival_edition_settlement_effects WHERE attempt_count > 0;
SELECT count(*) INTO processed_effects FROM festival_effect_authority_results;
SELECT count(*) INTO duplicate_canonical_records FROM (SELECT stable_reference FROM festival_effect_authority_results GROUP BY stable_reference HAVING count(*) > 1) duplicates;
ASSERT result->>'canonicalId' IS NOT NULL, 'replay idempotent canonical result';
RAISE NOTICE 'FESTIVAL_LIFECYCLE_SUMMARY derived';
END $run$;
ROLLBACK;`;

function replaced(source, search, replacement) {
  assert(source.includes(search), `test setup did not find ${search}`);
  return source.replace(search, replacement);
}

describe("performance effect SQL certification", () => {
  it("accepts an executed lifecycle contract", () => assert.doesNotThrow(() => certifyPerformanceEffectsHarness(valid)));
  it("certifies the production integration harness", () => {
    const sql = readFileSync(new URL("../../supabase/tests/live_performance_progression_harness.sql", import.meta.url), "utf8");
    assert.doesNotThrow(() => certifyPerformanceEffectsHarness(sql));
  });
  it("rejects the exact PR #1461 IF false bypass", () => assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("BEGIN;", "BEGIN; IF false THEN")), /unreachable/));
  it("rejects numeric and CASE unreachable variants", () => {
    assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("BEGIN;", "BEGIN; IF 1 = 0 THEN")), /unreachable/);
    assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("BEGIN;", "BEGIN; CASE WHEN false THEN NULL; END CASE;")), /unreachable/);
  });
  it("rejects DEFAULT VALUES fixtures", () => assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("(id) VALUES ('10000000-0000-4000-8000-000000000001')", "DEFAULT VALUES")), /DEFAULT VALUES/));
  it("rejects placeholder-only effect calls", () => assert.throws(() => certifyPerformanceEffectsHarness(replaced(valid, "apply_festival_band_fans_effect(fixture_id)", "apply_festival_band_fans_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL)")), /placeholder-only/));
  it("rejects hard-coded lifecycle counters", () => assert.throws(() => certifyPerformanceEffectsHarness(replaced(valid, "SELECT count(*) INTO claimed_effects FROM festival_edition_settlement_effects WHERE attempt_count > 0", "claimed_effects := 0")), /hard-coded|database-derived/));
  it("rejects lifecycle RPCs hidden in a harness function", () => assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("DO $run$", "CREATE FUNCTION hidden() RETURNS void LANGUAGE plpgsql AS $run$")), /harness-defined/));
  it("rejects swallowed failures", () => assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("END $run$;", "EXCEPTION WHEN OTHERS THEN NULL; END $run$;")), /swallowed/));
  it("rejects RPC names in comments", () => assert.throws(() => certifyPerformanceEffectsHarness(replaced(valid, "SELECT public.claim_next_festival_settlement_effect(fixture_id) INTO result;", "-- SELECT public.claim_next_festival_settlement_effect(fixture_id) INTO result;")), /claim_next/));
  it("rejects direct lifecycle writes and fabricated results", () => {
    assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("ROLLBACK;", "UPDATE festival_edition_settlement_effects SET status='applied'; ROLLBACK;")), /bypass/);
    assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("ROLLBACK;", "INSERT INTO live_performance_outcomes(id) VALUES (gen_random_uuid()); ROLLBACK;")), /fabricated/);
  });
  it("rejects missing rollback or replay assertions", () => {
    assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("ROLLBACK;", "COMMIT;")), /ROLLBACK/);
    assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("ASSERT result->>'canonicalId' IS NOT NULL, 'replay idempotent canonical result';", "")), /replay/);
  });
});

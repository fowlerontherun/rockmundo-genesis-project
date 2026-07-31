import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { certifyPerformanceEffectsHarness, lifecycleFunctions } from "./certify-performance-effects-harness.mjs";

const tables = ["festival_companies", "festivals", "festival_editions", "festival_runtime_performances", "festival_edition_settlements", "festival_edition_settlement_outcomes", "festival_edition_settlement_effects"];
const valid = `\\set ON_ERROR_STOP on\nBEGIN;\n${tables.map(t => `INSERT INTO public.${t} DEFAULT VALUES;`).join("\n")}
${lifecycleFunctions.map(f => `SELECT public.${f}(NULL);`).join("\n")}
DO $$ DECLARE replay_count integer := 0; BEGIN ASSERT replay_count = 0; END $$;\nROLLBACK;`;

describe("performance effect SQL certification", () => {
  it("accepts executable lifecycle SQL", () => assert.doesNotThrow(() => certifyPerformanceEffectsHarness(valid)));
  it("rejects RPC names in line and block comments", () => assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("SELECT public.claim_next_festival_settlement_effect(NULL);", "-- SELECT public.claim_next_festival_settlement_effect(NULL);\n/* claim_next_festival_settlement_effect */")), /claim_next/));
  it("rejects scenario names and RPCs in quoted documentation", () => assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("SELECT public.apply_festival_band_fans_effect(NULL);", "SELECT 'NPC scenario apply_festival_band_fans_effect(NULL)';")), /band_fans/));
  it("rejects calculator-only SQL", () => assert.throws(() => certifyPerformanceEffectsHarness("\\set ON_ERROR_STOP on\nBEGIN; SELECT calculate_live_performance_fans('{}'); ROLLBACK;"), /claim_next/));
  it("rejects a direct effect status update", () => assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("ROLLBACK;", "UPDATE festival_edition_settlement_effects SET status='applied'; ROLLBACK;")), /bypass/));
  it("rejects missing replay assertions", () => assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("DO $$ DECLARE replay_count integer := 0; BEGIN ASSERT replay_count = 0; END $$;", "")), /replay/));
  it("rejects missing rollback", () => assert.throws(() => certifyPerformanceEffectsHarness(valid.replace("ROLLBACK;", "COMMIT;")), /ROLLBACK/));
});

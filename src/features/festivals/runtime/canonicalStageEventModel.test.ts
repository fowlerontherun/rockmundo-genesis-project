import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canAdvanceCanonicalStageState,
  canonicalStageStates,
  type CanonicalStageState,
} from "./canonicalStageEventModel";

const sql = readFileSync(
  new URL("../../../../supabase/reconciliation/festival/canonical_edition_stage_evidence_ledger.sql", import.meta.url),
  "utf8",
);

describe("canonical festival stage evidence", () => {
  it("only recognises explicitly sourced runtime stage statuses", () => {
    expect(canonicalStageStates).toEqual([
      "ready", "starting", "live", "delayed", "completed", "cancelled",
    ]);
    for (const state of canonicalStageStates) {
      expect(sql).toContain("'stage_" + state + "'");
    }
  });

  it("does not claim live or completed before receiving an initial stage event", () => {
    expect(canAdvanceCanonicalStageState(null, "live")).toBe(false);
    expect(canAdvanceCanonicalStageState(null, "completed")).toBe(false);
    expect(canAdvanceCanonicalStageState(null, "ready")).toBe(true);
    expect(canAdvanceCanonicalStageState(null, "cancelled")).toBe(true);
  });

  it("supports official delayed recovery and cancellation while rejecting terminal reactivation", () => {
    expect(canAdvanceCanonicalStageState("ready", "starting")).toBe(true);
    expect(canAdvanceCanonicalStageState("starting", "live")).toBe(true);
    expect(canAdvanceCanonicalStageState("live", "completed")).toBe(true);
    expect(canAdvanceCanonicalStageState("live", "delayed")).toBe(true);
    expect(canAdvanceCanonicalStageState("delayed", "starting")).toBe(true);
    for (const status of canonicalStageStates) {
      expect(canAdvanceCanonicalStageState("completed", status)).toBe(false);
      expect(canAdvanceCanonicalStageState("cancelled", status)).toBe(false);
    }
  });

  it("requires edition-v2 runtime, validated published stage and generated item identity", () => {
    expect(sql).toContain("REFERENCES public.festival_editions_v2(id)");
    expect(sql).toContain("REFERENCES public.festival_site_plan_stages(id)");
    expect(sql).toContain("REFERENCES public.festival_runtime_evidence(id)");
    expect(sql).toContain("p.festival_edition_id=v_runtime.edition_id");
    expect(sql).toContain("item->>'stageId'=v_stage_id::text");
    expect(sql).toContain("item->>'festivalDate'=v_date::text");
    expect(sql).toContain("festival_stage_observation_out_of_day");
  });

  it("does not expose raw evidence or an insert API to public browsers", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS private.festival_edition_stage_events");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON TABLE private.festival_edition_stage_events FROM PUBLIC, anon, authenticated, service_role");
    expect(sql).toContain("AFTER INSERT ON public.festival_runtime_evidence");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).not.toContain("GRANT SELECT ON private.festival_edition_stage_events");
    expect(sql).not.toContain("get_festival_edition_runtime_control_room");
  });

  it("never accepts an implicit schedule-only stage status", () => {
    const forbidden: CanonicalStageState[] = ["live", "starting", "completed"];
    for (const next of forbidden) {
      expect(canAdvanceCanonicalStageState(null, next)).toBe(false);
    }
  });
});

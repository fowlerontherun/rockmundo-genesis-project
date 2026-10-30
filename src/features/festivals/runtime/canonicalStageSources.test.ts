import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const actionSql = readFileSync(resolve(process.cwd(), "supabase/reconciliation/festival/canonical_edition_stage_runtime_actions.sql"), "utf8");
const publicSql = readFileSync(resolve(process.cwd(), "supabase/reconciliation/festival/canonical_edition_stage_public_live_projection.sql"), "utf8");
const crowdSql = readFileSync(resolve(process.cwd(), "supabase/reconciliation/festival/canonical_edition_stage_crowd_evidence_ledger.sql"), "utf8");

describe("canonical Festival V2 evidence sources", () => {
  it("writes stage events only through a real operator-confirmed canonical runtime action", () => {
    expect(actionSql).toContain("REFERENCES public.festival_edition_runtimes(id)");
    expect(actionSql).toContain("public.festival_editions_v2");
    expect(actionSql).toContain("public.festival_site_plan_stages");
    expect(actionSql).toContain("public.festival_runtime_evidence");
    expect(actionSql).toContain("v_item->>'sourceBookingId'");
    expect(actionSql).toContain("'operator_confirmed'");
    expect(actionSql).toContain("clock_timestamp()");
    expect(actionSql).toContain("FOR UPDATE");
    expect(actionSql).toContain("festival_stage_slot_identity_mismatch");
    expect(actionSql).toContain("festival_stage_artist_booking_unverified");
    expect(actionSql).toContain("festival_stage_overlap_not_permitted");
    expect(actionSql).toContain("get_canonical_festival_stage_control");
  });

  it("requires explicit actor authority, active runtime, expected version and replay isolation", () => {
    for (const error of [
      "festival_stage_action_unauthorised", "festival_stage_action_forbidden",
      "festival_stage_runtime_stale", "festival_stage_runtime_not_live",
      "festival_stage_action_idempotency_conflict", "festival_stage_outside_festival_day",
    ]) expect(actionSql).toContain(error);
    expect(actionSql).toContain("GRANT EXECUTE ON FUNCTION public.record_canonical_festival_stage_action");
    expect(actionSql).toContain("TO authenticated;");
    expect(actionSql).toContain("FORCE ROW LEVEL SECURITY");
  });

  it("accepts crowd measurements only from genuine canonical stage allocation evidence", () => {
    expect(crowdSql).toContain("'stage_audience_allocation'");
    expect(crowdSql).toContain("'canonical_runtime_stage_allocation'");
    expect(crowdSql).toContain("festival_stage_allocation_missing_verified_source");
    expect(crowdSql).toContain("v_total>v_capacity");
    expect(crowdSql).toContain("v_total>coalesce(v_runtime.site_attendance,0)");
    expect(crowdSql).toContain("v_at AT TIME ZONE v_timezone");
    expect(crowdSql).toContain("festival_stage_allocation_stale_or_wrong_day");
    expect(crowdSql).toContain("festival_stage_allocation_idempotency_conflict");
  });


  it("publishes confirmed and recent same-day stage observations only", () => {
    expect(publicSql).toContain("private.festival_edition_stage_events");
    expect(publicSql).toContain("private.festival_edition_stage_crowd_observations");
    expect(publicSql).toContain("ev.runtime_id=v_runtime.id");
    expect(publicSql).toContain("ev.festival_date=v_day");
    expect(publicSql).toContain("stage.status='ready'");
    expect(publicSql).toContain("now() - interval '10 minutes'");
    expect(publicSql).toContain("'performances', v_performances");
    expect(publicSql).toContain("'stageCrowds', v_stage_crowds");
    expect(publicSql).toContain("'scheduledStart', NULL");
    expect(publicSql).not.toContain("'observedAudience', latest.observed_audience");
  });

  it("does not reveal exact headcounts or private mood observations to visitor APIs", () => {
    expect(crowdSql).toContain("FORCE ROW LEVEL SECURITY");
    expect(crowdSql).toContain("REVOKE ALL ON private.festival_edition_stage_crowd_observations");
    expect(crowdSql).toContain("'moodSource' IS DISTINCT FROM 'measured'");
    expect(crowdSql).not.toContain("GRANT SELECT ON private.festival_edition_stage_crowd_observations");
    expect(crowdSql).not.toContain("get_public_festival_edition_live_status");
  });
});

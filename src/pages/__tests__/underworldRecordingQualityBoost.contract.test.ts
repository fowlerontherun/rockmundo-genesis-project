import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(fileURLToPath(new URL(
  "../../../supabase/production-repairs/20261015_underworld_recording_quality_boost_first_slice.sql",
  import.meta.url,
)), "utf8");
const worker = readFileSync(fileURLToPath(new URL(
  "../../../supabase/functions/complete-recording-sessions/index.ts",
  import.meta.url,
)), "utf8");

describe("first timed Underworld recording boost cutover", () => {
  it("preserves existing paid-only arrest, legacy-item, jail and cash ledger safeguards", () => {
    for (const token of [
      "app.player_cash_context", "UNDERWORLD_CONSUME_IMPRISONED",
      "UNDERWORLD_LEGACY_ITEM_REQUIRES_REVIEW",
      "UNDERWORLD_FROZEN_EFFECTS_INVALID",
      "UNDERWORLD_INSUFFICIENT_FUNDS", "UNDERWORLD_PAYMENT_METHOD_NOT_YET_SUPPORTED",
      "UNDERWORLD_PURCHASE_REQUEST_KEY_MISMATCH",
      "underworld_purchase_arrest_trigger",
    ]) expect(sql).toContain(token);
  });

  it("rejects catalog drift, mixed boosters and legacy inventory before reward", () => {
    expect(sql).toContain("UNDERWORLD_RPC_VERSION_DRIFT_REBASE_REQUIRED");
    expect(sql).toContain("underworld_safe_recording_boost");
    expect(sql).toContain("purchased_duration_hours");
    expect(sql).toContain("jsonb_each(p_effects))<>1");
    expect(sql).toContain("v_number BETWEEN 1 AND 50");
    expect(sql).toContain("v_purchase.client_request_id IS NULL");
    expect(sql).toContain("v_purchase.gifted_from_purchase_id IS NOT NULL");
  });

  it("activates only once, starting expiry on consumption and not purchase", () => {
    expect(sql).toContain("underworld_boost_effect_once_per_purchase");
    expect(sql).toContain("source_purchase_id");
    expect(sql).toContain("now()+make_interval(hours=>v_purchase.purchased_duration_hours)");
    expect(sql).toContain("quantity=0,is_used=true,applied_at=now()");
    expect(sql).toContain("effects_applied,expires_at,is_used,quantity,client_request_id");
    expect(sql).toContain("v_product.price_token_id IS NULL");
    expect(sql).toContain("FROM PUBLIC,anon,authenticated");
  });

  it("applies to an authoritative recording outcome with paid performer and expiry checks", () => {
    expect(worker).toContain("selectRecordingQualityBoost(");
    expect(worker).toContain("applyRecordingQualityBoost(");
    expect(worker).toContain(".not('source_purchase_id', 'is', null)");
    expect(worker).toContain(".in('profile_id', bookedIds)");
    expect(worker).toContain(".lte('started_at', session.scheduled_end)");
    expect(worker).toContain(".gt('expires_at', session.scheduled_end)");
    expect(worker).toContain("final_master_quality: newQuality");
    expect(worker).toContain("outcome_breakdown: outcomeBreakdown");
  });
});

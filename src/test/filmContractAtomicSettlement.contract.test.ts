import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20261019170622_atomic_film_contract_schedule_settlement.sql",
  "utf8",
);
const edge = readFileSync(
  "supabase/functions/process-scheduled-activities/index.ts",
  "utf8",
);
const harness = readFileSync(
  "supabase/tests/film_contract_atomic_settlement_4227.sql",
  "utf8",
);

describe("film contract atomic completion authority (#4227)", () => {
  it("locks schedule and contract before granting rewards", () => {
    expect(sql).toContain("WHERE id=p_activity_id FOR UPDATE");
    expect(sql).toContain("WHERE id=p_contract_id FOR UPDATE");
    expect(sql).toContain("film_settlement_schedule_mismatch");
    expect(sql).toContain("film_settlement_account_mismatch");
    expect(sql).toContain("film_settlement_profile_not_owned");
    expect(sql).toContain("scheduled_end > now()");
    expect(sql).toContain("filming_not_finished");
    expect(sql).toContain("v_contract.status NOT IN ('accepted','filming')");
  });

  it("settles contracted cash and fame once per contract to its scheduled profile", () => {
    expect(sql).toContain("contract_id uuid PRIMARY KEY");
    expect(sql).toContain("activity_id uuid NOT NULL UNIQUE");
    expect(sql).toContain("film_settlement_replayed_with_different_activity");
    expect(sql).toContain("v_contract.compensation::bigint");
    expect(sql).toContain("v_contract.total_pay_cents");
    expect(sql).toContain("v_contract.fame_boost");
    expect(sql).toContain("SET\n cash=cash+v_pay,\n fame=fame+v_fame");
    expect(sql).toContain("WHERE id=v_profile.id");
    expect(sql).toContain("status='completed',completed_at=now()");
    expect(sql).toContain("'already_settled'");
  });

  it("restricts a settlement receipt and RPC to service-role execution", () => {
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON public.film_contract_settlements FROM PUBLIC,anon,authenticated");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.settle_film_contract_atomic(uuid,uuid)");
    expect(sql).toContain("TO service_role");
  });

  it("removes all independent film reward writes from Edge", () => {
    expect(edge).not.toContain("increment_user_cash");
    expect(edge).not.toContain("increment_user_fame");
    expect(edge).toContain("'settle_film_contract_atomic'");
    expect(edge).toContain("p_activity_id: activity.id");
    expect(edge).toContain("p_contract_id: contractId");
    expect(edge).toContain("activity.activity_type === 'film_production'");
    expect(edge).toContain("continue;");
    expect(edge).toContain("Film activity is missing its contract");
    expect(edge).toContain("Film settlement rejected");
    expect(edge).toContain("settlement?.settled === true");
  });

  it("keeps a rollback-only, no-production-payout regression suite", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    expect(harness).toContain("film_cash_fame_double_settlement");
    expect(harness).toContain("film_profile_reward_incorrect");
    expect(harness).toContain("film_receipt_or_schedule_commit_incomplete");
    expect(harness).toContain("film_forged_contract_allowed");
  });
});

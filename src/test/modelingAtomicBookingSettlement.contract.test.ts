import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync("src/components/modeling/ModelingOffersPanel.tsx", "utf8");
const generator = readFileSync("src/utils/modelingOfferGenerator.ts", "utf8");
const worker = readFileSync("supabase/functions/process-scheduled-activities/index.ts", "utf8");
const sql = readFileSync(
  "supabase/migrations/20261118180100_atomic_modeling_booking_settlement.sql",
  "utf8",
);

describe("atomic modeling career (#4233)", () => {
  it("does not accept offers or insert diary entries through independent browser calls", () => {
    expect(generator).toContain("rpc('book_modeling_offer_atomic'");
    expect(panel).not.toContain("acceptModelingOffer(");
    expect(panel).not.toContain('from("player_modeling_contracts")\n        .update');
    expect(panel).not.toContain("createScheduledActivity({");
  });

  it("makes booking, schedule conflicts and terms a single database transaction", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.book_modeling_offer_atomic");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("a.scheduled_start<p_end AND a.scheduled_end>p_start");
    expect(sql).toContain("modeling_schedule_conflict");
    expect(sql).toContain("'modeling_contract_id',p_offer_id");
    expect(sql).toContain("booking_activity_id=v_activity");
  });

  it("keeps settlement server-only, receipt-unique, and calendar completion atomic", () => {
    expect(sql).toContain("activity_id uuid NOT NULL UNIQUE");
    expect(sql).toContain("contract_id uuid PRIMARY KEY");
    expect(sql).toContain("modeling_settlement_unverified_terms");
    expect(sql).toContain("UPDATE public.profiles SET cash=cash+v_terms.compensation_amount");
    expect(sql).toContain("UPDATE public.player_scheduled_activities SET status='completed'");
    expect(sql).toContain("TO service_role;");
    expect(worker).toContain("settle_modeling_contract_atomic");
    expect(worker).toContain("activity.metadata?.modeling_contract_id");
    expect(worker).toContain("Legacy modeling booking requires manual reconciliation");
  });
});

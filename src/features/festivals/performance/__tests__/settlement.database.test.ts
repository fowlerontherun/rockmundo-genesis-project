import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settlement = readFileSync(
  "supabase/migrations/20291219030000_festival_settlement_and_career_effects.sql",
  "utf8",
);
const hardening = readFileSync(
  "supabase/migrations/20291219030100_festival_settlement_retry_hardening.sql",
  "utf8",
);
const service = readFileSync("src/features/festivals/performance/service.ts", "utf8");
const organiserSettlement = readFileSync(
  "src/features/festivals/admin/components/FestivalSettlementManagement.tsx",
  "utf8",
);

describe("canonical festival settlement database contract", () => {
  it("posts contract money through Finance with stable idempotency keys", () => {
    expect(settlement).toContain("public.finance_transfer(");
    expect(settlement).toContain("':contract:'||i.contract_id||':payout'");
    expect(settlement).toContain("':contract:'||i.contract_id||':deposit-refund'");
    expect(settlement).toContain("finance_transaction_id");
    expect(settlement).toContain("refund_transaction_id");
    expect(settlement).toContain("FESTIVAL_SETTLEMENT_RECONCILIATION_FAILED");
  });

  it("settles signed guarantee, bonus, merch and cancellation terms", () => {
    expect(settlement).toContain("terms->>'guarantee_fee_cents'");
    expect(settlement).toContain("terms->>'performance_bonus_cents'");
    expect(settlement).toContain("terms->>'merch_share_percent'");
    expect(settlement).toContain("terms#>>'{cancellation_terms,kill_fee_cents}'");
    expect(settlement).toContain("festival_settlement_contract_refund");
  });

  it("applies career effects and performer progression exactly once", () => {
    expect(settlement).toContain("UPDATE public.bands SET fame=");
    expect(settlement).toContain("casual_fans=casual_after");
    expect(settlement).toContain("festival_reputation_state");
    expect(settlement).toContain("festival_sponsor_health_state");
    expect(settlement).toContain("festival_member_progression_applications");
    expect(settlement).toContain("UPDATE public.profiles SET experience=");
    expect(settlement).toContain("UNIQUE(settlement_id,outcome_id,profile_id)");
  });

  it("keeps settlement internals RPC-only and exposes narrow views", () => {
    expect(settlement).toContain("REVOKE ALL ON public.festival_edition_settlements");
    expect(settlement).toContain("CREATE OR REPLACE FUNCTION public.get_festival_performance_settlement_breakdown");
    expect(settlement).toContain("CREATE OR REPLACE FUNCTION public.get_festival_edition_settlement_reconciliation");
    expect(settlement).toContain("GRANT EXECUTE ON FUNCTION public.settle_festival_edition");
    expect(service).toContain('rpc<Json>("get_festival_performance_settlement_breakdown"');
    expect(service).toContain('rpc<Json>("get_festival_edition_settlement_reconciliation"');
  });

  it("surfaces one-shot organiser settlement and reconciliation controls", () => {
    expect(organiserSettlement).toContain("useSettleFestivalEdition");
    expect(organiserSettlement).toContain("useFestivalEditionSettlementReconciliation");
    expect(organiserSettlement).toContain("Settle edition");
    expect(organiserSettlement).toContain("Edition reconciliation");
    expect(organiserSettlement).toContain("Artist payouts:");
    expect(organiserSettlement).toContain("Refresh reconciliation");
  });

  it("makes completed requests replay-safe and freezes child outcome evidence", () => {
    expect(hardening).toContain("WHERE edition_id=p_edition_id AND idempotency_key=prepare_key");
    expect(hardening).toContain("IF s.status<>'completed' THEN");
    expect(hardening).toContain("festival_settlement_events_idempotency_full_idx");
    expect(hardening).toContain("festival_ledger_idempotency_full_idx");
    expect(hardening).toContain("CASE WHEN TG_OP='DELETE' THEN OLD.outcome_id ELSE NEW.outcome_id END");
  });
});

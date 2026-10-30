import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20261030201000_block_client_awards_prize_ledger_forgery.sql",
  "utf8",
);
const smoke = readFileSync(
  "supabase/tests/award_settlement_rollback_smoke.sql",
  "utf8",
);

describe("award prize ledger authorization and rollback regression", () => {
  it("prevents authenticated member inserts from spoofing award prize credits", () => {
    expect(sql).toContain("ON public.band_earnings");
    expect(sql).toContain("FOR INSERT TO authenticated");
    expect(sql).toContain("source <> 'award_show_prize'");
    expect(sql).toContain("bm.user_id = (select auth.uid())");
    expect(sql).not.toContain("FOR INSERT TO public");
  });

  it("the SQL smoke test always rolls back its test settlements", () => {
    expect(smoke).toContain("public.award_admin_preview_results(show_id)");
    expect(smoke).toContain("public.award_admin_finalize_show(show_id)");
    expect(smoke).toContain("retried:=public.award_admin_finalize_show(show_id)");
    expect(smoke).toContain("source='award_show_prize'");
    expect(smoke).toContain("num_notifications<1");
    expect(smoke).toContain("EXCEPTION WHEN SQLSTATE 'PZX01'");
    expect(smoke).toContain("USING ERRCODE='PZX01'");
    expect(smoke).toContain("band_balance FROM public.bands");
  });
});

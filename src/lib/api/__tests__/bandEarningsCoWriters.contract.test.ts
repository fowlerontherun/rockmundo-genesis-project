import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("#4119: band earnings must be the only credit writer on journalled paths", () => {
  it("credits admin money only once and surfaces earnings failures", () => {
    const admin = source("src/pages/admin/FameFansGifting.tsx");
    expect(admin).not.toContain("updates.band_balance =");
    expect(admin).toContain("if (Object.keys(updates).length > 0)");
    expect(admin).toContain('from("band_earnings").insert');
    expect(admin).toContain("if (earningsError) throw earningsError");
  });

  it("does not directly add major event cash before inserting earnings", () => {
    const worker = source("supabase/functions/complete-major-event/index.ts");
    expect(worker).not.toMatch(/band_balance:\\s*\\(band\\.band_balance/);
    expect(worker).toContain("fame: (band.fame || 0) + fameGained");
    expect(worker).toContain("source: 'major_event'");
    expect(worker).toContain("metadata: { performance_id: performanceId }");
    expect(worker).toContain("if (bandUpdateError) throw bandUpdateError");
    expect(worker).toContain("if (earningsError) throw earningsError");
  });

  it("requires an authenticated, single-transaction release cancellation authority", () => {
    const dialog = source("src/components/releases/CancelReleaseDialog.tsx");
    const sql = source(
      "supabase/production-repairs/20261015_atomic_release_cancellation_MANUAL_ONLY.sql",
    );
    expect(dialog).toContain('.rpc("cancel_release_atomic"');
    expect(dialog).not.toContain('.from("band_earnings")');
    expect(dialog).not.toContain('.from("releases")');
    expect(dialog).not.toContain('minorToMajor(release.total_cost)');
    expect(dialog).toContain('data.refundMajor');
    expect(sql).toContain("WHERE id=p_release_id FOR UPDATE");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("public._caller_profile_id()");
    expect(sql).toContain("release_cancellation_not_authorized");
    expect(sql).toContain("release_no_longer_cancellable");
    expect(sql).toContain("release_has_sales_cannot_refund");
    expect(sql).toContain("release_format_already_manufactured");
    expect(sql).toContain("incremental_earnings_trigger_required");
    expect(sql).toContain("release_refund_requires_manual_payer_reconciliation");
    expect(sql).toContain("release_refund_ledger_evidence_inconsistent");
    expect(sql).toContain("release_refund_already_recorded");
    expect(sql).toContain("v_band_cost_minor<>v_charge_major*100");
    expect(sql).toContain("UPDATE public.releases SET release_status='cancelled'");
    expect(sql).toContain("INSERT INTO public.band_earnings");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.cancel_release_atomic(uuid)");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.cancel_release_atomic(uuid)");
  });
});

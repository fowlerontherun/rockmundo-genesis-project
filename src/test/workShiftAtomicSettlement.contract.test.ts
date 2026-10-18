import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/migrations/20261018200133_atomic_work_shift_settlement_20261018.sql", import.meta.url), "utf8");
const worker = readFileSync(new URL("../../supabase/functions/shift-clock-out/index.ts", import.meta.url), "utf8");

describe("once-only work-shift settlement (#4216 and #4217)", () => {
  it("worker only requests the service-only transaction and never writes rewards separately", () => {
    expect(worker).toContain(".rpc(");
    expect(worker).toContain("'settle_work_shift_atomic'");
    expect(worker).toContain("if (!receipt?.settled)");
    for (const write of [".from('experience_ledger')", ".from('shift_history')", ".from('player_employment')", ".from('city_treasury')", ".from('profiles')", ".from('bands')"]) {
      expect(worker).not.toContain(write);
    }
    expect(worker).not.toContain("credit_city_treasury");
  });
  it("server locks shift, checks due activity and prevents historical duplicate payouts", () => {
    expect(sql).toContain("WHERE id=p_shift_id FOR UPDATE");
    expect(sql).toContain("WHERE id=p_activity_id FOR UPDATE");
    expect(sql).toContain("a.ends_at > v_now");
    expect(sql).toContain("work_shift_existing_partial_settlement_requires_review");
    expect(sql).toContain("work_shift_settlements");
    expect(sql).toContain("UPDATE public.player_employment SET shifts_completed=coalesce(shifts_completed,0)+1");
    expect(sql).toContain("public.credit_city_treasury");
    expect(sql).toContain("DELETE FROM public.profile_activity_statuses WHERE id=a.id");
  });
  it("denies API access to anonymous and ordinary authenticated players", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.settle_work_shift_atomic(uuid,uuid) FROM PUBLIC,anon,authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.settle_work_shift_atomic(uuid,uuid) TO service_role");
    expect(sql).toContain("ALTER TABLE public.work_shift_settlements ENABLE ROW LEVEL SECURITY");
  });
});

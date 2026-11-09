import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
// The October 17 migration is the active gameplay-treasury payroll implementation.
// The old 2030 finance-accounts migration is superseded and must not be treated
// as the live payroll contract (or referenced under its renamed filename).
const migration = read("supabase/migrations/20261017110239_e155a93e-3985-439d-8a16-1d70bbedc946.sql");
const endpoint = read("supabase/functions/process-weekly-band-pay/index.ts");
const config = read("supabase/config.toml");
const gate = read("supabase/production-repairs/20261109_weekly_payroll_invocation_gate_4082_MANUAL_ONLY.sql");

describe("weekly band payroll safety against the deployed gameplay implementation", () => {
  it("keeps the privileged HTTP payroll endpoint retired", () => {
    expect(endpoint).toContain("Deno.serve(");
    expect(endpoint).toContain("status: 410");
    expect(endpoint).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(endpoint).not.toContain("createClient");
    expect(config).toContain("[functions.process-weekly-band-pay]\nverify_jwt = true");
  });

  it("claims at most one settlement per active band per week", () => {
    expect(migration).toContain("PRIMARY KEY (band_id, week_start)");
    expect(migration).toContain("IF EXISTS (SELECT 1 FROM public.band_weekly_payroll_settlements");
    expect(migration).toContain("INSERT INTO public.band_weekly_payroll_settlements");
    expect(migration).toContain("WHERE b.status = 'active'::public.band_status");
    expect(migration).toContain("v_band.status <> 'active'::public.band_status");
    expect(migration).toContain("NOT COALESCE(bm.is_touring_member,false)");
    expect(migration).toContain("FOR UPDATE");
  });

  it("uses spendable gameplay funds and floors each member's share", () => {
    expect(migration).toContain("FROM public.band_treasuries t");
    expect(migration).toContain("t.is_primary IS TRUE FOR UPDATE");
    expect(migration).toContain("t.reserved_balance_minor");
    expect(migration).toContain("LEAST(COALESCE(v_band.band_balance,0)::bigint");
    expect(migration).toContain("v_each := floor(floor(");
    expect(migration).toContain("v_total := v_each * v_count");
    expect(migration).toContain("v_available <= 0");
    expect(migration).toContain("v_count = 0");
  });

  it("rolls back a band's entire settlement if any member credit or expense fails", () => {
    expect(migration).toContain("EXCEPTION WHEN OTHERS THEN");
    expect(migration).toContain("v_failures := v_failures ||");
    expect(migration).toContain("INSERT INTO public.band_earnings");
    expect(migration).toContain("UPDATE public.profiles SET cash");
    expect(migration).toContain("INSERT INTO public.activity_feed");
    expect(migration).toContain("'band_pay'");
    expect(migration).toContain("weekly_pay");
    expect(migration).toContain("RETURN jsonb_build_object(");
  });

  it("exposes only band-member settlement reads and does not mint treasury cash", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FOR SELECT TO authenticated");
    expect(migration).toContain("bm.user_id = auth.uid()");
    expect(migration).not.toContain("UPDATE public.band_treasuries");
    expect(migration).not.toContain("INSERT INTO public.financial_transactions");
  });

  it("requires a separately reviewed manual gate before dropping service-role access", () => {
    expect(gate).toContain("ALTER FUNCTION public.process_weekly_band_payroll()");
    expect(gate).toContain("RENAME TO process_weekly_band_payroll_core_4082;");
    expect(gate).toContain("REVOKE ALL ON FUNCTION public.process_weekly_band_payroll()");
    expect(gate).toContain("FROM PUBLIC, anon, authenticated, service_role;");
    expect(gate).toContain("EXTRACT(ISODOW FROM (now() AT TIME ZONE 'UTC')) <> 6");
  });

  it("rounds down per-member payouts without overdrawing the payroll allocation", () => {
    const payEach = (available: number, percent: number, members: number) =>
      Math.floor(Math.floor(available * percent / 100) / members);
    const samples: Array<[number, number, number]> = [
      [9999, 10, 3], [520001, 27.5, 4], [100, 1, 5],
      [550000, 100, 2], [0, 50, 3],
    ];
    for (const [available, percent, members] of samples) {
      const each = payEach(available, percent, members);
      expect(each).toBeGreaterThanOrEqual(0);
      expect(each * members).toBeLessThanOrEqual(available);
      expect(each * members).toBeLessThanOrEqual(Math.floor(available * percent / 100));
    }
  });
});

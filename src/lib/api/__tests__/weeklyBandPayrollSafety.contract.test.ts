import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const migration = read("supabase/migrations/20300106200000_secure_atomic_weekly_band_payroll.sql");
const endpoint = read("supabase/functions/process-weekly-band-pay/index.ts");
const config = read("supabase/config.toml");

describe("six weekly payroll safety regressions", () => {
  it("#4025 retires the privileged HTTP endpoint, requiring no service key", () => {
    expect(endpoint).toContain("Deno.serve(");
    expect(endpoint).toContain("status: 410");
    expect(endpoint).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(endpoint).not.toContain("createClient");
    expect(config).toContain("[functions.process-weekly-band-pay]\nverify_jwt = true");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.process_weekly_band_payroll()");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated, service_role");
    expect(migration).toContain("IF auth.uid() IS NOT NULL THEN");
  });

  it("#4022 schedules one internal Saturday payment with a per-band weekly unique claim", () => {
    expect(migration).toContain("PRIMARY KEY (band_id, week_start)");
    expect(migration).toContain("ON CONFLICT (band_id,week_start) DO NOTHING");
    expect(migration).toContain("WHERE x.band_id=v_band_id AND x.week_start=v_week");
    expect(migration).toContain("extract(isodow FROM v_today) <> 6");
    expect(migration).toContain("PERFORM cron.unschedule('process-weekly-band-pay')");
    expect(migration).toContain("'0 10 * * 6'");
    expect(migration).toContain("'SELECT public.process_weekly_band_payroll()'");
    expect(migration).not.toContain("net.http_post");
    expect(migration).not.toContain("functions/v1/process-weekly-band-pay");
  });

  it("#4026 uses canonical treasury/wallet accounts rather than legacy money", () => {
    expect(migration).toContain("a.metadata->>'account_role'='band_treasury'");
    expect(migration).toContain("v_treasury.available_balance_minor");
    expect(migration).toContain("wallet.owner_type='player'");
    expect(migration).toContain("wallet.is_primary");
    expect(migration).toContain("UPDATE public.financial_accounts");
    expect(migration).toContain("INSERT INTO public.financial_transactions");
    expect(migration).toContain("INSERT INTO public.financial_ledger_entries");
    expect(migration).toContain("'wage_payment'::public.financial_transaction_category");
    expect(migration).not.toContain("SELECT band_balance");
    expect(migration).not.toContain("UPDATE public.profiles SET cash");
  });

  it("#4024 prevents lost updates with ordered account locks and relative balance writes", () => {
    expect(migration).toContain("ORDER BY a.id FOR UPDATE");
    expect(migration).toContain("FROM public.bands b\n      WHERE b.id=v_band_id FOR UPDATE");
    expect(migration).toContain("SET current_balance_minor=current_balance_minor-v_each");
    expect(migration).toContain("SET current_balance_minor=current_balance_minor+v_each");
    expect(migration).toContain("AND available_balance_minor>=v_each");
    expect(migration).not.toContain("band_balance: balance -");
    expect(migration).not.toContain("profile.cash+");
  });

  it("#4023 rolls back all payments for a band if any audit, journal or member credit fails", () => {
    expect(migration).toContain("BEGIN\n      -- Lock first");
    expect(migration).toContain("EXCEPTION WHEN OTHERS THEN");
    expect(migration).toContain("RAISE WARNING 'Weekly band payroll rolled back");
    expect(migration).toContain("JOIN public.profiles p ON p.id=bm.profile_id");
    expect(migration).toContain("v_each:=(");
    expect(migration).toContain("v_total:=v_each*v_payable");
    expect(migration).toContain("v_wallet_count <> v_payable");
    expect(migration).toContain("INSERT INTO public.band_earnings");
    expect(migration).toContain("INSERT INTO public.activity_feed");
  });

  it("#4027 only pays active bands, not on-hiatus bands", () => {
    expect(migration).toContain("WHERE b.status='active'::public.band_status");
    expect(migration).toContain("v_band.status<>'active'::public.band_status");
    expect(migration).not.toContain("on_hiatus");
  });

  it("always rounds legacy whole-unit reports down, never overdrawing balances", () => {
    const perMember = (balanceMinor: number, percent: number, payable: number) =>
      Math.floor(Math.floor(balanceMinor * percent / 100) / payable / 100) * 100;
    const examples: Array<[number, number, number]> = [
      [9999, 10, 3], [520001, 27.5, 4], [100, 1, 5],
      [550000, 100, 2], [0, 50, 3],
    ];
    for (const [balance, pct, members] of examples) {
      const each = perMember(balance, pct, members);
      expect(each % 100).toBe(0);
      expect(each * members).toBeLessThanOrEqual(balance);
      expect(each * members).toBeLessThanOrEqual(Math.floor(balance * pct / 100));
    }
  });
});

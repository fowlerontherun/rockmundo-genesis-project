import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const gate = read("supabase/production-repairs/20261109_weekly_payroll_invocation_gate_4082_MANUAL_ONLY.sql");
const currentPayroll = read("supabase/migrations/20261017110239_e155a93e-3985-439d-8a16-1d70bbedc946.sql");
const diagnostics = read("supabase/diagnostics/payment_cron_readiness.sql");

describe("#4082 live gameplay payroll invocation gate", () => {
  it("protects the actual October gameplay payroll, not the retired 2030 finance-ledger variant", () => {
    expect(currentPayroll).toContain("CREATE OR REPLACE FUNCTION public.process_weekly_band_payroll()");
    expect(currentPayroll).toContain("FROM public.band_treasuries");
    expect(currentPayroll).toContain("INSERT INTO public.band_weekly_payroll_settlements");
    expect(currentPayroll).toContain("PRIMARY KEY (band_id, week_start)");
    expect(currentPayroll).toContain("INSERT INTO public.band_earnings");
    expect(currentPayroll).toContain("UPDATE public.profiles SET cash");
    expect(gate).toContain("process_weekly_band_payroll_core_4082");
    expect(gate).not.toContain("financial_accounts.current_balance_minor");
  });

  it("refuses deployment on mismatched jobs or money implementation", () => {
    expect(gate).toContain("current_user <> 'postgres'");
    expect(gate).toContain("Only the postgres database owner");
    expect(gate).toContain("to_regprocedure('public.process_weekly_band_payroll_core_4082()')");
    expect(gate).toContain("to_regclass('public.band_weekly_payroll_settlements')");
    expect(gate).toContain("username = 'postgres'");
    expect(gate).toContain("schedule = '0 10 * * 6'");
    expect(gate).toContain("Multiple payroll schedule references");
    expect(gate).toContain("Payroll implementation differs from reviewed gameplay version");
    expect(gate).toContain("SET LOCAL lock_timeout");
  });

  it("only allows database-owned Saturday UTC payroll invocation", () => {
    expect(gate).toContain("session_user <> 'postgres'");
    expect(gate).toContain("auth.uid() IS NOT NULL");
    expect(gate).toContain("EXTRACT(ISODOW FROM (now() AT TIME ZONE 'UTC')) <> 6");
    expect(gate).toContain("'outside_schedule'");
    expect(gate).toContain("RETURN public.process_weekly_band_payroll_core_4082();");
    expect(gate).toContain("REVOKE ALL ON FUNCTION public.process_weekly_band_payroll_core_4082()");
    expect(gate).toContain("REVOKE ALL ON FUNCTION public.process_weekly_band_payroll()");
    expect(gate).toContain("FROM PUBLIC, anon, authenticated, service_role;");
    expect(gate).toContain("has_function_privilege('service_role'");
  });

  it("can be staged without payment, job activation, or secret reads", () => {
    expect(gate).toContain("BEGIN;");
    expect(gate).toContain("COMMIT;");
    expect(gate).not.toMatch(/^\s*(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|SELECT\s+public\.process_weekly_band_payroll\s*\()/im);
    expect(gate).not.toMatch(/^\s*(?:PERFORM\s+cron\.|SELECT\s+cron\.)/im);
    expect(gate).not.toContain("net.http_post(");
    expect(gate).not.toContain("vault.decrypted_secrets");
    expect(gate).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("provides redacted settlement/event/expense parity and privilege checks", () => {
    expect(diagnostics).toContain("accounting_parity");
    expect(diagnostics).toContain("expected_member_credits");
    expect(diagnostics).toContain("credited_major");
    expect(diagnostics).toContain("expenses_major");
    expect(diagnostics).toContain("service_can_execute_payroll_core");
    expect(diagnostics).toContain("embeds_token_shape");
    expect(diagnostics).not.toMatch(/^\s*SELECT\s+.*\bcommand\s*(?:,|FROM)/im);
  });
});

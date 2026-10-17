import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSql = (filename: string) =>
  readFileSync(resolve(process.cwd(), "supabase/production-repairs", filename), "utf8");

const sponsorship = readSql("20261016_sponsorship_atomic_rpc_guarded_INSTALLED.sql");
const botb = readSql("20261016_botb_service_only_acl_APPLIED.sql");

describe("applied production repairs for October migration reconciliation #4072", () => {
  it("preserves the exact service-only, idempotent sponsorship settlement gates", () => {
    expect(sponsorship).toContain("CREATE OR REPLACE FUNCTION public.process_sponsorship_installment_atomic(");
    expect(sponsorship).toContain("LANGUAGE plpgsql SECURITY DEFINER SET search_path=''");
    expect(sponsorship).toContain("current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'");
    expect(sponsorship).toContain("auth.uid() IS NOT NULL");
    expect(sponsorship).toContain("WHERE id=p_payment_id FOR UPDATE");
    expect(sponsorship).toContain("WHERE id=v_payment.contract_id FOR UPDATE");
    expect(sponsorship).toContain("sponsorship_contract_payment_history_drift");
    expect(sponsorship).toContain("sponsorship_gameplay_treasury_drift");
    expect(sponsorship).toContain("sponsorship_post_credit_projection_failed");
    expect(sponsorship).toContain("band_earnings_sponsorship_payment_once");
    expect(sponsorship).toContain("REVOKE ALL ON FUNCTION public.process_sponsorship_installment_atomic(uuid)");
    expect(sponsorship).toContain("FROM PUBLIC,anon,authenticated");
    expect(sponsorship).toContain("TO service_role");
    expect(sponsorship).not.toMatch(/\bcron\.(?:schedule|unschedule)\s*\(/i);
  });

  it("keeps the applied source outside the automatic migration queue and without explicit transaction wrappers", () => {
    // Production used a single apply_migration transaction, so explicit
    // BEGIN/COMMIT from the manual runbook were stripped before execution.
    expect(sponsorship).not.toMatch(/^\s*(?:BEGIN|COMMIT);\s*$/gm);
    expect(botb).not.toMatch(/^\s*(?:BEGIN|COMMIT);\s*$/gm);
    expect(sponsorship).not.toMatch(/UPDATE\s+(?:public\.)?band_treasuries\s+SET\s+balance_minor/i);
    expect(sponsorship).not.toMatch(/UPDATE\s+(?:public\.)?bands\s+SET\s+band_balance/i);
  });

  it("removes direct public access from all three Battle of the Bands reward authorities", () => {
    for (const signature of [
      "public.generate_botb_events(integer)",
      "public.resolve_botb_event(uuid)",
      "public.run_botb_cycle()",
    ]) {
      expect(botb).toContain(`REVOKE ALL ON FUNCTION ${signature}`);
      expect(botb).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO service_role`);
    }
    expect((botb.match(/FROM PUBLIC,anon,authenticated/g) ?? [])).toHaveLength(3);
    expect(botb).toContain("pg_get_userbyid(p.proowner)='postgres'");
    expect(botb).toContain("BOTB_SCHEDULER_DEPENDENCY_CHANGED");
    expect(botb).toContain("username='postgres'");
    expect(botb).toContain("jobname='run-battle-of-the-bands'");
  });

  it("prevents cron changes and all direct prize/treasury mutations in the ACL patch", () => {
    expect(botb).not.toMatch(/\bcron\.(?:schedule|unschedule|alter_job)\s*\(/i);
    expect(botb).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:public\.)?(?:band_earnings|bands|botb_events|botb_entries)\b/i);
    expect(botb).not.toContain("CREATE OR REPLACE FUNCTION");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const fromFile = (name: string) => readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");
const legacy = fromFile("20251108083155_create_admin_cron_monitor_tables.sql");
const cutover = fromFile("20251112060817_40f343b9-3dee-4a17-8953-e7472c74e5f3.sql");
const patch = fromFile("20261026112500_secure_admin_cron_monitor_rpcs.sql");

describe("admin cron monitor historical model cutover", () => {
  it("preserves the November 8 table rather than replacing it with a view in place", () => {
    expect(legacy).toContain("CREATE TABLE IF NOT EXISTS public.admin_cron_job_runs");
    expect(cutover).toContain("ALTER TABLE public.admin_cron_job_runs RENAME TO admin_cron_job_runs_legacy");
    expect(cutover).toContain("DROP VIEW IF EXISTS public.admin_cron_job_summary");
    expect(cutover).not.toContain("DROP TABLE public.admin_cron_job_runs");
    expect(cutover).not.toContain("CASCADE");
  });
  it("replaces the legacy admin RPC return types before creating canonical views", () => {
    expect(cutover).toContain("DROP FUNCTION IF EXISTS public.admin_get_cron_job_runs(integer)");
    expect(cutover).toContain("DROP FUNCTION IF EXISTS public.admin_get_cron_job_summary()");
    expect(cutover).toContain("CREATE OR REPLACE VIEW public.admin_cron_job_runs WITH (security_invoker=true)");
    expect(cutover).toContain("CREATE OR REPLACE VIEW public.admin_cron_job_summary WITH (security_invoker=true)");
  });
  it("protects live and migration replayed cron data from anonymous callers", () => {
    for (const code of [cutover, patch]) {
      expect(code).toContain("IF auth.role() IS DISTINCT FROM 'service_role'");
      expect(code).toContain("public.has_role(auth.uid(),'admin')");
      expect(code).toContain("REVOKE ALL ON FUNCTION public.admin_get_cron_job_summary() FROM PUBLIC,anon");
      expect(code).toContain("REVOKE ALL ON FUNCTION public.admin_get_cron_job_runs(integer) FROM PUBLIC,anon");
    }
  });
});

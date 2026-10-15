import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("five unresolved operational issue regression contracts", () => {
  it("#4082 removes credential-bearing cron schedules without starting payroll or printing tokens", () => {
    const sql = read("supabase/production-repairs/20261015_quarantine_embedded_jwt_cron_jobs.sql");
    expect(sql).toContain("cron.unschedule(v_job.jobid)");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("is_legacy_bearer");
    expect(sql).toContain("ORDER BY jobid FOR UPDATE");
    expect(sql).toContain("Legacy payroll/sponsorship cron cleanup incomplete");
    expect(sql).toContain("MANUAL REVIEW ONLY");
    expect(sql).not.toMatch(/PERFORM\s+public\.process_weekly_band_payroll\(/);
    expect(sql).not.toMatch(/http_post\s*\(/i);
    expect(sql).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("#4119 checks three real money authorities before payroll and stays read-only", () => {
    const sql = read("supabase/production-repairs/20261015_payroll_liquidity_readiness_readonly.sql");
    expect(sql).toContain("public.band_treasuries");
    expect(sql).toContain("public.financial_accounts");
    expect(sql).toContain("public.band_earnings");
    expect(sql).toContain("third_ledger_not_reconciled");
    expect(sql).toContain("payroll_accounts_not_unique");
    expect(sql).toContain("gameplay_invalid_or_over_reserved");
    expect(sql).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|CREATE\s+FUNCTION|cron\.schedule\s*\()\b/i);
  });

  it("#2002 keeps first crowd entrance and applause pending until sound catalogue loads", () => {
    const crowd = read("src/features/gig-experience/viewer/audio/useCrowdAmbience.ts");
    expect(crowd).toContain("lastSongIdRef.current && sounds.length > 0");
    expect(crowd).toContain("lastReactionRef.current && sounds.length > 0");
    expect(crowd).toContain("lastPhaseRef.current && sounds.length > 0");
    expect(crowd).toContain("lastPhaseRef.current = null");
    expect(crowd).toContain("reactionCooldownRef.current.reset()");
  });

  it("#2182 gives staff a logo-gap queue and actual light/dark asset previews", () => {
    const admin = read("src/pages/admin/BrandsAdmin.tsx");
    const identity = read("src/features/festival-company/ui/SponsorIdentity.tsx");
    expect(admin).toContain("Brand logos to review");
    expect(admin).toContain("Missing or unsafe logos");
    expect(admin).toContain('previewTheme="light"');
    expect(admin).toContain('previewTheme="dark"');
    expect(identity).toContain('previewTheme?: "light" | "dark"');
    expect(identity).toContain('"bg-white text-slate-900"');
    expect(identity).toContain('"bg-slate-950 text-slate-100"');
  });

  it("#2183 updates the edition profile version after each successful save and retains failed drafts", () => {
    const editor = read("src/features/festival-company/ui/FestivalPublicProfileEditor.tsx");
    expect(editor).toContain("const refreshed = await plan.refetch()");
    expect(editor).toContain("if (refreshed.isError)");
    expect(editor).toContain("setDirty(false)");
    expect(editor).toContain("Your draft is preserved");
    expect(editor).toContain("<fieldset disabled={save.isPending || plan.isLoading}");
  });
});

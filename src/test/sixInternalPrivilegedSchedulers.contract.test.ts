import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const targets = [
  "generate-gig-offers",
  "generate-pr-offers",
  "generate-radio-invitations",
  "complete-release-manufacturing",
  "process-tour-travel",
  "auto-complete-gigs",
] as const;
const read = (path: string) => readFileSync(path, "utf8");
const helper = read("supabase/functions/_shared/trusted-scheduler.ts");
const claimSql = read("supabase/migrations/20261019112829_trusted_privileged_job_window_claims.sql");
const cutoverSql = read("supabase/migrations/20261019112904_vault_auth_six_privileged_lifecycle_crons.sql");

describe("six internal privileged schedulers (#4255)", () => {
  it("requires an internal secret BEFORE any scheduled job-window claim", () => {
    expect(helper).toContain('req.method !== "POST"');
    expect(helper).toContain('"verify_internal_cron_secret"');
    expect(helper).toContain('req.headers.get("x-cron-secret")');
    expect(helper).toContain('authenticated !== true');
    expect(helper).toContain("status: 401");
    expect(helper).toContain('"claim_privileged_job_window"');
    expect(helper).toContain('claim?.claimed !== true');
    expect(helper).toContain("already_claimed");
    expect(helper.indexOf('"verify_internal_cron_secret"')).toBeLessThan(
      helper.indexOf('"claim_privileged_job_window"'),
    );
  });

  it.each(targets)("%s authorises before data access / service-role mutations", (target) => {
    const src = read(`supabase/functions/${target}/index.ts`);
    const handler = src.indexOf("serve(async (req)");
    const guard = src.indexOf("authorizeInternalJob(req", handler);
    const firstMutation = src.indexOf(".from(", handler);
    expect(src).toContain("../_shared/trusted-scheduler.ts");
    expect(guard).toBeGreaterThan(handler);
    expect(firstMutation).toBeGreaterThan(guard);
    expect(src).toContain(`"${target}", corsHeaders`);
    if (target === "generate-pr-offers" || target === "generate-gig-offers" || target === "auto-complete-gigs") {
      expect(src.indexOf("await safeJson", handler)).toBeGreaterThan(guard);
      expect(src.indexOf("startJobRun(", handler)).toBeGreaterThan(guard);
    }
  });

  it("holds one authoritative scheduled window per job and blocks browser access", () => {
    expect(claimSql).toContain("PRIMARY KEY (job_name,window_started_at)");
    expect(claimSql).toContain("ON CONFLICT DO NOTHING");
    expect(claimSql).toContain("unknown_internal_job_window");
    expect(claimSql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(claimSql).toContain("FROM PUBLIC,anon,authenticated");
    expect(claimSql).toContain("TO service_role");
    expect(cutoverSql).toContain("vault.decrypted_secrets");
    expect(cutoverSql).toContain("'x-cron-secret'");
    expect(cutoverSql).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(cutoverSql).toContain("cron_job_id_changed");
    expect(cutoverSql).toContain("allow_manual_trigger=false");
  });

  it("does not let a release screen execute a global manufacturing job", () => {
    const autoRelease = read("src/hooks/useAutoReleaseManufacturing.ts");
    const tab = read("src/components/releases/MyReleasesTab.tsx");
    expect(autoRelease).not.toContain("supabase.functions.invoke");
    expect(tab).not.toContain('functions.invoke("complete-release-manufacturing")');
    expect(tab).toContain("Release queued");
    expect(autoRelease).toContain("invalidateQueries");
  });
});

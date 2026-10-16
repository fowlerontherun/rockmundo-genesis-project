import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const worker = source("supabase/functions/complete-recording-sessions/index.ts");
const repair = source("supabase/production-repairs/20261016_recording_cron_auth_and_rpc_cutover.sql");

describe("recording completion cron authentication cutover", () => {
  it("continues to require an owned active character for manual completion", () => {
    expect(worker).toContain("if (payload?.sessionId)");
    expect(worker).toContain("Recording not owned by active character");
    expect(worker).toContain(".eq('profile_id', payload.profileId).maybeSingle()");
    expect(worker).toContain("supabase.auth.getUser(bearer)");
  });

  it("requires either service-role authentication or a verified Vault cron credential", () => {
    expect(worker).toContain("req.headers.get('x-cron-secret')");
    expect(worker).toContain("supabase.rpc('verify_internal_cron_secret', { p_secret: cronSecret })");
    expect(worker).toContain("cronAuthorized = !error && data === true");
    expect(worker).toContain("if (!serviceKey || (bearer !== serviceKey && !cronAuthorized))");
    expect(worker).toContain("Global recording processing requires service authentication");
    expect(worker).not.toContain("} else if (!serviceKey || bearer !== serviceKey)");
  });

  it("does not persist authentication credentials in pg_cron", () => {
    expect(repair).toContain("cron.alter_job(");
    expect(repair).toContain("jobname = 'complete-recording-sessions'");
    expect(repair).toContain("vault.decrypted_secrets");
    expect(repair).toContain("'x-cron-secret'");
    expect(repair).not.toMatch(/Bearer eyJ[A-Za-z0-9_.-]+/);
    expect(repair).not.toContain("'Authorization',");
  });

  it("preserves the privileged, idempotent claim/XP RPC permissions", () => {
    for (const name of [
      "claim_recording_completion",
      "release_recording_completion",
      "finalize_recording_completion",
      "award_recording_xp_atomic",
    ]) expect(repair).toContain(`public.${name}`);
    expect(repair).toContain("auth.jwt()->>''role''");
    expect(repair).toContain("current_setting(''role'',true)");
    expect(repair).toContain("REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated");
    expect(repair).toContain("GRANT EXECUTE ON FUNCTION %s TO service_role");
    expect(worker).toContain("'claim_recording_completion'");
    expect(worker).toContain("'award_recording_xp_atomic'");
    expect(worker).toContain("'finalize_recording_completion'");
  });
});

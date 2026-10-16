import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = readFileSync(
  fileURLToPath(new URL('../../../supabase/production-repairs/20261016_stage_paused_sponsorship_vault_dry_run_MANUAL_ONLY.sql', import.meta.url)),
  'utf8',
);

describe('#4082 existing paused sponsorship job staging', () => {
  it('only targets the known inactive existing job without creating or activating a scheduler', () => {
    expect(file).toContain("jobname = 'process-sponsorship-payments-cron'");
    expect(file).toContain("schedule = '0 0 * * *'");
    expect(file).toContain('v_job <> 52');
    expect(file).toContain('cron.alter_job(');
    expect(file).toContain('active => false');
    expect(file).not.toContain('cron.schedule(');
    expect(file).not.toContain('cron.unschedule(');
  });

  it('retrieves the secret at runtime and cannot perform payouts from the staged body', () => {
    expect(file).toContain('vault.decrypted_secrets');
    expect(file).toContain("'x-cron-secret'");
    expect(file).toContain('{"dryRun":true}');
    expect(file).not.toContain('{"dryRun":false}');
    expect(file).not.toMatch(/Bearer\\s+eyJ[A-Za-z0-9_-]{20,}/);
  });

  it('fails closed on credential-bearing, reactivated or changed jobs', () => {
    expect(file).toContain('SPONSORSHIP_JOB_ID_DRIFT');
    expect(file).toContain('PAYMENT_JOBS_NOT_QUARANTINED');
    expect(file).toContain('STAGED_SPONSORSHIP_COMMAND_VERIFICATION_FAILED');
    expect(file).toContain('SPONSORSHIP_VAULT_OR_AUTH_PREREQUISITE_MISSING');
  });
});

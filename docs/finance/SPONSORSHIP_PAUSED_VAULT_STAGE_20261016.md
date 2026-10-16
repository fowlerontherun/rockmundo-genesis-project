# #4082 — Paused sponsorship Vault staging (16 October 2026)

**Manual-only, fail-closed; not a payout release.**

## Why this is needed

Production no longer matches the 15 October quarantine/reinstall runbook. On 16 October, the existing cron jobs were **disabled and their stored bearer commands replaced**, not unscheduled. The older `20261015_sponsorship_vault_cron_install_AFTER_QUARANTINE.sql` refuses to run while job names exist. The earlier `20261014_sponsorship_cron_vault_auth_cutover.sql` prepares a **live payment body** and must not be used as an automatic follow-up to containment.

A new manual-only idempotent script, `supabase/production-repairs/20261016_stage_paused_sponsorship_vault_dry_run_MANUAL_ONLY.sql`, targets only the existing *disabled* sponsorship job (#52). It preserves the daily schedule, stores a runtime Vault lookup, and hardcodes **dryRun: true**. It refuses job-ID/schedule drift, any resumed affected job, missing Vault/auth prerequisites or embedded bearer-shaped credentials. It does not require the unavailable settlement RPC because it cannot invoke it while disabled and the body is a dry run.

## Live verification performed (no settlements)

- Jobs #51, #52 and #76 are disabled, with no credential-shaped strings in their `cron.job.command`.
- Job #52 now contains a runtime Vault secret lookup and a dry-run-only request body while disabled.
- 16 October HTTP smoke test: an unauthenticated `POST` returned **401**; a Vault-authenticated **dryRun** `POST` returned **200**, with `paymentsPaid = 0`. No secret was displayed.
- Service-role verifier grant is present; `anon` and `authenticated` cannot execute it.
- `process_sponsorship_installment_atomic(uuid)` and `process_weekly_band_payroll()` remain absent in production.
- Payroll remains independently blocked because gameplay and financial accounts disagree (see #4119).
- A separate redacted scan identified 43 unrelated cron commands matching bearer/JWT patterns; their rotation and migration remain a distinct broader security release.

## Release blockers

Do not enable job #52, remove dry-run mode, install the guarded sponsorship RPC, or resume payroll as part of this staging change. Those steps require reviewed backup/PITR and a restored staging fixture, function grants and schema checks, race/retry/idempotency tests, reconciliation of legacy earnings against gameplay treasuries, credential rotation/blast-radius analysis, and an explicitly approved production rollout window.

When staged and separately authorized, deploy the **guarded manual-only** RPC from `20261015_sponsorship_atomic_installment_guarded_MANUAL_ONLY.sql` rather than replaying the older unapplied October sponsorship migration. The guarded implementation returns the `replayed` boolean required by the deployed worker and refuses unreconciled band liquidity.

Do not use the older `AFTER_QUARANTINE` installer against paused-but-existing jobs. A reviewed, separate release should edit the existing scheduler to live mode only after complete staging verification. Never use `cron.schedule` to create a duplicate payment runner, replay missed wages, or set a finance balance to a gameplay projection.

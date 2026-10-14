# Sponsored payout worker authentication and cron credential removal

Issue: [#4082](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4082)
Overall migration reconciliation: [#4072](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072)

## Production audit (read-only, 14 October 2026)

- `process-sponsorship-payments-cron` is active at `0 0 * * *`, but
  its `cron.job.command` contains an embedded JWT-shaped bearer credential.
- `process-sponsorship-payments` Edge function has `verify_jwt=false`.
  Before this change, the handler instantiated a service-role client and made
  privileged payments without authenticating incoming HTTP calls.
- `public.verify_internal_cron_secret(text)` already exists, with EXECUTE
  granted to `service_role` but not `anon` or `authenticated`.
  Vault has a secret named `internal_cron_secret`. Never export the value.
- `process_sponsorship_installment_atomic(uuid)` does **not** exist live.
  The corrected source migration was merged as part of PR #4081; merging
  a migration file is not the same as applying it.
- At audit time, `sponsorship_payments` had zero scheduled/paid rows.
  Re-check before any deployment.

## Code changes

1. The sponsorship Edge worker rejects requests without a valid
   `x-cron-secret` **before** parsing request bodies, creating job-run
   records or executing service-role queries.
2. `supabase/production-repairs/20261014_sponsorship_cron_vault_auth_cutover.sql`
   changes only the existing cron job command via `cron.alter_job`.
   The command resolves the protected secret at execution time rather than
   storing a bearer token. It checks for the installed payout RPC and the
   Vault/verifier prerequisites, failing without altering the job if missing.
3. Tests enforce the early auth gate and the no-embedded-token cron contract.

## Coordinated production order (NOT automated by this PR)

1. Verify PITR or restorable backup, copy sanitized schema to staging and
   capture current `cron.job` state **without selecting `command` text**.
2. Confirm that `sponsorship_payments` and `band_earnings` don't contain
   duplicate settlements. Apply/verify the audited atomic sponsorship RPC
   from PR #4081 in isolation. Test repeated and concurrent payout requests
   against disposable data.
3. Stage the cron cutover SQL and gated Edge function together; test that a
   missing/wrong secret returns HTTP 401 and valid secret allows one
   no-op/zero-row scheduled execution. Ensure no client-visible API depends
   on the previously unguarded endpoint.
4. **Production:** apply the verified cron cutover SQL **first**. It replaces
   the stored bearer credential and sends the header that both the new
   handler and existing unguarded handler can receive. Verify job command
   does not embed a JWT.
5. Deploy the gated Edge worker (with `verify_jwt=false` at the gateway;
   authorization is enforced by the `x-cron-secret` verifier). A gateway
   `verify_jwt=true` setting without an Authorization header would reject
   the pg_cron request before the function's gate.
6. Execute only a **read-only** postdeployment audit; do not manually
   settle real payments for a smoke test. Inspect next scheduled run's job
   status and payment ledger, ensuring no duplicate credits.
7. Rotate/revoke the superseded embedded JWT and search **all** cron jobs
   for embedded bearer patterns using boolean SQL, not command text. The
   payroll job still needs its own separate migration and treasury funding
   reconciliation; do not change it as part of this cutover.

## Read-only verification SQL

```sql
select jobname,active,schedule,
  command ~* 'Bearer[[:space:]]+eyJ' as has_embedded_jwt,
  command like '%vault.decrypted_secrets%' as uses_runtime_vault
from cron.job
where jobname='process-sponsorship-payments-cron';

select to_regprocedure('public.process_sponsorship_installment_atomic(uuid)')
  as payout_rpc;

select count(*) from public.sponsorship_payments
where status='scheduled' and scheduled_at <= now();
```

## Rollback

If the Edge worker rejects a scheduled request after cutover, preserve
current payout row state, check secret-verifier grants and Vault membership,
and redeploy the previous authenticated-safe worker or pause this single
job briefly while correcting the header; **never restore the bearer token
in `cron.job.command`**. Do not retry manually against real payments
until exact-once settlement is confirmed.

## Payroll blocker

The weekly payroll cron still targets an HTTP endpoint deployed as 410.
There are two active pay-enabled bands. Repo documentation
`docs/finance/WEEKLY_PAYROLL_HARDENING_20261014.md` reports that neither
has a verified matching canonical ledger treasury. A migration that
introduces `process_weekly_band_payroll()` must remain withheld until those
treasuries and historical wages are reconciled. The latest historical
`band_pay` activity in this audit was on 10 October 2026 (25 records).

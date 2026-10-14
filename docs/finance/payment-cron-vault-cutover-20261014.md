# Payroll and sponsorship cron recovery — controlled release (#4082)

**Status: staging / approval required. Do not execute any settlement function in
production merely to test it.** The security patch alone deliberately fails closed
for existing cron callers that only send a bearer token.

## Confirmed production snapshot (14 October 2026)

Read-only checks found:
- Both named cron jobs active, storing Authorization/Bearer headers rather than
  referencing Vault. The commands' secrets were **not read or copied**.
- Sponsorship's currently deployed worker has `verify_jwt=false` and lacked a
  caller check. The committed worker now requires `x-cron-secret` validated via
  `public.verify_internal_cron_secret(text)` through the service-role client.
- `verify_internal_cron_secret(text)` exists, is `SECURITY DEFINER`, and only
  `service_role` has EXECUTE; a Vault secret named `internal_cron_secret` exists.
- Production lacks `process_sponsorship_installment_atomic(uuid)`,
  `process_weekly_band_payroll()` and `band_weekly_payroll_settlements`.
- Weekly cron still calls retired `process-weekly-band-pay` HTTP, which returns 410.

These facts can change. Re-run `supabase/diagnostics/payment_cron_readiness.sql`
immediately before and after release; it emits **no command strings or secrets**.

## Release sequence — do not bypass gates

1. Confirm PITR, an isolated restore rehearsal, current main commit, explicit
   financial-ledger snapshot and deploy permissions. Determine the last
   successful real payouts from settlement/ledger records; cron `active` is
   not evidence of payment.
2. Install and test the dependency-reviewed forward-only **atomic sponsorship
   RPC** in a disposable staging database, including idempotency, concurrent
   retries, permissions, zero-row and rollback scenarios. Do not replay
   `20261012213100_atomic_sponsorship_installments.sql` on production blindly:
   it may conflict with current ledger/trigger state. Finish #4072 reconciliation.
3. Deploy the authenticated sponsorship Edge Function **without sending an
   execution request**. Verify a missing/invalid `x-cron-secret` gets 401,
   verifier failure gets 503 and absolutely no job log or balance mutation is
   caused by either. Confirm `verify_jwt=false` for this **secret-gated**
   function: unlike user JWT auth, the header gate validates the cron caller.
4. After staging review, convert the existing sponsorship cron job in a single
   controlled change. **Illustrative, not automatic migration:** use
   `cron.alter_job` by the existing job ID, retain its daily midnight schedule,
   and replace its command with the following server-side-only secret lookup:

   ```sql
   -- Only after reviewed RPC, worker auth and staging results are verified.
   SELECT cron.alter_job(
     job_id := (SELECT jobid FROM cron.job
                WHERE jobname = 'process-sponsorship-payments-cron'),
     command := $cron$
       SELECT net.http_post(
         url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-sponsorship-payments',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'x-cron-secret',
           (SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'internal_cron_secret')
         ),
         body := '{}'::jsonb
       ) AS request_id;
     $cron$
   );
   ```

   In the final reviewed execution wrapper verify exactly one job exists, its
   existing schedule is correct, the Vault secret exists, the destination is
   correct and the atomic RPC has compatible signatures/grants. **Never paste
   the Vault value into the SQL text or return a decrypted secret in logs.**
   Confirm `cron.job.command` now references Vault by boolean checks only.

5. Use a **zero-due-payments** staging fixture and separately verify exactly
   one eligible paid installment with retries. Do not trigger paid production
   settlements as a smoke test. Inspect audited results without printing tokens.
6. Reconcile payroll's historical payouts, band treasury ledgers and active
   pay-enabled bands before enabling its replacement. The existing payroll
   migration needs live-schema compatibility and concurrency tests; both
   replacement objects were absent on the production snapshot. Migrate the
   scheduler from retired HTTP to internal database invocation only after
   approval. One named job, one settlement authority.
7. Rotate/revoke stored old JWT credentials **after** all remaining users and
   cron dependencies are inventoried; retiring a cron command does not erase
   backups, logs or external copies. Re-audit cron commands for bare bearer
   headers, run security advisors and monitor next scheduled completions.

## Required evidence before issue closure

A successful unauthorized-response test without ledger mutation; authenticated
staging run; migration/grant signatures; zero duplication under retry/race; an
approved rollback and restoration plan; payroll ledger reconciliation; post-cutover
cron metadata containing **no static bearer**; confirmed scheduled successful
settlements; and token rotation. If any step fails, stop and maintain a disabled
or fail-closed path rather than issuing unverified payouts.

This PR changes the worker and creates diagnostics and this runbook. It does **not**
apply any production DDL, update cron commands, rotate credentials or issue payments.

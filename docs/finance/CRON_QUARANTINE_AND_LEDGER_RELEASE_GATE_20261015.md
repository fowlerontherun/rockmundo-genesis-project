# Payroll and sponsorship release gate — 15 October 2026

Related: **#4082** (credential-bearing cron), **#4119** (gameplay vs payroll liquidity).

**Prepared and audited, not applied.** This report contains no credential values
and no per-player or sensitive payment transactions. Runbooks and scripts in
`supabase/production-repairs/` are intentionally outside automated migrations.

## Read-only production evidence

An administrator-safe query of `cron.job`, returning *only* booleans and
schedule metadata, found two active jobs:

| Job name | Active | Stored bearer/JWT-like literal | Vault-backed secret | DB payroll |
| --- | --- | --- | --- | --- |
| process-weekly-band-pay | yes | yes | no | no |
| process-sponsorship-payments-cron | yes | yes | no | no |

**Never SELECT, export, log or paste `cron.job.command`.** The current
`process-weekly-band-pay` HTTP endpoint returns 410. An active cron job
does not prove a valid wage settlement. Do not replay any historical wage.

A separate read-only three-ledger preflight on the same date reported:
- **2 pay-enabled bands**;
- **0** missing/duplicated gameplay primary treasuries;
- **0** negative or over-reserved gameplay treasuries;
- **0** differences between displayed band cash and gameplay treasury;
- **2** without exactly one compatible active financial payroll account;
- **2** with missing/incompatible financial-account balances or currencies;
- **1** with an earnings history subtotal differing from spendable gameplay
  cash — legitimate recording or rehearsal bookings may explain the difference.

The diagnostic SQL is
`supabase/production-repairs/20261015_payroll_liquidity_readiness_readonly.sql`.
Run it as a trusted DBA on a sanitised restore before comparing production
aggregates. A zero discrepancy in one of the three models is **not** overall
payroll readiness.

## Phase A: contain credential exposure — controlled outage

1. Confirm production PITR restoration and separately verify a sanitised
   staging clone. Back up redacted cron job names/schedules and evidence in
   private operational storage, *not* command literals or JWTs.
2. Notify game operations that sponsorship scheduled settlement will be paused
   while the atomic `process_sponsorship_installment_atomic` and Vault-based
   scheduler are verified. Wages are already routed to a retired HTTP worker.
3. Stage and review
   `supabase/production-repairs/20261015_quarantine_embedded_jwt_cron_jobs.sql`.
   It matches *only* two known job names with the expected embedded bearer
   pattern, holds row locks, and `cron.unschedule`s them in one transaction.
   It **does not** pay players, invoke Edge functions, create new schedules,
   change ledger money or read decrypted Vault secrets. Unexpected changed
   commands fail the transaction and require a new review.
4. Following separate production approval, execute the script once. Verify
   both names are absent from `cron.job` using `jobname` only. Confirm no
   other payment schedule remained live with a literal credential using
   boolean-only aggregation, not `command` output.
5. Coordinate token rotation/revocation with the auth owner: deleting cron
   entries does not revoke bearer strings that may have leaked elsewhere.
   Monitor job errors and preserve all ledger history.

## Phase B: independently restore sponsorship

Only after the server's `verify_internal_cron_secret` authorization gate,
atomic installment RPC and dry-run have passed staging tests may operations
install a **new** credentialless job that reads its secret from Vault **at
execution time**. Exercise an authenticated dry-run with zero settlement,
then verify unique installment IDs and precise ledger effects before allowing
ordinary schedules. No production cron installation is part of this PR.

## Phase C: independently restore weekly wages

**Block until the third-ledger conflicts are resolved.** Stage the proposed
incremental `band_earnings` correction and canonical payroll architecture
against actual recording/rehearsal expenses and member wallets; validate
idempotent Saturday settlement, reserved cash, concurrency, retries, rollback
and a previous-payroll audit before considering the cutover. Never use the
earnings subtotal to mint missing cash or enable payroll just because a cron
name exists.

## Release stop conditions

Stop if an unexpected cron command replaced the legacy job, a backup/restore
rehearsal fails, the Vault verifier is unavailable, credentials remain stored,
payroll account count differs from one, currencies/amounts disagree, a member
wallet is missing, or a rehearsal/recording debit can be reversed by earnings.

The staged SQL files and tests may be merged independently of actually
performing the operational remediation. **Neither scheduling nor payments
should be activated by a normal source-code deployment.**

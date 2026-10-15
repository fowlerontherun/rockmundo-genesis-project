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

## #4082 staged settlement RPC and post-quarantine schedule (follow-up)

A compatible guarded sponsorship RPC is now staged at
`supabase/production-repairs/20261015_sponsorship_atomic_installment_guarded_MANUAL_ONLY.sql`.
It does not settle funds or modify any cron jobs merely by being installed.
The old October migration **must not** be replayed. The new RPC serializes
the due installment, verifies service-role authorization, prevents duplicate
payment journal entries, and rejects discrepancies between historical
`band_earnings`, displayed band money and the primary USD gameplay treasury
before it credits a cent. The current full-earnings-reprojection trigger can
overwrite already-spent cash: any such discrepancy **blocks** the installment
for manual reconciliation rather than minting a correction. Its finance
indexes and trigger expectations are strictly verified.

After the approved **Phase A** quarantine has removed both old JWT cron jobs
and credentials are rotated, the *separate* reinstall script
`supabase/production-repairs/20261015_sponsorship_vault_cron_install_AFTER_QUARANTINE.sql`
can recreate **only** the sponsorship job. Unlike the older
`20261014_sponsorship_cron_vault_auth_cutover.sql` (which updates an existing
job), the new installer correctly handles a quarantined/missing job, refuses
to overwrite any unexpected scheduler state and stores only a runtime Vault
query, never a decrypted secret. The obsolete in-place alter script must **not**
be run after quarantine.

As checked on 15 October, production contained zero sponsorship contracts,
zero installments (including zero due), and **six bands whose earnings totals
differ from spendable band balances**. Never backfill, reset, or mint cash to
make these disappear. Sponsor settlement tests must use staging fixtures and
verify zero new overpayments, replay idempotency, locked concurrency, invalid
contract/owner, inaccurate treasury, expired/stale installment, cancellation,
and exact rollback of status, balance, morale and ledger if any step fails.

Operator stop conditions for the two staged scripts: no verified backup and
restorable staging clone; any pending unexpected payment; changed balance
triggers; failed service-role-only RPC permission check; no known-safe
authentication failure/zero-payment dry run of the deployed Edge function;
credentials still stored in any cron command; conflicting schedule names;
no confirmed credential rotation; or unapproved restart window.

Neither staged script should be run automatically by GitHub CI, release
pipelines, `db push`, or an unreviewed finance migration. Installing an RPC
alone is not the complete fix; #4082 stays open until both schedulers,
credential rotation, payroll reconciliation and payment ledgers have been
verified end-to-end.

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

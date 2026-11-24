# Issue #4082 — live payroll runtime audit and invocation gate (9 November 2026)

**Release state: partial remediation only. Do NOT close #4082 based on this PR.**
This PR adds a manual-only, zero-payout restriction for the currently deployed
weekly payroll function and fixes tests for its actual source. It does **not**
reactivate sponsorship, settle or backfill any wage, modify live schedules,
rotate keys, or transfer money.

## Read-only live evidence (9 November 2026)

The deployed implementation is from
`20261017110239_e155a93e-3985-439d-8a16-1d70bbedc946.sql`,
**not** the previously planned financial-account implementation in the
renamed `20261014101831_secure_atomic_weekly_band_payroll.sql`.
It uses `bands.band_balance` limited by the primary
`band_treasuries` available amount, posts a negative `band_earnings`
expense, updates `profiles.cash`, and records `band_pay` activity.
It does not create an immutable `financial_transactions` transfer.

- `process-weekly-band-pay` (job #76) is active, owned by `postgres`,
  scheduled for Saturday 10:00 UTC, and routes internally to the payroll RPC
  without HTTP. There is one named payroll scheduler.
- `process-sponsorship-payments-cron` (#52) remains inactive, Vault-backed,
  and configured with `dryRun`; sponsorship offers (#51) are inactive.
- Both atomic RPC signatures exist in the database. API roles `anon` and
  `authenticated` cannot execute either. **service_role could execute the
  existing payroll RPC** before this proposed gate is staged.
- There are two eligible bands with a single primary gameplay treasury each,
  with zero displayed/gameplay balance mismatches in the current check.
  **The absence of `financial_accounts.metadata.account_role='band_treasury'`
  is not a blocker for this newer implementation**; do not run the legacy
  metadata-role repair to force those ledgers to agree.
- Six settlements (two bands for each week starting 19 Oct, 26 Oct, 2 Nov)
  were made on Sat 24 Oct, Sat 31 Oct and Sat 7 Nov, at approximately
  10:00:02, 10:00:02 and 10:00:01 UTC.
- Settlement totals, negative `band_earnings` totals and positive activity
  credits agree **in aggregate** in all three weeks. Total settled wages:
  11,316,320 game dollars; four member credit records per week.
- No `cron.job_run_details` rows for job #76 were available in this audit
  despite the scheduled-time settlements. Ledger/activity evidence is
  stronger than relying on the cron `active` flag alone.
- Boolean-only scan found zero cron commands with stored bearer/JWT shapes.
  This does **not** prove the historical credentials were revoked/rotated.
- The live payroll function had **no Saturday-only guard**; the scheduler's
  Saturday schedule does not prevent a direct midweek service-role RPC call.

No Vault decrypted values, `cron.job.command` strings, JWTs, player UUIDs,
or personal data were queried or copied into the report. **No live writes,
DB migrations, schedules or payouts were performed in this audit.**

## Prepared manual-only safety patch

`supabase/production-repairs/20261109_weekly_payroll_invocation_gate_4082_MANUAL_ONLY.sql`

The script begins a short-locking transaction and checks exact scheduler
name, owner, schedule and internal routing, the payroll function's expected
gameplay implementation, and the settlement table. On mismatches it aborts
before any DDL.

On a **reviewed staging restore** only, the script atomically:
1. Renames the existing gameplay payer to an internal, restricted core.
2. Revokes `PUBLIC`, `anon`, `authenticated` and `service_role` execution
   on the core; creates a wrapper under the original scheduled function name.
3. Requires the `postgres` session (the current cron owner), a null
   `auth.uid()`, and UTC Saturday; other days return `outside_schedule`
   without calling the core.
4. Revokes all API execution privileges on the wrapper and verifies ACLs
   before commit. It does not execute the payer or alter its money logic.

The script is deliberately **outside `supabase/migrations/`**. A code merge
does not execute it. Do not schedule it as an automatic migration.

### Required deployment verification

Before any production DDL: document backup/PITR recovery, restore a staging
copy with financial data handled securely, validate job/permissions/dependency
compatibility and test transaction rollback. Prove in staging that a weekday
invocation is inert, unauthorized API roles cannot execute either function,
the Saturday cron owner can invoke the wrapper, concurrent Saturday retries
settle only once, a failing member transfer rolls back the full band, and
existing balances and credit totals do not drift.

At approved production deployment, apply only the reviewed manual gate in a
maintenance window away from Saturday 10:00 UTC. Run
`supabase/diagnostics/payment_cron_readiness.sql` to inspect only
redacted metadata, ACLs and recent settlement parity; **never call the
payroll RPC as a smoke test**. Confirm the next natural Saturday run posted
one balanced settlement per eligible band and did not duplicate any earlier
week. If rollback is required, disable the job temporarily under the change
plan, drop only the wrapper and rename the existing core back under the
database owner's control; **do not restore service-role payment grants**.
Do not perform any historical backfill automatically.

## Outstanding issue-closure gates

1. Verify a staging restore, backup and production rollout of the invocation
   gate. These checks are **not** claimed as completed.
2. Decide and implement how direct profile cash changes, gameplay treasury
   updates and the unified finance journal obtain a single authoritative,
   immutable per-member payroll transfer record. The current matching
   aggregate counts do not prove all finance-ledger invariants.
3. Verify sponsorship worker authentication and atomic settlement on a
   staged due-installment fixture, transition the disabled Vault-backed
   sponsorship job through approved dry-run to live, and verify one
   settled installment with no replay or duplicate. No active sponsorship
   installments existed in the 16 October audit; current live settlement
   evidence needs a new check.
4. Verify rotation/revocation of historical embedded keys and wider scheduler
   credential cleanup. Zero stored JWT-shaped commands is not key revocation.
5. Independently reconcile missed historical payroll, if any, with receipts;
   obtain explicit batch authorization **before** crediting missed wages.
6. Check next-run logs/settlements and frontend/gameplay regression; only
   then close #4082.

Related: #4072 (migration drift), #4119 (gameplay and finance ledger authority),
earlier PRs #4172, #4204 and #4212. This is an incremental safety PR, not a
substitute for those production release gates.

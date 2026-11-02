# Work-shift settlement certification (#4216)

## Production-safe read-only audit

Run `supabase/diagnostics/work_shift_settlement_audit.sql` with read-only DB access. Review every non-zero anomaly; don't treat a historical ledger count as authority to debit, credit, or finish a shift. Existing legacy shifts without a matching active activity are **quarantined**, not automatically replayed. The source of truth for new shifts is `work_shift_settlements.shift_id` plus exactly one corresponding XP ledger row and, when tax is positive, one city treasury ledger row.

## Non-production regression

1. Run `supabase/tests/work_shift_atomic_regression_harness.sql` using `psql -X -v ON_ERROR_STOP=1 -f ...` on a seeded staging/clone DB. It uses `BEGIN / ROLLBACK` and covers two characters, positive city tax, replay, zero income/XP, negative reward rejection and completed-without-receipt handling.
2. On a **disposable local Postgres DB only**, run `supabase/tests/work_shift_atomic_failure_injection_harness.sql` with `PGOPTIONS='-c app.allow_test_fixtures=true'`. The harness creates transaction-scoped triggers and verifies rollback followed by a single successful retry for seven failure points. **Never run this trigger test on production** (DDL locks tables until rollback).
3. On the same disposable local DB, seed at least two employed profiles and run `PGOPTIONS='-c app.allow_test_fixtures=true' SUPABASE_DB_URL=postgresql://...@localhost:54322/postgres node scripts/work-shifts/certify-parallel.mjs`. It starts two independent `psql` connections, holds the first transaction open after settlement, and requires the blocked second RPC to return `settled:false`. This test intentionally commits synthetic fixtures/rewards to the disposable database and refuses remote hosts.
4. Use the read-only audit again after deployment. Also verify normal scheduler logs contain no settlement errors and no new duplicate XP/tax groups.

## Legacy reconciliation

The migration does **not** modify historical cash, city balances or XP. For each duplicate XP/tax group, reconcile account/profile, original shift, tax rate as applied at shift time, cash balance transactions and historical job logs. Record a reviewed correction with an independent idempotency key only when the amounts and recipient are proven. For orphaned in-progress shifts, establish whether work actually occurred, whether a completed attendance/activity record existed, and whether any payout was previously made. Do not manufacture missing active statuses or call the payout RPC on old rows. Track unresolved cases separately before closing the incident.

Do not claim release acceptance until the parallel-connection and failure-injection gates **pass** on an isolated database and finance review resolves the historical duplicate and orphan cases.

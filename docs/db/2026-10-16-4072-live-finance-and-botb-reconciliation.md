# Issue #4072 — 16 October 2026 direct production changes

**Production:** Supabase `yztogmdixmchsmimtent`. This document records **already-applied** SQL. The exact executed statements are copied from `supabase_migrations.schema_migrations.statements`, not reconstructed from historical scripts.

**Do not replay these records** through a bulk `supabase db push`, CI, or automatic migration folder. They are deliberately preserved in `supabase/production-repairs/` outside `supabase/migrations/`.

| Recorded version | Database name | Source |
| --- | --- | --- |
| `20261016205623` | `rockmundo_20261016_earnings_sponsorship_uniqueness_and_trigger_acl` | `20261016_sponsor_payment_uniqueness_trigger_acl_applied.sql` |
| `20261016205852` | `rockmundo_20261016_sponsorship_atomic_rpc_guarded_inactive` | `20261016_sponsorship_atomic_rpc_guarded_INSTALLED.sql` |
| `20261016210403` | `rockmundo_botb_prize_settlement_service_only_20261016` | `20261016_botb_service_only_acl_APPLIED.sql` |

## Implemented and verified

- Unique partial index `band_earnings_sponsorship_payment_once` enforces one sponsor earning per non-null payment ID. Historical sponsor payments and earnings count were **zero**.
- Internal `update_band_balance_from_earnings()` trigger-function direct EXECUTE grants revoked for `PUBLIC`, `anon`, `authenticated`, `service_role`; PostgreSQL trigger invocation remains attached.
- `process_sponsorship_installment_atomic(uuid)` restored as a privileged *service-role-only* function using the source-controlled guarded finance implementation. No cron activated or installment settled. Direct anonymous/authenticated grants absent; invalid role and null-input guards tested without payment.
- `generate_botb_events(integer)`, `resolve_botb_event(uuid)`, `run_botb_cycle()` direct invocation revoked for `PUBLIC`, `anon`, `authenticated`. Explicit `service_role` grants retained. The existing `run-battle-of-the-bands` cron remains active at `7 * * * *`, runs as function-owner `postgres`, and calls `public.run_botb_cycle()`.
- No API-facing user payouts, cash, XP, cron activation or modification was executed by these three migrations. The 31 primary gameplay band treasuries remained aligned with the displayed whole-unit balances; the two payment settlement crons stayed inactive.

## Safety blockers **not** resolved

1. **Do not claim earnings accounting is repaired.** The production `update_band_balance_from_earnings()` function still uses `SUM(band_earnings.amount)`, which can erase real recording/rehearsal expenses after new revenue. Full-sum-to-delta change in `20261015_incremental_band_earnings_trigger.sql` must be coordinated with `resolve_botb_event` to avoid double $5,000 prizes.
2. **Do not enable sponsorship payment cron** until the production-like restoration, payout idempotency and end-to-end dry-run gates are met. The service-role-only RPC exists; this is **not** proof the settlement worker and ledger system are release-ready.
3. **Do not enable weekly payroll.** The DB replacement function `process_weekly_band_payroll()` remains absent and four of 16 primary finance accounts differ from the bands' gameplay treasuries. Reconcile account authority, prior payroll, and backfill evidence before cutover.
4. **Complete PITR backup verification and isolated restore rehearsal** before financial trigger rewrites, data migrations or historical reconciliation.
5. Run clean replay tests across historical collision groups and full CI before considering issue #4072 completed.

These migrations are schema/ACL protections only. This document does **not** certify production browser tests, staging financial concurrency tests or fully green CI.

# Finance A2 — Refund, obligation and mortgage repair

**Status:** COMPLETE  
**Implemented:** 2026-08-24

## Scope closed

This slice completes backlog PR A2 on top of the A1 atomic rehearsal/recording booking authority.

### Booking/payment/refund atomicity

- Added `booking_refunds` as the durable one-refund-per-booking-payment audit record.
- Added source-aware reversal through `_refund_atomic_booking_payment(...)`.
- Band-funded bookings return funds to the authoritative band treasury and write a treasury credit transaction.
- Personal-funded bookings return funds to the original booking profile wallet.
- Added authenticated narrow cancellation RPCs for rehearsals and recording sessions.
- Cancellation, refund and scheduled-activity cancellation happen in one database transaction.
- Refund idempotency is serialised with an advisory transaction lock and unique refund/idempotency constraints.

### Obligation replay and collection repair

- Added deterministic unique attempt numbering per obligation schedule.
- Added `process_financial_obligation_payment_guarded(...)` to serialise the idempotency key before the existing internal accounting processor can mutate state.
- Replaying the same request now returns the existing attempt instead of incrementing attempts or re-running missed-payment/debt logic.
- Automatic processing now respects the exact `next_retry_at` timestamp and `max_attempts`.
- Automatic collection stops retrying exhausted schedules; explicit player retry remains available as a recovery action.
- Outstanding obligation balances and missed counts are reconciled from schedule/debt state rather than incremented on retries.

### Mortgage schedule-version repair

- Added `sync_mortgage_financial_obligation_schedule(...)`.
- Current mortgage schedule version is projected into the universal obligation schedule with `source_schedule_version`, durable source IDs and business/idempotency keys.
- Superseded unpaid obligation rows are cancelled when a new mortgage schedule version replaces them.
- A trigger resynchronises the universal obligation schedule whenever mortgage schedule lines are inserted, updated or deleted.
- Existing mortgage obligations are backfilled through the synchroniser during migration.

## Verification coverage

`supabase/tests/finance_a2_replay_refund_mortgage_harness.sql` verifies:

- refund table/RLS presence;
- narrow cancellation RPCs and internal refund revocation;
- guarded obligation processor and replay lock;
- retry/max-attempt enforcement contract;
- mortgage schedule synchroniser and trigger;
- schedule-version tracking;
- schedule/debt-derived reconciliation.

Full clean reset, DB lint, behavioural SQL execution and browser E2E remain part of backlog A4, the dedicated finance executable-verification gate.

## Files

- `supabase/migrations/20260824104500_finance_a2_refunds_obligation_mortgage_repair.sql`
- `supabase/tests/finance_a2_replay_refund_mortgage_harness.sql`

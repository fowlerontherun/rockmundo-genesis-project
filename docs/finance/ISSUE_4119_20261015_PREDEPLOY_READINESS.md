# #4119 — earnings-trigger live preflight and dependent writer cutover (15 Oct 2026)

Related: [#4119](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4119), [#4082](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4082), existing [PR #4124](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4124).

**Status: preflight and code hardening only. NOT a deployment approval.** All Supabase queries in this pass were read-only. Do not mark historical earnings or cash as corrected.

## Verified production schema (read-only, 2026-10-15)

- Supabase project `yztogmdixmchsmimtent`, PostgreSQL 17.6.
- 31 bands; no missing/duplicate primary band treasury, no mismatch between primary treasury whole-major-unit balances and `bands.band_balance`, and no negative or over-reserved primary treasury among those bands.
- Two pay-enabled bands; third-ledger payroll reconciliation remains a separate blocking concern.
- Legacy `public.update_band_balance_from_earnings()` MD5 of `pg_get_functiondef`: `147db03f61ae14b7a6c9ef56f9cf7b8b`. It **still uses `SUM(amount)`** rather than incremental deltas.
- Legacy `public.resolve_botb_event(uuid)` MD5: `9e0db33e4f4efc1b88450c967ca34200`. It directly increments `bands.band_balance` by 5,000 **and** inserts a corresponding `band_earnings` row.
- `sync_band_treasury_from_band_balance()` MD5: `02ffd4ca8b033a3c4ef8c24e851905d1`. The live compatibility trigger is already delta-aware if old balance matches treasury.
- `update_band_balance_from_earnings()` still carries direct `EXECUTE` privileges for `anon` and `authenticated`; the prepared repair revokes these.
- Live `band_earnings` INSERT, UPDATE and DELETE triggers are installed and point to the legacy function.

A scoped production search of SQL functions containing both `band_balance` and `band_earnings` found `resolve_botb_event` as the only additional function with both a direct `SET band_balance=` and an earnings insert. This does **not** prove every client or Edge workflow has been audited.

## Newly hardened co-writers in this branch

1. `src/pages/admin/FameFansGifting.tsx`: never separately increments band cash before posting an earnings grant; a money-only gift does not send an empty `bands` update; surfaces insert failure.
2. `supabase/functions/complete-major-event/index.ts`: maintains non-cash band progression but credits cash through one earnings insert; carries a performance ID in metadata for future reconciliation and propagates errors.
3. `src/components/releases/CancelReleaseDialog.tsx`: removes the second direct refund to `bands.band_balance`; checks earnings insert errors; tags the earnings row with the release ID for auditing.

Contract tests: `src/lib/api/__tests__/bandEarningsCoWriters.contract.test.ts`. They are source guards, **not** transactional database tests.

## Unresolved blockers — do not apply the manual SQL yet

- **Staging/backups:** Supabase has no development branches listed. Recoverable point-in-time backup and a verified restoration rehearsal were not established during this pass. Do not assume a fresh dev branch contains production data or schemas.
- **Release cancellation idempotency:** the existing browser flow has separate refund and status requests. It can still refund more than once on retries or concurrent cancellations. Replace this with a transactional, ownership-checked, exactly-once server authority before automatic retries or claiming acceptance.
- **Major event settlement idempotency:** performance completion, band-stat updates and earnings insertion remain separate database requests. Require atomic or safely resumable settlement before allowing replay of partially failed jobs.
- **Economic model:** other client and Edge paths still directly mutate `bands.band_balance` without necessarily recording `band_earnings`; e.g. DikCok and festival routes. They need a reconciliation and single-authority plan. Do not forcibly set game balance equal to historical earnings sums.
- **Payroll:** the separate `financial_accounts` liquidity model remains unreconciled and the scheduled payroll migration must stay disabled.

## Required ordered release

1. Confirm PITR and restore rehearsal; produce a sanitized production-shaped staging database. Confirm trigger/function definition hashes and grants still match this note; diff all current co-writers and scheduled jobs.
2. Validate the prepared `supabase/production-repairs/20261015_incremental_band_earnings_trigger.sql` in staging, including races, reserved funds, earnings INSERT/UPDATE/DELETE/band reassignment, cascades and one BOTB credit.
3. Deploy and test the frontend and Edge cash co-writer fixes **before** changing the trigger; make sure the deployed major-event worker version is new enough.
4. Pause/coordinate conflicting scheduled earners for the agreed change window, rerun exact read-only preflight, then apply the reviewed single-transaction SQL under DBA control.
5. Verify legacy trigger function is gone, public execution revoked, one-dollar earning causes exactly one-dollar cash/treasury delta, booked expenses are preserved, and source-specific BOTB payout is not doubled.
6. Reconcile historical possible reversals separately from the prospective fix. Do not create money or compensate old ledger entries automatically. Leave payroll disabled until the third-ledger authority is resolved.

**No production schema/data writes, payroll calls, cash adjustments or scheduled job mutations were performed in this pass.**

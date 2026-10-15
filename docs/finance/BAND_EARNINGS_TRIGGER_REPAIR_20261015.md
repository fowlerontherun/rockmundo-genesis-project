# Incremental band earnings trigger repair — 15 October 2026

Tracks #4119, #4082 and #4072. **Prepared code only; no production database
writes or payout/cron changes in this PR.**

## Why

Production has two gameplay money pathways:
- `bands.band_balance` (whole game-currency units) is synchronised to the
  primary `band_treasuries.balance_minor` via the AFTER UPDATE trigger
  `sync_band_treasury_from_band_balance()`. Booking/rehearsal expenses post
  entries in `band_treasury_transactions` without necessarily adding a row
  to `band_earnings`.
- `band_earnings` is a partial history of revenue, transfers and expenses.
  Its live AFTER INSERT/UPDATE/DELETE trigger, named
  `update_band_balance_from_earnings()`, **replaces the band balance with
  `SUM(band_earnings.amount)`** for every new row.

On 14 October, WAR DOGS. had a valid $28,000 difference from its earnings
subtotal: $27,400 studio booking and $400 + $200 rehearsal bookings. An
ordinary daily merchandise earnings row at 06:00 UTC on 15 October added
$3,646 but set the balance to **2,245,857** (the sum of all earnings) rather
than the cash-preserving **2,217,857**. The resulting $28,000 increase is
consistent with the trigger resetting those previously paid bookings.
**Do not restore this difference by adding money or deleting ledger rows.**
The incident requires historical reconciliation with the underlying
`band_treasury_transactions` records.

## Prepared forward-only repair

File: `supabase/production-repairs/20261015_incremental_band_earnings_trigger.sql`

The script is intentionally **outside** `supabase/migrations/` to avoid the
existing duplicate/future timestamp collisions and accidental automatic
deployment. Under one PostgreSQL transaction it:

1. Checks the existing legacy SUM-based trigger implementation and that all
   current band balances and primary gameplay treasury balances agree.
2. Replaces **only** the function body behind the existing INSERT, UPDATE,
   DELETE triggers; trigger names and attachment points are preserved.
3. Uses `NEW.amount` for INSERT, `-OLD.amount` for DELETE, and the net
   old/new differences for UPDATE. If band ownership changes, locks affected
   bands in UUID order and debits/credits exactly their respective deltas.
   Unchanged amount/band updates are inert.
4. Locks the gameplay band and treasury, fails if already divergent, verifies
   the resulting whole-unit amount is nonnegative, fits the integer column,
   and does not consume reserved treasury funds. The existing balance-to-
   treasury trigger applies the incremental change. The repair checks the
   resulting treasury value and reservation to fail closed.
5. Revokes direct `EXECUTE` of the privileged trigger function from
   `PUBLIC`, `anon`, `authenticated`, and `service_role`.
6. Replaces `resolve_botb_event(uuid)` in the same transaction: that existing
   function directly gave the winner +5,000 to `bands.band_balance` **and**
   recorded +5,000 in `band_earnings`. It now grants cash only via the
   earnings entry, preserving the event's fame/fans, placement and event
   bookkeeping without a second credit.

This is not a new historical `band_earnings` backfill and does not alter
existing gameplay balances, treasury balances, finance accounts, or history
when deployed. It deliberately does **not** enable weekly payroll: the
`financial_accounts` model still diverges from the game's cash treasury.

## Mandatory staging tests

Use a restored, suitably sanitized database with a temporary test band and
valid existing treasury; never run the test suite against real production bands.

- Seed $100 cash, make a genuine $30 recording booking in
  `band_treasury_transactions` through the live booking RPC; verify $70
  remains. Insert $10 earnings; balance must now be $80, not $110.
- Insert positive and negative earnings and confirm exactly one appropriate
  balance delta each. Check the sub-dollar remainder and reserved-money
  rules. Insufficient cash must fail the whole earnings write rather than
  clamp cash or let the treasury go negative.
- Update an earnings description only (no money effect); change +15 to +12
  (net -3); reassign earnings to a second band (debit original / credit new);
  DELETE an earnings row (reverse that row's effect). Failures must roll back.
- Test simultaneous earnings inserts and a concurrent rehearsal booking for
  the same band. Ensure no lost updates and that transaction retries handle
  any conflicting row-lock order with treasury-first booking RPCs.
- Execute `resolve_botb_event` on a disposable event fixture and prove
  the winner receives exactly one $5,000 credit, not $10,000, alongside
  appropriate fame/fans. Test repeated calls according to event idempotency.
- Audit all other production functions and Edge paths that may credit
  `bands.band_balance` before writing `band_earnings`. Confirm no other
  co-writer needs an equivalent paired fix. Validate cascade deletes and
  regular service-role daily streaming/merchandise jobs.
- Check the treasury and earnings deltas **after** each action. No direct
  testing in the live project.

## Production release prerequisites

1. Verify actual recoverable PITR/backup and restore rehearsal. Record
   exact SQL and function-definition hashes and rollback copies privately.
2. Check live trigger body/grants, one primary treasury per band and
   `bands.band_balance = trunc(band_treasuries.balance_minor/100)` across
   all bands. Repeat the audit immediately before deployment.
3. Deploy the fully reviewed, staging-certified repair **as a single
   transaction**, with a maintenance window for jobs touching those tables.
   Coordinate RPC/Edge writers with staging findings; the BOTB change and
   trigger body must never be installed separately.
4. Confirm existing historical rows and band balances were **not** changed
   at installation; test only a controlled future transaction, with a
   supported rollback plan. Re-run permission/security advisors and
   monitor error logs and treasury-vs-band reconciliation.
5. Investigate any historical reversals (especially WAR DOGS.'s 15 Oct
   merchandise job) separately. Do not silently book compensating credits,
   or attempt to make `financial_accounts` match `band_treasuries`.
6. After reliable gameplay earnings/expenses are in one authority, handle
   payroll architecture, historical wages, duplicated migration versions,
   and cron secrets in independent reviews.

## Read-only verification query

```sql
SELECT b.id,b.name,b.band_balance,t.balance_minor,
  COALESCE(e.earnings_total,0) AS earnings_total,
  b.band_balance - COALESCE(e.earnings_total,0) AS bookings_vs_earnings
FROM public.bands b
JOIN public.band_treasuries t ON t.band_id=b.id AND t.is_primary
LEFT JOIN (
 SELECT band_id,SUM(amount)::bigint earnings_total
 FROM public.band_earnings GROUP BY band_id
) e ON e.band_id=b.id
ORDER BY b.name;
```

## Rollback

Do not revert the SQL in a live game by blindly restoring the SUM trigger:
that would immediately reintroduce recording/rehearsal payment reversals.
If staged tests expose a conflict, do not deploy. After deployment, halt
affected producers, capture ledger/account state, and use a reviewed,
retested compatibility trigger or another coordinated forward repair.

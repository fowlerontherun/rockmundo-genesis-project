# Gameplay payroll receipts for #4119

The 11 November read-only production check found the 17 October incremental
earnings trigger attached to INSERT, UPDATE and DELETE. The current payroll
function already pays from the gameplay treasury, and primary gameplay
treasuries agreed with the corresponding displayed band balances. The
earlier payroll design using a band-owned `financial_accounts` balance is
superseded. The existing wallet cash trigger journals member credits
through the finance clearing account.

The reviewed repair preserves the gameplay treasury as the payer. For each
band and week it takes one recipient snapshot, computes the split using
unreserved cash, and verifies the exact gameplay debit before recording the
treasury receipt. It identifies wallet journal credits by band, UTC week,
and recipient and verifies each credit in the same per-band transaction.
If a debit or credit cannot be verified, PostgreSQL rolls back that band's
settlement and all its writes. A treasury receipt describes the same debit
as the earnings row and must be counted only once in cross-ledger reports.

## Historical differences

Read-only evidence on 11 November, in whole game dollars.

| Band | Gameplay cash | Earnings subtotal | Recorded treasury-only movements | Residual |
| --- | ---: | ---: | --- | ---: |
| Betonherz | 400 | 0 | Wallet credit 400 | 0 |
| ECHO | 300 | 0 | Wallet credit 300 | 0 |
| Elysian | 3,000 | 0 | Wallet credit 3,000 | 0 |
| JPW | 8,572 | 20,322 | Wallet credits 558, booking debits 13,600 | 1,292 |

JPW's residual remains unattributed. An opening balance or prior adjustment
would require dated evidence before it could be assigned to either source.
The repair uses the locked gameplay balance and leaves historical settlements
and balances as recorded.

## Verification and deployment

The local PostgreSQL fixture used the repository's incremental earnings
function and simulated the treasury projection and wallet journal triggers.
It exercised earnings after a booking, duplicate membership, reserved cash,
sub-dollar balance preservation, rollback when the second recipient's
journal credit was missing, and a same-week replay. Before production rollout,
use a restored staging copy to exercise the actual wallet and treasury
triggers and run two simultaneous payroll calls for the same fixture week.

Apply the manual script
`supabase/production-repairs/20261111_weekly_payroll_gameplay_receipts_4119.sql`
as the database owner after staging. It checks the existing gameplay
function body and changes the implementation in place, preserving its
existing grants. The script targets the original deployed function, so if
the #4082 wrapper has already been installed, review and adapt the repair
to target its core before running it. The currently scheduled job was
active at audit time. The repair leaves job configuration and past wages
as recorded.

After the next scheduled settlement, compare the sum of the member wallet
receipts with the gameplay debit and settlement, in minor units. The
following query should return zero rows for settlements with treasury
receipts. Compare the receipt count with that week's eligible settlements
as a separate coverage check.

```sql
SELECT s.band_id, s.week_start
FROM public.band_weekly_payroll_settlements s
JOIN public.band_treasury_transactions d
  ON d.idempotency_key = 'weekly-band-payroll:' || s.band_id || ':'
    || to_char(s.week_start, 'YYYY-MM-DD')
LEFT JOIN public.financial_transactions f
  ON f.metadata->>'idempotency_key' = d.idempotency_key
  AND f.status = 'completed'
WHERE s.week_start = date_trunc('week', now() AT TIME ZONE 'UTC')::date
GROUP BY s.band_id, s.week_start, s.amount_total, s.member_count, d.amount_minor
HAVING count(f.id) <> s.member_count
   OR COALESCE(sum(f.net_amount_minor), 0) <> d.amount_minor
   OR d.amount_minor <> s.amount_total::bigint * 100;
```

# Ledger-backed payroll treasury reconciliation — 14 October 2026

Related: [migration plan #4072](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072), [payroll security #4082](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4082), PRs #4084 and #4085.

**State: review-only SQL authored, no production writes carried out.**

## What was discovered

The existing weekly payroll migration chooses `financial_accounts` with
`metadata.account_role = 'band_treasury'`. There were no rows with that
metadata tag in production. Further auditing demonstrated that each pay-enabled
band **already** has one active primary USD `Band operating account`,
and that every posted ledger entry matches its current balance.

| Band | Existing operating account | Balance, USD | Complete ledger entries | Eligible non-touring player characters | Legacy `bands.band_balance` |
| --- | --- | ---: | ---: | ---: | ---: |
| Shockmaster | d3593fad-df6b-4613-8daf-c51ba35c6dfe | 1,284,462.00 | 10 | 1 | 4,295,646 |
| WAR DOGS. | 9e0e483c-66a7-495f-a027-2fb7aff3abf4 | 48,074.00 | 10 | 3 | 2,214,211 |

The canonical account ledger origins are: Shockmaster 1 opening starting-funds
credit, 5 merchandise revenue credits and 4 merchandise cost debits; WAR DOGS.
1 starting-funds credit and 9 merchandise cost debits. All 20 account ledger
entries reference completed finance transactions. Both accounts have zero
reserved balance and compatible active player wallets for all eligible members.

**Important:** Ledger mathematical balance is verified, but this does not mean
every historical game revenue/expense was migrated into the canonical finance
system. Both legacy band balances disagree substantially with canonical finance
balances. Do not assume they should be made equal. Do not pay from the legacy
scalar or create a second treasury with copied balances.

## Proposed repair

`supabase/production-repairs/20261014_reconcile_existing_band_payroll_treasuries.sql`
is a deliberately *targeted* transaction which:

- Requires exactly the two pre-audited band/account UUID associations.
- Takes locks and checks living production band account status, single
  account per target band, primary USD operating designation, zero reserved
  balance and valid journal reconciliation.
- Rejects incomplete/missing transaction references or an existing conflicting
  role.
- Sets **only** `metadata.account_role='band_treasury'` on the two existing
  accounts. No account, transaction, ledger, cash, band balance or wage
  amount is inserted or updated. Re-running after the role is present is inert.
- If either band fails validation, the entire statement rolls back.

This script is **not** a normal sequential migration and is not run by
`supabase db push`. Record its exact SQL content hash and production execution
identity as part of an approved manual release. It does not automatically
start payroll. Run in a restored staging database first.

## Before approving payroll

1. Verify restorable backup/PITR and stage a sanitized copy with these two
   bands, their four eligible current characters, accounts, ledger and
   historical `band_pay` activity. Never run a payout dry-run against live
   wallets.
2. Confirm all existing account balances and transaction statuses again.
   If any have changed, read the migration preflight and reassess.
3. Review the differences between `bands.band_balance` (legacy earnings
   projection) and the canonical finance ledger. Establish which historical
   revenue types were never journaled and whether payroll economics need a
   design decision. The opening `starting_funds` records are canonical
   journal entries but may represent a historical balance backfill.
4. Confirm that historical payroll has been settled: there are 25
   `activity_feed.activity_type='band_pay'` rows, last seen on
   2026-10-10 10:00:07 UTC, but no wage transactions with the proposed
   `weekly-band-pay:` idempotency prefix. Separate the old system's
   actual cash changes from mere feed records before enabling a new payer.
5. Validate [PR #4085](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4085)'s payroll function against the full live schema:
   currency, enum, unique key, service-only execution, member eligibility,
   ledger-entry symmetry, account balance checks, failing member rollback,
   and two concurrent schedulers. Check interactions with the existing
   `band_earnings` -> `bands.band_balance` recomputation trigger.
6. Resolve duplicate migration timestamp `20300106200000` with personal
   gig booking, plus any migration history drift. Use a unique audited
   deployment identity rather than blindly applying both files.
7. Only after an approved staging report, apply this metadata-only repair
   followed by the separate, reviewed SQL payroll function/cron cutover.
   Confirm the Saturday schedule runs exactly once; do **not** issue missed
   payroll automatically. Do not restore the retired HTTP endpoint.
8. Reconcile the first scheduled run against the member-level finance ledger
   and `band_weekly_payroll_settlements` without copying any JWT/secret from
   `cron.job.command`.

## Read-only revalidation query

```sql
WITH target AS (
  SELECT b.name, a.id AS account_id,
    a.current_balance_minor, a.available_balance_minor, a.reserved_balance_minor,
    a.metadata->>'account_role' AS account_role
  FROM public.bands b
  JOIN public.financial_accounts a ON a.owner_type='band'
   AND a.owner_id=b.id
  WHERE b.status='active' AND b.weekly_pay_percent>0
)
SELECT t.name, t.account_id, t.current_balance_minor,
  t.available_balance_minor, t.reserved_balance_minor, t.account_role,
  count(le.id) AS journal_entries,
  coalesce(sum(CASE le.entry_direction::text
    WHEN 'credit' THEN le.amount_minor
    WHEN 'debit' THEN -le.amount_minor ELSE 0 END),0) AS net_minor,
  count(*) FILTER(WHERE le.id IS NOT NULL AND
    (tx.id IS NULL OR tx.status::text<>'completed')) AS incomplete_entries
FROM target t
LEFT JOIN public.financial_ledger_entries le ON le.account_id=t.account_id
LEFT JOIN public.financial_transactions tx ON tx.id=le.transaction_id
GROUP BY t.name,t.account_id,t.current_balance_minor,t.available_balance_minor,
 t.reserved_balance_minor,t.account_role;
```

### Do not roll back by deleting finance rows

If the approved metadata repair is later judged incorrect, halt the new
scheduler, reconcile any intervening payments, then remove the
`band_treasury` role only with another reviewed, guarded metadata update.
Deleting finance journal history or resetting player wallets is prohibited.

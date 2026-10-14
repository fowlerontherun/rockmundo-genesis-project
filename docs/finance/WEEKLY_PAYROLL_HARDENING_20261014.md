# Weekly Band Payroll Hardening — 14 October 2026

Addresses #4022, #4023, #4024, #4025, #4026 and #4027.

## Security incident boundary

The historical cron job `process-weekly-band-pay` calls an HTTP edge function using a project **anon** bearer token. That handler uses `SUPABASE_SERVICE_ROLE_KEY` without checking the caller or enforcing weekly idempotency. A request could trigger payouts repeatedly and cause multiple independent balance writes.

This change:
- Retires the HTTP edge handler (all non-OPTIONS requests get **410**, no service role or DB calls).
- Requires JWT verification for that retired endpoint as another layer of defence.
- Replaces the HTTP pg_cron job with `SELECT public.process_weekly_band_payroll()` every Saturday at **10:00 UTC**. PostgreSQL owns the schedule, not an HTTP client.
- Revokes RPC access from `PUBLIC`, `anon`, `authenticated` and `service_role`. The internal cron function additionally rejects requests with an authenticated user identity.
- Enforces one settled payout per **band/week** with a primary key and ledger idempotency keys.
- Uses only active band's authoritative `financial_accounts` treasury balance and active member player wallet accounts.
- Locks bands, then all participating financial accounts in deterministic order, posting paired journal entries and moving amounts with relative updates.
- Uses a per-band PL/pgSQL exception subtransaction to roll back *all* member payments, logs, settlements and treasury debits if **any** step fails.
- Deliberately **does not** distribute payroll for bands on hiatus.
- Rounds individual pay **down to whole major units** to preserve `band_earnings.amount` and `activity_feed.earnings` integer compatibility; any remainder stays in the treasury.

## Verified live prerequisites and blockers (read-only inspection)

On 14 October 2026, production had an active Saturday **HTTP** cron job and two active bands with `weekly_pay_percent > 0`. **Neither band had a matching active canonical ledger treasury** with `metadata.account_role='band_treasury'`.

The replacement therefore **fails closed** for those bands until treasury reconciliation completes. It **must not** mint funds from `bands.band_balance` without tracing existing finance transactions or treasury migrations.

The production schema also did not expose the `financial_accounts.currency_code` field or `public._move_financial_account_money` helper from newer repository migrations. The replacement uses existing common fields and inserts paired entries directly against the Phase 1 ledger, but all affected migrations must be tested against actual staging schema before deployment.

## Additional fail-closed migration preflight (issue #4082)

A read-only production recount found **two** active pay-enabled bands and
**zero** active canonical `band_treasury` financial accounts; both bands lack
the required treasury. The latest historical `band_pay` activity is dated
10 October 2026, with 25 activity records. No payments with the replacement
function's `weekly-band-pay:` idempotency-key format exist yet.

The migration now raises `Payroll cutover blocked` **before** creating
the settlement table/function or unscheduling the existing cron job whenever
any active pay-enabled band lacks a canonical active treasury. This is a
release guard, **not** a treasury repair. Never backfill canonical treasuries
from the legacy `bands.band_balance` scalar without proving the underlying
funds in the finance ledger. Keep the retired HTTP endpoint unable to pay.

The timestamp prefix `20300106200000` is shared with the personal-funded
gig booking migration. Reconcile the duplicate identity before running normal
migration tooling; a future-dated filename is not permission to bypass this
preflight.

## Required staging and deployment checks

1. First review deployed migration versions; reconcile the canonical treasury setup for both currently pay-enabled bands and prove opening balances are backed by existing ledger funds.
2. In staging, test anonymous/regular authenticated/service-role calls to the retired HTTP endpoint: **410** or JWT rejection; neither must credit money.
3. Run a full Saturdays-at-10:00 simulation on a disposable database with two active members, a dormant character, a touring member, a paused band and an on-hiatus band.
4. Verify one successful run creates one `band_weekly_payroll_settlements` row per eligible band/week, `N` completed wage transactions, **2N** immutable ledger entries, one band expense and `N` player activity rows.
5. Verify a second call in the same week does nothing. Verify that an invalid wallet, mismatched currency, insufficient balance or forced activity-feed insert failure leaves **zero committed settlement, debit or wage entries** for that band.
6. Run concurrent payroll calls and an unrelated treasury transfer. Compare `financial_accounts`, `profiles.cash`, `bands.band_balance` and ledger deltas; they must reconcile.
7. Deploy the edge retirement and the SQL cron migration as one coordinated release. Confirm the old HTTP job was **removed**, the internal SQL job exists and the cron role can execute the internal function.
8. After the first scheduled payroll, audit `band_weekly_payroll_settlements`, finance transactions, and worker warnings. Never manually execute this function in production to test it.

Read-only cron audit:

```sql
SELECT jobname, schedule, active,
       CASE
         WHEN command LIKE '%functions/v1/process-weekly-band-pay%' THEN 'INSECURE_HTTP'
         WHEN command LIKE '%process_weekly_band_payroll()%' THEN 'INTERNAL_DB'
         ELSE 'UNKNOWN'
       END AS route
FROM cron.job
WHERE jobname = 'process-weekly-band-pay';
```

Read-only payout history:

```sql
SELECT band_id, week_start, member_count, amount_minor, currency_code, paid_at
FROM public.band_weekly_payroll_settlements
ORDER BY week_start DESC, band_id
LIMIT 100;
```

**This PR alone does not deploy the migration or repair the two missing production treasuries.** Do not claim that production payroll is live or validated until those checks pass.

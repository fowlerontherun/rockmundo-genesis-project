# Production migration reconciliation — batch 1 (14 October 2026)

Tracker: [#4072](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072)

## Scope

This PR corrects two **currently unapplied** migration files and their code/tests. It
is **not a production migration application**, historical payout, or cron migration.

- `20261013113000_atomic_daily_stipend.sql`: fix live grant column contract and
  make the database compute the full stipend. The Edge handler sends only a
  profile ID. Never accept SXP, AP, VIP, streak or reward metadata from callers.
- `20261012213100_atomic_sponsorship_installments.sql`: use the existing
  `band_earnings` balance-recomputation trigger as the sole accounting writer;
  guard against already-present earnings, mismatched band IDs, invalid amounts
  and not-yet-due payments.

**Historical repair rule:** Do not replay the original gig consequences DELETE
migration, the stale direct-message fallback, or any other production-replaced
SQL. Read `supabase/production-repairs/README-20261014.md` first.

## Read-only baseline checked 14 October 2026

Production project `yztogmdixmchsmimtent`:

- Both new function signatures were absent in `pg_proc` when audited.
- `profile_daily_xp_grants` has `xp_amount`, `source`,
  `attribute_points_amount`, `metadata`; it has **no** `xp_awarded` column.
- Stipend source: 494 rows and **zero duplicate (profile_id, grant_date) pairs**.
- Activity bonus source: 541 rows. Activity bonuses can share dates with
  stipend grants. Any uniqueness constraint must target `source='daily_stipend'`
  only, not all rows.
- `player_xp_wallet` has the required SXP/AP, earned-point and streak columns.
- `vip_subscriptions` has `user_id`, `status`, `starts_at`, `expires_at`.
- `band_earnings` has INSERT/UPDATE/DELETE balance recomputation triggers.
- `sponsorship_payments` had zero rows at audit time; do not assume that remains
  true on deployment day.
- Active sponsorship and weekly payroll cron jobs contain literal JWT-shaped
  bearer strings in `cron.job.command`. **Never print, copy or paste job
  commands into issues, PRs or CI logs.** Move cron authentication to protected
  runtime secret retrieval in a separate coordinated cutover.

## Deployment prerequisites

1. Verify an actual recoverable backup/PITR and rehearse restore. This is **not
   verified** by this PR.
2. Stage against a sanitized copy of the live schema; Supabase development
   branches do not automatically contain live player data.
3. Run current schema/advisor scans; validate SECURITY DEFINER and GRANTs,
   reward authority, source-scoped daily uniqueness, and canonical earnings
   trigger. Ensure current production migrations/history still match.
4. Confirm any updated Edge Function is deployed in the same release as the
   corresponding RPC, or explicitly sequence a backward-compatible cutover.
   The stipend RPC changes its parameter signature; deploy it **before** the
   Edge handler starts calling the new signature.
5. Only apply the corrected, uniquely recorded migrations after their exact
   dependency checks and staging integration suite have passed. Do not bulk
   `db push` while 19 duplicate timestamp groups remain unresolved.

## Read-only production preflight (do not output credentials)

```sql
select to_regprocedure('public.claim_daily_stipend_atomic(uuid)') as stipend_rpc,
       to_regprocedure('public.process_sponsorship_installment_atomic(uuid)') as sponsorship_rpc;

select profile_id, grant_date, count(*) as n
from public.profile_daily_xp_grants
where source = 'daily_stipend'
group by profile_id, grant_date
having count(*) > 1;

select tgname from pg_trigger
where tgrelid='public.band_earnings'::regclass and not tgisinternal;

select jobname,active,
       command ~* 'Bearer[[:space:]]+eyJ' as embeds_jwt,
       command ~* 'decrypted_secret|vault' as resolves_runtime_secret
from cron.job
where jobname in ('process-sponsorship-payments-cron','process-weekly-band-pay');
```

## Required staging tests

- Stipend: active living character owner succeeds; anonymous, wrong-character,
  deceased and inactive callers fail. Same-day sequential and concurrent claims
  credit once. Stipend and activity bonus can coexist on the same UTC date.
- Stipend: verify server-calculated VIP + milestone bonuses against the
  established caps (2000 SXP, 30 AP); verify `xp_amount`,
  `attribute_points_amount`, `attribute_points_earned`, SXP wallet, streak,
  day cutoff, and rollback when the insert or wallet update fails.
- Sponsorship: two workers racing for the same installment settle once;
  a payment with an existing earnings-ledger entry fails closed instead of
  paying twice. Check contract/band mismatch, future dates, cancelled contracts,
  invalid amounts and rollback of all updates if insertion fails.
- Confirm the live trigger writes exactly one canonical band balance projection.
  Check contract `weeks_paid` and `total_paid` match reconciled installment
  data. No automatic backfill in this PR.
- Check app/API error handling and PostgREST schema-cache refresh after
  deployment. Run all existing progression and sponsorship regressions.

## Rollout and rollback gate

Do not enable cron payouts or historical processing as part of this PR.
Before execution, record the exact migration name/checksum and deployment
sequence, and run a dry-run in staging. Keep the old app deployment available
until the new RPC signature is live and verified.

On any mismatch, stop the release and revert the application traffic first.
Restore the function definition from a reviewed rollback or point-in-time
backup only after checking current grant/ledger writes. Never delete live
stipend grants, sponsorship earnings or historical gig attempts as a shortcut.

## Follow-up work (outside this PR)

- Rotate/remove JWTs from sponsorship and payroll cron jobs with a tested
  Vault-backed authentication path; do not disable active scheduled jobs
  without a coordinated maintenance/cutover window.
- Introduce production-compatible XP and gear foundations; reconcile future
  migration filenames and collision groups; verify isolated restoration.
- Restore lottery/business/subsidiary RPCs after their economics and authority
  checks. See issue #4072.

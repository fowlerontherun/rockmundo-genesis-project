-- READ ONLY. Never select cron.job.command, Vault decrypted secrets, or JWT values.
-- Finance cron cutover evidence for #4082 and migration reconciliation #4072.
-- Execute with a trusted database operator in production or isolated staging.

select
  jobname,
  schedule,
  active,
  case
    when command like '%process_weekly_band_payroll%' and command not like '%net.http_post%' then 'INTERNAL_PAYROLL'
    when command like '%x-cron-secret%' and command like '%vault.decrypted_secrets%' then 'VAULT_AUTHENTICATED_HTTP'
    when command like '%net.http_post%' then 'LEGACY_HTTP_REVIEW_REQUIRED'
    else 'UNKNOWN_REVIEW_REQUIRED'
  end as route,
  position('Bearer ' in command) > 0 as embeds_bearer_prefix,
  position('Authorization' in command) > 0 as embeds_authorization_header,
  position('x-cron-secret' in command) > 0 as uses_cron_secret_header,
  position('vault.decrypted_secrets' in command) > 0 as reads_vault_at_execution
from cron.job
where jobname in ('process-sponsorship-payments-cron', 'process-weekly-band-pay')
order by jobname;

select
  to_regprocedure('public.verify_internal_cron_secret(text)') is not null as cron_verifier_exists,
  to_regprocedure('public.process_sponsorship_installment_atomic(uuid)') is not null as sponsorship_atomic_rpc_exists,
  to_regprocedure('public.process_weekly_band_payroll()') is not null as weekly_payroll_rpc_exists,
  to_regclass('public.band_weekly_payroll_settlements') is not null as weekly_payroll_settlements_exists,
  exists (select 1 from vault.secrets where name = 'internal_cron_secret') as named_vault_secret_exists;

select
  p.proname as function_name,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anonymous_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as player_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'verify_internal_cron_secret',
    'process_sponsorship_installment_atomic',
    'process_weekly_band_payroll'
  )
order by p.proname;

-- Ledger inspection must be performed using approved settlement history,
-- not by manually invoking a live payment function.

-- November 2026: verified gameplay payroll (NOT the retired financial_accounts
-- proposal) — reconcile actual settlements, expense rows, and credited events.
-- This returns weekly aggregates only. Never call the payout function here.
WITH settlements AS (
  SELECT week_start, count(*) AS settled_bands,
         sum(member_count)::bigint AS expected_member_credits,
         sum(amount_total)::bigint AS settled_major
  FROM public.band_weekly_payroll_settlements
  WHERE week_start >= (now() AT TIME ZONE 'UTC')::date - 84
  GROUP BY week_start
), credited AS (
  SELECT metadata->>'week_start' AS week_key,
         count(*) AS credited_members, sum(earnings)::bigint AS credited_major
  FROM public.activity_feed
  WHERE activity_type = 'band_pay' AND metadata ? 'week_start'
  GROUP BY metadata->>'week_start'
), expensed AS (
  SELECT metadata->>'week_start' AS week_key,
         count(*) AS expense_rows, sum(amount)::bigint AS expenses_major
  FROM public.band_earnings
  WHERE source = 'weekly_pay' AND metadata ? 'week_start'
  GROUP BY metadata->>'week_start'
)
SELECT s.week_start, s.settled_bands,
       s.expected_member_credits, COALESCE(c.credited_members,0) AS credited_members,
       s.settled_major, COALESCE(c.credited_major,0) AS credited_major,
       COALESCE(e.expense_rows,0) AS expense_rows,
       COALESCE(e.expenses_major,0) AS expenses_major,
       (s.expected_member_credits = COALESCE(c.credited_members,0)
        AND s.settled_major = COALESCE(c.credited_major,0)
        AND s.settled_major = -COALESCE(e.expenses_major,0)
        AND s.settled_bands = COALESCE(e.expense_rows,0)) AS accounting_parity
FROM settlements s
LEFT JOIN credited c ON c.week_key = s.week_start::text
LEFT JOIN expensed e ON e.week_key = s.week_start::text
ORDER BY s.week_start DESC;

-- Scheduler and gated-function ACLs; never emit cron.job.command or
-- function bodies. Service-role must not execute the payroll wrapper/core.
SELECT j.jobname, j.active, j.schedule, j.username,
       (j.command ILIKE '%process_weekly_band_payroll%'
        AND j.command NOT ILIKE '%http%') AS internal_payroll_route,
       (j.command ~* 'bearer[[:space:]]+|eyJ[A-Za-z0-9_-]{20,}') AS embeds_token_shape,
       (SELECT has_function_privilege('service_role', p.oid, 'EXECUTE')
        FROM pg_proc p WHERE p.oid =
          to_regprocedure('public.process_weekly_band_payroll()')) AS service_can_execute_payroll,
       (SELECT has_function_privilege('service_role', p.oid, 'EXECUTE')
        FROM pg_proc p WHERE p.oid =
          to_regprocedure('public.process_weekly_band_payroll_core_4082()')) AS service_can_execute_payroll_core
FROM cron.job j WHERE j.jobname = 'process-weekly-band-pay';

-- Release gate: no automatic backfill, manual invocation, or sponsorship
-- activation is authorized by a passing read-only report.

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

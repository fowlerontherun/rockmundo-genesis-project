-- MANUAL OPERATOR RUNBOOK SQL ONLY. NOT A SUPABASE MIGRATION.
-- #4082: replace stored bearer header with runtime Vault secret lookup.
-- Must run only after staging/PITR approvals, RPC compatibility and Edge auth
-- deployment are verified. Do not run from supabase db push/reset.
-- This file never reads, logs or embeds actual Vault/JWT credential values.
-- Before execution, operator must explicitly set a transaction-local
-- app.finance_cron_cutover_approved=true in an approved transaction.
--
-- Example: BEGIN; SET LOCAL app.finance_cron_cutover_approved = 'true';
--          \i supabase/production-repairs/sponsorship_cron_vault_cutover_MANUAL_ONLY.sql
--          COMMIT;
-- Do not run the example without the verified release ticket / restore gate.

do $guard$
declare
  v_job record;
  v_job_count integer;
begin
  if current_setting('app.finance_cron_cutover_approved', true) is distinct from 'true' then
    raise exception 'Finance cron cutover requires explicit approved transaction';
  end if;

  select count(*)
    into v_job_count
  from cron.job
  where jobname = 'process-sponsorship-payments-cron';
  if v_job_count <> 1 then
    raise exception 'Expected exactly one sponsorship cron job';
  end if;

  select jobid, schedule, active, command
    into v_job
  from cron.job
  where jobname = 'process-sponsorship-payments-cron';

  if v_job.schedule <> '0 0 * * *' or not v_job.active then
    raise exception 'Unexpected sponsorship job schedule or state';
  end if;
  if to_regprocedure('public.process_sponsorship_installment_atomic(uuid)') is null then
    raise exception 'Sponsorship atomic RPC missing; stop before scheduler change';
  end if;
  if not has_function_privilege(
    'service_role', 'public.process_sponsorship_installment_atomic(uuid)', 'EXECUTE'
  ) then
    raise exception 'Sponsorship atomic RPC not granted to service_role';
  end if;
  if to_regprocedure('public.verify_internal_cron_secret(text)') is null or
     not has_function_privilege(
       'service_role', 'public.verify_internal_cron_secret(text)', 'EXECUTE'
     ) then
    raise exception 'Cron verifier missing or service-role execution not granted';
  end if;
  if not exists (
    select 1 from vault.secrets where name = 'internal_cron_secret'
  ) then
    raise exception 'Named Vault secret is missing';
  end if;

  -- Never overwrite some other job or silently replace an altered destination.
  if position('functions/v1/process-sponsorship-payments' in v_job.command) = 0 then
    raise exception 'Unexpected sponsorship cron destination';
  end if;

  -- No secret value is baked into cron.job.command: it is resolved at run time.
  perform cron.alter_job(
    job_id := v_job.jobid,
    command := $cron$
      select net.http_post(
        url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-sponsorship-payments',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'internal_cron_secret'
          )
        ),
        body := '{}'::jsonb
      ) as request_id;
    $cron$
  );
end;
$guard$;

-- Verify only boolean/metadata columns from payment_cron_readiness.sql.
-- Never SELECT cron.job.command after cutover; it may contain legacy secrets
-- for other jobs. Rotate the superseded bearer credential with an impact audit.

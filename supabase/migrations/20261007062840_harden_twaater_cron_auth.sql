-- Protect internal scheduler Edge Functions with a random secret stored in Supabase Vault.
-- The cron commands read the decrypted secret server-side and send it in a private header.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'internal_cron_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'internal_cron_secret',
      'Shared secret for authenticated pg_cron to Edge Function calls'
    );
  end if;
end
$$;

create or replace function public.verify_internal_cron_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_secret is not null
    and length(p_secret) >= 32
    and exists (
      select 1
      from vault.decrypted_secrets s
      where s.name = 'internal_cron_secret'
        and s.decrypted_secret = p_secret
    );
$$;

revoke all on function public.verify_internal_cron_secret(text) from public;
revoke all on function public.verify_internal_cron_secret(text) from anon;
revoke all on function public.verify_internal_cron_secret(text) from authenticated;
grant execute on function public.verify_internal_cron_secret(text) to service_role;

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'bot-engagement-cron'),
  command := $cron$
    select net.http_post(
      url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/bot-engagement',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_cron_secret')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $cron$
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'process-scheduled-activities'),
  command := $cron$
    select net.http_post(
      url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-scheduled-activities',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_cron_secret')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $cron$
);

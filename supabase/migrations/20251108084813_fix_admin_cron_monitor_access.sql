-- Ensure admin cron monitor data can be loaded by admin users through RPC helpers
set check_function_bodies = off;

create or replace function public.admin_get_cron_job_summary()
returns setof public.admin_cron_job_summary
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select *
  from public.admin_cron_job_summary
  order by display_name;
end;
$$;

revoke all on function public.admin_get_cron_job_summary() from public;
grant execute on function public.admin_get_cron_job_summary() to authenticated;

create or replace function public.admin_get_cron_job_runs(_limit integer default 50)
returns setof public.admin_cron_job_runs
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select *
  from public.admin_cron_job_runs
  order by started_at desc
  limit coalesce(_limit, 50);
end;
$$;

revoke all on function public.admin_get_cron_job_runs(integer) from public;
grant execute on function public.admin_get_cron_job_runs(integer) to authenticated;


create unique index if not exists mayor_salary_payments_mayor_week_key
on public.mayor_salary_payments(mayor_id, week_of);

create or replace function public.pay_mayor_salary_atomic(p_mayor_id uuid, p_week_of date, p_amount bigint)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_profile_id uuid; v_city_id uuid;
begin
  select profile_id,city_id into v_profile_id,v_city_id
  from public.city_mayors where id=p_mayor_id and is_current=true for update;
  if not found then return false; end if;
  insert into public.mayor_salary_payments(mayor_id,profile_id,city_id,amount,week_of)
  values(p_mayor_id,v_profile_id,v_city_id,p_amount,p_week_of)
  on conflict (mayor_id,week_of) do nothing;
  if not found then return false; end if;
  update public.profiles set cash=coalesce(cash,0)+(p_amount/100) where id=v_profile_id;
  if not found then raise exception 'Mayor profile not found'; end if;
  return true;
end $$;

revoke all on function public.pay_mayor_salary_atomic(uuid,date,bigint) from public,anon,authenticated;
grant execute on function public.pay_mayor_salary_atomic(uuid,date,bigint) to service_role;

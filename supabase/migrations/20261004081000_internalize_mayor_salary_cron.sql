create or replace function public.process_weekly_mayor_salaries()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_salary bigint; v_week date; v_m record; v_paid integer:=0;
begin
 select weekly_salary_per_mayor into v_salary from public.mayor_pay_settings where id=1;
 if v_salary is null then raise exception 'Mayor salary settings missing'; end if;
 v_week := current_date - extract(dow from current_date)::integer;
 for v_m in select id from public.city_mayors where is_current=true loop
   if public.pay_mayor_salary_atomic(v_m.id,v_week,v_salary) then v_paid:=v_paid+1; end if;
 end loop;
 return v_paid;
end $$;
revoke all on function public.process_weekly_mayor_salaries() from public,anon,authenticated;
grant execute on function public.process_weekly_mayor_salaries() to service_role;

select cron.unschedule('pay-mayor-salaries-weekly')
where exists(select 1 from cron.job where jobname='pay-mayor-salaries-weekly');
select cron.schedule('pay-mayor-salaries-weekly','0 3 * * 1',$$select public.process_weekly_mayor_salaries();$$);

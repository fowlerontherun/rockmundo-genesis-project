create or replace function public.ensure_current_lottery_draw()
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_week date; v_id uuid;
begin
 v_week:=current_date-extract(isodow from current_date)::integer+1;
 insert into public.lottery_draws(week_start) values(v_week) on conflict(week_start) do nothing;
 select id into v_id from public.lottery_draws where week_start=v_week;
 return v_id;
end $$;
revoke all on function public.ensure_current_lottery_draw() from public,anon,authenticated;
grant execute on function public.ensure_current_lottery_draw() to service_role;

select cron.schedule('ensure-current-lottery-draw','5 0 * * 2',$$select public.ensure_current_lottery_draw();$$)
where not exists(select 1 from cron.job where jobname='ensure-current-lottery-draw');

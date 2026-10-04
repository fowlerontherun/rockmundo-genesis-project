create or replace function public.ensure_current_lottery_draw()
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_week date; v_id uuid; v_jackpot integer;
begin
 v_week:=current_date-extract(isodow from current_date)::integer+1;
 v_jackpot:=(1000000+floor(random()*19000001))::integer;
 insert into public.lottery_draws(week_start,jackpot_amount) values(v_week,v_jackpot) on conflict(week_start) do nothing;
 select id into v_id from public.lottery_draws where week_start=v_week;
 return v_id;
end $$;
revoke all on function public.ensure_current_lottery_draw() from public,anon,authenticated;
grant execute on function public.ensure_current_lottery_draw() to service_role;

create or replace function public.process_weekly_lottery_draw()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.lottery_draws%rowtype;t record;nums integer[];n integer;matches integer;cash integer;xp integer;fame integer;settled boolean;processed integer:=0;paid bigint:=0;
begin
 select * into d from public.lottery_draws where status in ('pending','drawn') order by week_start desc limit 1 for update;
 if not found then return jsonb_build_object('status','no_pending_draw'); end if;
 nums:=d.winning_numbers;
 if nums is null or array_length(nums,1)<>5 then nums:='{}'::integer[]; while array_length(nums,1) is null or array_length(nums,1)<5 loop n:=floor(random()*30)::integer+1;if not n=any(nums) then nums:=array_append(nums,n);end if;end loop;end if;
 update public.lottery_draws set winning_numbers=nums,bonus_number=null,draw_date=coalesce(draw_date,now()),status='drawn' where id=d.id;
 for t in select * from public.lottery_tickets where draw_id=d.id and claimed=false order by id loop
  select count(*)::integer into matches from unnest(t.selected_numbers)x where x=any(nums);cash:=0;xp:=0;fame:=0;
  if matches=5 then cash:=d.jackpot_amount;xp:=10000;fame:=5000;elsif matches=4 then cash:=10000;xp:=1000;fame:=250;elsif matches=3 then cash:=500;xp:=100;elsif matches=2 then cash:=25;end if;
  settled:=public.settle_lottery_ticket_atomic(t.id,matches,false,cash,xp,fame);if settled then processed:=processed+1;paid:=paid+cash;end if;
 end loop;
 update public.lottery_draws set status='paid_out' where id=d.id and not exists(select 1 from public.lottery_tickets where draw_id=d.id and claimed=false);
 return jsonb_build_object('status','paid_out','draw_id',d.id,'tickets_processed',processed,'total_prizes_paid',paid,'jackpot',d.jackpot_amount);
end $$;
revoke all on function public.process_weekly_lottery_draw() from public,anon,authenticated;
grant execute on function public.process_weekly_lottery_draw() to service_role;

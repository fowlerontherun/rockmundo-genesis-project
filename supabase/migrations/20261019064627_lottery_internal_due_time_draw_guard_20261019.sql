-- Issue #4224: exclusively scheduled, transactional lottery draw.
-- Deployed directly to production and mirrored here. No draw is executed
-- by this migration. Existing ticket history and cron job ID are untouched.
-- Cron: Monday 00:05 UTC, after the end of the seven-day sales window.
-- For unmatched non-due rows this procedure returns no_due_draw.
-- The exclusive row lock and atomic ticket settlement ensure replay safety.
create or replace function public.process_weekly_lottery_draw()
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.lottery_draws%rowtype; t record; nums integer[]; bonus integer; n integer; matches integer; bm boolean; cash integer; xp integer; fame integer; settled boolean; processed integer:=0; paid bigint:=0;
begin
 -- The sole draw authority is the internal pg_cron job at Monday 00:05 UTC.
 -- A future draw stays open for ticket purchases even if a privileged caller
 -- accidentally invokes this function early. The same row lock covers all
 -- prize settlements; concurrent/repeated invocations cannot credit twice.
 select * into d from public.lottery_draws
  where status in ('pending','drawn')
    and week_start::timestamp + interval '7 days 5 minutes' <= (now() at time zone 'UTC')
  order by week_start asc limit 1 for update;
 if not found then return jsonb_build_object('status','no_due_draw'); end if;
 nums:=d.winning_numbers; bonus:=d.bonus_number;
 if d.status='drawn' then
   -- Never redraw a previously revealed/partially settled game.
   if cardinality(nums) is distinct from 7
      or (select count(distinct x) from unnest(nums) as x where x between 1 and 49)<>7
      or bonus not between 1 and 10 or bonus is null or d.draw_date is null
   then raise exception 'lottery_draw_invalid_existing_result'; end if;
 else
   if nums is not null or bonus is not null or d.draw_date is not null
   then raise exception 'lottery_draw_pending_already_has_result'; end if;
   nums:='{}'::integer[];
   while cardinality(nums)<7 loop
     n:=floor(random()*49)::integer+1;
     if not n=any(nums) then nums:=array_append(nums,n); end if;
   end loop;
   bonus:=floor(random()*10)::integer+1;
 end if;
 update public.lottery_draws set winning_numbers=nums,bonus_number=bonus,draw_date=coalesce(draw_date,now()),status='drawn' where id=d.id;
 for t in select * from public.lottery_tickets where draw_id=d.id and claimed=false order by id loop
   select count(*)::integer into matches from unnest(t.selected_numbers) x where x=any(nums);
   bm:=t.bonus_number=bonus; cash:=0; xp:=0; fame:=0;
   if matches=7 and bm then cash:=d.jackpot_amount;xp:=10000;fame:=5000;
   elsif matches=7 then cash:=250000;xp:=5000;
   elsif matches=6 and bm then cash:=50000;xp:=2000;
   elsif matches=6 then cash:=10000;xp:=1000;
   elsif matches=5 and bm then cash:=5000;xp:=500;
   elsif matches=5 then cash:=1000;xp:=200;
   elsif matches=4 then cash:=500;xp:=100;
   elsif matches=3 then cash:=2;
   end if;
   settled:=public.settle_lottery_ticket_atomic(t.id,matches,bm,cash,xp,fame);
   if settled then processed:=processed+1;paid:=paid+cash; end if;
 end loop;
 update public.lottery_draws set status='paid_out' where id=d.id and not exists(select 1 from public.lottery_tickets where draw_id=d.id and claimed=false);
 return jsonb_build_object('status','paid_out','draw_id',d.id,'tickets_processed',processed,'total_prizes_paid',paid);
end $$;
revoke all on function public.process_weekly_lottery_draw() from public,anon,authenticated;
grant execute on function public.process_weekly_lottery_draw() to service_role;

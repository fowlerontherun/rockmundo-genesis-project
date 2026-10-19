-- Weekly Lottery 7-of-49 contract, GitHub #4223, 19 October 2026.
-- Live receipt 20261019063411; applied directly, then mirrored to GitHub.
-- Preflight: zero tickets; existing ticket price is $2.
-- Exactly seven unique 1..49 main numbers and a separate 1..10 bonus.
-- Cash is debited $2 once by the locked server RPC; max ten tickets per
-- character per draw. Legacy paid-out draws are not touched.
-- This migration does not initiate a draw or pay any player.

CREATE OR REPLACE FUNCTION public.buy_lottery_ticket_atomic(
  p_profile_id uuid,p_draw_id uuid,p_selected_numbers integer[],p_bonus_number integer
) RETURNS public.lottery_tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE v_profile public.profiles%ROWTYPE;
        v_draw public.lottery_draws%ROWTYPE;
        v_ticket public.lottery_tickets%ROWTYPE;
        v_count integer;
BEGIN
  IF auth.uid() IS NULL OR p_profile_id IS NULL THEN
    RAISE EXCEPTION 'lottery_login_required' USING ERRCODE='42501';
  END IF;
  IF cardinality(p_selected_numbers) IS DISTINCT FROM 7
     OR (SELECT count(DISTINCT x) FROM unnest(p_selected_numbers) AS x WHERE x BETWEEN 1 AND 49)<>7
     OR p_bonus_number NOT BETWEEN 1 AND 10 OR p_bonus_number IS NULL
  THEN RAISE EXCEPTION 'invalid_lottery_selection'; END IF;

  -- Lock draw before counting tickets: concurrent buys serialize globally.
  SELECT * INTO v_draw FROM public.lottery_draws WHERE id=p_draw_id FOR UPDATE;
  IF NOT FOUND OR v_draw.status<>'pending'
    OR v_draw.draw_date IS NOT NULL OR v_draw.winning_numbers IS NOT NULL
    OR v_draw.week_start <> date_trunc('week',now() AT TIME ZONE 'UTC')::date
  THEN RAISE EXCEPTION 'lottery_draw_not_open'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id FOR UPDATE;
  IF NOT FOUND OR v_profile.user_id IS DISTINCT FROM auth.uid()
     OR v_profile.is_active IS DISTINCT FROM true
     OR v_profile.deleted_at IS NOT NULL OR v_profile.died_at IS NOT NULL
  THEN RAISE EXCEPTION 'lottery_profile_not_owned_or_active' USING ERRCODE='42501'; END IF;

  SELECT count(*) INTO v_count FROM public.lottery_tickets
   WHERE profile_id=p_profile_id AND draw_id=p_draw_id;
  IF v_count>=10 THEN RAISE EXCEPTION 'lottery_ticket_limit'; END IF;

  UPDATE public.profiles SET cash=cash-2 WHERE id=p_profile_id AND cash>=2;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_lottery_cash'; END IF;

  INSERT INTO public.lottery_tickets
    (user_id,profile_id,draw_id,selected_numbers,bonus_number)
  VALUES(v_profile.user_id,p_profile_id,p_draw_id,p_selected_numbers,p_bonus_number)
  RETURNING * INTO v_ticket;
  RETURN v_ticket;
END
$body$;
REVOKE ALL ON FUNCTION public.buy_lottery_ticket_atomic(uuid,uuid,integer[],integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buy_lottery_ticket_atomic(uuid,uuid,integer[],integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_lottery_ticket_atomic(
  p_ticket_id uuid,p_matches integer,p_bonus_matched boolean,
  p_prize_cash integer,p_prize_xp integer,p_prize_fame integer
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE v_ticket public.lottery_tickets%ROWTYPE;
        v_user uuid;
BEGIN
  IF p_ticket_id IS NULL OR p_matches NOT BETWEEN 0 AND 7
    OR p_prize_cash IS NULL OR p_prize_cash NOT BETWEEN 0 AND 20000000
    OR p_prize_xp IS NULL OR p_prize_xp NOT BETWEEN 0 AND 10000
    OR p_prize_fame IS NULL OR p_prize_fame NOT BETWEEN 0 AND 5000
  THEN RAISE EXCEPTION 'invalid_lottery_settlement'; END IF;

  SELECT * INTO v_ticket FROM public.lottery_tickets
   WHERE id=p_ticket_id FOR UPDATE;
  IF NOT FOUND OR v_ticket.claimed THEN RETURN false; END IF;
  SELECT user_id INTO v_user FROM public.profiles
   WHERE id=v_ticket.profile_id FOR UPDATE;
  IF NOT FOUND OR v_user IS DISTINCT FROM v_ticket.user_id THEN
    RAISE EXCEPTION 'lottery_recipient_mismatch';
  END IF;

  UPDATE public.lottery_tickets
     SET matches=p_matches, bonus_matched=coalesce(p_bonus_matched,false),
         prize_cash=p_prize_cash,prize_xp=p_prize_xp,
         prize_fame=p_prize_fame,claimed=true
   WHERE id=p_ticket_id AND claimed=false;
  IF NOT FOUND THEN RAISE EXCEPTION 'lottery_settlement_claim_lost'; END IF;

  IF p_prize_cash>0 OR p_prize_fame>0 THEN
    UPDATE public.profiles
       SET cash=cash+p_prize_cash, fame=fame+p_prize_fame
     WHERE id=v_ticket.profile_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'lottery_profile_missing'; END IF;
  END IF;
  IF p_prize_xp>0 THEN
    INSERT INTO public.player_xp_wallet(profile_id) VALUES(v_ticket.profile_id)
      ON CONFLICT(profile_id) DO NOTHING;
    UPDATE public.player_xp_wallet
       SET xp_balance=coalesce(xp_balance,0)+p_prize_xp,
           lifetime_xp=coalesce(lifetime_xp,0)+p_prize_xp,
           skill_xp_balance=coalesce(skill_xp_balance,0)+p_prize_xp,
           skill_xp_lifetime=coalesce(skill_xp_lifetime,0)+p_prize_xp,
           last_recalculated=now()
     WHERE profile_id=v_ticket.profile_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'lottery_wallet_missing'; END IF;
    INSERT INTO public.experience_ledger
      (user_id,profile_id,activity_type,xp_amount,metadata)
    VALUES(v_user,v_ticket.profile_id,'lottery',p_prize_xp,
      jsonb_build_object('ticket_id',p_ticket_id,'draw_id',v_ticket.draw_id,
                         'cash_prize',p_prize_cash,'fame_prize',p_prize_fame));
  END IF;
  RETURN true;
END
$body$;
REVOKE ALL ON FUNCTION public.settle_lottery_ticket_atomic(uuid,integer,boolean,integer,integer,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_lottery_ticket_atomic(uuid,integer,boolean,integer,integer,integer)
  TO service_role;

create or replace function public.process_weekly_lottery_draw()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.lottery_draws%rowtype; t record; nums integer[]; bonus integer; n integer; matches integer; bm boolean; cash integer; xp integer; fame integer; settled boolean; processed integer:=0; paid bigint:=0;
begin
 select * into d from public.lottery_draws where status in ('pending','drawn') order by week_start desc limit 1 for update;
 if not found then return jsonb_build_object('status','no_pending_draw'); end if;
 nums:=d.winning_numbers; bonus:=d.bonus_number;
 if nums is null or array_length(nums,1)<>7 then
   nums:='{}'::integer[];
   while array_length(nums,1) is null or array_length(nums,1)<7 loop
     n:=floor(random()*49)::integer+1;
     if not n=any(nums) then nums:=array_append(nums,n); end if;
   end loop;
 end if;
 if bonus is null then bonus:=floor(random()*10)::integer+1; end if;
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

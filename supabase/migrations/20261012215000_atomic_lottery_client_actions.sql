-- Atomic lottery purchase and historical manual-claim settlement.
-- The scheduled draw processor also settles tickets; the manual claim guards claimed=true.
CREATE OR REPLACE FUNCTION public.buy_lottery_ticket_atomic(
  p_profile_id uuid,p_draw_id uuid,p_selected_numbers integer[],p_bonus_number integer
) RETURNS public.lottery_tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user uuid; v_ticket public.lottery_tickets%rowtype; v_count integer;
BEGIN
 SELECT user_id INTO v_user FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF v_user IS NULL THEN RAISE EXCEPTION 'invalid_lottery_profile'; END IF;
 IF (SELECT status FROM public.lottery_draws WHERE id=p_draw_id FOR UPDATE) <> 'pending' THEN
  RAISE EXCEPTION 'lottery_draw_closed';
 END IF;
 IF cardinality(p_selected_numbers)<>5 OR
   (SELECT count(DISTINCT x) FROM unnest(p_selected_numbers)x WHERE x BETWEEN 1 AND 30)<>5 OR
   p_bonus_number NOT BETWEEN 1 AND 10 THEN
  RAISE EXCEPTION 'invalid_lottery_selection';
 END IF;
 SELECT count(*) INTO v_count FROM public.lottery_tickets WHERE profile_id=p_profile_id AND draw_id=p_draw_id;
 IF v_count>=10 THEN RAISE EXCEPTION 'lottery_ticket_limit'; END IF;
 UPDATE public.profiles SET cash=cash-2 WHERE id=p_profile_id AND cash>=2;
 IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_lottery_cash'; END IF;
 INSERT INTO public.lottery_tickets(user_id,profile_id,draw_id,selected_numbers,bonus_number)
 VALUES(v_user,p_profile_id,p_draw_id,p_selected_numbers,p_bonus_number)
 RETURNING * INTO v_ticket;
 RETURN v_ticket;
END $$;

CREATE OR REPLACE FUNCTION public.claim_lottery_prize_atomic(p_profile_id uuid,p_ticket_id uuid)
RETURNS public.lottery_tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_ticket public.lottery_tickets%rowtype; v_user uuid;
BEGIN
 SELECT user_id INTO v_user FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF v_user IS NULL THEN RAISE EXCEPTION 'invalid_lottery_profile'; END IF;
 SELECT * INTO v_ticket FROM public.lottery_tickets
 WHERE id=p_ticket_id AND profile_id=p_profile_id AND user_id=v_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'lottery_ticket_not_found'; END IF;
 IF v_ticket.claimed THEN RAISE EXCEPTION 'lottery_prize_already_settled'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.lottery_draws WHERE id=v_ticket.draw_id AND status IN ('drawn','paid_out'))
 THEN RAISE EXCEPTION 'lottery_draw_not_final'; END IF;
 IF greatest(coalesce(v_ticket.prize_cash,0),coalesce(v_ticket.prize_xp,0),coalesce(v_ticket.prize_fame,0))=0
 THEN RAISE EXCEPTION 'lottery_no_prize'; END IF;
 UPDATE public.profiles SET
   cash=coalesce(cash,0)+greatest(0,coalesce(v_ticket.prize_cash,0)),
   xp=coalesce(xp,0)+greatest(0,coalesce(v_ticket.prize_xp,0)),
   fame=coalesce(fame,0)+greatest(0,coalesce(v_ticket.prize_fame,0))
 WHERE id=p_profile_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'lottery_profile_not_found'; END IF;
 UPDATE public.lottery_tickets SET claimed=true WHERE id=p_ticket_id RETURNING * INTO v_ticket;
 RETURN v_ticket;
END $$;
REVOKE ALL ON FUNCTION public.buy_lottery_ticket_atomic(uuid,uuid,integer[],integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.claim_lottery_prize_atomic(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buy_lottery_ticket_atomic(uuid,uuid,integer[],integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_lottery_prize_atomic(uuid,uuid) TO authenticated;

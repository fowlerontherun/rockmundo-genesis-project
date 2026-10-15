-- Controlled production reconciliation, issue #4072.
-- Replaces the incompatible 20261012215000 lottery RPC body and the
-- existing settlement helper which incorrectly writes public.profiles.xp.
-- Source-of-truth SXP is player_xp_wallet plus experience_ledger.
-- Preflight: zero lottery tickets / previously settled prizes on 2026-10-15.
-- This script is forward-only; it does not run a draw or issue a payout.
--
-- CRITICAL: prevent direct INSERT bypassing ticket price and per-draw cap.
REVOKE INSERT ON public.lottery_tickets FROM PUBLIC, anon, authenticated;

-- Extra defence against accidental XP double-credit from separate callers.
CREATE UNIQUE INDEX IF NOT EXISTS lottery_experience_ledger_ticket_unique_20261015
  ON public.experience_ledger ((metadata->>'ticket_id'))
  WHERE activity_type='lottery' AND metadata->>'ticket_id' IS NOT NULL;

-- Retain the signature already called by the production lottery scheduler.
-- Writes are locked and transactional: ticket state, cash/fame, XP wallet,
-- and experience ledger must all succeed together or all roll back.
CREATE OR REPLACE FUNCTION public.settle_lottery_ticket_atomic(
  p_ticket_id uuid,p_matches integer,p_bonus_matched boolean,
  p_prize_cash integer,p_prize_xp integer,p_prize_fame integer
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE v_ticket public.lottery_tickets%ROWTYPE;
        v_user uuid;
BEGIN
  IF p_ticket_id IS NULL OR p_matches NOT BETWEEN 0 AND 5
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

-- The UI already calls this RPC, but its original migration was never applied.
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
  IF cardinality(p_selected_numbers) IS DISTINCT FROM 5
     OR (SELECT count(DISTINCT x) FROM unnest(p_selected_numbers) AS x WHERE x BETWEEN 1 AND 30)<>5
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

-- Historical manual claims can only settle a finalized, unpaid ticket.
-- The automatic draw processor marks tickets claimed, so this never
-- credits a second time and does not depend on profiles.xp.
CREATE OR REPLACE FUNCTION public.claim_lottery_prize_atomic(
  p_profile_id uuid,p_ticket_id uuid
) RETURNS public.lottery_tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE v_ticket public.lottery_tickets%ROWTYPE;
        v_user uuid;v_applied boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'lottery_login_required' USING ERRCODE='42501'; END IF;
  SELECT user_id INTO v_user FROM public.profiles WHERE id=p_profile_id FOR UPDATE;
  IF NOT FOUND OR v_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'lottery_profile_not_owned' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_ticket FROM public.lottery_tickets
   WHERE id=p_ticket_id AND profile_id=p_profile_id AND user_id=v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lottery_ticket_not_found'; END IF;
  IF v_ticket.claimed THEN RAISE EXCEPTION 'lottery_prize_already_settled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lottery_draws
    WHERE id=v_ticket.draw_id AND status IN ('drawn','paid_out') AND winning_numbers IS NOT NULL)
  THEN RAISE EXCEPTION 'lottery_draw_not_final'; END IF;
  IF greatest(v_ticket.prize_cash,v_ticket.prize_xp,v_ticket.prize_fame)<=0 THEN
    RAISE EXCEPTION 'lottery_no_prize'; END IF;

  v_applied:=public.settle_lottery_ticket_atomic(
    v_ticket.id,coalesce(v_ticket.matches,0),v_ticket.bonus_matched,
    v_ticket.prize_cash,v_ticket.prize_xp,v_ticket.prize_fame);
  IF NOT v_applied THEN RAISE EXCEPTION 'lottery_settlement_conflict'; END IF;
  SELECT * INTO v_ticket FROM public.lottery_tickets WHERE id=p_ticket_id;
  RETURN v_ticket;
END
$body$;
REVOKE ALL ON FUNCTION public.claim_lottery_prize_atomic(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_lottery_prize_atomic(uuid,uuid)
  TO authenticated;

NOTIFY pgrst,'reload schema';

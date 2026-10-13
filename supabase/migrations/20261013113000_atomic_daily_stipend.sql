-- One claim and one wallet credit, with rollback on any failure.
CREATE OR REPLACE FUNCTION public.claim_daily_stipend_atomic(
 p_profile_id uuid,p_sxp integer,p_ap integer,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_today date := (now() AT TIME ZONE 'UTC')::date;
 v_wallet public.player_xp_wallet%ROWTYPE;
 v_streak integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
 SELECT 1 FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid()
 AND deleted_at IS NULL AND died_at IS NULL) THEN
  RAISE EXCEPTION 'PROFILE_NOT_OWNED' USING ERRCODE='42501';
 END IF;
 IF p_sxp NOT BETWEEN 1 AND 2000 OR p_ap NOT BETWEEN 0 AND 30
 OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'INVALID_STIPEND';
 END IF;
 INSERT INTO public.player_xp_wallet(profile_id) VALUES(p_profile_id)
 ON CONFLICT(profile_id) DO NOTHING;
 SELECT * INTO v_wallet FROM public.player_xp_wallet
 WHERE profile_id=p_profile_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.profile_daily_xp_grants
 WHERE profile_id=p_profile_id AND grant_date=v_today) THEN
  RAISE EXCEPTION 'DAILY_STIPEND_ALREADY_CLAIMED';
 END IF;
 v_streak := CASE WHEN v_wallet.last_stipend_claim_date = v_today - 1
 THEN coalesce(v_wallet.stipend_claim_streak,0)+1 ELSE 1 END;
 INSERT INTO public.profile_daily_xp_grants(profile_id,grant_date,xp_awarded,metadata)
 VALUES(p_profile_id,v_today,p_sxp,p_metadata || jsonb_build_object('streak',v_streak));
 UPDATE public.player_xp_wallet SET
 skill_xp_balance=coalesce(skill_xp_balance,0)+p_sxp,
 skill_xp_lifetime=coalesce(skill_xp_lifetime,0)+p_sxp,
 xp_balance=coalesce(xp_balance,0)+p_sxp,
 lifetime_xp=coalesce(lifetime_xp,0)+p_sxp,
 attribute_points_balance=coalesce(attribute_points_balance,0)+p_ap,
 attribute_points_lifetime=coalesce(attribute_points_lifetime,0)+p_ap,
 stipend_claim_streak=v_streak,last_stipend_claim_date=v_today,
 last_recalculated=now()
 WHERE profile_id=p_profile_id;
 RETURN jsonb_build_object('date',v_today,'streak',v_streak,'sxp',p_sxp,'ap',p_ap);
END $$;
REVOKE ALL ON FUNCTION public.claim_daily_stipend_atomic(uuid,integer,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_stipend_atomic(uuid,integer,integer,jsonb) TO authenticated;

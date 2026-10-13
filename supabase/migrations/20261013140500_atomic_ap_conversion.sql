-- Convert AP and write its audit event together or roll back both.
CREATE OR REPLACE FUNCTION public.convert_ap_to_sxp_atomic(
 p_profile_id uuid,p_amount integer,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_balance integer;v_after integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_profile_id
 AND user_id=auth.uid() AND died_at IS NULL AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'PROFILE_NOT_OWNED' USING ERRCODE='42501'; END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>10000 OR
 jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN
 RAISE EXCEPTION 'INVALID_CONVERSION';END IF;
 SELECT attribute_points_balance INTO v_balance FROM public.player_xp_wallet
 WHERE profile_id=p_profile_id FOR UPDATE;
 IF NOT FOUND OR coalesce(v_balance,0)<p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_AP';END IF;
 UPDATE public.player_xp_wallet SET
 attribute_points_balance=attribute_points_balance-p_amount,
 skill_xp_balance=coalesce(skill_xp_balance,0)+p_amount*100,
 skill_xp_lifetime=coalesce(skill_xp_lifetime,0)+p_amount*100,
 xp_balance=coalesce(xp_balance,0)+p_amount*100,
 lifetime_xp=coalesce(lifetime_xp,0)+p_amount*100,
 last_recalculated=now()
 WHERE profile_id=p_profile_id RETURNING xp_balance INTO v_after;
 INSERT INTO public.xp_ledger(profile_id,event_type,xp_delta,balance_after,
 attribute_points_delta,skill_points_delta,metadata)
 VALUES(p_profile_id,'ap_to_sxp_conversion',p_amount*100,v_after,-p_amount,0,
 p_metadata || jsonb_build_object('ap_spent',p_amount,'sxp_gained',p_amount*100,'rate',100));
END $$;
REVOKE ALL ON FUNCTION public.convert_ap_to_sxp_atomic(uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.convert_ap_to_sxp_atomic(uuid,integer,jsonb) TO authenticated;

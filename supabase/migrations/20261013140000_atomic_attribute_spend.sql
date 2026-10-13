-- Apply AP cost and selected attribute increase in the same transaction.
CREATE OR REPLACE FUNCTION public.spend_attribute_points_atomic(p_profile_id uuid,p_attribute text,p_cost integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_wallet public.player_xp_wallet%ROWTYPE; v_value integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS
  (SELECT 1 FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid()
    AND deleted_at IS NULL AND died_at IS NULL)
 THEN RAISE EXCEPTION 'PROFILE_NOT_OWNED' USING ERRCODE='42501'; END IF;
 IF p_attribute NOT IN ('charisma','looks','mental_focus','musicality','physical_endurance',
   'stage_presence','crowd_engagement','social_reach')
 OR p_cost IS NULL OR p_cost<1 OR p_cost>100
 THEN RAISE EXCEPTION 'INVALID_ATTRIBUTE_OR_COST'; END IF;
 SELECT * INTO v_wallet FROM public.player_xp_wallet WHERE profile_id=p_profile_id FOR UPDATE;
 IF NOT FOUND OR coalesce(v_wallet.attribute_points_balance,0)<p_cost
 THEN RAISE EXCEPTION 'INSUFFICIENT_ATTRIBUTE_POINTS'; END IF;
 INSERT INTO public.player_attributes(profile_id) VALUES(p_profile_id)
 ON CONFLICT(profile_id) DO NOTHING;
 EXECUTE format('SELECT coalesce(%I,0) FROM public.player_attributes WHERE profile_id=$1 FOR UPDATE',p_attribute)
 INTO v_value USING p_profile_id;
 IF v_value+p_cost>100 THEN RAISE EXCEPTION 'ATTRIBUTE_CAP_EXCEEDED'; END IF;
 UPDATE public.player_xp_wallet SET attribute_points_balance=attribute_points_balance-p_cost,
 last_recalculated=now() WHERE profile_id=p_profile_id;
 EXECUTE format('UPDATE public.player_attributes SET %I=$2,attribute_points_spent=coalesce(attribute_points_spent,0)+$3 WHERE profile_id=$1',p_attribute)
 USING p_profile_id,v_value+p_cost,p_cost;
END $$;
REVOKE ALL ON FUNCTION public.spend_attribute_points_atomic(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.spend_attribute_points_atomic(uuid,text,integer) TO authenticated;

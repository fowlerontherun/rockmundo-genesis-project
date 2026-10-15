-- Production-compatible AP -> SXP conversion. Original 20261013140500
-- targeted nonexistent public.xp_ledger; preserve the contract against the
-- live experience_ledger without recreating that legacy table.
BEGIN;
CREATE OR REPLACE FUNCTION public.convert_ap_to_sxp_atomic(
  p_profile_id uuid, p_amount integer, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE
  v_user uuid:=auth.uid();
  v_ap integer;
  v_after integer;
  v_xp integer;
BEGIN
  IF v_user IS NULL OR p_profile_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=p_profile_id AND p.user_id=v_user
      AND p.died_at IS NULL AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'PROFILE_NOT_OWNED' USING ERRCODE='42501';
  END IF;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount>10000
     OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object'
     OR octet_length(p_metadata::text)>4096 THEN
    RAISE EXCEPTION 'INVALID_CONVERSION' USING ERRCODE='22023';
  END IF;
  v_xp:=p_amount*100;
  SELECT attribute_points_balance INTO v_ap
  FROM public.player_xp_wallet WHERE profile_id=p_profile_id FOR UPDATE;
  IF NOT FOUND OR coalesce(v_ap,0)<p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_AP';
  END IF;
  UPDATE public.player_xp_wallet SET
    attribute_points_balance=attribute_points_balance-p_amount,
    skill_xp_balance=coalesce(skill_xp_balance,0)+v_xp,
    skill_xp_lifetime=coalesce(skill_xp_lifetime,0)+v_xp,
    xp_balance=coalesce(xp_balance,0)+v_xp,
    lifetime_xp=coalesce(lifetime_xp,0)+v_xp,
    last_recalculated=now()
  WHERE profile_id=p_profile_id
  RETURNING xp_balance INTO v_after;
  IF NOT FOUND THEN RAISE EXCEPTION 'XP_WALLET_NOT_FOUND'; END IF;

  INSERT INTO public.experience_ledger(
    profile_id,user_id,activity_type,xp_amount,metadata
  ) VALUES (
    p_profile_id,v_user,'ap_to_sxp_conversion',v_xp,
    p_metadata || jsonb_build_object(
      'ap_spent',p_amount,'sxp_gained',v_xp,
      'rate',100,'balance_after',v_after,
      'unique_event_id','ap-sxp:'||gen_random_uuid()::text)
  );
END;
$f$;
REVOKE ALL ON FUNCTION public.convert_ap_to_sxp_atomic(uuid,integer,jsonb)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.convert_ap_to_sxp_atomic(uuid,integer,jsonb)
 TO authenticated;
COMMIT;
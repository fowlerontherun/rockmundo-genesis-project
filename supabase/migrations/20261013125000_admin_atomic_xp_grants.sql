-- Atomic admin grant: wallet and ledger succeed or fail together.
CREATE OR REPLACE FUNCTION public.admin_grant_special_xp_atomic(
 p_profile_id uuid,p_amount integer,p_reason text,p_metadata jsonb DEFAULT '{}'::jsonb,
 p_request_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user uuid;v_balance integer;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF p_profile_id IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount>100000
 OR nullif(btrim(coalesce(p_reason,'')),'') IS NULL OR
 jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'INVALID_ADMIN_GRANT';
 END IF;
 SELECT user_id INTO v_user FROM public.profiles WHERE id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
 INSERT INTO public.player_xp_wallet(profile_id) VALUES(p_profile_id)
 ON CONFLICT(profile_id) DO NOTHING;
 UPDATE public.player_xp_wallet SET
  xp_balance=coalesce(xp_balance,0)+p_amount,
  lifetime_xp=coalesce(lifetime_xp,0)+p_amount,
  skill_xp_balance=coalesce(skill_xp_balance,0)+p_amount,
  skill_xp_lifetime=coalesce(skill_xp_lifetime,0)+p_amount,
  last_recalculated=now()
 WHERE profile_id=p_profile_id RETURNING xp_balance INTO v_balance;
 INSERT INTO public.experience_ledger(profile_id,user_id,activity_type,xp_amount,metadata)
 VALUES(p_profile_id,v_user,'admin_grant',p_amount,
 p_metadata || jsonb_build_object('reason',p_reason,'granted_by',auth.uid(),'request_id',p_request_id));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.admin_grant_special_xp_atomic(uuid,integer,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_special_xp_atomic(uuid,integer,text,jsonb,text) TO authenticated;

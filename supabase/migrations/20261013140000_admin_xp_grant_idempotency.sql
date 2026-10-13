-- Idempotent admin XP payouts. The request ID is shared by a bulk batch, but
-- unique per target profile. The grant marker and XP/ledger credit are atomic.
CREATE TABLE IF NOT EXISTS public.admin_xp_grant_requests (
 request_id text NOT NULL,
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 amount integer NOT NULL,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(request_id,profile_id)
);
ALTER TABLE public.admin_xp_grant_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_xp_grant_requests FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_special_xp_atomic(
 p_profile_id uuid,p_amount integer,p_reason text,p_metadata jsonb DEFAULT '{}'::jsonb,
 p_request_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user uuid;v_inserted integer;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF p_profile_id IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount>100000
 OR nullif(btrim(coalesce(p_reason,'')),'') IS NULL OR p_request_id IS NULL
 OR length(btrim(p_request_id)) < 8 OR length(p_request_id)>128
 OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'INVALID_ADMIN_GRANT';
 END IF;
 SELECT user_id INTO v_user FROM public.profiles WHERE id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
 INSERT INTO public.admin_xp_grant_requests(request_id,profile_id,amount,reason)
 VALUES(p_request_id,p_profile_id,p_amount,p_reason)
 ON CONFLICT(request_id,profile_id) DO NOTHING;
 GET DIAGNOSTICS v_inserted=ROW_COUNT;
 IF v_inserted=0 THEN
  IF NOT EXISTS(SELECT 1 FROM public.admin_xp_grant_requests
     WHERE request_id=p_request_id AND profile_id=p_profile_id AND amount=p_amount AND reason=p_reason)
  THEN RAISE EXCEPTION 'ADMIN_GRANT_REQUEST_CONFLICT';END IF;
  RETURN false;
 END IF;
 INSERT INTO public.player_xp_wallet(profile_id) VALUES(p_profile_id)
 ON CONFLICT(profile_id) DO NOTHING;
 UPDATE public.player_xp_wallet SET
  xp_balance=coalesce(xp_balance,0)+p_amount,
  lifetime_xp=coalesce(lifetime_xp,0)+p_amount,
  skill_xp_balance=coalesce(skill_xp_balance,0)+p_amount,
  skill_xp_lifetime=coalesce(skill_xp_lifetime,0)+p_amount,
  last_recalculated=now()
 WHERE profile_id=p_profile_id;
 INSERT INTO public.experience_ledger(profile_id,user_id,activity_type,xp_amount,metadata)
 VALUES(p_profile_id,v_user,'admin_grant',p_amount,
 p_metadata || jsonb_build_object('reason',p_reason,'granted_by',auth.uid(),'request_id',p_request_id));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.admin_grant_special_xp_atomic(uuid,integer,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_special_xp_atomic(uuid,integer,text,jsonb,text) TO authenticated;

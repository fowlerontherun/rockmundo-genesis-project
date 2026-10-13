-- Separate bonuses from stipend claims and commit a single activity payout atomically.
CREATE TABLE IF NOT EXISTS public.profile_activity_xp_bonuses (
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 grant_date date NOT NULL,
 xp_awarded integer NOT NULL CHECK(xp_awarded > 0),
 ap_awarded integer NOT NULL CHECK(ap_awarded >= 0),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(profile_id,grant_date)
);
ALTER TABLE public.profile_activity_xp_bonuses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_activity_xp_bonuses FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.award_daily_activity_xp_atomic(
 p_profile_id uuid,p_grant_date date,p_xp integer,p_ap integer,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_inserted integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED'; END IF;
 IF p_profile_id IS NULL OR p_grant_date IS NULL OR p_xp NOT BETWEEN 1 AND 250 OR p_ap NOT BETWEEN 0 AND 20
   OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'Invalid activity bonus';
 END IF;
 INSERT INTO public.profile_activity_xp_bonuses(profile_id,grant_date,xp_awarded,ap_awarded,metadata)
 VALUES(p_profile_id,p_grant_date,p_xp,p_ap,p_metadata)
 ON CONFLICT(profile_id,grant_date) DO NOTHING;
 GET DIAGNOSTICS v_inserted=ROW_COUNT;
 IF v_inserted=0 THEN RETURN false; END IF;
 INSERT INTO public.player_xp_wallet(profile_id) VALUES(p_profile_id)
 ON CONFLICT(profile_id) DO NOTHING;
 UPDATE public.player_xp_wallet SET
  xp_balance=coalesce(xp_balance,0)+p_xp,
  lifetime_xp=coalesce(lifetime_xp,0)+p_xp,
  skill_xp_balance=coalesce(skill_xp_balance,0)+p_xp,
  skill_xp_lifetime=coalesce(skill_xp_lifetime,0)+p_xp,
  attribute_points_balance=coalesce(attribute_points_balance,0)+p_ap,
  attribute_points_lifetime=coalesce(attribute_points_lifetime,0)+p_ap,
  last_recalculated=now()
 WHERE profile_id=p_profile_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Activity bonus wallet missing'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.award_daily_activity_xp_atomic(uuid,date,integer,integer,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.award_daily_activity_xp_atomic(uuid,date,integer,integer,jsonb) TO service_role;

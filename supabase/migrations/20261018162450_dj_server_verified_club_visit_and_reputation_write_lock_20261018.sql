-- Applied directly to production Supabase as 20261018162450.
-- Server-verified club visit replaces mutable client-side tier/DJ/spend fields.
-- Keep historical club reputation intact. See #4264 and #4265.
CREATE OR REPLACE FUNCTION public.record_verified_club_visit(p_profile_id uuid, p_club_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_profile_city uuid;
  v_profile_active boolean;
  v_club_city uuid;
  v_rep public.player_club_reputation%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_visits integer;
  v_dj_sets integer;
  v_spend numeric;
  v_tier text;
  v_perks jsonb;
  v_points integer;
  v_previous_tier text;
BEGIN
  IF v_user_id IS NULL OR p_profile_id IS NULL OR p_club_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated club visitor required' USING ERRCODE='42501';
  END IF;

  -- Serialize all visits for this character, including first-time inserts.
  SELECT p.current_city_id,p.is_active INTO v_profile_city,v_profile_active
  FROM public.profiles p
  WHERE p.id=p_profile_id AND p.user_id=v_user_id FOR UPDATE;
  IF NOT FOUND OR COALESCE(v_profile_active,false)=false THEN
    RAISE EXCEPTION 'An active, owned character is required'
      USING ERRCODE='42501';
  END IF;

  SELECT c.city_id INTO v_club_city
  FROM public.city_night_clubs c WHERE c.id=p_club_id;
  IF NOT FOUND OR v_profile_city IS DISTINCT FROM v_club_city THEN
    RAISE EXCEPTION 'Travel to this nightclub city before visiting'
      USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_rep FROM public.player_club_reputation
    WHERE profile_id=p_profile_id AND club_id=p_club_id FOR UPDATE;
  IF v_rep.id IS NOT NULL AND v_rep.last_visit_at IS NOT NULL
     AND v_rep.last_visit_at > v_now - interval '8 hours' THEN
    RETURN jsonb_build_object(
      'awarded',false,'tier',v_rep.reputation_tier,
      'previous_tier',v_rep.reputation_tier,
      'next_eligible_at',v_rep.last_visit_at+interval '8 hours'
    );
  END IF;

  v_visits := greatest(0,coalesce(v_rep.visit_count,0))+1;
  v_dj_sets := greatest(0,coalesce(v_rep.dj_sets_played,0));
  v_spend := greatest(0,coalesce(v_rep.total_spend,0));
  v_previous_tier := coalesce(v_rep.reputation_tier,'newcomer');
  v_tier := CASE
    WHEN v_visits+v_dj_sets*2 >= 50 THEN 'legend'
    WHEN v_visits+v_dj_sets*2 >= 20 THEN 'vip'
    WHEN v_visits+v_dj_sets*2 >= 5 THEN 'regular'
    ELSE 'newcomer'
  END;
  v_perks := CASE v_tier
    WHEN 'legend' THEN '["Skip cover charge","50% drink discount","VIP lounge access","Priority DJ slots","Backstage access","Fame bonus +10%"]'::jsonb
    WHEN 'vip' THEN '["Skip cover charge","25% drink discount","VIP lounge access","Priority DJ slots"]'::jsonb
    WHEN 'regular' THEN '["Skip cover charge","10% drink discount"]'::jsonb
    ELSE '[]'::jsonb
  END;
  v_points := least(2147483647,
    v_visits::bigint*10 + v_dj_sets::bigint*25 + floor(v_spend/10))::integer;

  IF v_rep.id IS NULL THEN
    INSERT INTO public.player_club_reputation(
      profile_id,club_id,visit_count,dj_sets_played,total_spend,
      reputation_tier,reputation_points,perks_unlocked,last_visit_at
    ) VALUES (
      p_profile_id,p_club_id,v_visits,0,0,
      v_tier,v_points,v_perks,v_now
    );
  ELSE
    UPDATE public.player_club_reputation
    SET visit_count=v_visits, reputation_tier=v_tier,
        reputation_points=v_points, perks_unlocked=v_perks,
        last_visit_at=v_now
    WHERE id=v_rep.id;
  END IF;
  RETURN jsonb_build_object(
    'awarded',true,'tier',v_tier,'previous_tier',v_previous_tier,
    'next_eligible_at',v_now+interval '8 hours'
  );
END;
$function$

REVOKE ALL ON FUNCTION public.record_verified_club_visit(uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_verified_club_visit(uuid,uuid)
  TO authenticated;

ALTER TABLE public.player_club_reputation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own club reputation" ON public.player_club_reputation;
DROP POLICY IF EXISTS "Users can update own club reputation" ON public.player_club_reputation;
REVOKE INSERT,UPDATE,DELETE
  ON public.player_club_reputation FROM PUBLIC,anon,authenticated;

COMMENT ON FUNCTION public.record_verified_club_visit(uuid,uuid) IS
  'Owned character, same-city, eight-hour cooldown; server-generated social club visits. Not a DJ-settling or reward minting RPC.';
COMMENT ON TABLE public.player_club_reputation IS
  'Reputation levels and DJ counters are authoritative; owners can read but cannot submit their own tiers, visits, spends or DJ-set counts.';

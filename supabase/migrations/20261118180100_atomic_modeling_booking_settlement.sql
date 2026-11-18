-- #4232 / #4233: server-issued, character-scoped offers; atomic diary booking
-- and exactly-once modelling cash/fame settlement.
-- Deploy with the matching frontend and scheduled worker. Do not replay old
-- accepted bookings automatically or grant payout RPCs to browser roles.

ALTER TABLE public.player_modeling_contracts
  ADD COLUMN IF NOT EXISTS booking_activity_id uuid
  REFERENCES public.player_scheduled_activities(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS modeling_contract_booking_activity_unique
  ON public.player_modeling_contracts(booking_activity_id)
  WHERE booking_activity_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.modeling_offer_generation_state (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.modeling_offer_terms (
  contract_id uuid PRIMARY KEY REFERENCES public.player_modeling_contracts(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  compensation_amount bigint NOT NULL CHECK (compensation_amount BETWEEN 0 AND 1000000),
  fame_amount integer NOT NULL CHECK (fame_amount BETWEEN 0 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.modeling_contract_settlements (
  contract_id uuid PRIMARY KEY REFERENCES public.player_modeling_contracts(id) ON DELETE RESTRICT,
  activity_id uuid NOT NULL UNIQUE REFERENCES public.player_scheduled_activities(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  compensation_amount bigint NOT NULL CHECK (compensation_amount BETWEEN 0 AND 1000000),
  fame_amount integer NOT NULL CHECK (fame_amount BETWEEN 0 AND 10000),
  settled_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.modeling_offer_generation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modeling_offer_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modeling_contract_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.modeling_offer_generation_state,public.modeling_offer_terms,
  public.modeling_contract_settlements FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.modeling_offer_generation_state TO service_role;
GRANT SELECT,INSERT ON public.modeling_offer_terms,public.modeling_contract_settlements TO service_role;

-- Neither a forged offer nor a rewritten compensation column may be paid.
-- All client mutations must go through the authenticated RPCs below.
REVOKE INSERT,UPDATE,DELETE ON public.player_modeling_contracts FROM authenticated;
GRANT SELECT ON public.player_modeling_contracts TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_modeling_offers_secure(p_profile_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_profile public.profiles%rowtype;
  v_gig public.modeling_gigs%rowtype;
  v_last timestamptz;
  v_skill text;
  v_skill_level integer;
  v_looks integer;
  v_count integer := 0;
  v_limit integer := 1 + floor(random()*3)::integer;
  v_pay integer;
  v_contract uuid;
  v_expires timestamptz;
BEGIN
  IF v_actor IS NULL OR p_profile_id IS NULL THEN
    RAISE EXCEPTION 'modeling_auth_required';
  END IF;
  SELECT * INTO v_profile FROM public.profiles
  WHERE id=p_profile_id AND user_id=v_actor AND is_active=true
    AND deleted_at IS NULL AND died_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'modeling_active_character_required'; END IF;
  IF EXISTS (SELECT 1 FROM public.player_modeling_contracts
    WHERE profile_id=p_profile_id
      AND (status IN ('accepted','shooting')
        OR (status='pending' AND expires_at>now())))
  THEN RETURN 0; END IF;

  SELECT generated_at INTO v_last FROM public.modeling_offer_generation_state
  WHERE profile_id=p_profile_id;
  IF v_last IS NOT NULL AND v_last>now()-interval '10 minutes' THEN RETURN 0; END IF;
  INSERT INTO public.modeling_offer_generation_state(profile_id,generated_at)
  VALUES(p_profile_id,now()) ON CONFLICT(profile_id) DO UPDATE SET generated_at=now();

  v_looks := LEAST(100,50 + floor(GREATEST(0,v_profile.fame)/100)::integer);
  FOR v_gig IN
    SELECT * FROM public.modeling_gigs
    WHERE is_available=true
      AND COALESCE(min_looks_required,0)<=v_looks
      AND COALESCE(min_fame_required,0)<=v_profile.fame
      AND compensation_min BETWEEN 0 AND 1000000
      AND compensation_max BETWEEN compensation_min AND 1000000
      AND COALESCE(fame_boost,0) BETWEEN 0 AND 10000
      AND COALESCE(duration_hours,2) BETWEEN 1 AND 12
    ORDER BY random() LIMIT 20
  LOOP
    -- current_level is a skill LEVEL, not an XP percentage. The old client
    -- compared it with 20/30/50/200, leaving every starter shoot locked.
    -- Photo shoots are the entry path; advanced work requires actual skills.
    v_skill := CASE v_gig.gig_type
      WHEN 'runway' THEN 'modeling_basic_runway'
      WHEN 'cover_shoot' THEN 'modeling_basic_camera'
      WHEN 'commercial' THEN 'modeling_basic_commercial'
      WHEN 'brand_ambassador' THEN 'modeling_basic_brand'
      WHEN 'music_video_cameo' THEN 'modeling_basic_camera'
      WHEN 'editorial' THEN 'fashion_professional_styling'
      WHEN 'fashion_week' THEN 'fashion_professional_fundamentals'
      ELSE NULL END;
    v_skill_level := CASE v_gig.gig_type
      WHEN 'runway' THEN 2 WHEN 'cover_shoot' THEN 3
      WHEN 'commercial' THEN 2 WHEN 'brand_ambassador' THEN 3
      WHEN 'music_video_cameo' THEN 1
      WHEN 'editorial' THEN 4 WHEN 'fashion_week' THEN 5
      ELSE 0 END;
    IF v_skill IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.skill_progress
      WHERE profile_id=p_profile_id AND skill_slug=v_skill
        AND current_level>=v_skill_level
    ) THEN CONTINUE; END IF;
    v_pay := v_gig.compensation_min +
      floor(random() * (v_gig.compensation_max-v_gig.compensation_min+1))::integer;
    v_expires := now()+make_interval(days=>3+floor(random()*5)::integer);
    INSERT INTO public.player_modeling_contracts
      (user_id,profile_id,gig_id,brand_id,status,gig_type,compensation,
       fame_boost,looks_boost,expires_at,offer_reason)
    VALUES(v_actor,p_profile_id,v_gig.id,v_gig.brand_id,'pending',v_gig.gig_type,
      v_pay,COALESCE(v_gig.fame_boost,0),COALESCE(v_gig.looks_boost,0),v_expires,
      'A modeling agency has offered you a '||COALESCE(v_gig.title,'shoot'))
    RETURNING id INTO v_contract;
    INSERT INTO public.modeling_offer_terms
      (contract_id,profile_id,compensation_amount,fame_amount)
    VALUES(v_contract,p_profile_id,v_pay,COALESCE(v_gig.fame_boost,0));
    v_count := v_count + 1;
    EXIT WHEN v_count>=v_limit;
  END LOOP;
  RETURN v_count;
END $fn$;

CREATE OR REPLACE FUNCTION public.decline_modeling_offer_secure(p_offer_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'modeling_auth_required'; END IF;
  UPDATE public.player_modeling_contracts
  SET status='declined'
  WHERE id=p_offer_id AND user_id=(SELECT auth.uid()) AND status='pending'
    AND EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid()) AND p.deleted_at IS NULL);
  RETURN FOUND;
END $fn$;

CREATE OR REPLACE FUNCTION public.book_modeling_offer_atomic(
  p_offer_id uuid,p_profile_id uuid,p_start timestamptz,
  p_end timestamptz,p_shoot_date date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_profile public.profiles%rowtype;
  v_contract public.player_modeling_contracts%rowtype;
  v_terms public.modeling_offer_terms%rowtype;
  v_gig public.modeling_gigs%rowtype;
  v_activity uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'modeling_auth_required'; END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_shoot_date IS NULL
    OR p_start<=now() OR p_end<=p_start OR p_end>p_start+interval '12 hours'
    OR abs(p_shoot_date-(p_start AT TIME ZONE 'UTC')::date)>1
  THEN RAISE EXCEPTION 'modeling_invalid_booking_window'; END IF;

  -- One row-level account lock serialises simultaneous bookings by this
  -- character against each other; the conflict check uses the whole account.
  SELECT * INTO v_profile FROM public.profiles
  WHERE id=p_profile_id AND user_id=v_actor AND is_active=true
    AND deleted_at IS NULL AND died_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'modeling_active_character_required'; END IF;
  SELECT * INTO v_contract FROM public.player_modeling_contracts
  WHERE id=p_offer_id FOR UPDATE;
  IF NOT FOUND OR v_contract.user_id<>v_actor OR v_contract.profile_id<>p_profile_id
     OR v_contract.status<>'pending' OR v_contract.expires_at IS NULL
     OR v_contract.expires_at<=now()
  THEN RAISE EXCEPTION 'modeling_offer_unavailable'; END IF;
  SELECT * INTO v_terms FROM public.modeling_offer_terms
  WHERE contract_id=p_offer_id AND profile_id=p_profile_id FOR UPDATE;
  IF NOT FOUND OR v_terms.compensation_amount IS DISTINCT FROM v_contract.compensation
    OR v_terms.fame_amount IS DISTINCT FROM COALESCE(v_contract.fame_boost,0)
  THEN RAISE EXCEPTION 'modeling_offer_terms_unverified'; END IF;
  SELECT * INTO v_gig FROM public.modeling_gigs WHERE id=v_contract.gig_id;
  IF NOT FOUND OR p_end-p_start<>make_interval(hours=>COALESCE(v_gig.duration_hours,2))
  THEN RAISE EXCEPTION 'modeling_invalid_shoot_duration'; END IF;
  -- The legacy check_scheduling_conflict uses an unqualified table name and
  -- fails under a hardened empty search_path. Check the canonical rows here.
  IF EXISTS (
    SELECT 1 FROM public.player_scheduled_activities a
    WHERE a.user_id=v_actor AND a.status IN ('scheduled','in_progress')
      AND a.scheduled_start<p_end AND a.scheduled_end>p_start
  ) THEN
    RAISE EXCEPTION 'modeling_schedule_conflict';
  END IF;

  INSERT INTO public.player_scheduled_activities
    (user_id,profile_id,activity_type,scheduled_start,scheduled_end,
     status,title,description,metadata)
  VALUES(v_actor,p_profile_id,'pr_appearance',p_start,p_end,'scheduled',
    'Modeling: '||v_gig.title,COALESCE(v_gig.description,'Modeling shoot'),
    jsonb_build_object('modeling_contract_id',p_offer_id,'gig_id',v_gig.id,
      'gig_type',v_gig.gig_type))
  RETURNING id INTO v_activity;

  UPDATE public.player_modeling_contracts SET
    status='accepted',shoot_date=p_shoot_date,scheduled_start=p_start,
    scheduled_end=p_end,booking_activity_id=v_activity
  WHERE id=p_offer_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'modeling_contract_state_changed'; END IF;
  RETURN jsonb_build_object('booked',true,'activity_id',v_activity,
    'contract_id',p_offer_id,'compensation_amount',v_terms.compensation_amount);
END $fn$;

CREATE OR REPLACE FUNCTION public.settle_modeling_contract_atomic(
  p_activity_id uuid,p_contract_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_activity public.player_scheduled_activities%rowtype;
  v_contract public.player_modeling_contracts%rowtype;
  v_terms public.modeling_offer_terms%rowtype;
  v_previous public.modeling_contract_settlements%rowtype;
BEGIN
  SELECT * INTO v_activity FROM public.player_scheduled_activities
  WHERE id=p_activity_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('settled',false,'reason','schedule_missing'); END IF;
  IF v_activity.activity_type<>'pr_appearance'
    OR v_activity.metadata->>'modeling_contract_id' IS DISTINCT FROM p_contract_id::text
  THEN RAISE EXCEPTION 'modeling_settlement_schedule_mismatch'; END IF;
  SELECT * INTO v_contract FROM public.player_modeling_contracts
  WHERE id=p_contract_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('settled',false,'reason','contract_missing'); END IF;
  IF v_contract.user_id<>v_activity.user_id OR v_contract.profile_id<>v_activity.profile_id
    OR v_contract.booking_activity_id IS DISTINCT FROM p_activity_id
    OR v_contract.scheduled_start IS DISTINCT FROM v_activity.scheduled_start
    OR v_contract.scheduled_end IS DISTINCT FROM v_activity.scheduled_end
  THEN RAISE EXCEPTION 'modeling_settlement_identity_mismatch'; END IF;

  SELECT * INTO v_previous FROM public.modeling_contract_settlements
  WHERE contract_id=p_contract_id;
  IF FOUND THEN
    IF v_previous.activity_id<>p_activity_id THEN
      RAISE EXCEPTION 'modeling_settlement_replayed_with_different_activity'; END IF;
    RETURN jsonb_build_object('settled',false,'reason','already_settled');
  END IF;
  IF v_activity.status<>'in_progress' OR v_activity.scheduled_end>now()
    OR v_contract.status NOT IN ('accepted','shooting') THEN
    RETURN jsonb_build_object('settled',false,'reason','schedule_not_due'); END IF;
  SELECT * INTO v_terms FROM public.modeling_offer_terms
  WHERE contract_id=p_contract_id AND profile_id=v_contract.profile_id;
  IF NOT FOUND OR v_terms.compensation_amount IS DISTINCT FROM v_contract.compensation
    OR v_terms.fame_amount IS DISTINCT FROM COALESCE(v_contract.fame_boost,0)
  THEN RAISE EXCEPTION 'modeling_settlement_unverified_terms'; END IF;

  PERFORM 1 FROM public.profiles WHERE id=v_contract.profile_id
    AND user_id=v_contract.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'modeling_settlement_profile_missing'; END IF;
  INSERT INTO public.modeling_contract_settlements
    (contract_id,activity_id,user_id,profile_id,compensation_amount,fame_amount)
  VALUES(p_contract_id,p_activity_id,v_contract.user_id,v_contract.profile_id,
    v_terms.compensation_amount,v_terms.fame_amount);
  UPDATE public.profiles SET cash=cash+v_terms.compensation_amount,
    fame=fame+v_terms.fame_amount,updated_at=now()
  WHERE id=v_contract.profile_id AND user_id=v_contract.user_id;
  UPDATE public.player_modeling_contracts SET status='completed',completed_at=now()
  WHERE id=p_contract_id AND status IN ('accepted','shooting');
  IF NOT FOUND THEN RAISE EXCEPTION 'modeling_settlement_contract_state_changed'; END IF;
  UPDATE public.player_scheduled_activities SET status='completed',
    completed_at=now(),metadata=COALESCE(metadata,'{}'::jsonb)
      ||jsonb_build_object('modeling_settlement_contract_id',p_contract_id)
  WHERE id=p_activity_id AND status='in_progress';
  IF NOT FOUND THEN RAISE EXCEPTION 'modeling_settlement_schedule_state_changed'; END IF;
  RETURN jsonb_build_object('settled',true,'contract_id',p_contract_id,
    'activity_id',p_activity_id,'compensation_amount',v_terms.compensation_amount,
    'fame_amount',v_terms.fame_amount);
END $fn$;

REVOKE ALL ON FUNCTION public.generate_modeling_offers_secure(uuid),
  public.decline_modeling_offer_secure(uuid),
  public.book_modeling_offer_atomic(uuid,uuid,timestamptz,timestamptz,date),
  public.settle_modeling_contract_atomic(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_modeling_offers_secure(uuid),
  public.decline_modeling_offer_secure(uuid),
  public.book_modeling_offer_atomic(uuid,uuid,timestamptz,timestamptz,date)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_modeling_contract_atomic(uuid,uuid)
  TO service_role;

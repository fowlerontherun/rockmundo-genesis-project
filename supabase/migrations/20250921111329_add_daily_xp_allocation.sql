-- Daily XP stipend and spend procedures

CREATE TABLE IF NOT EXISTS public.profile_daily_xp_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  grant_date date NOT NULL,
  xp_awarded integer NOT NULL CHECK (xp_awarded > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  claimed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT profile_daily_xp_grants_unique_day UNIQUE (profile_id, grant_date),
  CONSTRAINT profile_daily_xp_grants_metadata_object CHECK (
    metadata IS NULL OR jsonb_typeof(metadata) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_profile_daily_xp_grants_profile
  ON public.profile_daily_xp_grants (profile_id, grant_date DESC);


CREATE OR REPLACE FUNCTION public.progression_claim_daily_xp(
  p_profile_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_wallet public.player_xp_wallet%ROWTYPE;
  v_today date := (timezone('utc', now()))::date;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_amount integer := 150;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % does not exist', p_profile_id
      USING ERRCODE = 'PGRST116';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profile_daily_xp_grants g
    WHERE g.profile_id = p_profile_id
      AND g.grant_date = v_today
  ) THEN
    RAISE EXCEPTION 'Daily XP already claimed for %', v_today
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.player_xp_wallet (profile_id)
  VALUES (p_profile_id)
  ON CONFLICT (profile_id) DO NOTHING;

  UPDATE public.player_xp_wallet
  SET
    xp_balance = GREATEST(xp_balance + v_amount, 0),
    lifetime_xp = lifetime_xp + GREATEST(v_amount, 0),
    last_recalculated = timezone('utc', now())
  WHERE profile_id = p_profile_id
  RETURNING * INTO v_wallet;

  INSERT INTO public.profile_daily_xp_grants (
    profile_id,
    grant_date,
    xp_awarded,
    metadata
  )
  VALUES (
    p_profile_id,
    v_today,
    v_amount,
    v_metadata || jsonb_build_object('grant_date', v_today)
  );

  INSERT INTO public.xp_ledger (
    profile_id,
    event_type,
    xp_delta,
    balance_after,
    attribute_points_delta,
    skill_points_delta,
    metadata
  )
  VALUES (
    p_profile_id,
    'daily_stipend',
    v_amount,
    COALESCE(v_wallet.xp_balance, 0),
    0,
    0,
    v_metadata || jsonb_build_object('grant_date', v_today)
  );

  RETURN jsonb_build_object(
    'message', format('Daily stipend granted (%s XP)', v_amount),
    'xp_awarded', v_amount,
    'grant_date', v_today
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.progression_claim_daily_xp(uuid, jsonb)
TO service_role;


CREATE OR REPLACE FUNCTION public.progression_spend_attribute_xp(
  p_profile_id uuid,
  p_attribute_key text,
  p_xp integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.player_xp_wallet%ROWTYPE;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_current_value integer := 0;
  v_capacity integer := 0;
  v_spend integer := 0;
  v_new_value integer := 0;
  v_allowed text[] := ARRAY[
    'physical_endurance','mental_focus','stage_presence','crowd_engagement','social_reach',
    'creativity','technical','business','marketing','composition','musical_ability','vocal_talent',
    'rhythm_sense','creative_insight','technical_mastery','business_acumen','marketing_savvy'
  ];
BEGIN
  IF p_attribute_key IS NULL OR NOT (p_attribute_key = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Attribute % is not eligible for XP spending', p_attribute_key
      USING ERRCODE = 'P0001';
  END IF;

  IF p_xp IS NULL OR p_xp <= 0 THEN
    RAISE EXCEPTION 'XP amount must be positive'
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_wallet
  FROM public.player_xp_wallet
  WHERE profile_id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'XP wallet not found for profile %', p_profile_id
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(v_wallet.xp_balance, 0) < p_xp THEN
    RAISE EXCEPTION 'Insufficient XP balance (% required, % available)', p_xp, v_wallet.xp_balance
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.player_attributes (profile_id)
  VALUES (p_profile_id)
  ON CONFLICT (profile_id) DO NOTHING;

  EXECUTE format(
    'SELECT COALESCE(%1$I, 0) FROM public.player_attributes WHERE profile_id = $1',
    p_attribute_key
  )
  INTO v_current_value
  USING p_profile_id;

  v_capacity := LEAST(1000, v_current_value + p_xp) - v_current_value;

  IF v_capacity <= 0 THEN
    RAISE EXCEPTION 'Attribute % is already at the maximum value', p_attribute_key
      USING ERRCODE = 'P0001';
  END IF;

  v_spend := LEAST(p_xp, v_capacity);
  v_new_value := v_current_value + v_spend;

  INSERT INTO public.profile_attribute_transactions (
    profile_id,
    transaction_type,
    attribute_key,
    points_delta,
    attribute_value_delta,
    xp_delta,
    metadata
  )
  VALUES (
    p_profile_id,
    'daily_spend',
    p_attribute_key,
    0,
    v_spend,
    -v_spend,
    v_metadata || jsonb_build_object('requested_xp', p_xp, 'applied_xp', v_spend)
  );

  RETURN jsonb_build_object(
    'attribute_key', p_attribute_key,
    'xp_spent', v_spend,
    'new_value', v_new_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.progression_spend_attribute_xp(uuid, text, integer, jsonb)
TO service_role;


CREATE OR REPLACE FUNCTION public.progression_spend_skill_xp(
  p_profile_id uuid,
  p_skill_slug text,
  p_xp integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.player_xp_wallet%ROWTYPE;
  v_skill public.skill_progress%ROWTYPE;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_skill_slug IS NULL OR btrim(p_skill_slug) = '' THEN
    RAISE EXCEPTION 'Skill slug is required for XP spend'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_xp IS NULL OR p_xp <= 0 THEN
    RAISE EXCEPTION 'XP amount must be positive'
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_wallet
  FROM public.player_xp_wallet
  WHERE profile_id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'XP wallet not found for profile %', p_profile_id
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(v_wallet.xp_balance, 0) < p_xp THEN
    RAISE EXCEPTION 'Insufficient XP balance (% required, % available)', p_xp, v_wallet.xp_balance
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.skill_progress (
    profile_id,
    skill_slug,
    current_level,
    current_xp,
    required_xp,
    last_practiced_at
  )
  VALUES (
    p_profile_id,
    p_skill_slug,
    1,
    0,
    100,
    v_now
  )
  ON CONFLICT (profile_id, skill_slug) DO NOTHING;

  SELECT * INTO v_skill
  FROM public.skill_progress
  WHERE profile_id = p_profile_id
    AND skill_slug = p_skill_slug
  FOR UPDATE;

  UPDATE public.skill_progress
  SET
    current_xp = COALESCE(v_skill.current_xp, 0) + p_xp,
    last_practiced_at = v_now,
    updated_at = v_now,
    required_xp = COALESCE(v_skill.required_xp, 100)
  WHERE id = v_skill.id;

  UPDATE public.player_xp_wallet
  SET
    xp_balance = GREATEST(xp_balance - p_xp, 0),
    xp_spent = xp_spent + p_xp,
    last_recalculated = v_now
  WHERE profile_id = p_profile_id
  RETURNING * INTO v_wallet;

  INSERT INTO public.xp_ledger (
    profile_id,
    event_type,
    xp_delta,
    balance_after,
    attribute_points_delta,
    skill_points_delta,
    metadata
  )
  VALUES (
    p_profile_id,
    'skill_training',
    -p_xp,
    COALESCE(v_wallet.xp_balance, 0),
    0,
    0,
    v_metadata || jsonb_build_object('skill_slug', p_skill_slug)
  );

  RETURN jsonb_build_object(
    'skill_slug', p_skill_slug,
    'xp_spent', p_xp,
    'current_xp', COALESCE(v_skill.current_xp, 0) + p_xp,
    'current_level', COALESCE(v_skill.current_level, 1),
    'required_xp', COALESCE(v_skill.required_xp, 100)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.progression_spend_skill_xp(uuid, text, integer, jsonb)
TO service_role;

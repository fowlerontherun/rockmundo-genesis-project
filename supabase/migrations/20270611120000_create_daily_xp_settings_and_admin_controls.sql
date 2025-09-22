-- Daily XP configuration and admin progression controls

CREATE TABLE IF NOT EXISTS public.daily_xp_settings (
  id boolean PRIMARY KEY DEFAULT true,
  daily_xp_amount integer NOT NULL CHECK (daily_xp_amount > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT daily_xp_settings_singleton CHECK (id = true),
  CONSTRAINT daily_xp_settings_metadata_object CHECK (
    metadata IS NULL OR jsonb_typeof(metadata) = 'object'
  )
);

INSERT INTO public.daily_xp_settings (id, daily_xp_amount)
VALUES (true, 150)
ON CONFLICT (id) DO NOTHING;


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
  v_amount integer;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % does not exist', p_profile_id
      USING ERRCODE = 'PGRST116';
  END IF;

  SELECT daily_xp_amount INTO v_amount
  FROM public.daily_xp_settings
  WHERE id = true;

  v_amount := COALESCE(v_amount, 150);

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Daily XP stipend is not configured'
      USING ERRCODE = 'P0001';
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

  v_metadata := v_metadata || jsonb_build_object(
    'grant_date', v_today,
    'daily_xp_amount', v_amount
  );

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
    v_metadata
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
    v_metadata
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


CREATE OR REPLACE FUNCTION public.progression_admin_adjust_momentum(
  p_actor_user_id uuid,
  p_profile_id uuid,
  p_amount integer,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_before integer := 0;
  v_after integer := 0;
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Momentum adjustment must be a non-zero value'
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % does not exist', p_profile_id
      USING ERRCODE = 'PGRST116';
  END IF;

  v_before := COALESCE(v_profile.momentum, 0);
  v_after := GREATEST(0, LEAST(1000, v_before + p_amount));

  UPDATE public.profiles
  SET
    momentum = v_after,
    updated_at = timezone('utc', now())
  WHERE id = p_profile_id;

  v_metadata := v_metadata || jsonb_build_object(
    'adjusted_by', p_actor_user_id,
    'reason', p_reason,
    'momentum_before', v_before,
    'momentum_after', v_after,
    'momentum_delta', v_after - v_before,
    'adjusted_at', timezone('utc', now())
  );

  RETURN jsonb_build_object(
    'profile_id', p_profile_id,
    'momentum_before', v_before,
    'momentum_after', v_after,
    'momentum_delta', v_after - v_before,
    'reason', p_reason,
    'metadata', v_metadata
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.progression_admin_adjust_momentum(uuid, uuid, integer, text, jsonb)
TO service_role;


CREATE OR REPLACE FUNCTION public.progression_admin_set_daily_xp(
  p_actor_user_id uuid,
  p_new_amount integer,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.daily_xp_settings%ROWTYPE;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_previous integer := NULL;
BEGIN
  IF p_new_amount IS NULL OR p_new_amount <= 0 THEN
    RAISE EXCEPTION 'Daily XP amount must be a positive integer'
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_settings
  FROM public.daily_xp_settings
  WHERE id = true
  FOR UPDATE;

  IF FOUND THEN
    v_previous := v_settings.daily_xp_amount;
  END IF;

  v_metadata := v_metadata || jsonb_build_object(
    'updated_by', p_actor_user_id,
    'reason', p_reason,
    'updated_at', timezone('utc', now()),
    'previous_amount', v_previous,
    'daily_xp_amount', p_new_amount
  );

  INSERT INTO public.daily_xp_settings AS s (
    id,
    daily_xp_amount,
    metadata,
    updated_at
  )
  VALUES (
    true,
    p_new_amount,
    v_metadata,
    timezone('utc', now())
  )
  ON CONFLICT (id) DO UPDATE
  SET
    daily_xp_amount = EXCLUDED.daily_xp_amount,
    metadata = EXCLUDED.metadata,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_settings;

  RETURN jsonb_build_object(
    'previous_amount', v_previous,
    'daily_xp_amount', v_settings.daily_xp_amount,
    'updated_at', v_settings.updated_at,
    'metadata', v_settings.metadata
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.progression_admin_set_daily_xp(uuid, integer, text, jsonb)
TO service_role;


NOTIFY pgrst, 'reload schema';

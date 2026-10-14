-- #3877-#3879: one server-calculated daily stipend per character and UTC day.
-- Forward-only repair of an unapplied migration. Both activity bonuses and
-- stipend grants use this table, so the uniqueness rule MUST be source-scoped.
-- Preflight: zero duplicate (profile_id, grant_date) pairs for source=daily_stipend.
CREATE UNIQUE INDEX IF NOT EXISTS profile_daily_xp_grants_one_stipend_per_day
  ON public.profile_daily_xp_grants(profile_id, grant_date)
  WHERE source = 'daily_stipend';

-- Never accept SXP/AP amounts, VIP status, streak or reward metadata from a
-- browser/Edge request. Postgres computes the award under the locked wallet.
CREATE OR REPLACE FUNCTION public.claim_daily_stipend_atomic(
  p_profile_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_wallet public.player_xp_wallet%ROWTYPE;
  v_streak integer;
  v_base_ap integer;
  v_bonus_sxp integer := 0;
  v_bonus_ap integer := 0;
  v_pre_cap_sxp integer;
  v_pre_cap_ap integer;
  v_is_vip boolean;
  v_sxp integer;
  v_ap integer;
  v_milestones integer[] := ARRAY[]::integer[];
BEGIN
  IF v_user_id IS NULL OR p_profile_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_profile_id AND user_id = v_user_id
      AND is_active IS TRUE AND deleted_at IS NULL AND died_at IS NULL
  ) THEN
    RAISE EXCEPTION 'PROFILE_NOT_OWNED' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.player_xp_wallet(profile_id) VALUES (p_profile_id)
    ON CONFLICT (profile_id) DO NOTHING;
  SELECT * INTO v_wallet FROM public.player_xp_wallet
    WHERE profile_id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STIPEND_WALLET_MISSING';
  END IF;

  -- The wallet lock serializes simultaneous claims; the partial UNIQUE index
  -- also protects against different grant paths using this stipend source.
  IF v_wallet.last_stipend_claim_date = v_today OR EXISTS (
    SELECT 1 FROM public.profile_daily_xp_grants
    WHERE profile_id = p_profile_id AND grant_date = v_today
      AND source = 'daily_stipend'
  ) THEN
    RAISE EXCEPTION 'DAILY_STIPEND_ALREADY_CLAIMED';
  END IF;

  v_streak := CASE
    WHEN v_wallet.last_stipend_claim_date = v_today - 1
      THEN greatest(0, coalesce(v_wallet.stipend_claim_streak, 0)) + 1
    ELSE 1
  END;
  v_base_ap := 1 + floor(random() * 10)::integer;

  IF v_streak >= 7 THEN
    v_bonus_sxp := v_bonus_sxp + 150;
    v_bonus_ap := v_bonus_ap + 2;
    v_milestones := array_append(v_milestones, 7);
  END IF;
  IF v_streak >= 14 THEN
    v_bonus_sxp := v_bonus_sxp + 300;
    v_bonus_ap := v_bonus_ap + 3;
    v_milestones := array_append(v_milestones, 14);
  END IF;
  IF v_streak >= 30 THEN
    v_bonus_sxp := v_bonus_sxp + 500;
    v_bonus_ap := v_bonus_ap + 5;
    v_milestones := array_append(v_milestones, 30);
  END IF;
  IF v_streak >= 100 THEN
    v_bonus_sxp := v_bonus_sxp + 1000;
    v_bonus_ap := v_bonus_ap + 8;
    v_milestones := array_append(v_milestones, 100);
  END IF;
  IF v_streak >= 365 THEN
    v_bonus_sxp := v_bonus_sxp + 2000;
    v_bonus_ap := v_bonus_ap + 12;
    v_milestones := array_append(v_milestones, 365);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.vip_subscriptions
    WHERE user_id = v_user_id AND status = 'active'
      AND starts_at <= now() AND expires_at > now()
  ) INTO v_is_vip;

  v_pre_cap_sxp := 600 + v_bonus_sxp;
  v_pre_cap_ap := v_base_ap + v_bonus_ap;
  v_sxp := least(2000, v_pre_cap_sxp
    + CASE WHEN v_is_vip THEN round(v_pre_cap_sxp * 0.25)::integer ELSE 0 END);
  v_ap := least(30, v_pre_cap_ap
    + CASE WHEN v_is_vip THEN round(v_pre_cap_ap * 0.25)::integer ELSE 0 END);

  INSERT INTO public.profile_daily_xp_grants(
    profile_id, grant_date, xp_amount, source, attribute_points_amount, metadata
  ) VALUES (
    p_profile_id, v_today, v_sxp, 'daily_stipend', v_ap,
    jsonb_build_object(
      'streak', v_streak,
      'base_sxp', 600,
      'base_ap', v_base_ap,
      'bonus_sxp', v_bonus_sxp,
      'bonus_ap', v_bonus_ap,
      'is_vip', v_is_vip,
      'vip_bonus_sxp', CASE WHEN v_is_vip THEN round(v_pre_cap_sxp * 0.25)::integer ELSE 0 END,
      'vip_bonus_ap', CASE WHEN v_is_vip THEN round(v_pre_cap_ap * 0.25)::integer ELSE 0 END,
      'total_sxp', v_sxp,
      'total_ap', v_ap,
      'milestones_reached', v_milestones
    )
  );

  UPDATE public.player_xp_wallet SET
    skill_xp_balance = coalesce(skill_xp_balance, 0) + v_sxp,
    skill_xp_lifetime = coalesce(skill_xp_lifetime, 0) + v_sxp,
    xp_balance = coalesce(xp_balance, 0) + v_sxp,
    lifetime_xp = coalesce(lifetime_xp, 0) + v_sxp,
    attribute_points_balance = coalesce(attribute_points_balance, 0) + v_ap,
    attribute_points_lifetime = coalesce(attribute_points_lifetime, 0) + v_ap,
    attribute_points_earned = coalesce(attribute_points_earned, 0) + v_ap,
    stipend_claim_streak = v_streak,
    last_stipend_claim_date = v_today,
    last_recalculated = now()
  WHERE profile_id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STIPEND_WALLET_UPDATE_FAILED';
  END IF;

  RETURN jsonb_build_object(
    'date', v_today, 'streak', v_streak, 'sxp', v_sxp,
    'ap', v_ap, 'is_vip', v_is_vip
  );
END;
$$;
REVOKE ALL ON FUNCTION public.claim_daily_stipend_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_stipend_atomic(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';

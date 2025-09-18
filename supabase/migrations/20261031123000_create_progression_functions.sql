-- Progression RPCs used by the Edge Function for XP and attribute management

-- Helper constant lists reused in multiple routines
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'progression_attribute_key'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.progression_attribute_key AS ENUM (
      'physical_endurance',
      'mental_focus',
      'stage_presence',
      'crowd_engagement',
      'social_reach',
      'creativity',
      'technical',
      'business',
      'marketing',
      'composition',
      'musical_ability',
      'vocal_talent',
      'rhythm_sense',
      'creative_insight',
      'technical_mastery',
      'business_acumen',
      'marketing_savvy'
    );
  END IF;
END;
$$;

-- Action XP awards ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.progression_award_action_xp(
  p_profile_id uuid,
  p_amount integer,
  p_category text DEFAULT 'general',
  p_action_key text DEFAULT 'gameplay_action',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_category text := COALESCE(NULLIF(btrim(p_category), ''), 'general');
  v_action_key text := COALESCE(NULLIF(btrim(p_action_key), ''), 'gameplay_action');
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_unique_event_id text := NULLIF(v_metadata->>'unique_event_id', '');
  v_daily_cap integer := 75000;
  v_weekly_cap integer := 300000;
  v_max_single integer := 5000;
  v_totals record;
  v_event_id uuid;
  v_event_time timestamptz;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % does not exist', p_profile_id
      USING ERRCODE = 'PGRST116';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'XP amount must be a positive integer'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_amount > v_max_single THEN
    RAISE EXCEPTION 'Single action XP awards are limited to %', v_max_single
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_totals
  FROM public.get_profile_action_xp_totals(p_profile_id, 'action_xp');

  IF v_totals.day_xp + p_amount > v_daily_cap THEN
    RAISE EXCEPTION 'Daily action XP cap of % exceeded', v_daily_cap
      USING ERRCODE = '23514';
  END IF;

  IF v_totals.week_xp + p_amount > v_weekly_cap THEN
    RAISE EXCEPTION 'Weekly action XP cap of % exceeded', v_weekly_cap
      USING ERRCODE = '23514';
  END IF;

  IF v_unique_event_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.xp_ledger l
    WHERE l.profile_id = p_profile_id
      AND l.event_type = 'action_xp'
      AND l.metadata ? 'unique_event_id'
      AND l.metadata->>'unique_event_id' = v_unique_event_id
  ) THEN
    RAISE EXCEPTION 'Duplicate progression event detected for unique_event_id=%', v_unique_event_id
      USING ERRCODE = 'P0001';
  END IF;

  v_metadata := v_metadata || jsonb_build_object(
    'category', v_category,
    'action_key', v_action_key
  );

  INSERT INTO public.profile_action_xp_events (
    profile_id,
    action_type,
    xp_amount,
    metadata
  )
  VALUES (
    p_profile_id,
    'action_xp',
    p_amount,
    v_metadata
  )
  RETURNING id, occurred_at INTO v_event_id, v_event_time;

  RETURN jsonb_build_object(
    'message', format('Awarded %s XP for %s', p_amount, v_category),
    'event_id', v_event_id,
    'occurred_at', v_event_time,
    'category', v_category,
    'action_key', v_action_key,
    'amount', p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.progression_award_action_xp(uuid, integer, text, text, jsonb)
TO service_role;

-- Weekly bonus awards -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.progression_award_weekly_bonus(
  p_profile_id uuid,
  p_bonus_xp integer DEFAULT 0,
  p_attribute_points integer DEFAULT 0,
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
  v_unique_event_id text := NULLIF(v_metadata->>'unique_event_id', '');
  v_bonus_type text := COALESCE(NULLIF(v_metadata->>'bonus_type', ''), 'standard');
  v_week_start date := date_trunc('week', timezone('utc', now()))::date;
  v_max_bonus_xp integer := 20000;
  v_max_attribute_points integer := 20;
  v_claim_id uuid;
  v_claimed_at timestamptz;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % does not exist', p_profile_id
      USING ERRCODE = 'PGRST116';
  END IF;

  IF (p_bonus_xp IS NULL OR p_bonus_xp < 0) OR (p_attribute_points IS NULL OR p_attribute_points < 0) THEN
    RAISE EXCEPTION 'Bonus XP and attribute points must be non-negative values'
      USING ERRCODE = '22023';
  END IF;

  IF p_bonus_xp = 0 AND p_attribute_points = 0 THEN
    RAISE EXCEPTION 'Weekly bonuses must include XP or attribute points'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_bonus_xp > v_max_bonus_xp THEN
    RAISE EXCEPTION 'Weekly bonus XP cannot exceed %', v_max_bonus_xp
      USING ERRCODE = '23514';
  END IF;

  IF p_attribute_points > v_max_attribute_points THEN
    RAISE EXCEPTION 'Weekly bonus attribute points cannot exceed %', v_max_attribute_points
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profile_weekly_bonus_claims c
    WHERE c.profile_id = p_profile_id
      AND c.week_start = v_week_start
      AND c.bonus_type = v_bonus_type
  ) THEN
    RAISE EXCEPTION 'Weekly bonus already claimed for week % and type %', v_week_start, v_bonus_type
      USING ERRCODE = 'P0001';
  END IF;

  IF v_unique_event_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.xp_ledger l
    WHERE l.profile_id = p_profile_id
      AND l.event_type = 'weekly_bonus'
      AND l.metadata ? 'unique_event_id'
      AND l.metadata->>'unique_event_id' = v_unique_event_id
  ) THEN
    RAISE EXCEPTION 'Duplicate weekly bonus event detected for unique_event_id=%', v_unique_event_id
      USING ERRCODE = 'P0001';
  END IF;

  v_metadata := v_metadata || jsonb_build_object(
    'bonus_type', v_bonus_type,
    'week_start', v_week_start,
    'xp_awarded', p_bonus_xp,
    'attribute_points', p_attribute_points
  );

  INSERT INTO public.profile_weekly_bonus_claims (
    profile_id,
    week_start,
    bonus_type,
    xp_awarded,
    metadata
  )
  VALUES (
    p_profile_id,
    v_week_start,
    v_bonus_type,
    p_bonus_xp,
    v_metadata
  )
  RETURNING id, claimed_at INTO v_claim_id, v_claimed_at;

  IF p_attribute_points > 0 THEN
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
      'bonus',
      NULL,
      p_attribute_points,
      0,
      0,
      jsonb_build_object(
        'source', 'weekly_bonus',
        'bonus_claim_id', v_claim_id
      ) || v_metadata
    );
  END IF;

  RETURN jsonb_build_object(
    'message', format('Weekly bonus granted for week starting %s', v_week_start),
    'claim_id', v_claim_id,
    'claimed_at', v_claimed_at,
    'week_start', v_week_start,
    'bonus_type', v_bonus_type,
    'xp_awarded', p_bonus_xp,
    'attribute_points', p_attribute_points
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.progression_award_weekly_bonus(uuid, integer, integer, jsonb)
TO service_role;

-- Attribute star purchases ------------------------------------------------

CREATE OR REPLACE FUNCTION public.progression_buy_attribute_star(
  p_profile_id uuid,
  p_attribute_key text,
  p_points integer DEFAULT 1,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_attribute_key public.progression_attribute_key;
  v_points integer := GREATEST(p_points, 1);
  v_available_points integer;
  v_current_value integer := 0;
  v_new_value integer;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_unique_event_id text := NULLIF(v_metadata->>'unique_event_id', '');
  v_max_points_per_purchase integer := 25;
  v_transaction_id uuid;
  v_allowed text[] := ARRAY[
    'physical_endurance','mental_focus','stage_presence','crowd_engagement','social_reach',
    'creativity','technical','business','marketing','composition','musical_ability','vocal_talent',
    'rhythm_sense','creative_insight','technical_mastery','business_acumen','marketing_savvy'
  ];
BEGIN
  IF p_attribute_key IS NULL OR NOT (p_attribute_key = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Attribute key % is not recognised for upgrades', p_attribute_key
      USING ERRCODE = 'P0001';
  END IF;

  v_attribute_key := p_attribute_key::public.progression_attribute_key;

  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'Attribute star purchases require at least one point'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_points > v_max_points_per_purchase THEN
    RAISE EXCEPTION 'Cannot purchase more than % stars at once', v_max_points_per_purchase
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % does not exist', p_profile_id
      USING ERRCODE = 'PGRST116';
  END IF;

  SELECT COALESCE(attribute_points_available, 0) INTO v_available_points
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF v_available_points < v_points THEN
    RAISE EXCEPTION 'Insufficient attribute points available (% required, % present)', v_points, v_available_points
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.player_attributes (profile_id)
  VALUES (p_profile_id)
  ON CONFLICT (profile_id) DO NOTHING;

  PERFORM 1
  FROM public.player_attributes
  WHERE profile_id = p_profile_id
  FOR UPDATE;

  EXECUTE format(
    'SELECT COALESCE(%1$I, 0) FROM public.player_attributes WHERE profile_id = $1',
    p_attribute_key
  )
  INTO v_current_value
  USING p_profile_id;

  v_new_value := v_current_value + v_points;

  IF v_new_value > 1000 THEN
    RAISE EXCEPTION 'Attribute % cannot exceed 1000 (attempted %)', p_attribute_key, v_new_value
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  IF v_unique_event_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profile_attribute_transactions t
    WHERE t.profile_id = p_profile_id
      AND t.transaction_type = 'purchase'
      AND t.metadata ? 'unique_event_id'
      AND t.metadata->>'unique_event_id' = v_unique_event_id
  ) THEN
    RAISE EXCEPTION 'Duplicate attribute purchase detected for unique_event_id=%', v_unique_event_id
      USING ERRCODE = 'P0001';
  END IF;

  v_metadata := v_metadata || jsonb_build_object(
    'attribute_key', p_attribute_key,
    'points_spent', v_points
  );

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
    'purchase',
    p_attribute_key,
    -v_points,
    v_points,
    0,
    v_metadata
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'message', format('Purchased %s star(s) for %s', v_points, p_attribute_key),
    'transaction_id', v_transaction_id,
    'attribute_key', p_attribute_key,
    'points_spent', v_points,
    'new_value', v_new_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.progression_buy_attribute_star(uuid, text, integer, jsonb)
TO service_role;

-- Attribute respec --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.progression_respec_attributes(
  p_profile_id uuid,
  p_distribution jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_attributes public.player_attributes%ROWTYPE;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_unique_event_id text := NULLIF(v_metadata->>'unique_event_id', '');
  v_allowed text[] := ARRAY[
    'physical_endurance','mental_focus','stage_presence','crowd_engagement','social_reach',
    'creativity','technical','business','marketing','composition','musical_ability','vocal_talent',
    'rhythm_sense','creative_insight','technical_mastery','business_acumen','marketing_savvy'
  ];
  v_entry record;
  v_normalized jsonb := '{}'::jsonb;
  v_target_total integer := 0;
  v_budget integer := 0;
  v_respec_id uuid;
  v_remaining integer;
BEGIN
  IF jsonb_typeof(p_distribution) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Attribute distribution must be a JSON object'
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

  INSERT INTO public.player_attributes (profile_id)
  VALUES (p_profile_id)
  ON CONFLICT (profile_id) DO NOTHING;

  SELECT * INTO v_attributes
  FROM public.player_attributes
  WHERE profile_id = p_profile_id
  FOR UPDATE;

  IF jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  FOR v_entry IN
    SELECT key, value
    FROM jsonb_each(p_distribution)
  LOOP
    IF NOT (v_entry.key = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'Attribute % is not valid for respec', v_entry.key
        USING ERRCODE = 'P0001';
    END IF;

    IF jsonb_typeof(v_entry.value) <> 'number' THEN
      RAISE EXCEPTION 'Attribute % must map to a numeric value', v_entry.key
        USING ERRCODE = '22023';
    END IF;

    IF (v_entry.value::text)::numeric < 0 THEN
      RAISE EXCEPTION 'Attribute % cannot be negative', v_entry.key
        USING ERRCODE = '23514';
    END IF;

    v_normalized := v_normalized || jsonb_build_object(
      v_entry.key,
      LEAST(1000, floor((v_entry.value::text)::numeric))
    );
    v_target_total := v_target_total + LEAST(1000, floor((v_entry.value::text)::numeric))::integer;
  END LOOP;

  IF v_target_total = 0 THEN
    RAISE EXCEPTION 'Respec distribution must allocate at least one point'
      USING ERRCODE = 'P0001';
  END IF;

  v_budget := GREATEST(COALESCE(v_profile.attribute_points_available, 0), 0)
    + GREATEST(COALESCE(v_attributes.attribute_points_spent, 0), 0);

  IF v_target_total > v_budget THEN
    RAISE EXCEPTION 'Requested allocation % exceeds available budget %', v_target_total, v_budget
      USING ERRCODE = '23514';
  END IF;

  IF v_unique_event_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profile_respec_events r
    WHERE r.profile_id = p_profile_id
      AND r.metadata ? 'unique_event_id'
      AND r.metadata->>'unique_event_id' = v_unique_event_id
  ) THEN
    RAISE EXCEPTION 'Duplicate respec detected for unique_event_id=%', v_unique_event_id
      USING ERRCODE = 'P0001';
  END IF;

  v_metadata := v_metadata || jsonb_build_object(
    'target_total', v_target_total,
    'attribute_budget', v_budget
  );

  INSERT INTO public.profile_respec_events (
    profile_id,
    attribute_points_refunded,
    skill_points_refunded,
    xp_refunded,
    reset_reason,
    metadata,
    initiated_by
  )
  VALUES (
    p_profile_id,
    GREATEST(COALESCE(v_attributes.attribute_points_spent, 0), 0),
    0,
    0,
    'player_respec',
    v_metadata,
    auth.uid()
  )
  RETURNING id INTO v_respec_id;

  UPDATE public.player_attributes
  SET
    physical_endurance = 0,
    mental_focus = 0,
    stage_presence = 0,
    crowd_engagement = 0,
    social_reach = 0,
    creativity = 0,
    technical = 0,
    business = 0,
    marketing = 0,
    composition = 0,
    musical_ability = 0,
    vocal_talent = 0,
    rhythm_sense = 0,
    creative_insight = 0,
    technical_mastery = 0,
    business_acumen = 0,
    marketing_savvy = 0,
    updated_at = timezone('utc', now())
  WHERE profile_id = p_profile_id;

  SELECT attribute_points INTO v_remaining
  FROM public.player_attributes
  WHERE profile_id = p_profile_id
  FOR UPDATE;

  FOR v_entry IN
    SELECT key, value
    FROM jsonb_each(v_normalized)
  LOOP
    IF (v_entry.value::text)::integer = 0 THEN
      CONTINUE;
    END IF;

    IF v_remaining < (v_entry.value::text)::integer THEN
      RAISE EXCEPTION 'Insufficient points remaining to allocate % to %', (v_entry.value::text)::integer, v_entry.key
        USING ERRCODE = '23514';
    END IF;

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
      'respec_spend',
      v_entry.key,
      -(v_entry.value::text)::integer,
      (v_entry.value::text)::integer,
      0,
      jsonb_build_object('respec_event_id', v_respec_id) || v_metadata
    );

    v_remaining := v_remaining - (v_entry.value::text)::integer;
  END LOOP;

  RETURN jsonb_build_object(
    'message', 'Attributes redistributed successfully',
    'respec_event_id', v_respec_id,
    'allocated_points', v_target_total,
    'remaining_points', v_remaining,
    'distribution', v_normalized
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.progression_respec_attributes(uuid, jsonb, jsonb)
TO service_role;

-- Special XP awards -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.progression_award_special_xp(
  p_profile_id uuid,
  p_amount integer,
  p_bonus_type text DEFAULT 'special',
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
  v_bonus_type text := COALESCE(NULLIF(btrim(p_bonus_type), ''), 'special');
  v_unique_event_id text := NULLIF(v_metadata->>'unique_event_id', '');
  v_totals record;
  v_daily_cap integer := 100000;
  v_weekly_cap integer := 400000;
  v_max_single integer := 25000;
  v_event_id uuid;
  v_event_time timestamptz;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % does not exist', p_profile_id
      USING ERRCODE = 'PGRST116';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Special XP awards must be positive'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_amount > v_max_single THEN
    RAISE EXCEPTION 'Special XP awards cannot exceed %', v_max_single
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_totals
  FROM public.get_profile_action_xp_totals(p_profile_id, 'special_xp');

  IF v_totals.day_xp + p_amount > v_daily_cap THEN
    RAISE EXCEPTION 'Daily special XP cap of % exceeded', v_daily_cap
      USING ERRCODE = '23514';
  END IF;

  IF v_totals.week_xp + p_amount > v_weekly_cap THEN
    RAISE EXCEPTION 'Weekly special XP cap of % exceeded', v_weekly_cap
      USING ERRCODE = '23514';
  END IF;

  IF v_unique_event_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.xp_ledger l
    WHERE l.profile_id = p_profile_id
      AND l.event_type = 'special_xp'
      AND l.metadata ? 'unique_event_id'
      AND l.metadata->>'unique_event_id' = v_unique_event_id
  ) THEN
    RAISE EXCEPTION 'Duplicate special XP event detected for unique_event_id=%', v_unique_event_id
      USING ERRCODE = 'P0001';
  END IF;

  v_metadata := v_metadata || jsonb_build_object('bonus_type', v_bonus_type);

  INSERT INTO public.profile_action_xp_events (
    profile_id,
    action_type,
    xp_amount,
    metadata
  )
  VALUES (
    p_profile_id,
    'special_xp',
    p_amount,
    v_metadata
  )
  RETURNING id, occurred_at INTO v_event_id, v_event_time;

  RETURN jsonb_build_object(
    'message', format('Special XP (%s) granted: %s', v_bonus_type, p_amount),
    'event_id', v_event_id,
    'occurred_at', v_event_time,
    'bonus_type', v_bonus_type,
    'amount', p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.progression_award_special_xp(uuid, integer, text, jsonb)
TO service_role;

-- Align ledger event typing across triggers -------------------------------

CREATE OR REPLACE FUNCTION public.apply_profile_weekly_bonus()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet public.player_xp_wallet%ROWTYPE;
  v_xp integer := COALESCE(NEW.xp_awarded, 0);
BEGIN
  IF v_xp = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.player_xp_wallet (profile_id)
  VALUES (NEW.profile_id)
  ON CONFLICT (profile_id) DO NOTHING;

  UPDATE public.player_xp_wallet
  SET
    xp_balance = GREATEST(xp_balance + v_xp, 0),
    lifetime_xp = lifetime_xp + GREATEST(v_xp, 0),
    last_recalculated = timezone('utc', now())
  WHERE profile_id = NEW.profile_id
  RETURNING * INTO v_wallet;

  IF NOT FOUND THEN
    SELECT * INTO v_wallet
    FROM public.player_xp_wallet
    WHERE profile_id = NEW.profile_id;
  END IF;

  UPDATE public.profiles
  SET experience = GREATEST(COALESCE(experience, 0) + v_xp, 0)
  WHERE id = NEW.profile_id;

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
    NEW.profile_id,
    'weekly_bonus',
    v_xp,
    COALESCE(v_wallet.xp_balance, 0),
    0,
    0,
    NEW.metadata
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_profile_respec_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet public.player_xp_wallet%ROWTYPE;
  v_attr integer := COALESCE(NEW.attribute_points_refunded, 0);
  v_skill integer := COALESCE(NEW.skill_points_refunded, 0);
  v_xp integer := COALESCE(NEW.xp_refunded, 0);
BEGIN
  INSERT INTO public.player_xp_wallet (profile_id)
  VALUES (NEW.profile_id)
  ON CONFLICT (profile_id) DO NOTHING;

  UPDATE public.player_xp_wallet
  SET
    xp_balance = GREATEST(xp_balance + v_xp, 0),
    xp_spent = GREATEST(xp_spent - GREATEST(v_xp, 0), 0),
    last_recalculated = timezone('utc', now())
  WHERE profile_id = NEW.profile_id
  RETURNING * INTO v_wallet;

  IF NOT FOUND THEN
    SELECT * INTO v_wallet
    FROM public.player_xp_wallet
    WHERE profile_id = NEW.profile_id;
  END IF;

  UPDATE public.profiles
  SET
    attribute_points_available = GREATEST(COALESCE(attribute_points_available, 0) + v_attr, 0),
    skill_points_available = GREATEST(COALESCE(skill_points_available, 0) + v_skill, 0),
    experience = GREATEST(COALESCE(experience, 0) + v_xp, 0)
  WHERE id = NEW.profile_id;

  INSERT INTO public.player_attributes (profile_id)
  VALUES (NEW.profile_id)
  ON CONFLICT (profile_id) DO NOTHING;

  UPDATE public.player_attributes
  SET
    attribute_points = GREATEST(attribute_points + v_attr, 0),
    attribute_points_spent = GREATEST(attribute_points_spent - v_attr, 0),
    updated_at = timezone('utc', now())
  WHERE profile_id = NEW.profile_id;

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
    NEW.profile_id,
    'attribute_respec',
    v_xp,
    COALESCE(v_wallet.xp_balance, 0),
    v_attr,
    v_skill,
    NEW.metadata
  );

  RETURN NEW;
END;
$$;

-- Smoke tests -------------------------------------------------------------

DO $$
DECLARE
  v_profile_id uuid;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE NOTICE 'No profiles available for progression smoke tests, skipping.';
  ELSE
    PERFORM public.progression_award_action_xp(
      v_profile_id,
      10,
      'smoke_test',
      'smoke_action',
      jsonb_build_object('unique_event_id', gen_random_uuid()::text)
    );

    PERFORM public.progression_award_weekly_bonus(
      v_profile_id,
      15,
      2,
      jsonb_build_object('unique_event_id', gen_random_uuid()::text)
    );

    PERFORM public.progression_buy_attribute_star(
      v_profile_id,
      'creativity',
      1,
      jsonb_build_object('unique_event_id', gen_random_uuid()::text)
    );

    PERFORM public.progression_award_special_xp(
      v_profile_id,
      20,
      'smoke',
      jsonb_build_object('unique_event_id', gen_random_uuid()::text)
    );

    PERFORM public.progression_respec_attributes(
      v_profile_id,
      jsonb_build_object('creativity', 1, 'technical', 1),
      jsonb_build_object('unique_event_id', gen_random_uuid()::text)
    );
  END IF;
END;
$$;

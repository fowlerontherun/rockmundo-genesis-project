-- Profile progression ledgers for player-controlled XP and attribute management

CREATE TABLE IF NOT EXISTS public.profile_action_xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  xp_amount integer NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT profile_action_xp_events_non_zero_xp CHECK (xp_amount <> 0),
  CONSTRAINT profile_action_xp_events_metadata_object CHECK (
    metadata IS NULL OR jsonb_typeof(metadata) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_profile_action_xp_events_profile
  ON public.profile_action_xp_events (profile_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_action_xp_events_action
  ON public.profile_action_xp_events (action_type);

CREATE TABLE IF NOT EXISTS public.profile_weekly_bonus_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  bonus_type text NOT NULL,
  xp_awarded integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  claimed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT profile_weekly_bonus_claims_unique_week UNIQUE (profile_id, week_start, bonus_type),
  CONSTRAINT profile_weekly_bonus_claims_metadata_object CHECK (
    metadata IS NULL OR jsonb_typeof(metadata) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_profile_weekly_bonus_claims_profile
  ON public.profile_weekly_bonus_claims (profile_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_profile_weekly_bonus_claims_type
  ON public.profile_weekly_bonus_claims (bonus_type);

CREATE TABLE IF NOT EXISTS public.profile_attribute_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  attribute_key text,
  points_delta integer NOT NULL,
  attribute_value_delta integer NOT NULL DEFAULT 0,
  xp_delta integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT profile_attribute_transactions_non_zero CHECK (
    points_delta <> 0 OR attribute_value_delta <> 0 OR xp_delta <> 0
  ),
  CONSTRAINT profile_attribute_transactions_metadata_object CHECK (
    metadata IS NULL OR jsonb_typeof(metadata) = 'object'
  ),
  CONSTRAINT profile_attribute_transactions_attribute_key CHECK (
    attribute_key IS NULL OR attribute_key = ANY (
      ARRAY[
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
      ]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_profile_attribute_transactions_profile
  ON public.profile_attribute_transactions (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_attribute_transactions_attribute
  ON public.profile_attribute_transactions (attribute_key);

CREATE TABLE IF NOT EXISTS public.profile_respec_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attribute_points_refunded integer NOT NULL DEFAULT 0 CHECK (attribute_points_refunded >= 0),
  skill_points_refunded integer NOT NULL DEFAULT 0 CHECK (skill_points_refunded >= 0),
  xp_refunded integer NOT NULL DEFAULT 0,
  reset_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  initiated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT profile_respec_events_metadata_object CHECK (
    metadata IS NULL OR jsonb_typeof(metadata) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_profile_respec_events_profile
  ON public.profile_respec_events (profile_id, created_at DESC);

-- Tight row-level security policies for player owned data
ALTER TABLE public.profile_action_xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_weekly_bonus_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_attribute_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_respec_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages profile_action_xp_events"
ON public.profile_action_xp_events
FOR ALL
USING (auth.role() IN ('service_role', 'supabase_admin'))
WITH CHECK (auth.role() IN ('service_role', 'supabase_admin'));

CREATE POLICY "Players read their action xp events"
ON public.profile_action_xp_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_action_xp_events.profile_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Players record their action xp events"
ON public.profile_action_xp_events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_action_xp_events.profile_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Service role manages profile_weekly_bonus_claims"
ON public.profile_weekly_bonus_claims
FOR ALL
USING (auth.role() IN ('service_role', 'supabase_admin'))
WITH CHECK (auth.role() IN ('service_role', 'supabase_admin'));

CREATE POLICY "Players read their weekly bonus claims"
ON public.profile_weekly_bonus_claims
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_weekly_bonus_claims.profile_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Players claim their weekly bonus"
ON public.profile_weekly_bonus_claims
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_weekly_bonus_claims.profile_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Service role manages profile_attribute_transactions"
ON public.profile_attribute_transactions
FOR ALL
USING (auth.role() IN ('service_role', 'supabase_admin'))
WITH CHECK (auth.role() IN ('service_role', 'supabase_admin'));

CREATE POLICY "Players read their attribute transactions"
ON public.profile_attribute_transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_attribute_transactions.profile_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Players record their attribute transactions"
ON public.profile_attribute_transactions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_attribute_transactions.profile_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Service role manages profile_respec_events"
ON public.profile_respec_events
FOR ALL
USING (auth.role() IN ('service_role', 'supabase_admin'))
WITH CHECK (auth.role() IN ('service_role', 'supabase_admin'));

CREATE POLICY "Players read their respec events"
ON public.profile_respec_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_respec_events.profile_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Players request their respec events"
ON public.profile_respec_events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_respec_events.profile_id
      AND p.user_id = auth.uid()
  )
);

-- Views and helper functions for enforcement of cadence caps
CREATE OR REPLACE VIEW public.profile_action_xp_daily_totals AS
SELECT
  e.profile_id,
  e.action_type,
  date_trunc('day', e.occurred_at)::date AS activity_date,
  SUM(e.xp_amount) AS total_xp,
  COUNT(*) AS event_count
FROM public.profile_action_xp_events e
GROUP BY e.profile_id, e.action_type, date_trunc('day', e.occurred_at)::date;

CREATE OR REPLACE VIEW public.profile_action_xp_weekly_totals AS
SELECT
  e.profile_id,
  e.action_type,
  date_trunc('week', e.occurred_at)::date AS week_start,
  SUM(e.xp_amount) AS total_xp,
  COUNT(*) AS event_count
FROM public.profile_action_xp_events e
GROUP BY e.profile_id, e.action_type, date_trunc('week', e.occurred_at)::date;

CREATE OR REPLACE FUNCTION public.get_profile_action_xp_totals(
  p_profile_id uuid,
  p_action text,
  p_reference timestamptz DEFAULT timezone('utc', now())
)
RETURNS TABLE (
  day_xp integer,
  day_events integer,
  week_xp integer,
  week_events integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_day_start timestamptz := date_trunc('day', timezone('utc', p_reference));
  v_week_start timestamptz := date_trunc('week', timezone('utc', p_reference));
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN occurred_at >= v_day_start AND occurred_at < v_day_start + INTERVAL '1 day' THEN xp_amount ELSE 0 END), 0) AS day_xp,
    COALESCE(SUM(CASE WHEN occurred_at >= v_day_start AND occurred_at < v_day_start + INTERVAL '1 day' THEN 1 ELSE 0 END), 0) AS day_events,
    COALESCE(SUM(CASE WHEN occurred_at >= v_week_start AND occurred_at < v_week_start + INTERVAL '7 day' THEN xp_amount ELSE 0 END), 0) AS week_xp,
    COALESCE(SUM(CASE WHEN occurred_at >= v_week_start AND occurred_at < v_week_start + INTERVAL '7 day' THEN 1 ELSE 0 END), 0) AS week_events
  FROM public.profile_action_xp_events
  WHERE profile_id = p_profile_id
    AND action_type = p_action;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_claimed_weekly_bonus(
  p_profile_id uuid,
  p_week_start date,
  p_bonus_type text
)
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profile_weekly_bonus_claims c
    WHERE c.profile_id = p_profile_id
      AND c.week_start = p_week_start
      AND c.bonus_type = p_bonus_type
  );
$$;

-- Trigger helpers to keep profile balances in sync
CREATE OR REPLACE FUNCTION public.apply_profile_action_xp_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet public.player_xp_wallet%ROWTYPE;
  v_amount integer := COALESCE(NEW.xp_amount, 0);
BEGIN
  IF v_amount = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.player_xp_wallet (profile_id)
  VALUES (NEW.profile_id)
  ON CONFLICT (profile_id) DO NOTHING;

  UPDATE public.player_xp_wallet
  SET
    xp_balance = GREATEST(xp_balance + v_amount, 0),
    lifetime_xp = lifetime_xp + GREATEST(v_amount, 0),
    xp_spent = xp_spent + GREATEST(-v_amount, 0),
    last_recalculated = timezone('utc', now())
  WHERE profile_id = NEW.profile_id
  RETURNING * INTO v_wallet;

  IF NOT FOUND THEN
    SELECT * INTO v_wallet
    FROM public.player_xp_wallet
    WHERE profile_id = NEW.profile_id;
  END IF;

  UPDATE public.profiles
  SET experience = GREATEST(COALESCE(experience, 0) + v_amount, 0)
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
    NEW.action_type,
    v_amount,
    COALESCE(v_wallet.xp_balance, 0),
    0,
    0,
    NEW.metadata
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_profile_attribute_transaction()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet public.player_xp_wallet%ROWTYPE;
  v_points integer := COALESCE(NEW.points_delta, 0);
  v_value_delta integer := COALESCE(NEW.attribute_value_delta, 0);
  v_xp integer := COALESCE(NEW.xp_delta, 0);
  v_attribute_column text := NEW.attribute_key;
BEGIN
  INSERT INTO public.player_xp_wallet (profile_id)
  VALUES (NEW.profile_id)
  ON CONFLICT (profile_id) DO NOTHING;

  UPDATE public.player_xp_wallet
  SET
    xp_balance = GREATEST(xp_balance + v_xp, 0),
    lifetime_xp = lifetime_xp + GREATEST(v_xp, 0),
    xp_spent = xp_spent + GREATEST(-v_xp, 0),
    attribute_points_earned = attribute_points_earned + GREATEST(v_points, 0),
    last_recalculated = timezone('utc', now())
  WHERE profile_id = NEW.profile_id
  RETURNING * INTO v_wallet;

  IF NOT FOUND THEN
    SELECT * INTO v_wallet
    FROM public.player_xp_wallet
    WHERE profile_id = NEW.profile_id;
  END IF;

  INSERT INTO public.player_attributes (profile_id)
  VALUES (NEW.profile_id)
  ON CONFLICT (profile_id) DO NOTHING;

  UPDATE public.player_attributes
  SET
    attribute_points = GREATEST(attribute_points + v_points, 0),
    attribute_points_spent = CASE
      WHEN v_points < 0 THEN attribute_points_spent + ABS(v_points)
      ELSE attribute_points_spent
    END,
    updated_at = timezone('utc', now())
  WHERE profile_id = NEW.profile_id;

  IF v_attribute_column IS NOT NULL AND v_value_delta <> 0 THEN
    EXECUTE format(
      'UPDATE public.player_attributes
       SET %1$I = LEAST(GREATEST(COALESCE(%1$I, 0) + $1, 0), 1000),
           updated_at = timezone(''utc'', now())
       WHERE profile_id = $2',
      v_attribute_column
    ) USING v_value_delta, NEW.profile_id;
  END IF;

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
    'attribute_' || NEW.transaction_type,
    v_xp,
    COALESCE(v_wallet.xp_balance, 0),
    v_points,
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
    skill_points_earned = skill_points_earned + GREATEST(v_skill, 0),
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
    'respec',
    v_xp,
    COALESCE(v_wallet.xp_balance, 0),
    v_attr,
    v_skill,
    NEW.metadata
  );

  RETURN NEW;
END;
$$;

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
    'weekly_bonus:' || NEW.bonus_type,
    v_xp,
    COALESCE(v_wallet.xp_balance, 0),
    0,
    0,
    NEW.metadata
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profile_action_xp_events_apply
AFTER INSERT ON public.profile_action_xp_events
FOR EACH ROW EXECUTE FUNCTION public.apply_profile_action_xp_event();

CREATE TRIGGER trg_profile_attribute_transactions_apply
AFTER INSERT ON public.profile_attribute_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_profile_attribute_transaction();

CREATE TRIGGER trg_profile_respec_events_apply
AFTER INSERT ON public.profile_respec_events
FOR EACH ROW EXECUTE FUNCTION public.apply_profile_respec_event();

CREATE TRIGGER trg_profile_weekly_bonus_apply
AFTER INSERT ON public.profile_weekly_bonus_claims
FOR EACH ROW EXECUTE FUNCTION public.apply_profile_weekly_bonus();

-- Smoke tests to ensure the new progression triggers execute without referencing
-- removed profile columns. These run against an arbitrary existing profile and
-- clean up after themselves so no persistent state changes remain.
DO $$
DECLARE
  v_profile_id uuid;
  v_wallet public.player_xp_wallet%ROWTYPE;
  v_wallet_exists boolean := false;
  v_attr_points integer := 0;
  v_attr_spent integer := 0;
  v_attr_value integer := 0;
  v_attr_updated timestamptz := NULL;
  v_attr_exists boolean := false;
  v_profile_experience integer := 0;
  v_action_event_id uuid;
  v_attribute_tx_id uuid;
  v_respec_id uuid;
  v_bonus_id uuid;
  v_week_start date := date_trunc('week', timezone('utc', now()))::date;
BEGIN
  SELECT id, experience INTO v_profile_id, v_profile_experience
  FROM public.profiles
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE NOTICE 'Skipping profile progression trigger smoke tests: no profiles available.';
    RETURN;
  END IF;

  SELECT * INTO v_wallet
  FROM public.player_xp_wallet
  WHERE profile_id = v_profile_id;
  IF FOUND THEN
    v_wallet_exists := true;
  END IF;

  SELECT attribute_points, attribute_points_spent, musical_ability, updated_at
  INTO v_attr_points, v_attr_spent, v_attr_value, v_attr_updated
  FROM public.player_attributes
  WHERE profile_id = v_profile_id;
  IF FOUND THEN
    v_attr_exists := true;
  END IF;

  INSERT INTO public.profile_action_xp_events (
    profile_id,
    action_type,
    xp_amount,
    metadata
  )
  VALUES (
    v_profile_id,
    'regression_trigger_smoke',
    25,
    jsonb_build_object('test_run', 'progression_trigger_regression', 'source', 'action_event')
  )
  RETURNING id INTO v_action_event_id;

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
    v_profile_id,
    'regression_trigger_smoke',
    'musical_ability',
    1,
    10,
    -15,
    jsonb_build_object('test_run', 'progression_trigger_regression', 'source', 'attribute_transaction')
  )
  RETURNING id INTO v_attribute_tx_id;

  INSERT INTO public.profile_respec_events (
    profile_id,
    attribute_points_refunded,
    skill_points_refunded,
    xp_refunded,
    metadata
  )
  VALUES (
    v_profile_id,
    2,
    1,
    5,
    jsonb_build_object('test_run', 'progression_trigger_regression', 'source', 'respec_event')
  )
  RETURNING id INTO v_respec_id;

  INSERT INTO public.profile_weekly_bonus_claims (
    profile_id,
    week_start,
    bonus_type,
    xp_awarded,
    metadata
  )
  VALUES (
    v_profile_id,
    v_week_start,
    concat('regression_trigger_smoke_', gen_random_uuid()),
    35,
    jsonb_build_object('test_run', 'progression_trigger_regression', 'source', 'weekly_bonus')
  )
  RETURNING id INTO v_bonus_id;

  DELETE FROM public.profile_weekly_bonus_claims WHERE id = v_bonus_id;
  DELETE FROM public.profile_respec_events WHERE id = v_respec_id;
  DELETE FROM public.profile_attribute_transactions WHERE id = v_attribute_tx_id;
  DELETE FROM public.profile_action_xp_events WHERE id = v_action_event_id;

  DELETE FROM public.xp_ledger
  WHERE metadata ->> 'test_run' = 'progression_trigger_regression';

  IF v_wallet_exists THEN
    UPDATE public.player_xp_wallet
    SET
      xp_balance = v_wallet.xp_balance,
      lifetime_xp = v_wallet.lifetime_xp,
      xp_spent = v_wallet.xp_spent,
      attribute_points_earned = v_wallet.attribute_points_earned,
      skill_points_earned = v_wallet.skill_points_earned,
      last_recalculated = v_wallet.last_recalculated
    WHERE profile_id = v_profile_id;
  ELSE
    DELETE FROM public.player_xp_wallet WHERE profile_id = v_profile_id;
  END IF;

  IF v_attr_exists THEN
    UPDATE public.player_attributes
    SET
      attribute_points = v_attr_points,
      attribute_points_spent = v_attr_spent,
      musical_ability = v_attr_value,
      updated_at = v_attr_updated
    WHERE profile_id = v_profile_id;
  ELSE
    DELETE FROM public.player_attributes WHERE profile_id = v_profile_id;
  END IF;

  UPDATE public.profiles
  SET experience = v_profile_experience
  WHERE id = v_profile_id;
END;
$$;

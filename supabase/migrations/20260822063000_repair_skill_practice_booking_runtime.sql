-- Repair skill-practice booking/completion for the August 2026 runtime.
--
-- The previous RPCs referenced public.skill_definitions, but that table is
-- introduced by a later-dated migration in this repository. PL/pgSQL functions
-- can be created before referenced relations exist and then fail only when
-- invoked. Use the already-live per-character skill_progress table for runtime
-- eligibility and make catalogue naming optional.

CREATE TABLE IF NOT EXISTS public.skill_practice_reward_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.player_scheduled_activities(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  skill_slug text NOT NULL,
  xp_awarded integer NOT NULL CHECK (xp_awarded > 0),
  idempotency_key text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skill_practice_reward_activity_unique UNIQUE (activity_id),
  CONSTRAINT skill_practice_reward_idempotency_unique UNIQUE (idempotency_key)
);

ALTER TABLE public.skill_practice_reward_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players can view their practice rewards" ON public.skill_practice_reward_ledger;
CREATE POLICY "Players can view their practice rewards"
  ON public.skill_practice_reward_ledger
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_id
        AND p.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.schedule_skill_practice(
  p_profile_id uuid,
  p_skill_slug text,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_health numeric;
  v_skill_name text;
  v_count integer;
  v_day_start timestamptz;
  v_id uuid;
BEGIN
  IF p_scheduled_start IS NULL
     OR p_scheduled_end IS NULL
     OR p_scheduled_start <= now()
     OR p_scheduled_end <= p_scheduled_start
     OR p_scheduled_end - p_scheduled_start <> interval '1 hour' THEN
    RAISE EXCEPTION 'PRACTICE_PAST: choose a valid future one-hour slot' USING ERRCODE='P0001';
  END IF;

  SELECT p.user_id, p.health
  INTO v_user_id, v_health
  FROM public.profiles p
  WHERE p.id = p_profile_id
    AND p.user_id = auth.uid()
    AND p.is_active = true
    AND p.died_at IS NULL;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'PRACTICE_PROFILE: active profile required' USING ERRCODE='P0001';
  END IF;

  IF COALESCE(v_health, 100) < 15 THEN
    RAISE EXCEPTION 'PRACTICE_WELLNESS: health is too low for training' USING ERRCODE='P0001';
  END IF;

  -- skill_progress is the runtime source used by both current desktop and
  -- mobile skill screens. Do not depend on future catalogue relations here.
  IF NOT EXISTS (
    SELECT 1
    FROM public.skill_progress sp
    WHERE sp.profile_id = p_profile_id
      AND sp.skill_slug = p_skill_slug
      AND COALESCE(sp.current_level, 0) >= 1
  ) THEN
    RAISE EXCEPTION 'PRACTICE_SKILL: skill is invalid or locked' USING ERRCODE='P0001';
  END IF;

  -- A readable fallback works even before skill_catalogue_view exists.
  v_skill_name := initcap(replace(replace(p_skill_slug, '_', ' '), '-', ' '));

  -- If the later canonical catalogue is present, prefer its display name
  -- without making this August runtime depend on that relation existing.
  IF to_regclass('public.skill_catalogue_view') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT COALESCE(name, slug) FROM public.skill_catalogue_view WHERE slug = $1 LIMIT 1'
        INTO v_skill_name
        USING p_skill_slug;
      v_skill_name := COALESCE(
        v_skill_name,
        initcap(replace(replace(p_skill_slug, '_', ' '), '-', ' '))
      );
    EXCEPTION WHEN OTHERS THEN
      v_skill_name := initcap(replace(replace(p_skill_slug, '_', ' '), '-', ' '));
    END;
  END IF;

  -- Serialize bookings for this character/UTC practice day so conflict and
  -- daily-cap checks cannot race each other.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_profile_id::text || ':' || (p_scheduled_start AT TIME ZONE 'UTC')::date::text,
      0
    )
  );

  IF EXISTS (
    SELECT 1
    FROM public.player_scheduled_activities a
    WHERE a.profile_id = p_profile_id
      AND a.status IN ('scheduled', 'in_progress')
      AND a.scheduled_start < p_scheduled_end
      AND a.scheduled_end > p_scheduled_start
  ) THEN
    RAISE EXCEPTION 'PRACTICE_CONFLICT: time slot occupied' USING ERRCODE='P0001';
  END IF;

  v_day_start := ((p_scheduled_start AT TIME ZONE 'UTC')::date AT TIME ZONE 'UTC');

  SELECT count(*)
  INTO v_count
  FROM public.player_scheduled_activities a
  WHERE a.profile_id = p_profile_id
    AND (
      a.activity_type = 'skill_practice'
      OR (
        a.activity_type = 'other'
        AND COALESCE(a.metadata, '{}'::jsonb) @> '{"isPractice": true}'::jsonb
      )
    )
    AND a.status IN ('scheduled', 'in_progress', 'completed')
    AND a.scheduled_start >= v_day_start
    AND a.scheduled_start < v_day_start + interval '1 day';

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'PRACTICE_DAILY_CAP: daily limit reached' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.player_scheduled_activities (
    user_id,
    profile_id,
    activity_type,
    scheduled_start,
    scheduled_end,
    status,
    title,
    description,
    metadata
  ) VALUES (
    v_user_id,
    p_profile_id,
    'skill_practice',
    p_scheduled_start,
    p_scheduled_end,
    'scheduled',
    'Practice: ' || v_skill_name,
    'Focused practice session for ' || v_skill_name,
    jsonb_build_object(
      'isPractice', true,
      'skillSlug', p_skill_slug,
      'skill_slug', p_skill_slug,
      'skillName', v_skill_name
    )
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'activity_id', v_id,
    'skill_slug', p_skill_slug,
    'skill_name', v_skill_name,
    'sessions_used', v_count + 1,
    'sessions_remaining', 5 - (v_count + 1),
    'practice_date', (p_scheduled_start AT TIME ZONE 'UTC')::date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_skill_practice(uuid, text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_skill_practice(uuid, text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_skill_practice(uuid, text, timestamptz, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_skill_practice(p_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity public.player_scheduled_activities%ROWTYPE;
  v_progress public.skill_progress%ROWTYPE;
  v_slug text;
  v_reward constant integer := 5;
  v_level integer;
  v_xp integer;
  v_required integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE='42501';
  END IF;

  SELECT *
  INTO v_activity
  FROM public.player_scheduled_activities
  WHERE id = p_activity_id
  FOR UPDATE;

  IF NOT FOUND OR v_activity.activity_type <> 'skill_practice' THEN
    RAISE EXCEPTION 'invalid practice activity' USING ERRCODE='P0001';
  END IF;

  IF v_activity.status IN ('cancelled', 'missed') THEN
    RAISE EXCEPTION 'practice was not completed' USING ERRCODE='P0001';
  END IF;

  IF v_activity.scheduled_end > now() THEN
    RAISE EXCEPTION 'practice has not ended' USING ERRCODE='P0001';
  END IF;

  v_slug := COALESCE(
    v_activity.metadata->>'skillSlug',
    v_activity.metadata->>'skill_slug'
  );

  IF v_slug IS NULL OR btrim(v_slug) = '' THEN
    RAISE EXCEPTION 'invalid practice skill metadata' USING ERRCODE='P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.skill_practice_reward_ledger
    WHERE activity_id = p_activity_id
  ) THEN
    SELECT *
    INTO v_progress
    FROM public.skill_progress
    WHERE profile_id = v_activity.profile_id
      AND skill_slug = v_slug;

    RETURN jsonb_build_object(
      'already_rewarded', true,
      'xp_awarded', v_reward,
      'skill_progress', to_jsonb(v_progress)
    );
  END IF;

  SELECT *
  INTO v_progress
  FROM public.skill_progress
  WHERE profile_id = v_activity.profile_id
    AND skill_slug = v_slug
    AND current_level >= 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'practiced skill is no longer unlocked' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.skill_practice_reward_ledger (
    activity_id,
    profile_id,
    skill_slug,
    xp_awarded,
    idempotency_key
  ) VALUES (
    p_activity_id,
    v_activity.profile_id,
    v_slug,
    v_reward,
    'skill-practice:' || p_activity_id
  );

  v_level := v_progress.current_level;
  v_xp := COALESCE(v_progress.current_xp, 0) + v_reward;
  v_required := COALESCE(
    NULLIF(v_progress.required_xp, 0),
    public.progression_skill_required_xp(v_level)
  );

  WHILE v_xp >= v_required LOOP
    v_xp := v_xp - v_required;
    v_level := v_level + 1;
    v_required := public.progression_skill_required_xp(v_level);
  END LOOP;

  UPDATE public.skill_progress
  SET current_level = v_level,
      current_xp = v_xp,
      required_xp = v_required,
      last_practiced_at = now(),
      updated_at = now()
  WHERE id = v_progress.id
  RETURNING * INTO v_progress;

  UPDATE public.player_scheduled_activities
  SET status = 'completed',
      completed_at = now(),
      metadata = COALESCE(metadata, '{}'::jsonb)
        || jsonb_build_object('practiceRewarded', true)
  WHERE id = p_activity_id;

  RETURN jsonb_build_object(
    'already_rewarded', false,
    'xp_awarded', v_reward,
    'skill_progress', to_jsonb(v_progress)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_skill_practice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_skill_practice(uuid) TO service_role;

-- Ensure PostgREST sees the repaired booking RPC immediately after migration deploy.
NOTIFY pgrst, 'reload schema';

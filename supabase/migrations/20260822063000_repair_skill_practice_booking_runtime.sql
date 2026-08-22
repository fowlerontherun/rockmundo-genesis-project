-- Repair skill-practice booking for the August 2026 runtime.
--
-- The previous RPC validated practice by joining public.skill_definitions, but
-- that table is introduced by a later-dated migration in this repository. A
-- PL/pgSQL function can be created before a referenced relation exists, then
-- fail only when invoked. Use the already-live canonical per-character
-- skill_progress table for eligibility and make catalogue naming optional.

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
      v_skill_name := COALESCE(v_skill_name, initcap(replace(replace(p_skill_slug, '_', ' '), '-', ' ')));
    EXCEPTION WHEN OTHERS THEN
      v_skill_name := initcap(replace(replace(p_skill_slug, '_', ' '), '-', ' '));
    END;
  END IF;

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

-- Ensure PostgREST sees the repaired RPC immediately after migration deploy.
NOTIFY pgrst, 'reload schema';

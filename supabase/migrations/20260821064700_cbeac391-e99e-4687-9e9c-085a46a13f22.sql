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
  SELECT user_id, COALESCE(health, 100) INTO v_user_id, v_health
  FROM public.profiles
  WHERE id = p_profile_id AND user_id = auth.uid() AND died_at IS NULL;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'PRACTICE_PROFILE';
  END IF;

  IF p_scheduled_start IS NULL OR p_scheduled_end IS NULL OR p_scheduled_end <= p_scheduled_start THEN
    RAISE EXCEPTION 'PRACTICE_PAST';
  END IF;

  IF p_scheduled_start <= now() THEN
    RAISE EXCEPTION 'PRACTICE_PAST';
  END IF;

  IF v_health < 15 THEN
    RAISE EXCEPTION 'PRACTICE_WELLNESS';
  END IF;

  SELECT display_name INTO v_skill_name
  FROM public.skill_definitions
  WHERE slug = p_skill_slug;

  IF v_skill_name IS NULL THEN
    RAISE EXCEPTION 'PRACTICE_SKILL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.player_scheduled_activities
    WHERE profile_id = p_profile_id
      AND status IN ('scheduled', 'in_progress')
      AND scheduled_start < p_scheduled_end
      AND scheduled_end > p_scheduled_start
  ) THEN
    RAISE EXCEPTION 'PRACTICE_CONFLICT';
  END IF;

  v_day_start := date_trunc('day', p_scheduled_start);

  SELECT count(*) INTO v_count
  FROM public.player_scheduled_activities
  WHERE profile_id = p_profile_id
    AND activity_type = 'skill_practice'
    AND status IN ('scheduled', 'in_progress', 'completed')
    AND scheduled_start >= v_day_start
    AND scheduled_start < v_day_start + interval '1 day';

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'PRACTICE_DAILY_CAP';
  END IF;

  INSERT INTO public.player_scheduled_activities (
    user_id, profile_id, activity_type, scheduled_start, scheduled_end,
    status, title, description, metadata
  ) VALUES (
    v_user_id, p_profile_id, 'skill_practice', p_scheduled_start, p_scheduled_end,
    'scheduled', 'Practice: ' || v_skill_name,
    'Focused practice session for ' || v_skill_name,
    jsonb_build_object('isPractice', true, 'skill_slug', p_skill_slug)
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'activity_id', v_id,
    'skill_slug', p_skill_slug,
    'skill_name', v_skill_name,
    'sessions_used', v_count + 1,
    'sessions_remaining', 5 - (v_count + 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_skill_practice(uuid, text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_skill_practice(uuid, text, timestamptz, timestamptz) TO authenticated;
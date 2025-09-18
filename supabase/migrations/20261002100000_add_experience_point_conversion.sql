-- Add spendable point columns to player profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skill_points_available integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attribute_points_available integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS experience_at_last_conversion integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_point_conversion_at timestamptz DEFAULT now();

-- Align new bookkeeping columns with each profile's current state
UPDATE public.profiles
SET
  skill_points_available = COALESCE(skill_points_available, 0),
  attribute_points_available = COALESCE(attribute_points_available, 0),
  experience_at_last_conversion = COALESCE(experience, 0),
  last_point_conversion_at = COALESCE(last_point_conversion_at, now());

-- Function to convert accrued experience into spendable points once per day
CREATE OR REPLACE FUNCTION public.process_daily_point_conversions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_profile RECORD;
  v_xp_delta integer;
  v_remaining_xp integer;
  v_skill_points integer;
  v_attribute_points integer;
  v_consumed integer;
  v_processed integer := 0;
  v_message text;
  v_metadata jsonb;
  skill_rate constant integer := 150; -- XP required per skill point
  attribute_rate constant integer := 400; -- XP required per attribute point
BEGIN
  FOR v_profile IN
    SELECT id,
           user_id,
           COALESCE(experience, 0) AS experience,
           COALESCE(experience_at_last_conversion, 0) AS experience_at_last_conversion,
           last_point_conversion_at
    FROM public.profiles
  LOOP
    -- Reset trackers if experience was reduced since the last run
    IF v_profile.experience <= v_profile.experience_at_last_conversion THEN
      UPDATE public.profiles
      SET
        experience_at_last_conversion = v_profile.experience,
        last_point_conversion_at = timezone('utc', now())
      WHERE id = v_profile.id;
      CONTINUE;
    END IF;

    v_xp_delta := GREATEST(v_profile.experience - v_profile.experience_at_last_conversion, 0);
    v_remaining_xp := v_xp_delta;

    IF v_remaining_xp <= 0 THEN
      UPDATE public.profiles
      SET last_point_conversion_at = timezone('utc', now())
      WHERE id = v_profile.id;
      CONTINUE;
    END IF;

    v_attribute_points := v_remaining_xp / attribute_rate;
    v_remaining_xp := v_remaining_xp - (v_attribute_points * attribute_rate);

    v_skill_points := v_remaining_xp / skill_rate;
    v_remaining_xp := v_remaining_xp - (v_skill_points * skill_rate);

    v_consumed := v_xp_delta - v_remaining_xp;

    UPDATE public.profiles
    SET
      skill_points_available = skill_points_available + v_skill_points,
      attribute_points_available = attribute_points_available + v_attribute_points,
      experience_at_last_conversion = v_profile.experience - v_remaining_xp,
      last_point_conversion_at = timezone('utc', now())
    WHERE id = v_profile.id;

    IF v_skill_points > 0 OR v_attribute_points > 0 THEN
      v_processed := v_processed + 1;

      v_message := CASE
        WHEN v_skill_points > 0 AND v_attribute_points > 0 THEN
          format(
            'Daily training converted into %s and %s.',
            format('%s skill point%s', v_skill_points, CASE WHEN v_skill_points = 1 THEN '' ELSE 's' END),
            format('%s attribute point%s', v_attribute_points, CASE WHEN v_attribute_points = 1 THEN '' ELSE 's' END)
          )
        WHEN v_skill_points > 0 THEN
          format(
            'Daily training converted into %s.',
            format('%s skill point%s', v_skill_points, CASE WHEN v_skill_points = 1 THEN '' ELSE 's' END)
          )
        WHEN v_attribute_points > 0 THEN
          format(
            'Daily training converted into %s.',
            format('%s attribute point%s', v_attribute_points, CASE WHEN v_attribute_points = 1 THEN '' ELSE 's' END)
          )
        ELSE
          'Daily training conversion completed.'
      END;

      v_metadata := jsonb_build_object(
        'skill_points', v_skill_points,
        'attribute_points', v_attribute_points,
        'experience_converted', v_consumed,
        'experience_delta', v_xp_delta,
        'experience_leftover', v_remaining_xp
      );

      INSERT INTO public.activity_feed (
        user_id,
        profile_id,
        activity_type,
        message,
        metadata,
        created_at
      )
      VALUES (
        v_profile.user_id,
        v_profile.id,
        'point_grant',
        v_message,
        v_metadata,
        timezone('utc', now())
      );
    END IF;
  END LOOP;

  RETURN v_processed;
END;
$$;

COMMENT ON FUNCTION public.process_daily_point_conversions() IS 'Converts accrued experience into daily skill and attribute points for each profile.';

GRANT EXECUTE ON FUNCTION public.process_daily_point_conversions() TO service_role;

-- Ensure the pg_cron extension is available for scheduling the conversion job
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule the daily conversion at 04:30 UTC
DO $$
DECLARE
  existing_job_id integer;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'daily_experience_point_conversion';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'daily_experience_point_conversion',
    '30 4 * * *',
    $$SELECT public.process_daily_point_conversions();$$
  );
END;
$$;

-- Run once so profiles created before this migration are initialized
SELECT public.process_daily_point_conversions();

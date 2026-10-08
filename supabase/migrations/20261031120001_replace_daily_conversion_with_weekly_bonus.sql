-- Remove legacy daily point conversion columns and job
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS skill_points_available,
  DROP COLUMN IF EXISTS attribute_points_available,
  DROP COLUMN IF EXISTS experience_at_last_conversion,
  DROP COLUMN IF EXISTS last_point_conversion_at;

DO $$
DECLARE
  v_job_id integer;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'daily_experience_point_conversion';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.process_daily_point_conversions();

-- Weekly bonus tracking metadata
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_weekly_bonus_at timestamptz,
  ADD COLUMN IF NOT EXISTS experience_at_last_weekly_bonus integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_bonus_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_bonus_metadata jsonb NOT NULL DEFAULT '{}';

UPDATE public.profiles
SET
  experience_at_last_weekly_bonus = COALESCE(experience, 0),
  last_weekly_bonus_at = COALESCE(last_weekly_bonus_at, timezone('utc', now())),
  weekly_bonus_streak = COALESCE(weekly_bonus_streak, 0),
  weekly_bonus_metadata = jsonb_build_object('initialized_at', timezone('utc', now()));

-- Ledger to track XP adjustments
CREATE TABLE IF NOT EXISTS public.experience_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  recorded_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS experience_ledger_profile_recorded_idx
  ON public.experience_ledger (profile_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS experience_ledger_user_recorded_idx
  ON public.experience_ledger (user_id, recorded_at DESC);

COMMENT ON TABLE public.experience_ledger IS 'Tracks experience (XP) adjustments for each profile with contextual metadata.';

ALTER TABLE public.experience_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'experience_ledger'
      AND policyname = 'Experience ledger entries are viewable by owners'
  ) THEN
    CREATE POLICY "Experience ledger entries are viewable by owners"
      ON public.experience_ledger FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'experience_ledger'
      AND policyname = 'System can insert experience ledger entries'
  ) THEN
    CREATE POLICY "System can insert experience ledger entries"
      ON public.experience_ledger FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END;
$$;

GRANT SELECT ON public.experience_ledger TO service_role;
GRANT INSERT ON public.experience_ledger TO service_role;

-- Weekly bonus processor
CREATE OR REPLACE FUNCTION public.process_weekly_experience_bonus()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_profile RECORD;
  v_processed integer := 0;
  v_now timestamptz := timezone('utc', now());
  v_xp_delta integer;
  v_bonus integer;
  v_new_streak integer;
  v_metadata jsonb;
  v_message text;
BEGIN
  FOR v_profile IN
    SELECT id,
           user_id,
           COALESCE(experience, 0) AS experience,
           COALESCE(experience_at_last_weekly_bonus, 0) AS experience_at_last_weekly_bonus,
           COALESCE(weekly_bonus_streak, 0) AS weekly_bonus_streak,
           last_weekly_bonus_at
    FROM public.profiles
  LOOP
    v_xp_delta := GREATEST(v_profile.experience - v_profile.experience_at_last_weekly_bonus, 0);

    IF v_xp_delta <= 0 THEN
      UPDATE public.profiles
      SET
        experience_at_last_weekly_bonus = v_profile.experience,
        last_weekly_bonus_at = v_now,
        weekly_bonus_metadata = jsonb_build_object(
          'last_bonus_delta', v_xp_delta,
          'last_bonus_awarded', 0,
          'updated_at', v_now
        )
      WHERE id = v_profile.id;
      CONTINUE;
    END IF;

    v_bonus := GREATEST((v_xp_delta / 5), 100);

    IF v_profile.last_weekly_bonus_at IS NULL
       OR v_profile.last_weekly_bonus_at >= v_now - INTERVAL '14 days' THEN
      v_new_streak := v_profile.weekly_bonus_streak + 1;
    ELSE
      v_new_streak := 1;
    END IF;

    UPDATE public.profiles
    SET
      experience = experience + v_bonus,
      experience_at_last_weekly_bonus = v_profile.experience + v_bonus,
      last_weekly_bonus_at = v_now,
      weekly_bonus_streak = v_new_streak,
      weekly_bonus_metadata = jsonb_build_object(
        'experience_gained', v_xp_delta,
        'bonus_awarded', v_bonus,
        'streak', v_new_streak,
        'updated_at', v_now
      ),
      updated_at = v_now
    WHERE id = v_profile.id;

    INSERT INTO public.experience_ledger (
      profile_id,
      user_id,
      amount,
      reason,
      metadata,
      recorded_at
    )
    VALUES (
      v_profile.id,
      v_profile.user_id,
      v_bonus,
      'weekly_bonus',
      jsonb_build_object(
        'experience_gained', v_xp_delta,
        'bonus_awarded', v_bonus,
        'streak', v_new_streak
      ),
      v_now
    );

    v_message := format(
      'Weekly rehearsal bonus awarded: %s XP bonus after gaining %s XP.',
      v_bonus,
      v_xp_delta
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
      'weekly_bonus',
      v_message,
      jsonb_build_object(
        'experience_gained', v_xp_delta,
        'bonus_awarded', v_bonus,
        'streak', v_new_streak
      ),
      v_now
    );

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

COMMENT ON FUNCTION public.process_weekly_experience_bonus() IS 'Grants a weekly XP bonus based on experience gained since the previous run.';

GRANT EXECUTE ON FUNCTION public.process_weekly_experience_bonus() TO service_role;

DO $$
DECLARE
  v_job_id integer;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'weekly_experience_bonus';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'weekly_experience_bonus',
    '15 5 * * 1',
    $$SELECT public.process_weekly_experience_bonus();$$
  );
END;
$$;

-- Capture the current baseline without issuing an extra bonus
UPDATE public.profiles
SET experience_at_last_weekly_bonus = COALESCE(experience, 0);

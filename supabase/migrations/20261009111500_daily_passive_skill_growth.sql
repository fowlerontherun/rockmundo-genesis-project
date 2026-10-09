-- Daily passive skill growth: every owned, non-maxed skill gains 0.5%-5.0%
-- of the XP required for its current level once per UTC day.
-- The dedicated ledger makes retries and concurrent cron runs idempotent.

CREATE TABLE IF NOT EXISTS public.daily_skill_growth_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_slug text NOT NULL,
  grant_date date NOT NULL,
  growth_percent numeric(3,1) NOT NULL CHECK (growth_percent >= 0.5 AND growth_percent <= 5.0),
  xp_awarded integer NOT NULL CHECK (xp_awarded > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT daily_skill_growth_grants_unique UNIQUE (profile_id, skill_slug, grant_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_skill_growth_grants_profile_date
  ON public.daily_skill_growth_grants (profile_id, grant_date DESC);

ALTER TABLE public.daily_skill_growth_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can view their daily skill growth" ON public.daily_skill_growth_grants;
CREATE POLICY "Players can view their daily skill growth"
  ON public.daily_skill_growth_grants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = daily_skill_growth_grants.profile_id
        AND p.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.daily_skill_growth_grants TO authenticated;
GRANT ALL ON public.daily_skill_growth_grants TO service_role;

CREATE OR REPLACE FUNCTION public.process_daily_passive_skill_growth(
  p_grant_date date DEFAULT (timezone('utc', now()))::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_skill public.skill_progress%ROWTYPE;
  v_max_level integer;
  v_level integer;
  v_current_xp integer;
  v_required integer;
  v_growth_percent numeric(3,1);
  v_xp_awarded integer;
  v_grant_id uuid;
  v_awarded_skills integer := 0;
  v_awarded_xp integer := 0;
BEGIN
  FOR v_skill IN
    SELECT sp.*
    FROM public.skill_progress sp
    WHERE COALESCE(sp.current_level, 0) >= 1
      AND COALESCE(sp.current_level, 0) < public.progression_skill_max_level(sp.skill_slug)
    ORDER BY sp.profile_id, sp.skill_slug
    FOR UPDATE SKIP LOCKED
  LOOP
    v_max_level := public.progression_skill_max_level(v_skill.skill_slug);
    v_level := LEAST(GREATEST(COALESCE(v_skill.current_level, 1), 1), v_max_level);

    IF v_level >= v_max_level THEN
      CONTINUE;
    END IF;

    v_required := COALESCE(
      NULLIF(v_skill.required_xp, 0),
      public.progression_skill_required_xp(v_level)
    );

    -- Stable pseudo-random tenth-percent step for this profile/skill/day:
    -- 0.5, 0.6, ... 5.0. A retry gets exactly the same result.
    v_growth_percent :=
      0.5 + (
        (
          get_byte(
            decode(md5(v_skill.profile_id::text || ':' || v_skill.skill_slug || ':' || p_grant_date::text), 'hex'),
            0
          ) % 46
        )::numeric / 10.0
      );

    v_xp_awarded := GREATEST(1, ROUND(v_required * (v_growth_percent / 100.0))::integer);

    INSERT INTO public.daily_skill_growth_grants (
      profile_id,
      skill_slug,
      grant_date,
      growth_percent,
      xp_awarded,
      metadata
    )
    VALUES (
      v_skill.profile_id,
      v_skill.skill_slug,
      p_grant_date,
      v_growth_percent,
      v_xp_awarded,
      jsonb_build_object(
        'source', 'daily_passive_skill_growth',
        'level_before', v_level,
        'required_xp_before', v_required
      )
    )
    ON CONFLICT (profile_id, skill_slug, grant_date) DO NOTHING
    RETURNING id INTO v_grant_id;

    IF v_grant_id IS NULL THEN
      CONTINUE;
    END IF;

    v_current_xp := GREATEST(COALESCE(v_skill.current_xp, 0), 0) + v_xp_awarded;

    WHILE v_level < v_max_level AND v_current_xp >= v_required LOOP
      v_current_xp := v_current_xp - v_required;
      v_level := v_level + 1;
      IF v_level < v_max_level THEN
        v_required := public.progression_skill_required_xp(v_level);
      END IF;
    END LOOP;

    IF v_level >= v_max_level THEN
      v_level := v_max_level;
      v_current_xp := 0;
      v_required := 0;
    END IF;

    UPDATE public.skill_progress
    SET current_level = v_level,
        current_xp = v_current_xp,
        required_xp = v_required,
        updated_at = timezone('utc', now())
    WHERE id = v_skill.id;

    v_awarded_skills := v_awarded_skills + 1;
    v_awarded_xp := v_awarded_xp + v_xp_awarded;
    v_grant_id := NULL;
  END LOOP;

  RETURN jsonb_build_object(
    'grant_date', p_grant_date,
    'skills_awarded', v_awarded_skills,
    'xp_awarded', v_awarded_xp
  );
END;
$$;

COMMENT ON FUNCTION public.process_daily_passive_skill_growth(date) IS
  'Idempotently awards 0.5%-5.0% of next-level XP to every owned non-maxed skill once per UTC day.';

REVOKE ALL ON FUNCTION public.process_daily_passive_skill_growth(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_daily_passive_skill_growth(date) TO service_role;

DO $$
DECLARE
  v_job_id integer;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO v_job_id
    FROM cron.job
    WHERE jobname = 'daily_passive_skill_growth';

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
      'daily_passive_skill_growth',
      '30 3 * * *',
      'SELECT public.process_daily_passive_skill_growth();'
    );
  END IF;
END;
$$;

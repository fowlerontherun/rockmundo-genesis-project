-- Forward-only repair: live songwriting ran without the progression_v2 factor columns.
-- The existing completion worker remains authoritative for music/lyrics/XP.
-- A session-count trigger awards bounded polish/consistency after recovery has
-- modified real progress; old songs are NOT rerated or replayed.
ALTER TABLE public.songwriting_projects
  ADD COLUMN IF NOT EXISTS arrangement_progress integer NOT NULL DEFAULT 0 CHECK (arrangement_progress BETWEEN 0 AND 2000),
  ADD COLUMN IF NOT EXISTS polish_progress integer NOT NULL DEFAULT 0 CHECK (polish_progress BETWEEN 0 AND 500),
  ADD COLUMN IF NOT EXISTS consistency_score integer NOT NULL DEFAULT 0 CHECK (consistency_score BETWEEN 0 AND 500),
  ADD COLUMN IF NOT EXISTS calculation_version text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.songwriting_sessions
  ADD COLUMN IF NOT EXISTS polish_gained integer CHECK (polish_gained BETWEEN 0 AND 500),
  ADD COLUMN IF NOT EXISTS consistency_gained integer CHECK (consistency_gained BETWEEN 0 AND 500);

CREATE OR REPLACE FUNCTION private.rockmundo_award_songwriting_factors()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_session public.songwriting_sessions%ROWTYPE;
  v_hours integer;
  v_skill numeric := 0;
  v_work numeric;
  v_polish_raw numeric;
  v_consistency_raw numeric;
  v_polish integer;
  v_consistency integer;
  v_focus text;
BEGIN
  -- The session completion worker increases sessions_completed exactly once.
  -- Historical sessions are not replayed; NULL award columns mark unprocessed
  -- sessions, while zero is a valid capped award.
  IF COALESCE(NEW.sessions_completed, 0) <= COALESCE(OLD.sessions_completed, 0) THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_session FROM public.songwriting_sessions
   WHERE project_id = NEW.id AND completed_at IS NOT NULL
     AND polish_gained IS NULL AND consistency_gained IS NULL
   ORDER BY completed_at DESC, id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_focus := CASE WHEN v_session.session_type IN ('balanced','music','lyrics','arrangement','polish')
                  THEN v_session.session_type ELSE 'balanced' END;
  v_hours := CASE WHEN v_session.effort_hours IN (1,2,4) THEN v_session.effort_hours ELSE 1 END;
  -- Read trusted server-owned skills, never caller-supplied attributes.
  SELECT COALESCE(MAX(current_level), 0) INTO v_skill
    FROM public.skill_progress
   WHERE profile_id = COALESCE(v_session.profile_id, NEW.profile_id)
     AND skill_slug IN ('songwriting', 'composition');
  v_work := LEAST(12, GREATEST(0, COALESCE(v_session.music_progress_gained,0)
                                + COALESCE(v_session.lyrics_progress_gained,0)) / 240.0);
  v_polish_raw := (7 + v_hours * 3 + v_work + LEAST(8, v_skill / 3.0))
    * CASE v_focus WHEN 'polish' THEN 2.1 WHEN 'arrangement' THEN 1.35
                   WHEN 'music' THEN 0.8 WHEN 'lyrics' THEN 0.8 ELSE 1 END
    * GREATEST(0.25, 1 - COALESCE(OLD.polish_progress,0) / 550.0);
  v_consistency_raw := (7 + v_hours * 3 + v_work + LEAST(8, v_skill / 3.0))
    * CASE v_focus WHEN 'arrangement' THEN 2.0 WHEN 'polish' THEN 1.1
                   WHEN 'music' THEN 0.8 WHEN 'lyrics' THEN 0.8 ELSE 1 END
    * GREATEST(0.25, 1 - COALESCE(OLD.consistency_score,0) / 550.0);
  v_polish := LEAST(GREATEST(0, 500 - COALESCE(OLD.polish_progress,0)),
                    GREATEST(0, ROUND(v_polish_raw)::integer));
  v_consistency := LEAST(GREATEST(0, 500 - COALESCE(OLD.consistency_score,0)),
                         GREATEST(0, ROUND(v_consistency_raw)::integer));

  UPDATE public.songwriting_sessions SET
    polish_gained = v_polish,
    consistency_gained = v_consistency,
    progress_breakdown = COALESCE(progress_breakdown,'{}'::jsonb)
      || jsonb_build_object('factor_version','songwriting_factors_live_v1',
           'focus', v_focus, 'polishGained', v_polish, 'consistencyGained', v_consistency)
  WHERE id = v_session.id;

  NEW.polish_progress := COALESCE(OLD.polish_progress,0) + v_polish;
  NEW.consistency_score := COALESCE(OLD.consistency_score,0) + v_consistency;
  NEW.calculation_version := 'songwriting_factors_live_v1';
  NEW.songwriting_breakdown := COALESCE(NEW.songwriting_breakdown,'{}'::jsonb)
    || jsonb_build_object('polish_progress',NEW.polish_progress,
       'consistency_score',NEW.consistency_score,'factor_version','songwriting_factors_live_v1');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.rockmundo_award_songwriting_factors() FROM PUBLIC;
DROP TRIGGER IF EXISTS ab_songwriting_factor_progress ON public.songwriting_projects;
-- Runs AFTER aa_recovery_songwriting_progress so gains reflect recovery penalties.
CREATE TRIGGER ab_songwriting_factor_progress
BEFORE UPDATE OF sessions_completed ON public.songwriting_projects
FOR EACH ROW EXECUTE FUNCTION private.rockmundo_award_songwriting_factors();

-- Only newly completed projects receive the extra quality contribution.
-- Both dimensions are capped at 500; together they add at most 70/1000.
-- The existing optional final polish roll remains independent.
CREATE OR REPLACE FUNCTION private.rockmundo_songwriting_completion_snapshot()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_base integer;
  v_bonus_polish integer;
  v_bonus_consistency integer;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.writing_completed_at := COALESCE(NEW.writing_completed_at, now());
    v_base := LEAST(1000, GREATEST(0, COALESCE(NEW.quality_score, 50)));
    v_bonus_polish := ROUND(35 * COALESCE(NEW.polish_progress,0) / 500.0)::integer;
    v_bonus_consistency := ROUND(35 * COALESCE(NEW.consistency_score,0) / 500.0)::integer;
    IF NEW.writing_quality_score IS NULL THEN
      NEW.quality_score := LEAST(1000, v_base + v_bonus_polish + v_bonus_consistency);
      NEW.writing_quality_score := NEW.quality_score;
    END IF;
    NEW.polish_success_chance := COALESCE(NEW.polish_success_chance,
       25 + (ABS(hashtext(NEW.id::text)::bigint) % 51)::integer);
    NEW.completion_quality_breakdown := COALESCE(NEW.completion_quality_breakdown,'{}'::jsonb)
      || jsonb_build_object('source','live_songwriting_quality',
           'base_score',v_base,'polish_bonus',v_bonus_polish,
           'consistency_bonus',v_bonus_consistency,
           'final_score',NEW.writing_quality_score);
  END IF;
  RETURN NEW;
END;
$$;
NOTIFY pgrst, 'reload schema';

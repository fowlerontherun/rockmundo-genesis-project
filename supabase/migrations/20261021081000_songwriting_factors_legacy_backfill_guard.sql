-- Follow-up to factor progression: preserve earned legacy work without rewriting
-- previously completed song quality, and prevent Data API clients forging factors.
CREATE OR REPLACE FUNCTION private.rockmundo_guard_songwriting_factor_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = 'public', 'private', 'pg_temp'
AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF COALESCE(NEW.polish_progress,0) <> 0
         OR COALESCE(NEW.consistency_score,0) <> 0
         OR COALESCE(NEW.sessions_completed,0) <> 0 THEN
        RAISE EXCEPTION 'SONGWRITING_FACTORS_SERVER_CONTROLLED' USING ERRCODE='42501';
      END IF;
    ELSIF NEW.polish_progress IS DISTINCT FROM OLD.polish_progress
       OR NEW.consistency_score IS DISTINCT FROM OLD.consistency_score
       OR NEW.sessions_completed IS DISTINCT FROM OLD.sessions_completed THEN
      RAISE EXCEPTION 'SONGWRITING_FACTORS_SERVER_CONTROLLED' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.rockmundo_guard_songwriting_factor_writes() FROM PUBLIC;
DROP TRIGGER IF EXISTS a0_songwriting_factor_write_guard ON public.songwriting_projects;
CREATE TRIGGER a0_songwriting_factor_write_guard
BEFORE INSERT OR UPDATE ON public.songwriting_projects
FOR EACH ROW EXECUTE FUNCTION private.rockmundo_guard_songwriting_factor_writes();

-- Estimate historical, completed-session factor contributions from recorded
-- actual music/lyrics gains and duration. These are for continuity in the
-- progress display; legacy song quality, completion rolls and XP never change.
WITH ordered AS (
  SELECT s.id,
    ROW_NUMBER() OVER (PARTITION BY s.project_id ORDER BY s.completed_at, s.id) AS seq,
    CASE WHEN s.effort_hours IN (1,2,4) THEN s.effort_hours ELSE 1 END AS hours,
    GREATEST(0,COALESCE(s.music_progress_gained,0)) AS music,
    GREATEST(0,COALESCE(s.lyrics_progress_gained,0)) AS lyrics
  FROM public.songwriting_sessions s
  WHERE s.completed_at IS NOT NULL
    AND s.polish_gained IS NULL AND s.consistency_gained IS NULL
), estimated AS (
  SELECT id,
    GREATEST(0,LEAST(500,ROUND(
      (7 + hours*3 + LEAST(12,(music+lyrics)/240.0))
      * GREATEST(0.25,1 - (seq-1)*0.07))::integer)) AS polish,
    GREATEST(0,LEAST(500,ROUND(
      (7 + hours*3 + LEAST(12,LEAST(music,lyrics)/120.0))
      * GREATEST(0.25,1 - (seq-1)*0.07))::integer)) AS consistency
  FROM ordered
)
UPDATE public.songwriting_sessions s
SET polish_gained=e.polish,
    consistency_gained=e.consistency,
    progress_breakdown=COALESCE(s.progress_breakdown,'{}'::jsonb)
      || jsonb_build_object('factor_version','songwriting_factors_legacy_estimate_v1',
                           'legacy_estimate',true,'polishGained',e.polish,
                           'consistencyGained',e.consistency)
FROM estimated e WHERE s.id=e.id;

-- Reconcile factor totals from the session ledger; leave music, lyrics,
-- existing song quality and the post-completion final polish state untouched.
WITH totals AS (
  SELECT s.project_id,
    LEAST(500,SUM(COALESCE(s.polish_gained,0)))::integer AS polish,
    LEAST(500,SUM(COALESCE(s.consistency_gained,0)))::integer AS consistency
  FROM public.songwriting_sessions s
  WHERE s.completed_at IS NOT NULL
  GROUP BY s.project_id
)
UPDATE public.songwriting_projects p
SET polish_progress=t.polish, consistency_score=t.consistency,
    calculation_version=COALESCE(p.calculation_version,'songwriting_factors_live_v1'),
    songwriting_breakdown=COALESCE(p.songwriting_breakdown,'{}'::jsonb)
      || jsonb_build_object('polish_progress',t.polish,'consistency_score',t.consistency,
                           'legacy_factor_backfill',true)
FROM totals t WHERE p.id=t.project_id
  AND (p.polish_progress IS DISTINCT FROM t.polish
    OR p.consistency_score IS DISTINCT FROM t.consistency);
NOTIFY pgrst, 'reload schema';

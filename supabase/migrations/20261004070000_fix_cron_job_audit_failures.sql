-- Cron audit fixes verified in production on 2026-10-04.
-- 1) Fix company demand treasury ledger column drift (entry_type -> type).
-- 2) Batch chart achievement reconciliation so daily chart rebuilds do not
--    execute a full achievement reconciliation once per inserted chart row.
-- 3) Retire stale cron-monitor config entries whose Edge Functions no longer exist.

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.resolve_company_demand(date)'::regprocedure)
    INTO v_def;

  IF position('city_treasury_ledger(city_id,entry_type,amount,description)' in v_def) > 0 THEN
    v_def := replace(
      v_def,
      'city_treasury_ledger(city_id,entry_type,amount,description)',
      'city_treasury_ledger(city_id,type,amount,description)'
    );
    EXECUTE v_def;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_reconcile_achievements_chart_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_profile_id uuid;
  v_song public.songs%ROWTYPE;
BEGIN
  IF NEW.rank IS DISTINCT FROM 1 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_song FROM public.songs WHERE id=NEW.song_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_song.profile_id IS NOT NULL THEN
    PERFORM public.reconcile_profile_achievements(v_song.profile_id);
  ELSIF v_song.user_id IS NOT NULL THEN
    FOR v_profile_id IN SELECT p.id FROM public.profiles p WHERE p.user_id=v_song.user_id LOOP
      PERFORM public.reconcile_profile_achievements(v_profile_id);
    END LOOP;
  END IF;

  IF v_song.band_id IS NOT NULL THEN
    FOR v_profile_id IN
      SELECT DISTINCT bm.profile_id
      FROM public.band_members bm
      WHERE bm.band_id=v_song.band_id AND bm.profile_id IS NOT NULL
    LOOP
      PERFORM public.reconcile_profile_achievements(v_profile_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_reconcile_achievements_chart_entries_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_profile_id uuid;
BEGIN
  FOR v_profile_id IN
    WITH top_songs AS (
      SELECT DISTINCT song_id
      FROM new_chart_rows
      WHERE rank = 1 AND song_id IS NOT NULL
    ),
    affected_profiles AS (
      SELECT s.profile_id
      FROM public.songs s
      JOIN top_songs t ON t.song_id=s.id
      WHERE s.profile_id IS NOT NULL
      UNION
      SELECT p.id
      FROM public.songs s
      JOIN top_songs t ON t.song_id=s.id
      JOIN public.profiles p ON p.user_id=s.user_id
      WHERE s.user_id IS NOT NULL
      UNION
      SELECT bm.profile_id
      FROM public.songs s
      JOIN top_songs t ON t.song_id=s.id
      JOIN public.band_members bm ON bm.band_id=s.band_id
      WHERE s.band_id IS NOT NULL AND bm.profile_id IS NOT NULL
    )
    SELECT DISTINCT profile_id
    FROM affected_profiles
    WHERE profile_id IS NOT NULL
  LOOP
    PERFORM public.reconcile_profile_achievements(v_profile_id);
  END LOOP;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_reconcile_achievements_chart_entry ON public.chart_entries;
DROP TRIGGER IF EXISTS trg_reconcile_achievements_chart_entries_insert ON public.chart_entries;
DROP TRIGGER IF EXISTS trg_reconcile_achievements_chart_entry_update ON public.chart_entries;

CREATE TRIGGER trg_reconcile_achievements_chart_entries_insert
AFTER INSERT ON public.chart_entries
REFERENCING NEW TABLE AS new_chart_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.trg_reconcile_achievements_chart_entries_insert();

CREATE TRIGGER trg_reconcile_achievements_chart_entry_update
AFTER UPDATE OF rank ON public.chart_entries
FOR EACH ROW
WHEN (NEW.rank = 1)
EXECUTE FUNCTION public.trg_reconcile_achievements_chart_entry();

UPDATE public.cron_job_config
SET is_active=false, updated_at=now()
WHERE edge_function_name IN (
  'check-company-bankruptcy',
  'generate-company-reports',
  'process-company-operations',
  'process-company-payroll',
  'process-logistics-contracts',
  'process-studio-bookings',
  'process-venue-bookings',
  'process-daily-updates'
)
AND is_active=true;


-- Edge Functions can be terminated by the runtime before their catch/finally path
-- can update cron_job_runs. Reconcile abandoned "running" rows so the admin
-- monitor reports interrupted executions as errors instead of running forever.
CREATE OR REPLACE FUNCTION public.reconcile_stale_cron_job_runs(
  p_stale_after interval DEFAULT interval '10 minutes'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.cron_job_runs
  SET status = 'error',
      completed_at = COALESCE(completed_at, now()),
      duration_ms = COALESCE(
        duration_ms,
        GREATEST(0, (extract(epoch FROM (now() - started_at)) * 1000)::bigint)
      ),
      error_count = GREATEST(COALESCE(error_count, 0), 1),
      error_message = COALESCE(
        error_message,
        'Execution interrupted or timed out before completion was recorded'
      ),
      result_summary = COALESCE(
        result_summary,
        '{"error":"Execution interrupted or timed out before completion was recorded","reconciled":true}'::jsonb
      )
  WHERE status = 'running'
    AND started_at < now() - p_stale_after;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.reconcile_stale_cron_job_runs(interval)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_stale_cron_job_runs(interval)
TO service_role;

SELECT cron.schedule(
  'reconcile-stale-cron-job-runs',
  '*/10 * * * *',
  $$SELECT public.reconcile_stale_cron_job_runs(interval '10 minutes');$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reconcile-stale-cron-job-runs'
);

CREATE OR REPLACE FUNCTION public.process_inactive_character_comas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH updated AS (
    UPDATE public.profiles p
       SET died_at = now(),
           is_active = false,
           death_cause = 'Coma (extended inactivity)'
     WHERE p.died_at IS NULL
       AND p.last_login_at IS NOT NULL
       AND p.last_login_at < now() - interval '45 days'
    RETURNING p.id
  )
  SELECT count(*)::integer INTO v_count FROM updated;

  RETURN jsonb_build_object('comatose', COALESCE(v_count, 0), 'threshold_days', 45);
END;
$$;

REVOKE ALL ON FUNCTION public.process_inactive_character_comas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_inactive_character_comas() TO service_role;

SELECT cron.unschedule('process-inactive-character-comas')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-inactive-character-comas');

SELECT cron.schedule(
  'process-inactive-character-comas',
  '30 3 * * *',
  $cron$SELECT public.process_inactive_character_comas();$cron$
);
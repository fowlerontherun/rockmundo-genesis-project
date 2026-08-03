CREATE OR REPLACE FUNCTION public.process_offline_health_decay()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_skipped integer;
BEGIN
  SELECT count(*)::integer
    INTO v_skipped
    FROM public.profiles p
   WHERE p.died_at IS NULL
     AND p.last_login_at < now() - interval '24 hours';

  RETURN jsonb_build_object(
    'processed', 0,
    'deaths', 0,
    'skipped', COALESCE(v_skipped, 0),
    'reason', 'offline time does not affect character health'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_offline_health_decay() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_offline_health_decay() TO service_role;
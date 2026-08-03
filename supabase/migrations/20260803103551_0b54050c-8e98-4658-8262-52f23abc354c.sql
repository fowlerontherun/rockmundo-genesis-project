CREATE OR REPLACE FUNCTION public.check_character_health_decay()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.process_offline_health_decay();
$$;

REVOKE ALL ON FUNCTION public.check_character_health_decay() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_character_health_decay() TO service_role;
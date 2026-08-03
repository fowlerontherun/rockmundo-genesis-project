CREATE OR REPLACE FUNCTION public.revive_character(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.resurrect_character(p_profile_id);
END;
$$;

REVOKE ALL ON FUNCTION public.revive_character(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revive_character(uuid) TO authenticated, service_role;
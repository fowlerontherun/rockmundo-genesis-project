-- Harden profile helpers used by financial obligations RLS/RPCs.

CREATE OR REPLACE FUNCTION public.current_active_player_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND COALESCE(p.is_active, false) = true
    AND p.died_at IS NULL
  ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST, p.id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_player_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.current_active_player_profile_id()
$$;

REVOKE EXECUTE ON FUNCTION public.current_active_player_profile_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_player_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_active_player_profile_id(), public.current_player_profile_id() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

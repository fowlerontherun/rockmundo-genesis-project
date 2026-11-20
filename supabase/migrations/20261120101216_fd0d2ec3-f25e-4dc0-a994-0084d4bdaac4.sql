ALTER FUNCTION public.social_active_room_access(text) SET SCHEMA private;
CREATE FUNCTION public.social_active_room_access(p_room text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$ SELECT private.social_active_room_access(p_room) $$;
REVOKE ALL ON FUNCTION public.social_active_room_access(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.social_active_room_access(text) TO authenticated,service_role;
-- Supabase grants EXECUTE on new functions broadly by default; keep these adult
-- relationship mutations authenticated-only even though the functions also validate auth.uid().
REVOKE EXECUTE ON FUNCTION public.discover_scene_contacts(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.interact_scene_contact(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.discover_scene_contacts(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interact_scene_contact(uuid, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.prepare_festival_edition_runtime(uuid, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_festival_edition_runtime(uuid, uuid, integer, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.transition_festival_edition_runtime(uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_festival_edition_runtime(uuid, integer, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

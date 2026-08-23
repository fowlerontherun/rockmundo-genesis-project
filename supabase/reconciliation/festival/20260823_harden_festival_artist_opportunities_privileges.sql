-- Production parity overlay for the Festival artist opportunity inbox privilege boundary.
REVOKE ALL ON FUNCTION public.get_my_festival_artist_opportunities() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_artist_opportunities() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

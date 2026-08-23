-- Festival opportunity inbox is private to authenticated artists and represented bands.
REVOKE ALL ON FUNCTION public.get_my_festival_artist_opportunities() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_artist_opportunities() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

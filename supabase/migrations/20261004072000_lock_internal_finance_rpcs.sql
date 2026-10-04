revoke execute on function public.credit_city_treasury(uuid, numeric, text, text, uuid) from public, anon, authenticated;
grant execute on function public.credit_city_treasury(uuid, numeric, text, text, uuid) to service_role;

revoke execute on function public.increment_release_revenue(uuid, numeric) from public, anon, authenticated;
grant execute on function public.increment_release_revenue(uuid, numeric) to service_role;

revoke execute on function public.update_song_fame(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.update_song_fame(uuid, integer, text) to service_role;

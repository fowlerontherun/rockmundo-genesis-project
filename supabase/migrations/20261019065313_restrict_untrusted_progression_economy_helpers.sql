-- Deployed directly: Supabase migration receipt 20261019065313.
-- Issue #4226: seven SECURITY DEFINER helpers allowed unauthenticated writes
-- to other players' cash, fame, XP, health, band and relationship records.
-- No balance/stat rows are mutated by this permission-only migration.
-- The service_role and SQL owner retain access for trusted worker paths.
REVOKE ALL ON FUNCTION public.increment_user_cash(uuid,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_user_cash(uuid,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.increment_user_fame(uuid,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_user_fame(uuid,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.update_player_health(uuid,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_player_health(uuid,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.increment_profile_xp(uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_profile_xp(uuid,integer) TO service_role;
REVOKE ALL ON FUNCTION public.increment_value(uuid,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_value(uuid,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.increment_performance_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_performance_count(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.increment_relationship_score(uuid,uuid,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_relationship_score(uuid,uuid,text,numeric) TO service_role;

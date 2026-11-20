CREATE SCHEMA IF NOT EXISTS private;
ALTER FUNCTION public.counter_festival_artist_offer(uuid,integer,jsonb,uuid) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.counter_festival_artist_offer(uuid,integer,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.counter_festival_artist_offer(uuid,integer,jsonb,uuid) TO authenticated;
CREATE FUNCTION public.counter_festival_artist_offer(p_offer_id uuid,p_expected_version integer,p_terms jsonb,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT private.counter_festival_artist_offer(p_offer_id,p_expected_version,p_terms,p_idempotency_key); $$;
REVOKE ALL ON FUNCTION public.counter_festival_artist_offer(uuid,integer,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.counter_festival_artist_offer(uuid,integer,jsonb,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
BEGIN;
DO $check$
BEGIN
 IF has_function_privilege('anon','public.dj_finance_release_health()','EXECUTE')
 OR has_function_privilege('authenticated','public.dj_finance_release_health()','EXECUTE')
 OR NOT has_function_privilege('service_role','public.dj_finance_release_health()','EXECUTE')
 THEN RAISE EXCEPTION 'Finance release diagnostic has unsafe grants';END IF;
END $check$;
SET LOCAL ROLE service_role;
DO $svc$
DECLARE data jsonb;
BEGIN
 data:=public.dj_finance_release_health();
 IF data IS NULL OR data->>'scope'<>'dj_funded_offer_finance_only'
 OR jsonb_typeof(data->'counts')<>'object'
 OR data->>'feature_flags_verified'<>'false' THEN
 RAISE EXCEPTION 'Service role diagnostic output missing fields';END IF;
 RAISE NOTICE 'Service-only finance health RPC succeeded';
END $svc$;
SET LOCAL ROLE authenticated;
DO $client$
BEGIN
 BEGIN
  PERFORM public.dj_finance_release_health();
  RAISE EXCEPTION 'Authenticated browser can read service release diagnostic';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $client$;
ROLLBACK;
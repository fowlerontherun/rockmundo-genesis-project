-- Read-only verification for Support Band Marketplace Phase 4.

SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'estimate_support_travel_minutes',
    'find_tour_support_candidates',
    'find_tour_support_show_candidates'
  )
ORDER BY proname;

SELECT
  to_regprocedure('public.estimate_support_travel_minutes(uuid,uuid)') IS NOT NULL AS has_travel_estimator,
  to_regprocedure('public.find_tour_support_candidates(uuid,uuid)') IS NOT NULL AS has_tour_candidate_rpc,
  to_regprocedure('public.find_tour_support_show_candidates(uuid,uuid)') IS NOT NULL AS has_show_candidate_rpc;

SELECT
  count(*) FILTER (WHERE tour_enabled) AS tour_enabled_bands,
  count(*) FILTER (WHERE enabled AND tour_enabled) AS active_tour_support_bands
FROM public.band_support_preferences;

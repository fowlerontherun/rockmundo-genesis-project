\set ON_ERROR_STOP on
-- Read-only, transaction-scoped public festival runtime contract test.
-- Run AFTER deploying the reviewed canonical projection migration.
BEGIN;
DO $festival_test$
DECLARE
  v_slug text;
  v_public jsonb;
  v_live jsonb;
  v_def text;
BEGIN
  IF to_regprocedure('public.get_public_festival_edition_live_status(text)') IS NULL THEN
    RAISE EXCEPTION 'canonical festival public projection not deployed';
  END IF;
  SELECT pg_get_functiondef('public.get_public_festival_edition_live_status(text)'::regprocedure) INTO v_def;
  IF v_def NOT ILIKE '%SECURITY DEFINER%' OR
     v_def NOT ILIKE '%search_path%' OR
     v_def ILIKE '%get_festival_edition_runtime_control_room%' THEN
    RAISE EXCEPTION 'public runtime security or projection boundary invalid';
  END IF;
  IF NOT has_function_privilege('anon','public.get_public_festival_edition_live_status(text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.get_public_festival_edition_live_status(text)','EXECUTE') THEN
    RAISE EXCEPTION 'public runtime RPC unavailable to visitor clients';
  END IF;
  IF public.get_public_festival_edition_live_status('festival-that-does-not-exist-999') IS NOT NULL THEN
    RAISE EXCEPTION 'unknown festival slug leaked a runtime';
  END IF;
  SELECT coalesce(l.public_slug,p.public_slug) INTO v_slug
  FROM public.festival_launches l
  LEFT JOIN public.festival_public_profiles p ON p.festival_company_id = l.festival_company_id
  WHERE l.public_visibility IN ('public','unlisted')
    AND l.launch_status IN ('launched','tickets_on_sale','sales_paused','sales_closed')
    AND coalesce(l.public_slug,p.public_slug) IS NOT NULL
  ORDER BY l.created_at DESC LIMIT 1;
  IF v_slug IS NOT NULL THEN
    v_public := public.get_public_festival(v_slug);
    v_live := public.get_public_festival_edition_live_status(v_slug);
    IF v_live IS NOT NULL THEN
      IF v_live->>'festivalLaunchId' IS DISTINCT FROM v_public->>'id'
         OR v_live->>'editionId' IS DISTINCT FROM v_public->>'editionId' THEN
        RAISE EXCEPTION 'public runtime identity does not match the published edition';
      END IF;
      IF v_live ?| ARRAY['readiness','sales','staff','sponsors','incidents','blockers','permissions','privatePayload','generatedSchedule'] THEN
        RAISE EXCEPTION 'private owner control-room data exposed';
      END IF;
      IF v_live->'performances' <> '[]'::jsonb
         OR v_live->'stageCrowds' <> '[]'::jsonb THEN
        RAISE EXCEPTION 'public runtime claims unverified stage or crowd activity';
      END IF;
      IF v_live->>'currentDay' IS NULL AND
         (v_live->'attendanceBand' <> 'null'::jsonb OR v_live->'weather' <> 'null'::jsonb) THEN
        RAISE EXCEPTION 'out-of-day runtime observations were exposed';
      END IF;
    END IF;
  END IF;
END
$festival_test$;
ROLLBACK;

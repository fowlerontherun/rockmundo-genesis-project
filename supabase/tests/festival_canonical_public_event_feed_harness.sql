\set ON_ERROR_STOP on
-- Run against a disposable database after the canonical-stage and public-feed
-- migrations. Read-only assertions: no mutations or fake live evidence.
BEGIN;
DO $feed_test$
DECLARE
  v_slug text;
  v_status jsonb;
  v_feed jsonb;
  v_event jsonb;
BEGIN
  IF to_regprocedure('public.get_public_festival_edition_live_experience(text)') IS NULL THEN
    RAISE EXCEPTION 'canonical public event feed migration not deployed';
  END IF;
  IF NOT has_function_privilege('anon','public.get_public_festival_edition_live_experience(text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.get_public_festival_edition_live_experience(text)','EXECUTE') THEN
    RAISE EXCEPTION 'public visitors cannot read the canonical feed';
  END IF;
  IF has_table_privilege('anon','private.festival_edition_stage_events','SELECT')
     OR has_table_privilege('authenticated','private.festival_edition_stage_events','SELECT') THEN
    RAISE EXCEPTION 'private stage ledger exposed to browsers';
  END IF;
  IF public.get_public_festival_edition_live_experience('nonexistent-public-festival-999') IS NOT NULL THEN
    RAISE EXCEPTION 'unknown public slug leaked live data';
  END IF;

  SELECT coalesce(l.public_slug,p.public_slug) INTO v_slug
  FROM public.festival_launches l
  LEFT JOIN public.festival_public_profiles p ON p.festival_company_id=l.festival_company_id
  WHERE l.public_visibility IN ('public','unlisted')
    AND l.launch_status IN ('launched','tickets_on_sale','sales_paused','sales_closed')
    AND coalesce(l.public_slug,p.public_slug) IS NOT NULL
  ORDER BY l.created_at DESC LIMIT 1;
  IF v_slug IS NULL THEN RETURN; END IF;
  v_status := public.get_public_festival_edition_live_status(v_slug);
  v_feed := public.get_public_festival_edition_live_experience(v_slug);
  IF v_status IS NULL THEN
    IF v_feed IS NOT NULL THEN RAISE EXCEPTION 'feed escaped canonical status publication gate'; END IF;
    RETURN;
  END IF;
  IF v_feed->>'editionId' IS DISTINCT FROM v_status->>'editionId'
     OR v_feed->>'festivalLaunchId' IS DISTINCT FROM v_status->>'festivalLaunchId'
     OR v_feed->>'currentDay' IS DISTINCT FROM v_status->>'currentDay' THEN
    RAISE EXCEPTION 'feed and canonical status disagree on edition identity';
  END IF;
  IF v_feed->'feedAvailable' <> 'true'::jsonb
     OR jsonb_typeof(v_feed->'messages') IS DISTINCT FROM 'array'
     OR v_feed ?| ARRAY['staff','incidents','generatedSchedule','privatePayload','exactCrowd'] THEN
    RAISE EXCEPTION 'public feed contract leaked private data';
  END IF;
  FOR v_event IN SELECT value FROM jsonb_array_elements(v_feed->'messages') LOOP
    IF v_event->>'kind' IS DISTINCT FROM 'stage'
       OR v_event->>'status' NOT IN ('ready','changeover','soundcheck','starting','live','delayed','completed','cancelled')
       OR v_event ?| ARRAY['message','privatePayload','incident','exactCrowd','staff','artistName'] THEN
      RAISE EXCEPTION 'unapproved source payload in public event';
    END IF;
  END LOOP;
END
$feed_test$;
ROLLBACK;

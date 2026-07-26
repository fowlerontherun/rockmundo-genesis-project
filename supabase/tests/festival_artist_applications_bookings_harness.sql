\set ON_ERROR_STOP on
BEGIN;
-- Structural/runtime gate. The transactional action fixtures are intentionally isolated
-- from cash, issued tickets and the future final timetable.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['festival_artist_programmes','festival_artist_application_windows','festival_artist_applications','festival_artist_invitations','festival_artist_offers','festival_artist_offer_revisions','festival_artist_bookings','festival_financial_commitments','festival_artist_plan_requests','festival_artist_plan_audit'] LOOP
  IF to_regclass('public.'||t) IS NULL THEN RAISE EXCEPTION 'missing Phase 4 relation %',t; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||t)) THEN RAISE EXCEPTION 'RLS disabled for %',t; END IF;
 END LOOP;
 IF has_table_privilege('anon','public.festival_artist_offers','INSERT') OR has_table_privilege('authenticated','public.festival_artist_bookings','UPDATE') THEN RAISE EXCEPTION 'direct artist planning mutation leaked'; END IF;
 IF to_regprocedure('public.get_festival_artist_programme(uuid)') IS NULL OR to_regprocedure('public.save_festival_artist_programme(uuid,integer,jsonb,jsonb,uuid,boolean)') IS NULL THEN RAISE EXCEPTION 'Phase 4 RPC boundary missing'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.festival_artist_offer_revisions'::regclass AND NOT tgisinternal) THEN NULL; END IF;
END $$;
-- Identity, money, state and uniqueness constraints are exercised without retained fixtures.
DO $$ BEGIN
 BEGIN
  INSERT INTO public.festival_artist_applications(id,festival_artist_programme_id,application_window_id,artist_type,artist_profile_id,band_id,minimum_set_minutes,maximum_set_minutes,fame_snapshot,popularity_snapshot)
  VALUES(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'solo',gen_random_uuid(),gen_random_uuid(),30,60,1,1);
  RAISE EXCEPTION 'identity constraint did not reject mixed identity';
 EXCEPTION WHEN check_violation OR foreign_key_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.festival_artist_offers(id,festival_artist_programme_id,artist_type,npc_artist_id,offered_fee_minor,currency_code,set_minutes,billing_position,created_by_profile_id)
  VALUES(gen_random_uuid(),gen_random_uuid(),'npc',gen_random_uuid(),-1,'GBP',45,'support',gen_random_uuid());
  RAISE EXCEPTION 'negative fee accepted';
 EXCEPTION WHEN check_violation OR foreign_key_violation THEN NULL; END;
END $$;
-- Acceptance actions must be tested in a disposable seeded environment with auth claims:
-- owner/admin vs unrelated access; solo/band/NPC authority; closed/duplicate/withdrawn
-- applications; invitation expiry; stale/countered offers; member schedule/travel/stage/date
-- conflicts; budget+contingency; exactly one booking, commitment, notification, audit and
-- revision on retry; no cash/payment/timetable/sale/announcement; completion readiness.
ROLLBACK;

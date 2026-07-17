-- Festival creation phase 1 executable harness.
-- Run with: supabase db reset && psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_creation_phase1_harness.sql
-- The harness seeds deterministic admin/non-admin actors and rolls back all data.

BEGIN;
CREATE SCHEMA IF NOT EXISTS test_festival_creation;
CREATE OR REPLACE FUNCTION test_festival_creation.as_user(user_id uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM set_config('request.jwt.claim.sub', user_id::text, true); PERFORM set_config('request.jwt.claim.role', 'authenticated', true); END $$;
CREATE OR REPLACE FUNCTION test_festival_creation.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE 'SET LOCAL ROLE anon'; PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claim.role', 'anon', true); END $$;
CREATE OR REPLACE FUNCTION test_festival_creation.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE 'SET LOCAL ROLE service_role'; PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claim.role', 'service_role', true); END $$;
CREATE OR REPLACE FUNCTION test_festival_creation.assert_true(label text, actual boolean) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF actual IS DISTINCT FROM true THEN RAISE EXCEPTION 'assertion failed: %', label; END IF; END $$;
CREATE OR REPLACE FUNCTION test_festival_creation.assert_eq(label text, actual bigint, expected bigint) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'assertion failed: %, expected %, got %', label, expected, actual; END IF; END $$;
CREATE OR REPLACE FUNCTION test_festival_creation.assert_raises(label text, statement text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN RETURN; END; RAISE EXCEPTION 'assertion failed: % should have raised', label; END $$;

DO $$
DECLARE
  admin_user uuid := '71000000-0000-0000-0000-000000000001'; normal_user uuid := '71000000-0000-0000-0000-000000000002';
  admin_profile uuid := '72000000-0000-0000-0000-000000000001'; normal_profile uuid := '72000000-0000-0000-0000-000000000002';
  city_a uuid := '73000000-0000-0000-0000-000000000001'; city_b uuid := '73000000-0000-0000-0000-000000000002'; venue_a uuid := '74000000-0000-0000-0000-000000000001'; venue_b uuid := '74000000-0000-0000-0000-000000000002';
  payload jsonb; payload2 jsonb; res jsonb; res_retry jsonb; festival uuid; edition uuid; stage uuid; before_f bigint; before_e bigint; before_s bigint; reqs bigint;
BEGIN
  IF NOT has_function_privilege('authenticated', 'public.admin_create_festival_with_first_edition(jsonb)', 'EXECUTE') THEN RAISE EXCEPTION 'create first-edition RPC grant missing'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.admin_create_festival_edition_with_setup(uuid,jsonb)', 'EXECUTE') THEN RAISE EXCEPTION 'add edition RPC grant missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='admin_festival_creation_requests' AND column_name='actor_user_id' AND is_nullable='NO') THEN RAISE EXCEPTION 'actor_user_id must be non-null'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='admin_festival_creation_requests' AND indexname='admin_festival_creation_requests_actor_user_operation_key') THEN RAISE EXCEPTION 'actor-user idempotency unique index missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tg_festival_stage_edition_consistency') THEN RAISE EXCEPTION 'stage consistency trigger missing'; END IF;

  PERFORM test_festival_creation.as_service();
  INSERT INTO auth.users(id,email,role) VALUES (admin_user,'festival-phase1-admin@example.test','authenticated'), (normal_user,'festival-phase1-user@example.test','authenticated');
  INSERT INTO public.profiles(id,user_id,username,display_name) VALUES (admin_profile,admin_user,'festival_phase1_admin','Festival Admin'), (normal_profile,normal_user,'festival_phase1_user','Festival User');
  INSERT INTO public.user_roles(user_id,role) VALUES (admin_user,'admin'), (normal_user,'user');
  INSERT INTO public.cities(id,name,country,timezone) VALUES (city_a,'Harness City','United States','America/New_York'), (city_b,'Mismatch City','United Kingdom','Europe/London');
  INSERT INTO public.venues(id,name,city_id,capacity) VALUES (venue_a,'Harness Venue',city_a,5000), (venue_b,'Mismatch Venue',city_b,1000);

  payload := jsonb_build_object('mode','create_festival','idempotencyKey','phase1-key-1','identity',jsonb_build_object('name','Phase 1 Harness Fest','shortDescription','safe','fullDescription','safe festival','festivalType','recurring','primaryGenres',jsonb_build_array('Rock'),'isPublic',true),'edition',jsonb_build_object('title','Phase 1 2027','editionNumber',99,'startAt','2027-07-17T18:00:00Z','endAt','2027-07-19T23:00:00Z','applicationsOpenAt','2027-01-01T00:00:00Z','applicationsCloseAt','2027-03-01T00:00:00Z','bookingDeadlineAt','2027-05-01T00:00:00Z','timezone','America/New_York','currencyCode','USD'),'location',jsonb_build_object('country','United States','cityId',city_a,'venueId',venue_a,'capacity',4000,'minTicketPriceCents',2500,'maxTicketPriceCents',7500,'defaultTicketPriceCents',5000,'festivalDays',3),'stages',jsonb_build_array(jsonb_build_object('name','Main Stage','type','main','capacity',3000,'changeoverMinutes',30,'curfew','23:00','weatherProtection','covered','soundCapability','festival_grade','lightingCapability','premium')),'commercial',jsonb_build_object('estimatedAttendance',3500,'operatingBudgetCents',10000000,'performerBudgetCents',5000000,'staffingBudgetCents',2000000,'marketingBudgetCents',1000000,'sponsorshipEnabled',true,'merchandiseEnabled',true,'concessionsEnabled',true));

  PERFORM test_festival_creation.as_anon();
  PERFORM test_festival_creation.assert_raises('anonymous creation denied', format('SELECT public.admin_create_festival_with_first_edition(%L::jsonb)', payload::text));
  PERFORM test_festival_creation.as_user(normal_user);
  PERFORM test_festival_creation.assert_raises('non-admin creation denied', format('SELECT public.admin_create_festival_with_first_edition(%L::jsonb)', payload::text));

  PERFORM test_festival_creation.as_user(admin_user);
  SELECT count(*) INTO before_f FROM public.festivals; SELECT count(*) INTO before_e FROM public.festival_editions; SELECT count(*) INTO before_s FROM public.festival_stages;
  res := public.admin_create_festival_with_first_edition(payload); festival := (res->>'festival_id')::uuid; edition := (res->>'edition_id')::uuid; stage := (res->'stage_ids'->>0)::uuid;
  PERFORM test_festival_creation.assert_eq('one festival created', (SELECT count(*) FROM public.festivals)-before_f, 1);
  PERFORM test_festival_creation.assert_eq('one first edition created', (SELECT count(*) FROM public.festival_editions)-before_e, 1);
  PERFORM test_festival_creation.assert_true('stage created', (SELECT count(*) FROM public.festival_stages WHERE edition_id=edition) >= 1);
  PERFORM test_festival_creation.assert_true('edition belongs to festival', EXISTS (SELECT 1 FROM public.festival_editions WHERE id=edition AND festival_id=festival AND edition_number=1 AND status='planning' AND city_id=city_a AND currency_code='USD' AND timezone='America/New_York' AND minimum_ticket_price_cents=2500 AND maximum_ticket_price_cents=7500 AND public_metadata->>'default_ticket_price_cents'='5000'));
  PERFORM test_festival_creation.assert_true('stage belongs to edition and festival', EXISTS (SELECT 1 FROM public.festival_stages WHERE id=stage AND edition_id=edition AND festival_id=festival));
  PERFORM test_festival_creation.assert_true('audit written', EXISTS (SELECT 1 FROM public.festival_admin_audit_events WHERE festival_id=festival AND edition_id=edition));
  PERFORM test_festival_creation.assert_true('lifecycle history written', EXISTS (SELECT 1 FROM public.festival_edition_lifecycle_events WHERE edition_id=edition AND to_status='planning'));
  PERFORM test_festival_creation.assert_true('no game event created', NOT EXISTS (SELECT 1 FROM public.game_events WHERE id=festival));
  SELECT count(*) INTO reqs FROM public.admin_festival_creation_requests WHERE festival_id=festival;
  PERFORM test_festival_creation.assert_eq('only outer request record remains', reqs, 1);
  res_retry := public.admin_create_festival_with_first_edition(payload);
  PERFORM test_festival_creation.assert_true('idempotent retry returns original', (res_retry->>'festival_id')::uuid=festival AND (res_retry->>'edition_id')::uuid=edition AND (res_retry->>'created')::boolean=false);
  payload2 := jsonb_set(payload,'{identity,name}','"Changed Harness Fest"');
  PERFORM test_festival_creation.assert_raises('payload mismatch denied', format('SELECT public.admin_create_festival_with_first_edition(%L::jsonb)', payload2::text));

  PERFORM test_festival_creation.assert_raises('invalid dates rollback', format('SELECT public.admin_create_festival_with_first_edition(%L::jsonb)', jsonb_set(payload,'{idempotencyKey}','"bad-dates"') #- '{edition,endAt}' || jsonb_build_object('edition',(payload->'edition') || jsonb_build_object('endAt','2027-01-01T00:00:00Z'))));
  PERFORM test_festival_creation.assert_raises('invalid city rollback', format('SELECT public.admin_create_festival_with_first_edition(%L::jsonb)', jsonb_set(payload,'{idempotencyKey}','"bad-city"') || jsonb_build_object('location',(payload->'location') || jsonb_build_object('cityId','00000000-0000-0000-0000-000000000000'))));
  PERFORM test_festival_creation.assert_raises('venue city mismatch rejected', format('SELECT public.admin_create_festival_with_first_edition(%L::jsonb)', jsonb_set(payload,'{idempotencyKey}','"bad-venue-city"') || jsonb_build_object('location',(payload->'location') || jsonb_build_object('venueId',venue_b))));
  PERFORM test_festival_creation.assert_raises('duplicate stages rollback', format('SELECT public.admin_create_festival_with_first_edition(%L::jsonb)', jsonb_set(payload,'{idempotencyKey}','"bad-dupe-stage"') || jsonb_build_object('stages',jsonb_build_array(payload->'stages'->0,payload->'stages'->0))));
  PERFORM test_festival_creation.assert_raises('unsupported currency rejected', format('SELECT public.admin_create_festival_with_first_edition(%L::jsonb)', jsonb_set(payload,'{idempotencyKey}','"bad-currency"') || jsonb_build_object('edition',(payload->'edition') || jsonb_build_object('currencyCode','BTC'))));
  PERFORM test_festival_creation.assert_raises('unsupported timezone rejected', format('SELECT public.admin_create_festival_with_first_edition(%L::jsonb)', jsonb_set(payload,'{idempotencyKey}','"bad-timezone"') || jsonb_build_object('edition',(payload->'edition') || jsonb_build_object('timezone','Mars/Base'))));

  res := public.admin_create_festival_edition_with_setup(festival, (payload || jsonb_build_object('mode','add_edition','existingFestivalId',festival,'idempotencyKey','phase1-add-2','edition',(payload->'edition') || jsonb_build_object('title','Phase 1 2028','startAt','2028-07-17T18:00:00Z','endAt','2028-07-19T23:00:00Z','applicationsOpenAt','2028-01-01T00:00:00Z','applicationsCloseAt','2028-03-01T00:00:00Z','bookingDeadlineAt','2028-05-01T00:00:00Z'))));
  res := public.admin_create_festival_edition_with_setup(festival, (payload || jsonb_build_object('mode','add_edition','existingFestivalId',festival,'idempotencyKey','phase1-add-3','edition',(payload->'edition') || jsonb_build_object('title','Phase 1 2029','startAt','2029-07-17T18:00:00Z','endAt','2029-07-19T23:00:00Z','applicationsOpenAt','2029-01-01T00:00:00Z','applicationsCloseAt','2029-03-01T00:00:00Z','bookingDeadlineAt','2029-05-01T00:00:00Z'))));
  PERFORM test_festival_creation.assert_true('later edition gets next number', EXISTS (SELECT 1 FROM public.festival_editions WHERE id=(res->>'edition_id')::uuid AND festival_id=festival AND edition_number=3));
  PERFORM test_festival_creation.assert_true('request rows do not outlive failed aggregates', NOT EXISTS (SELECT 1 FROM public.admin_festival_creation_requests WHERE idempotency_key LIKE 'bad-%'));
END $$;
ROLLBACK;

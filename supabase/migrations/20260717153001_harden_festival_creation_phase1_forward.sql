-- Forward-only hardening for Phase 1 admin festival creation.
-- This migration intentionally does not modify the previously merged
-- 20260717120000_admin_festival_creation_phase1.sql history file.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS public.admin_festival_creation_requests
  ADD COLUMN IF NOT EXISTS actor_user_id uuid;

UPDATE public.admin_festival_creation_requests request
SET actor_user_id = profile.user_id
FROM public.profiles profile
WHERE request.actor_user_id IS NULL
  AND request.actor_profile_id = profile.id
  AND profile.user_id IS NOT NULL;

ALTER TABLE IF EXISTS public.admin_festival_creation_requests
  ADD COLUMN IF NOT EXISTS actor_resolution_status text NOT NULL DEFAULT 'resolved';

UPDATE public.admin_festival_creation_requests
SET actor_resolution_status = CASE WHEN actor_user_id IS NULL THEN 'historical_unresolved' ELSE 'resolved' END
WHERE actor_resolution_status IS NULL OR actor_resolution_status = 'resolved';

ALTER TABLE public.admin_festival_creation_requests
  DROP CONSTRAINT IF EXISTS admin_festival_creation_requests_actor_user_id_not_null;
ALTER TABLE public.admin_festival_creation_requests
  ADD CONSTRAINT admin_festival_creation_requests_actor_user_id_new_writes
  CHECK (actor_user_id IS NOT NULL OR actor_resolution_status = 'historical_unresolved') NOT VALID;
ALTER TABLE public.admin_festival_creation_requests
  VALIDATE CONSTRAINT admin_festival_creation_requests_actor_user_id_new_writes;

ALTER TABLE public.admin_festival_creation_requests
  DROP CONSTRAINT IF EXISTS admin_festival_creation_requests_actor_profile_id_operation_idemp_key;
ALTER TABLE public.admin_festival_creation_requests
  DROP CONSTRAINT IF EXISTS admin_festival_creation_requests_actor_user_id_operation_idempotency_key_key;
DROP INDEX IF EXISTS public.admin_festival_creation_requests_actor_profile_id_operation_idempo_key;
DROP INDEX IF EXISTS public.admin_festival_creation_requests_actor_user_operation_key;
CREATE UNIQUE INDEX IF NOT EXISTS admin_festival_creation_requests_actor_user_operation_key
  ON public.admin_festival_creation_requests(actor_user_id, operation, idempotency_key)
  WHERE actor_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.festival_creation_country_code(p_country text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(trim(coalesce(p_country,'')))
    WHEN 'united states' THEN 'US' WHEN 'usa' THEN 'US' WHEN 'us' THEN 'US'
    WHEN 'united kingdom' THEN 'GB' WHEN 'uk' THEN 'GB' WHEN 'great britain' THEN 'GB'
    WHEN 'france' THEN 'FR' WHEN 'germany' THEN 'DE' WHEN 'spain' THEN 'ES'
    WHEN 'italy' THEN 'IT' WHEN 'netherlands' THEN 'NL' WHEN 'canada' THEN 'CA'
    WHEN 'australia' THEN 'AU' WHEN '' THEN 'ZZ'
    ELSE upper(substr(regexp_replace(trim(p_country), '[^A-Za-z]', '', 'g'), 1, 2))
  END
$$;

CREATE OR REPLACE FUNCTION public.festival_creation_currency_for_country(p_country text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE public.festival_creation_country_code(p_country)
    WHEN 'GB' THEN 'GBP'
    WHEN 'FR' THEN 'EUR' WHEN 'DE' THEN 'EUR' WHEN 'ES' THEN 'EUR' WHEN 'IT' THEN 'EUR' WHEN 'NL' THEN 'EUR'
    WHEN 'CA' THEN 'CAD' WHEN 'AU' THEN 'AUD'
    ELSE 'USD'
  END
$$;

CREATE OR REPLACE FUNCTION public.admin_festival_reference_data()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH city_rows AS (
  SELECT c.id, c.name, c.country, public.festival_creation_country_code(c.country) AS country_code,
         coalesce(c.timezone,'UTC') AS timezone, public.festival_creation_currency_for_country(c.country) AS currency_code
  FROM public.cities c
), genre_rows AS (
  SELECT unnest(ARRAY['Rock','Pop','Metal','Electronic','Hip Hop','Country','Folk','Jazz','Punk','Indie','Alternative','R&B']) AS genre
  UNION SELECT DISTINCT b.genre FROM public.bands b WHERE b.genre IS NOT NULL
)
SELECT jsonb_build_object(
  'festivalTypes', jsonb_build_array('recurring','touring','one_off','community','showcase'),
  'genres', (SELECT coalesce(jsonb_agg(DISTINCT genre ORDER BY genre),'[]'::jsonb) FROM genre_rows),
  'currencies', jsonb_build_array('USD','EUR','GBP','CAD','AUD'),
  'countries', (SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('code',country_code,'name',coalesce(country,'Unknown'))),'[]'::jsonb) FROM city_rows),
  'cities', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'country',country_code,'countryName',country,'timezone',timezone,'currencyCode',currency_code) ORDER BY country,name),'[]'::jsonb) FROM city_rows),
  'venues', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'cityId',city_id,'capacity',capacity) ORDER BY name),'[]'::jsonb) FROM public.venues),
  'stageTypes', jsonb_build_array('main','second','tent','club','acoustic','experimental'),
  'weatherOptions', jsonb_build_array('open_air','covered','indoor'),
  'soundOptions', jsonb_build_array('basic','standard','premium','festival_grade'),
  'lightingOptions', jsonb_build_array('basic','standard','premium','festival_grade'),
  'commercialDefaults', jsonb_build_object('currencyCode','USD','minimumTicketPriceCents',0,'maximumTicketPriceCents',10000,'defaultTicketPriceCents',2500,'fallbackCurrencyApplied',true)
)
$$;
GRANT EXECUTE ON FUNCTION public.admin_festival_reference_data() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.internal_create_festival_edition_setup(
  p_festival_id uuid, p_payload jsonb, p_actor_user_id uuid, p_actor_profile_id uuid,
  p_operation_key text, p_forced_edition_number integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_festival public.festivals%ROWTYPE; v_edition public.festival_editions%ROWTYPE; v_stage jsonb; v_stage_ids uuid[] := ARRAY[]::uuid[]; v_stage_id uuid; v_stage_number int := 0;
  v_location jsonb := coalesce(p_payload->'location','{}'::jsonb); v_edition_payload jsonb := coalesce(p_payload->'edition','{}'::jsonb); v_commercial jsonb := coalesce(p_payload->'commercial','{}'::jsonb);
  v_start timestamptz := nullif(v_edition_payload->>'startAt','')::timestamptz; v_end timestamptz := nullif(v_edition_payload->>'endAt','')::timestamptz; v_app_open timestamptz := nullif(v_edition_payload->>'applicationsOpenAt','')::timestamptz; v_app_close timestamptz := nullif(v_edition_payload->>'applicationsCloseAt','')::timestamptz; v_booking timestamptz := nullif(v_edition_payload->>'bookingDeadlineAt','')::timestamptz;
  v_city uuid := nullif(v_location->>'cityId','')::uuid; v_venue uuid := nullif(v_location->>'venueId','')::uuid; v_capacity int := coalesce((v_location->>'capacity')::int,0); v_min bigint := coalesce((v_location->>'minTicketPriceCents')::bigint,0); v_max bigint := coalesce((v_location->>'maxTicketPriceCents')::bigint,0); v_default bigint := coalesce((v_location->>'defaultTicketPriceCents')::bigint,v_min); v_number int;
BEGIN
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  SELECT * INTO v_festival FROM public.festivals WHERE id=p_festival_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_CREATE_FESTIVAL_INVALID'; END IF;
  IF p_forced_edition_number IS NULL THEN SELECT coalesce(max(edition_number),0)+1 INTO v_number FROM public.festival_editions WHERE festival_id=p_festival_id; ELSE v_number := p_forced_edition_number; END IF;
  IF v_start IS NULL OR v_end IS NULL OR v_end <= v_start OR v_start < now() OR v_app_open IS NULL OR v_app_close IS NULL OR v_app_close < v_app_open OR v_app_close >= v_start OR (v_booking IS NOT NULL AND (v_booking < v_app_close OR v_booking > v_start)) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_INVALID_DATE'; END IF;
  IF v_city IS NULL OR NOT EXISTS (SELECT 1 FROM public.cities WHERE id=v_city) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_CITY_INVALID'; END IF;
  IF v_venue IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.venues WHERE id=v_venue AND city_id=v_city) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_VENUE_INVALID'; END IF;
  IF coalesce(v_edition_payload->>'timezone','') NOT IN (SELECT name FROM pg_timezone_names) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_TIMEZONE_INVALID'; END IF;
  IF coalesce(v_edition_payload->>'currencyCode','') NOT IN ('USD','EUR','GBP','CAD','AUD') THEN RAISE EXCEPTION 'FESTIVAL_CREATE_CURRENCY_INVALID'; END IF;
  IF v_capacity <= 0 OR v_min < 0 OR v_max < v_min OR v_default < v_min OR v_default > v_max THEN RAISE EXCEPTION 'FESTIVAL_CREATE_CAPACITY_OR_PRICE_INVALID'; END IF;
  IF v_venue IS NOT NULL AND EXISTS (SELECT 1 FROM public.venues WHERE id=v_venue AND capacity IS NOT NULL AND v_capacity > capacity) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_CAPACITY_EXCEEDED'; END IF;
  IF jsonb_array_length(coalesce(p_payload->'stages','[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_REQUIRED'; END IF;
  IF coalesce((v_commercial->>'operatingBudgetCents')::bigint,0) < 0 OR coalesce((v_commercial->>'performerBudgetCents')::bigint,0) < 0 OR coalesce((v_commercial->>'staffingBudgetCents')::bigint,0) < 0 OR coalesce((v_commercial->>'marketingBudgetCents')::bigint,0) < 0 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_BUDGET_INVALID'; END IF;
  INSERT INTO public.festival_editions(festival_id, edition_number, edition_year, title, description, city_id, venue_id, start_at, end_at, timezone, expected_attendance, capacity, minimum_ticket_price_cents, maximum_ticket_price_cents, currency_code, budget_cents, status, public_metadata, created_by, legacy_metadata)
  VALUES (p_festival_id, v_number, extract(year from v_start)::int, coalesce(nullif(v_edition_payload->>'title',''), v_festival.name || ' Edition ' || v_number), nullif(v_edition_payload->>'description',''), v_city, v_venue, v_start, v_end, v_edition_payload->>'timezone', coalesce((v_commercial->>'estimatedAttendance')::int, v_capacity), v_capacity, v_min, v_max, v_edition_payload->>'currencyCode', coalesce((v_commercial->>'operatingBudgetCents')::bigint,0), 'planning', jsonb_build_object('applications_open_at',v_app_open,'applications_close_at',v_app_close,'booking_deadline_at',v_booking,'site_name',v_location->>'siteName','default_ticket_price_cents',v_default,'commercial',v_commercial), p_actor_profile_id, jsonb_build_object('source','admin_creation_wizard')) RETURNING * INTO v_edition;
  INSERT INTO public.festival_edition_lifecycle_events(edition_id, from_status, to_status, actor_profile_id, reason, metadata, idempotency_key) VALUES (v_edition.id, NULL, v_edition.status, p_actor_profile_id, 'admin_edition_created', jsonb_build_object('source','admin_creation_wizard'), p_operation_key || ':lifecycle');
  FOR v_stage IN SELECT * FROM jsonb_array_elements(p_payload->'stages') LOOP
    IF nullif(trim(v_stage->>'name'),'') IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_INVALID'; END IF;
    IF EXISTS (SELECT 1 FROM public.festival_stages WHERE edition_id=v_edition.id AND lower(trim(stage_name))=lower(trim(v_stage->>'name')) AND archived_at IS NULL) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_DUPLICATE'; END IF;
    IF coalesce(v_stage->>'type','main') NOT IN ('main','second','tent','club','acoustic','experimental') THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_TYPE_INVALID'; END IF;
    IF coalesce((v_stage->>'capacity')::integer,0) <= 0 OR coalesce((v_stage->>'capacity')::integer,0) > v_capacity THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_CAPACITY_INVALID'; END IF;
    IF coalesce((v_stage->>'changeoverMinutes')::integer,30) < 5 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_CHANGEOVER_INVALID'; END IF;
    v_stage_number := v_stage_number + 1;
    INSERT INTO public.festival_stages(festival_id, edition_id, stage_name, stage_number, capacity, stage_type, sound_capability, lighting_capability, weather_protection, default_changeover_minutes, curfew_time, public_metadata, idempotency_key)
    VALUES (p_festival_id, v_edition.id, trim(v_stage->>'name'), v_stage_number, (v_stage->>'capacity')::integer, coalesce(v_stage->>'type','main'), v_stage->>'soundCapability', v_stage->>'lightingCapability', v_stage->>'weatherProtection', coalesce((v_stage->>'changeoverMinutes')::integer,30), nullif(v_stage->>'curfew','')::time, jsonb_build_object('created_from','admin_creation_wizard'), p_operation_key || ':stage:' || v_stage_number) RETURNING id INTO v_stage_id;
    v_stage_ids := array_append(v_stage_ids, v_stage_id);
  END LOOP;
  PERFORM public.festival_audit(v_edition.id,'edition_setup_created','festival_edition',v_edition.id,'{}',to_jsonb(v_edition),'admin festival creation wizard',p_operation_key || ':audit');
  RETURN jsonb_build_object('festival_id',p_festival_id,'edition_id',v_edition.id,'stage_ids',to_jsonb(v_stage_ids),'lifecycle_status',v_edition.status,'public_route','/festivals/' || p_festival_id,'management_route','/festivals/' || p_festival_id || '/manage/editions/' || v_edition.id,'created',true);
END $$;
REVOKE ALL ON FUNCTION public.internal_create_festival_edition_setup(uuid,jsonb,uuid,uuid,text,integer) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.internal_create_festival_edition_setup(uuid,jsonb,uuid,uuid,text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_create_festival_edition_with_setup(p_festival_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor_user uuid := auth.uid(); v_actor uuid := public.current_profile_id_safe(); v_key text := coalesce(p_payload->>'idempotencyKey', p_payload->>'idempotency_key'); v_hash text := public.festival_creation_request_hash(p_payload); v_existing public.admin_festival_creation_requests%ROWTYPE; v_count bigint; v_mode text := coalesce(p_payload->>'mode','add_edition'); v_number int; v_result jsonb;
BEGIN
  IF v_actor_user IS NULL OR NOT coalesce(public.has_role(v_actor_user,'admin'::public.app_role), false) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  IF nullif(trim(v_key),'') IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_IDEMPOTENCY_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor_user::text || ':admin_create_festival_edition_with_setup:' || v_key, 0));
  SELECT * INTO v_existing FROM public.admin_festival_creation_requests WHERE actor_user_id=v_actor_user AND operation='admin_create_festival_edition_with_setup' AND idempotency_key=v_key FOR UPDATE;
  IF FOUND THEN IF v_existing.request_hash <> v_hash THEN RAISE EXCEPTION 'FESTIVAL_CREATE_IDEMPOTENCY_CONFLICT'; END IF; RETURN v_existing.result || jsonb_build_object('created', false); END IF;
  PERFORM 1 FROM public.festivals WHERE id=p_festival_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_CREATE_FESTIVAL_INVALID'; END IF;
  SELECT count(*), coalesce(max(edition_number),0)+1 INTO v_count, v_number FROM public.festival_editions WHERE festival_id=p_festival_id;
  IF v_mode = 'create_first_edition' THEN
    IF v_count <> 0 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_FIRST_EDITION_ALREADY_EXISTS'; END IF;
    v_number := 1;
  ELSIF v_mode = 'add_edition' THEN
    IF v_count = 0 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_ADD_EDITION_REQUIRES_EXISTING'; END IF;
  ELSE
    RAISE EXCEPTION 'FESTIVAL_CREATE_MODE_INVALID';
  END IF;
  v_result := public.internal_create_festival_edition_setup(p_festival_id,p_payload,v_actor_user,v_actor,v_key,v_number);
  INSERT INTO public.admin_festival_creation_requests(actor_user_id,actor_profile_id,operation,idempotency_key,request_hash,festival_id,edition_id,result,actor_resolution_status) VALUES (v_actor_user,v_actor,'admin_create_festival_edition_with_setup',v_key,v_hash,p_festival_id,(v_result->>'edition_id')::uuid,v_result,'resolved');
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_create_festival_with_first_edition(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor_user uuid := auth.uid(); v_actor uuid := public.current_profile_id_safe(); v_key text := coalesce(p_payload->>'idempotencyKey', p_payload->>'idempotency_key'); v_hash text := public.festival_creation_request_hash(p_payload); v_existing public.admin_festival_creation_requests%ROWTYPE; v_identity jsonb := coalesce(p_payload->'identity','{}'::jsonb); v_location jsonb := coalesce(p_payload->'location','{}'::jsonb); v_festival public.festivals%ROWTYPE; v_result jsonb; v_name text := trim(coalesce(v_identity->>'name',''));
BEGIN
  IF v_actor_user IS NULL OR NOT coalesce(public.has_role(v_actor_user,'admin'::public.app_role), false) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  IF nullif(trim(v_key),'') IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_IDEMPOTENCY_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor_user::text || ':admin_create_festival_with_first_edition:' || v_key, 0));
  SELECT * INTO v_existing FROM public.admin_festival_creation_requests WHERE actor_user_id=v_actor_user AND operation='admin_create_festival_with_first_edition' AND idempotency_key=v_key FOR UPDATE;
  IF FOUND THEN IF v_existing.request_hash <> v_hash THEN RAISE EXCEPTION 'FESTIVAL_CREATE_IDEMPOTENCY_CONFLICT'; END IF; RETURN v_existing.result || jsonb_build_object('created', false); END IF;
  IF length(v_name) < 3 OR length(v_name) > 120 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_NAME_INVALID'; END IF;
  IF length(coalesce(v_identity->>'shortDescription','')) > 240 OR length(coalesce(v_identity->>'fullDescription','')) > 5000 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_DESCRIPTION_INVALID'; END IF;
  IF coalesce(v_identity->>'festivalType','') NOT IN ('recurring','touring','one_off','community','showcase') THEN RAISE EXCEPTION 'FESTIVAL_CREATE_TYPE_INVALID'; END IF;
  IF jsonb_array_length(coalesce(v_identity->'primaryGenres','[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_GENRE_INVALID'; END IF;
  INSERT INTO public.festivals(name, description, city_id, genre, scale, owner_profile_id, status, public_metadata)
  VALUES (v_name, coalesce(nullif(v_identity->>'fullDescription',''), v_identity->>'shortDescription'), nullif(v_location->>'cityId','')::uuid, (v_identity->'primaryGenres')->>0, v_identity->>'festivalType', NULL, 'planning', jsonb_build_object('short_description',v_identity->>'shortDescription','festival_type',v_identity->>'festivalType','primary_genres',v_identity->'primaryGenres','image_url',v_identity->>'imageUrl','public_visibility',coalesce((v_identity->>'isPublic')::boolean,false),'admin_creation_key',v_key)) RETURNING * INTO v_festival;
  v_result := public.internal_create_festival_edition_setup(v_festival.id, p_payload || jsonb_build_object('mode','create_first_edition','existingFestivalId',v_festival.id), v_actor_user, v_actor, v_key, 1);
  v_result := v_result || jsonb_build_object('festival_id',v_festival.id,'public_route','/festivals/' || v_festival.id,'management_route','/festivals/' || v_festival.id || '/manage/editions/' || (v_result->>'edition_id'),'created',true);
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, festival_id, edition_id, operation, target_type, target_id, after_snapshot, reason, idempotency_key) VALUES (v_actor, v_festival.id, (v_result->>'edition_id')::uuid, 'festival_created_with_first_edition', 'festival', v_festival.id, v_result, 'admin creation wizard', v_key);
  INSERT INTO public.admin_festival_creation_requests(actor_user_id,actor_profile_id,operation,idempotency_key,request_hash,festival_id,edition_id,result,actor_resolution_status) VALUES (v_actor_user,v_actor,'admin_create_festival_with_first_edition',v_key,v_hash,v_festival.id,(v_result->>'edition_id')::uuid,v_result,'resolved');
  RETURN v_result;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_create_festival_with_first_edition(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_festival_edition_with_setup(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_festival_edition_lifecycle_options(p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_status public.festival_edition_status; v_targets public.festival_edition_status[] := ARRAY['concept','planning','applications_open','booking','announced','on_sale','setup','live','settling','completed','postponed','cancelled','abandoned']::public.festival_edition_status[]; v_is_admin boolean := coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false);
BEGIN
  IF auth.uid() IS NULL OR NOT v_is_admin THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  SELECT status INTO v_status FROM public.festival_editions WHERE id=p_edition_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_EDITION_INVALID'; END IF;
  RETURN jsonb_build_object('editionId',p_edition_id,'currentState',v_status,'transitions',(SELECT jsonb_agg(jsonb_build_object('targetState',t,'available',public.validate_festival_edition_transition(v_status,t) AND t<>v_status,'blockers',CASE WHEN public.validate_festival_edition_transition(v_status,t) AND t<>v_status THEN '[]'::jsonb ELSE jsonb_build_array('Transition is not valid from current state') END,'warnings',CASE WHEN t IN ('live','postponed','cancelled','abandoned') THEN jsonb_build_array('This transition changes public operations and may notify players.') ELSE '[]'::jsonb END,'adminOverrideAllowed',t IN ('postponed','cancelled','abandoned'),'reasonRequired',t IN ('postponed','cancelled','abandoned'),'confirmationRequired',t IN ('live','postponed','cancelled','abandoned'),'severity',CASE WHEN t IN ('cancelled','abandoned') THEN 'destructive' WHEN t IN ('live','postponed') THEN 'warning' ELSE 'standard' END,'explanation',CASE WHEN t='applications_open' THEN 'Open band applications for this edition.' WHEN t='booking' THEN 'Close applications and begin booking decisions.' WHEN t='announced' THEN 'Publish confirmed festival details.' WHEN t='on_sale' THEN 'Open ticket sales for the announced edition.' WHEN t='setup' THEN 'Move operations into final event setup.' WHEN t='live' THEN 'Start live operation for the festival edition.' WHEN t='settling' THEN 'Close live operation and prepare settlement.' WHEN t='completed' THEN 'Mark settlement and outcomes complete.' WHEN t='postponed' THEN 'Postpone this edition and preserve its data.' WHEN t='cancelled' THEN 'Cancel this edition.' WHEN t='abandoned' THEN 'Abandon an unrecoverable edition.' ELSE 'Move the edition to ' || replace(t::text,'_',' ') || '.' END)) FROM unnest(v_targets) t));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_festival_edition_lifecycle_options(uuid) TO authenticated, service_role;

-- Phase 1 canonical festival admin creation workflow.
-- Creates server-authorised, idempotent aggregate operations without writing legacy game_events rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE public.festival_stages st
SET festival_id = e.festival_id
FROM public.festival_editions e
WHERE st.edition_id = e.id AND st.festival_id IS NULL;

ALTER TABLE public.festival_stages ALTER COLUMN festival_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_festival_stage_edition_consistency()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_festival uuid;
BEGIN
  IF NEW.edition_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_EDITION_REQUIRED'; END IF;
  SELECT festival_id INTO v_festival FROM public.festival_editions WHERE id = NEW.edition_id;
  IF v_festival IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_EDITION_INVALID'; END IF;
  NEW.festival_id := v_festival;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_festival_stage_edition_consistency ON public.festival_stages;
CREATE TRIGGER tg_festival_stage_edition_consistency BEFORE INSERT OR UPDATE OF edition_id, festival_id ON public.festival_stages FOR EACH ROW EXECUTE FUNCTION public.tg_festival_stage_edition_consistency();

CREATE TABLE IF NOT EXISTS public.admin_festival_creation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(trim(idempotency_key)) > 0)
);
ALTER TABLE public.admin_festival_creation_requests ADD COLUMN IF NOT EXISTS actor_user_id uuid;
UPDATE public.admin_festival_creation_requests SET actor_user_id = coalesce(actor_user_id, auth.uid()) WHERE actor_user_id IS NULL;
ALTER TABLE public.admin_festival_creation_requests ALTER COLUMN actor_user_id SET NOT NULL;
ALTER TABLE public.admin_festival_creation_requests DROP CONSTRAINT IF EXISTS admin_festival_creation_requests_actor_profile_id_operation_idemp_key;
DROP INDEX IF EXISTS admin_festival_creation_requests_actor_profile_id_operation_idempo_key;
CREATE UNIQUE INDEX IF NOT EXISTS admin_festival_creation_requests_actor_user_operation_key ON public.admin_festival_creation_requests(actor_user_id, operation, idempotency_key);
ALTER TABLE public.admin_festival_creation_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_festival_creation_requests_admin_read ON public.admin_festival_creation_requests;
CREATE POLICY admin_festival_creation_requests_admin_read ON public.admin_festival_creation_requests FOR SELECT TO authenticated USING (coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false));

CREATE OR REPLACE FUNCTION public.festival_creation_request_hash(p_payload jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT encode(digest(jsonb_build_object(
    'mode', p_payload->>'mode',
    'existingFestivalId', p_payload->>'existingFestivalId',
    'identity', coalesce(p_payload->'identity','{}'::jsonb) - 'imagePreviewUrl',
    'edition', coalesce(p_payload->'edition','{}'::jsonb) - 'editionNumber',
    'location', coalesce(p_payload->'location','{}'::jsonb),
    'stages', coalesce(p_payload->'stages','[]'::jsonb),
    'commercial', coalesce(p_payload->'commercial','{}'::jsonb)
  )::text, 'sha256'), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.admin_festival_reference_data()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT jsonb_build_object(
  'festivalTypes', jsonb_build_array('recurring','touring','one_off','community','showcase'),
  'genres', (SELECT coalesce(jsonb_agg(DISTINCT genre ORDER BY genre),'[]') FROM bands WHERE genre IS NOT NULL),
  'currencies', jsonb_build_array('USD','EUR','GBP'),
  'countries', (SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('code', coalesce(country,'Unknown'), 'name', coalesce(country,'Unknown'))),'[]') FROM cities),
  'cities', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'country',country,'timezone',coalesce(timezone,'UTC'),'currencyCode', CASE WHEN country IN ('United Kingdom','UK') THEN 'GBP' WHEN country IN ('France','Germany','Spain','Italy','Netherlands') THEN 'EUR' ELSE 'USD' END) ORDER BY country,name),'[]') FROM cities),
  'venues', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'cityId',city_id,'capacity',capacity) ORDER BY name),'[]') FROM venues),
  'stageTypes', jsonb_build_array('main','second','tent','club','acoustic','experimental'),
  'weatherOptions', jsonb_build_array('open_air','covered','indoor'),
  'soundOptions', jsonb_build_array('basic','standard','premium','festival_grade'),
  'lightingOptions', jsonb_build_array('basic','standard','premium','festival_grade'),
  'commercialDefaults', jsonb_build_object('currencyCode','USD','minimumTicketPriceCents',0,'maximumTicketPriceCents',10000,'defaultTicketPriceCents',2500)
)
$$;
GRANT EXECUTE ON FUNCTION public.admin_festival_reference_data() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_festival_edition_lifecycle_options(p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_status public.festival_edition_status; v_targets public.festival_edition_status[] := ARRAY['concept','planning','applications_open','booking','announced','on_sale','setup','live','settling','completed','postponed','cancelled','abandoned']::public.festival_edition_status[];
BEGIN
  SELECT status INTO v_status FROM public.festival_editions WHERE id=p_edition_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_EDITION_INVALID'; END IF;
  RETURN jsonb_build_object('editionId',p_edition_id,'currentState',v_status,'transitions',(SELECT jsonb_agg(jsonb_build_object('targetState',t,'available',public.validate_festival_edition_transition(v_status,t) AND t<>v_status,'blockers',CASE WHEN public.validate_festival_edition_transition(v_status,t) AND t<>v_status THEN '[]'::jsonb ELSE jsonb_build_array('Transition is not valid from current state') END,'warnings','[]'::jsonb,'adminOverrideAllowed',t IN ('postponed','cancelled','abandoned'),'reasonRequired',t IN ('postponed','cancelled','abandoned'),'confirmationRequired',t IN ('live','postponed','cancelled','abandoned'),'severity',CASE WHEN t IN ('cancelled','abandoned') THEN 'destructive' WHEN t IN ('live','postponed') THEN 'warning' ELSE 'standard' END,'explanation','Server-projected lifecycle rule')) FROM unnest(v_targets) t));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_festival_edition_lifecycle_options(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_create_festival_edition_with_setup(p_festival_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor_user uuid := auth.uid(); v_actor uuid := public.current_profile_id_safe();
  v_key text := coalesce(p_payload->>'idempotencyKey', p_payload->>'idempotency_key');
  v_hash text := public.festival_creation_request_hash(p_payload);
  v_existing public.admin_festival_creation_requests%ROWTYPE; v_festival public.festivals%ROWTYPE; v_edition public.festival_editions%ROWTYPE;
  v_stage jsonb; v_stage_ids uuid[] := ARRAY[]::uuid[]; v_stage_id uuid; v_stage_number integer := 0;
  v_location jsonb := coalesce(p_payload->'location','{}'::jsonb); v_edition_payload jsonb := coalesce(p_payload->'edition','{}'::jsonb); v_commercial jsonb := coalesce(p_payload->'commercial','{}'::jsonb);
  v_result jsonb; v_start timestamptz := nullif(v_edition_payload->>'startAt','')::timestamptz; v_end timestamptz := nullif(v_edition_payload->>'endAt','')::timestamptz; v_app_open timestamptz := nullif(v_edition_payload->>'applicationsOpenAt','')::timestamptz; v_app_close timestamptz := nullif(v_edition_payload->>'applicationsCloseAt','')::timestamptz; v_booking timestamptz := nullif(v_edition_payload->>'bookingDeadlineAt','')::timestamptz;
  v_city uuid := nullif(v_location->>'cityId','')::uuid; v_venue uuid := nullif(v_location->>'venueId','')::uuid; v_capacity integer := coalesce((v_location->>'capacity')::integer,0); v_min bigint := coalesce((v_location->>'minTicketPriceCents')::bigint,0); v_max bigint := coalesce((v_location->>'maxTicketPriceCents')::bigint,0); v_default bigint := coalesce((v_location->>'defaultTicketPriceCents')::bigint,v_min); v_next int;
BEGIN
  IF v_actor_user IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  IF NOT coalesce(public.has_role(v_actor_user,'admin'::public.app_role), false) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  IF nullif(trim(v_key),'') IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_IDEMPOTENCY_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor_user::text || ':admin_create_festival_edition_with_setup:' || v_key, 0));
  SELECT * INTO v_existing FROM public.admin_festival_creation_requests WHERE actor_user_id=v_actor_user AND operation='admin_create_festival_edition_with_setup' AND idempotency_key=v_key FOR UPDATE;
  IF FOUND THEN IF v_existing.request_hash <> v_hash THEN RAISE EXCEPTION 'FESTIVAL_CREATE_IDEMPOTENCY_CONFLICT'; END IF; RETURN v_existing.result || jsonb_build_object('created', false); END IF;
  SELECT * INTO v_festival FROM public.festivals WHERE id=p_festival_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_CREATE_FESTIVAL_INVALID'; END IF;
  IF v_start IS NULL OR v_end IS NULL OR v_end <= v_start OR v_start < now() OR v_app_open IS NULL OR v_app_close IS NULL OR v_app_close < v_app_open OR v_app_close >= v_start OR (v_booking IS NOT NULL AND (v_booking < v_app_close OR v_booking > v_start)) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_INVALID_DATE'; END IF;
  IF v_city IS NULL OR NOT EXISTS (SELECT 1 FROM public.cities WHERE id=v_city) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_CITY_INVALID'; END IF;
  IF v_venue IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.venues WHERE id=v_venue AND city_id=v_city) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_VENUE_INVALID'; END IF;
  IF coalesce(v_edition_payload->>'timezone','') NOT IN (SELECT name FROM pg_timezone_names) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_TIMEZONE_INVALID'; END IF;
  IF coalesce(v_edition_payload->>'currencyCode','') NOT IN ('USD','EUR','GBP') THEN RAISE EXCEPTION 'FESTIVAL_CREATE_CURRENCY_INVALID'; END IF;
  IF v_capacity <= 0 OR v_min < 0 OR v_max < v_min OR v_default < v_min OR v_default > v_max THEN RAISE EXCEPTION 'FESTIVAL_CREATE_CAPACITY_OR_PRICE_INVALID'; END IF;
  IF v_venue IS NOT NULL AND EXISTS (SELECT 1 FROM public.venues WHERE id=v_venue AND capacity IS NOT NULL AND v_capacity > capacity) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_CAPACITY_EXCEEDED'; END IF;
  IF jsonb_array_length(coalesce(p_payload->'stages','[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_REQUIRED'; END IF;
  IF coalesce((v_commercial->>'operatingBudgetCents')::bigint,0) < 0 OR coalesce((v_commercial->>'performerBudgetCents')::bigint,0) < 0 OR coalesce((v_commercial->>'staffingBudgetCents')::bigint,0) < 0 OR coalesce((v_commercial->>'marketingBudgetCents')::bigint,0) < 0 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_BUDGET_INVALID'; END IF;
  SELECT coalesce(max(edition_number),0)+1 INTO v_next FROM public.festival_editions WHERE festival_id=p_festival_id;
  INSERT INTO public.festival_editions(festival_id, edition_number, edition_year, title, description, city_id, venue_id, start_at, end_at, timezone, expected_attendance, capacity, minimum_ticket_price_cents, maximum_ticket_price_cents, currency_code, budget_cents, status, public_metadata, created_by, legacy_metadata)
  VALUES (p_festival_id, v_next, extract(year from v_start)::int, coalesce(nullif(v_edition_payload->>'title',''), v_festival.name || ' Edition ' || v_next), nullif(v_edition_payload->>'description',''), v_city, v_venue, v_start, v_end, v_edition_payload->>'timezone', coalesce((v_commercial->>'estimatedAttendance')::integer, v_capacity), v_capacity, v_min, v_max, v_edition_payload->>'currencyCode', coalesce((v_commercial->>'operatingBudgetCents')::bigint,0), 'planning', jsonb_build_object('applications_open_at',v_app_open,'applications_close_at',v_app_close,'booking_deadline_at',v_booking,'site_name',v_location->>'siteName','default_ticket_price_cents',v_default,'commercial',v_commercial), v_actor, jsonb_build_object('source','admin_creation_wizard')) RETURNING * INTO v_edition;
  INSERT INTO public.festival_edition_lifecycle_events(edition_id, from_status, to_status, actor_profile_id, reason, metadata, idempotency_key) VALUES (v_edition.id, NULL, v_edition.status, v_actor, 'admin_edition_created', jsonb_build_object('source','admin_creation_wizard'), v_key || ':lifecycle');
  FOR v_stage IN SELECT * FROM jsonb_array_elements(p_payload->'stages') LOOP
    IF nullif(trim(v_stage->>'name'),'') IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_INVALID'; END IF;
    IF EXISTS (SELECT 1 FROM public.festival_stages WHERE edition_id=v_edition.id AND lower(trim(stage_name))=lower(trim(v_stage->>'name')) AND archived_at IS NULL) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_DUPLICATE'; END IF;
    IF coalesce(v_stage->>'type','main') NOT IN ('main','second','tent','club','acoustic','experimental') THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_TYPE_INVALID'; END IF;
    IF coalesce((v_stage->>'capacity')::integer,0) <= 0 OR coalesce((v_stage->>'capacity')::integer,0) > v_capacity THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_CAPACITY_INVALID'; END IF;
    IF coalesce((v_stage->>'changeoverMinutes')::integer,30) < 5 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_CHANGEOVER_INVALID'; END IF;
    v_stage_number := v_stage_number + 1;
    INSERT INTO public.festival_stages(festival_id, edition_id, stage_name, stage_number, capacity, stage_type, sound_capability, lighting_capability, weather_protection, default_changeover_minutes, curfew_time, public_metadata, idempotency_key)
    VALUES (p_festival_id, v_edition.id, trim(v_stage->>'name'), v_stage_number, (v_stage->>'capacity')::integer, coalesce(v_stage->>'type','main'), v_stage->>'soundCapability', v_stage->>'lightingCapability', v_stage->>'weatherProtection', coalesce((v_stage->>'changeoverMinutes')::integer,30), nullif(v_stage->>'curfew','')::time, jsonb_build_object('created_from','admin_creation_wizard'), v_key || ':stage:' || v_stage_number) RETURNING id INTO v_stage_id;
    v_stage_ids := array_append(v_stage_ids, v_stage_id);
  END LOOP;
  PERFORM public.festival_audit(v_edition.id,'edition_setup_created','festival_edition',v_edition.id,'{}',to_jsonb(v_edition),'admin festival creation wizard',v_key || ':audit');
  v_result := jsonb_build_object('festival_id',p_festival_id,'edition_id',v_edition.id,'stage_ids',to_jsonb(v_stage_ids),'lifecycle_status',v_edition.status,'public_route','/festivals/' || p_festival_id,'management_route','/festivals/' || p_festival_id || '/manage/editions/' || v_edition.id,'created',true);
  INSERT INTO public.admin_festival_creation_requests(actor_user_id,actor_profile_id,operation,idempotency_key,request_hash,festival_id,edition_id,result) VALUES (v_actor_user,v_actor,'admin_create_festival_edition_with_setup',v_key,v_hash,p_festival_id,v_edition.id,v_result);
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_create_festival_with_first_edition(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor_user uuid := auth.uid(); v_actor uuid := public.current_profile_id_safe(); v_key text := coalesce(p_payload->>'idempotencyKey', p_payload->>'idempotency_key'); v_hash text := public.festival_creation_request_hash(p_payload); v_existing public.admin_festival_creation_requests%ROWTYPE; v_identity jsonb := coalesce(p_payload->'identity','{}'::jsonb); v_location jsonb := coalesce(p_payload->'location','{}'::jsonb); v_festival public.festivals%ROWTYPE; v_result jsonb; v_name text := trim(coalesce(v_identity->>'name',''));
BEGIN
  IF v_actor_user IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  IF NOT coalesce(public.has_role(v_actor_user,'admin'::public.app_role), false) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
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
  v_result := public.admin_create_festival_edition_with_setup(v_festival.id, p_payload || jsonb_build_object('mode','create_first_edition','existingFestivalId',v_festival.id,'idempotencyKey',v_key || ':first-edition'));
  DELETE FROM public.admin_festival_creation_requests WHERE actor_user_id=v_actor_user AND operation='admin_create_festival_edition_with_setup' AND idempotency_key=v_key || ':first-edition';
  UPDATE public.festival_editions SET edition_number=1 WHERE id=(v_result->>'edition_id')::uuid;
  v_result := v_result || jsonb_build_object('festival_id',v_festival.id,'public_route','/festivals/' || v_festival.id,'management_route','/festivals/' || v_festival.id || '/manage/editions/' || (v_result->>'edition_id'),'created',true);
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, festival_id, edition_id, operation, target_type, target_id, after_snapshot, reason, idempotency_key) VALUES (v_actor, v_festival.id, (v_result->>'edition_id')::uuid, 'festival_created_with_first_edition', 'festival', v_festival.id, v_result, 'admin creation wizard', v_key);
  INSERT INTO public.admin_festival_creation_requests(actor_user_id,actor_profile_id,operation,idempotency_key,request_hash,festival_id,edition_id,result) VALUES (v_actor_user,v_actor,'admin_create_festival_with_first_edition',v_key,v_hash,v_festival.id,(v_result->>'edition_id')::uuid,v_result);
  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_create_festival_with_first_edition(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_festival_edition_with_setup(uuid,jsonb) TO authenticated;

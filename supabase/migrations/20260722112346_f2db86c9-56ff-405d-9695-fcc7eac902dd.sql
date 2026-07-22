
ALTER TABLE public.festival_stages
  ADD COLUMN IF NOT EXISTS stage_type text NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS sound_capability text,
  ADD COLUMN IF NOT EXISTS lighting_capability text,
  ADD COLUMN IF NOT EXISTS backstage_capability text,
  ADD COLUMN IF NOT EXISTS stage_size text,
  ADD COLUMN IF NOT EXISTS weather_protection text,
  ADD COLUMN IF NOT EXISTS default_changeover_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS curfew_time time,
  ADD COLUMN IF NOT EXISTS public_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS technical_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.admin_festival_creation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  festival_id uuid REFERENCES public.festivals(id) ON DELETE CASCADE,
  edition_id uuid REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  result jsonb NOT NULL,
  actor_resolution_status text NOT NULL DEFAULT 'resolved',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_festival_creation_requests TO authenticated;
GRANT ALL ON public.admin_festival_creation_requests TO service_role;
ALTER TABLE public.admin_festival_creation_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_festival_creation_requests_admin_read ON public.admin_festival_creation_requests;
CREATE POLICY admin_festival_creation_requests_admin_read
  ON public.admin_festival_creation_requests FOR SELECT TO authenticated
  USING (coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false));
CREATE UNIQUE INDEX IF NOT EXISTS admin_festival_creation_requests_actor_user_operation_key
  ON public.admin_festival_creation_requests(actor_user_id, operation, idempotency_key)
  WHERE actor_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.festival_creation_request_hash(p_payload jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT md5(jsonb_build_object(
    'mode', p_payload->>'mode',
    'existingFestivalId', p_payload->>'existingFestivalId',
    'identity', coalesce(p_payload->'identity','{}'::jsonb) - 'imagePreviewUrl',
    'edition', coalesce(p_payload->'edition','{}'::jsonb) - 'editionNumber',
    'location', coalesce(p_payload->'location','{}'::jsonb),
    'stages', coalesce(p_payload->'stages','[]'::jsonb),
    'commercial', coalesce(p_payload->'commercial','{}'::jsonb)
  )::text)
$$;

CREATE OR REPLACE FUNCTION public.festival_audit(
  p_edition_id uuid, p_operation text, p_target_type text, p_target_id uuid,
  p_before jsonb DEFAULT '{}'::jsonb, p_after jsonb DEFAULT '{}'::jsonb,
  p_reason text DEFAULT NULL, p_idempotency_key text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_festival uuid;
BEGIN
  SELECT festival_id INTO v_festival FROM public.festival_editions WHERE id = p_edition_id;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, festival_id, edition_id, operation, target_type, target_id, before_snapshot, after_snapshot, reason, idempotency_key)
  VALUES (public.current_profile_id_safe(), v_festival, p_edition_id, p_operation, p_target_type, p_target_id, coalesce(p_before,'{}'::jsonb), coalesce(p_after,'{}'::jsonb), p_reason, p_idempotency_key);
END $$;

CREATE OR REPLACE FUNCTION public.admin_create_festival_edition_with_setup(p_festival_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor_user uuid := auth.uid();
  v_actor uuid := public.current_profile_id_safe();
  v_key text := coalesce(p_payload->>'idempotencyKey', p_payload->>'idempotency_key');
  v_hash text := public.festival_creation_request_hash(p_payload);
  v_existing public.admin_festival_creation_requests%ROWTYPE;
  v_festival public.festivals%ROWTYPE;
  v_edition public.festival_editions%ROWTYPE;
  v_stage jsonb; v_stage_ids uuid[] := ARRAY[]::uuid[]; v_stage_id uuid; v_stage_number integer := 0;
  v_location jsonb := coalesce(p_payload->'location','{}'::jsonb);
  v_edition_payload jsonb := coalesce(p_payload->'edition','{}'::jsonb);
  v_commercial jsonb := coalesce(p_payload->'commercial','{}'::jsonb);
  v_result jsonb;
  v_start timestamptz := nullif(v_edition_payload->>'startAt','')::timestamptz;
  v_end timestamptz := nullif(v_edition_payload->>'endAt','')::timestamptz;
  v_app_open timestamptz := nullif(v_edition_payload->>'applicationsOpenAt','')::timestamptz;
  v_app_close timestamptz := nullif(v_edition_payload->>'applicationsCloseAt','')::timestamptz;
  v_booking timestamptz := nullif(v_edition_payload->>'bookingDeadlineAt','')::timestamptz;
  v_city uuid := nullif(v_location->>'cityId','')::uuid;
  v_venue uuid := nullif(v_location->>'venueId','')::uuid;
  v_capacity integer := coalesce((v_location->>'capacity')::integer,0);
  v_min bigint := coalesce((v_location->>'minTicketPriceCents')::bigint,0);
  v_max bigint := coalesce((v_location->>'maxTicketPriceCents')::bigint,0);
  v_default bigint := coalesce((v_location->>'defaultTicketPriceCents')::bigint,v_min);
  v_next int;
  v_mode text := coalesce(p_payload->>'mode','add_edition');
  v_edition_count bigint;
BEGIN
  IF v_actor_user IS NULL OR NOT coalesce(public.has_role(v_actor_user,'admin'::public.app_role), false) THEN
    RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED';
  END IF;
  IF nullif(trim(v_key),'') IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_IDEMPOTENCY_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor_user::text || ':afews:' || v_key, 0));
  SELECT * INTO v_existing FROM public.admin_festival_creation_requests
    WHERE actor_user_id=v_actor_user AND operation='admin_create_festival_edition_with_setup' AND idempotency_key=v_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.request_hash <> v_hash THEN RAISE EXCEPTION 'FESTIVAL_CREATE_IDEMPOTENCY_CONFLICT'; END IF;
    RETURN v_existing.result || jsonb_build_object('created', false);
  END IF;
  SELECT * INTO v_festival FROM public.festivals WHERE id=p_festival_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_CREATE_FESTIVAL_INVALID'; END IF;
  SELECT count(*), coalesce(max(edition_number),0)+1 INTO v_edition_count, v_next FROM public.festival_editions WHERE festival_id=p_festival_id;
  IF v_mode = 'create_first_edition' THEN
    IF v_edition_count <> 0 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_FIRST_EDITION_ALREADY_EXISTS'; END IF;
    v_next := 1;
  END IF;
  IF v_start IS NULL OR v_end IS NULL OR v_end <= v_start OR v_start < now()
     OR v_app_open IS NULL OR v_app_close IS NULL OR v_app_close < v_app_open OR v_app_close >= v_start
     OR (v_booking IS NOT NULL AND (v_booking < v_app_close OR v_booking > v_start)) THEN
    RAISE EXCEPTION 'FESTIVAL_CREATE_INVALID_DATE';
  END IF;
  IF v_city IS NULL OR NOT EXISTS (SELECT 1 FROM public.cities WHERE id=v_city) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_CITY_INVALID'; END IF;
  IF v_venue IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.venues WHERE id=v_venue AND city_id=v_city) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_VENUE_INVALID'; END IF;
  IF coalesce(v_edition_payload->>'timezone','') NOT IN (SELECT name FROM pg_timezone_names) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_TIMEZONE_INVALID'; END IF;
  IF coalesce(v_edition_payload->>'currencyCode','') NOT IN ('USD','EUR','GBP','CAD','AUD') THEN RAISE EXCEPTION 'FESTIVAL_CREATE_CURRENCY_INVALID'; END IF;
  IF v_capacity <= 0 OR v_min < 0 OR v_max < v_min OR v_default < v_min OR v_default > v_max THEN RAISE EXCEPTION 'FESTIVAL_CREATE_CAPACITY_OR_PRICE_INVALID'; END IF;
  IF v_venue IS NOT NULL AND EXISTS (SELECT 1 FROM public.venues WHERE id=v_venue AND capacity IS NOT NULL AND v_capacity > capacity) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_CAPACITY_EXCEEDED'; END IF;
  IF jsonb_array_length(coalesce(p_payload->'stages','[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_REQUIRED'; END IF;
  IF coalesce((v_commercial->>'operatingBudgetCents')::bigint,0) < 0
     OR coalesce((v_commercial->>'performerBudgetCents')::bigint,0) < 0
     OR coalesce((v_commercial->>'staffingBudgetCents')::bigint,0) < 0
     OR coalesce((v_commercial->>'marketingBudgetCents')::bigint,0) < 0 THEN
    RAISE EXCEPTION 'FESTIVAL_CREATE_BUDGET_INVALID';
  END IF;

  INSERT INTO public.festival_editions(
    festival_id, edition_number, edition_year, title, description, city_id, venue_id,
    start_at, end_at, timezone, expected_attendance, capacity,
    minimum_ticket_price_cents, maximum_ticket_price_cents, currency_code, budget_cents,
    status, public_metadata, created_by, legacy_metadata)
  VALUES (
    p_festival_id, v_next, extract(year from v_start)::int,
    coalesce(nullif(v_edition_payload->>'title',''), v_festival.name || ' Edition ' || v_next),
    nullif(v_edition_payload->>'description',''), v_city, v_venue,
    v_start, v_end, v_edition_payload->>'timezone',
    coalesce((v_commercial->>'estimatedAttendance')::integer, v_capacity), v_capacity,
    v_min, v_max, v_edition_payload->>'currencyCode', coalesce((v_commercial->>'operatingBudgetCents')::bigint,0),
    'planning',
    jsonb_build_object('applications_open_at',v_app_open,'applications_close_at',v_app_close,'booking_deadline_at',v_booking,'site_name',v_location->>'siteName','default_ticket_price_cents',v_default,'commercial',v_commercial),
    v_actor, jsonb_build_object('source','admin_creation_wizard'))
  RETURNING * INTO v_edition;

  INSERT INTO public.festival_edition_lifecycle_events(edition_id, from_status, to_status, actor_profile_id, reason, metadata, idempotency_key)
  VALUES (v_edition.id, NULL, v_edition.status, v_actor, 'admin_edition_created', jsonb_build_object('source','admin_creation_wizard'), v_key || ':lifecycle');

  FOR v_stage IN SELECT * FROM jsonb_array_elements(p_payload->'stages') LOOP
    IF nullif(trim(v_stage->>'name'),'') IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_INVALID'; END IF;
    IF EXISTS (SELECT 1 FROM public.festival_stages WHERE edition_id=v_edition.id AND lower(trim(stage_name))=lower(trim(v_stage->>'name')) AND archived_at IS NULL) THEN
      RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_DUPLICATE';
    END IF;
    IF coalesce(v_stage->>'type','main') NOT IN ('main','second','tent','club','acoustic','experimental') THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_TYPE_INVALID'; END IF;
    IF coalesce((v_stage->>'capacity')::integer,0) <= 0 OR coalesce((v_stage->>'capacity')::integer,0) > v_capacity THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_CAPACITY_INVALID'; END IF;
    IF coalesce((v_stage->>'changeoverMinutes')::integer,30) < 5 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_CHANGEOVER_INVALID'; END IF;
    v_stage_number := v_stage_number + 1;
    INSERT INTO public.festival_stages(
      festival_id, edition_id, stage_name, stage_number, capacity, stage_type,
      sound_capability, lighting_capability, weather_protection,
      default_changeover_minutes, curfew_time, public_metadata, idempotency_key)
    VALUES (
      p_festival_id, v_edition.id, trim(v_stage->>'name'), v_stage_number, (v_stage->>'capacity')::integer,
      coalesce(v_stage->>'type','main'),
      v_stage->>'soundCapability', v_stage->>'lightingCapability', v_stage->>'weatherProtection',
      coalesce((v_stage->>'changeoverMinutes')::integer,30), nullif(v_stage->>'curfew','')::time,
      jsonb_build_object('created_from','admin_creation_wizard'), v_key || ':stage:' || v_stage_number)
    RETURNING id INTO v_stage_id;
    v_stage_ids := array_append(v_stage_ids, v_stage_id);
  END LOOP;

  PERFORM public.festival_audit(v_edition.id,'edition_setup_created','festival_edition',v_edition.id,'{}'::jsonb,to_jsonb(v_edition),'admin festival creation wizard',v_key || ':audit');

  v_result := jsonb_build_object(
    'festival_id', p_festival_id,
    'edition_id', v_edition.id,
    'stage_ids', to_jsonb(v_stage_ids),
    'lifecycle_status', v_edition.status,
    'public_route', '/festivals/' || p_festival_id,
    'management_route', '/festivals/' || p_festival_id || '/manage/editions/' || v_edition.id,
    'created', true);

  INSERT INTO public.admin_festival_creation_requests(actor_user_id, actor_profile_id, operation, idempotency_key, request_hash, festival_id, edition_id, result)
  VALUES (v_actor_user, v_actor, 'admin_create_festival_edition_with_setup', v_key, v_hash, p_festival_id, v_edition.id, v_result);

  RETURN v_result;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_create_festival_edition_with_setup(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_festival_with_first_edition(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor_user uuid := auth.uid();
  v_actor uuid := public.current_profile_id_safe();
  v_key text := coalesce(p_payload->>'idempotencyKey', p_payload->>'idempotency_key');
  v_hash text := public.festival_creation_request_hash(p_payload);
  v_existing public.admin_festival_creation_requests%ROWTYPE;
  v_identity jsonb := coalesce(p_payload->'identity','{}'::jsonb);
  v_location jsonb := coalesce(p_payload->'location','{}'::jsonb);
  v_festival public.festivals%ROWTYPE;
  v_result jsonb;
  v_name text := trim(coalesce(v_identity->>'name',''));
BEGIN
  IF v_actor_user IS NULL OR NOT coalesce(public.has_role(v_actor_user,'admin'::public.app_role), false) THEN
    RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED';
  END IF;
  IF nullif(trim(v_key),'') IS NULL THEN RAISE EXCEPTION 'FESTIVAL_CREATE_IDEMPOTENCY_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor_user::text || ':acfwfe:' || v_key, 0));
  SELECT * INTO v_existing FROM public.admin_festival_creation_requests
    WHERE actor_user_id=v_actor_user AND operation='admin_create_festival_with_first_edition' AND idempotency_key=v_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.request_hash <> v_hash THEN RAISE EXCEPTION 'FESTIVAL_CREATE_IDEMPOTENCY_CONFLICT'; END IF;
    RETURN v_existing.result || jsonb_build_object('created', false);
  END IF;
  IF length(v_name) < 3 OR length(v_name) > 120 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_NAME_INVALID'; END IF;
  IF coalesce(v_identity->>'festivalType','') NOT IN ('recurring','touring','one_off','community','showcase') THEN RAISE EXCEPTION 'FESTIVAL_CREATE_TYPE_INVALID'; END IF;
  IF jsonb_array_length(coalesce(v_identity->'primaryGenres','[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'FESTIVAL_CREATE_GENRE_INVALID'; END IF;

  INSERT INTO public.festivals(name, description, city_id, genre, scale, owner_profile_id, status, public_metadata)
  VALUES (
    v_name,
    coalesce(nullif(v_identity->>'fullDescription',''), v_identity->>'shortDescription'),
    nullif(v_location->>'cityId','')::uuid,
    (v_identity->'primaryGenres')->>0,
    v_identity->>'festivalType',
    v_actor,
    'planning',
    jsonb_build_object('short_description',v_identity->>'shortDescription','festival_type',v_identity->>'festivalType','primary_genres',v_identity->'primaryGenres','image_url',v_identity->>'imageUrl','public_visibility',coalesce((v_identity->>'isPublic')::boolean,false),'admin_creation_key',v_key))
  RETURNING * INTO v_festival;

  v_result := public.admin_create_festival_edition_with_setup(
    v_festival.id,
    p_payload || jsonb_build_object('mode','create_first_edition','existingFestivalId',v_festival.id,'idempotencyKey', v_key || ':first-edition'));

  DELETE FROM public.admin_festival_creation_requests
    WHERE actor_user_id=v_actor_user AND operation='admin_create_festival_edition_with_setup' AND idempotency_key = v_key || ':first-edition';

  v_result := v_result || jsonb_build_object('festival_id', v_festival.id,
    'public_route','/festivals/' || v_festival.id,
    'management_route','/festivals/' || v_festival.id || '/manage/editions/' || (v_result->>'edition_id'),
    'created', true);

  INSERT INTO public.festival_admin_audit_events(actor_profile_id, festival_id, edition_id, operation, target_type, target_id, after_snapshot, reason, idempotency_key)
  VALUES (v_actor, v_festival.id, (v_result->>'edition_id')::uuid, 'festival_created_with_first_edition', 'festival', v_festival.id, v_result, 'admin creation wizard', v_key);

  INSERT INTO public.admin_festival_creation_requests(actor_user_id, actor_profile_id, operation, idempotency_key, request_hash, festival_id, edition_id, result)
  VALUES (v_actor_user, v_actor, 'admin_create_festival_with_first_edition', v_key, v_hash, v_festival.id, (v_result->>'edition_id')::uuid, v_result);

  RETURN v_result;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_create_festival_with_first_edition(jsonb) TO authenticated;

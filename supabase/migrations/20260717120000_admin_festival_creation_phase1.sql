-- Phase 1 canonical festival admin creation workflow.
-- Creates server-authorised, idempotent aggregate operations without writing legacy game_events rows.

ALTER TABLE public.festival_stages ALTER COLUMN festival_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.admin_festival_creation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_profile_id, operation, idempotency_key),
  CHECK (length(trim(idempotency_key)) > 0)
);
ALTER TABLE public.admin_festival_creation_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_festival_creation_requests_admin_read ON public.admin_festival_creation_requests;
CREATE POLICY admin_festival_creation_requests_admin_read ON public.admin_festival_creation_requests FOR SELECT TO authenticated USING (coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false));

CREATE OR REPLACE FUNCTION public.admin_create_festival_edition_with_setup(p_festival_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor uuid := public.current_profile_id_safe();
  v_key text := coalesce(p_payload->>'idempotencyKey', p_payload->>'idempotency_key');
  v_hash text := md5(coalesce(p_payload,'{}'::jsonb)::text);
  v_existing public.admin_festival_creation_requests%ROWTYPE;
  v_festival public.festivals%ROWTYPE;
  v_edition public.festival_editions%ROWTYPE;
  v_stage jsonb;
  v_stage_ids uuid[] := ARRAY[]::uuid[];
  v_stage_id uuid;
  v_stage_number integer := 0;
  v_location jsonb := coalesce(p_payload->'location','{}'::jsonb);
  v_edition_payload jsonb := coalesce(p_payload->'edition','{}'::jsonb);
  v_commercial jsonb := coalesce(p_payload->'commercial','{}'::jsonb);
  v_result jsonb;
  v_start timestamptz := nullif(v_edition_payload->>'startAt','')::timestamptz;
  v_end timestamptz := nullif(v_edition_payload->>'endAt','')::timestamptz;
  v_app_open timestamptz := nullif(v_edition_payload->>'applicationsOpenAt','')::timestamptz;
  v_app_close timestamptz := nullif(v_edition_payload->>'applicationsCloseAt','')::timestamptz;
  v_city uuid := nullif(v_location->>'cityId','')::uuid;
  v_venue uuid := nullif(v_location->>'venueId','')::uuid;
  v_capacity integer := coalesce((v_location->>'capacity')::integer,0);
  v_min bigint := coalesce((v_location->>'minTicketPriceCents')::bigint,0);
  v_max bigint := coalesce((v_location->>'maxTicketPriceCents')::bigint,0);
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false) THEN RAISE EXCEPTION 'Admin authority required'; END IF;
  IF nullif(trim(v_key),'') IS NULL THEN RAISE EXCEPTION 'Idempotency key is required'; END IF;
  SELECT * INTO v_existing FROM public.admin_festival_creation_requests WHERE actor_profile_id IS NOT DISTINCT FROM v_actor AND operation='admin_create_festival_edition_with_setup' AND idempotency_key=v_key FOR UPDATE;
  IF FOUND THEN IF v_existing.request_hash <> v_hash THEN RAISE EXCEPTION 'Idempotency key reused with different festival creation input'; END IF; RETURN v_existing.result || jsonb_build_object('created', false); END IF;
  SELECT * INTO v_festival FROM public.festivals WHERE id=p_festival_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Festival not found'; END IF;
  IF v_start IS NULL OR v_end IS NULL OR v_end <= v_start OR v_start < now() THEN RAISE EXCEPTION 'Invalid date range'; END IF;
  IF v_app_open IS NULL OR v_app_close IS NULL OR v_app_close < v_app_open OR v_app_close >= v_start THEN RAISE EXCEPTION 'Application date conflict'; END IF;
  IF v_city IS NULL OR NOT EXISTS (SELECT 1 FROM public.cities WHERE id=v_city) THEN RAISE EXCEPTION 'Invalid city reference'; END IF;
  IF v_venue IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.venues WHERE id=v_venue AND city_id=v_city) THEN RAISE EXCEPTION 'Invalid venue reference'; END IF;
  IF coalesce(v_edition_payload->>'currencyCode','USD') NOT IN ('USD','EUR','GBP') THEN RAISE EXCEPTION 'Unsupported currency'; END IF;
  IF v_capacity <= 0 OR v_min < 0 OR v_max < v_min THEN RAISE EXCEPTION 'Invalid capacity or ticket price range'; END IF;
  IF jsonb_array_length(coalesce(p_payload->'stages','[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'At least one stage is required'; END IF;

  v_edition := public.create_festival_edition(p_festival_id, nullif(v_edition_payload->>'title',''), v_start, v_end, v_city, v_venue, coalesce((v_commercial->>'estimatedAttendance')::integer, v_capacity), v_capacity, v_min, v_max, jsonb_build_object('applications_open_at',v_app_open,'applications_close_at',v_app_close,'booking_deadline_at',v_edition_payload->>'bookingDeadlineAt','timezone',coalesce(v_edition_payload->>'timezone','UTC'),'currency_code',coalesce(v_edition_payload->>'currencyCode','USD'),'site_name',v_location->>'siteName','default_ticket_price_cents',coalesce((v_location->>'defaultTicketPriceCents')::bigint, v_min),'commercial',v_commercial), v_key || ':edition');
  UPDATE public.festival_editions SET currency_code=coalesce(v_edition_payload->>'currencyCode','USD'), timezone=coalesce(v_edition_payload->>'timezone','UTC'), budget_cents=coalesce((v_commercial->>'operatingBudgetCents')::bigint, budget_cents), status='planning' WHERE id=v_edition.id RETURNING * INTO v_edition;

  FOR v_stage IN SELECT * FROM jsonb_array_elements(p_payload->'stages') LOOP
    IF EXISTS (SELECT 1 FROM public.festival_stages WHERE edition_id=v_edition.id AND lower(stage_name)=lower(v_stage->>'name') AND archived_at IS NULL) THEN RAISE EXCEPTION 'Duplicate stage names are not allowed'; END IF;
    IF coalesce((v_stage->>'capacity')::integer,0) <= 0 OR coalesce((v_stage->>'capacity')::integer,0) > v_capacity THEN RAISE EXCEPTION 'Stage capacity conflict'; END IF;
    IF coalesce((v_stage->>'changeoverMinutes')::integer,30) < 5 THEN RAISE EXCEPTION 'Stage changeover duration is invalid'; END IF;
    v_stage_number := v_stage_number + 1;
    INSERT INTO public.festival_stages(festival_id, edition_id, stage_name, stage_number, capacity, stage_type, sound_capability, lighting_capability, weather_protection, default_changeover_minutes, curfew_time, public_metadata, idempotency_key)
    VALUES (NULL, v_edition.id, v_stage->>'name', v_stage_number, (v_stage->>'capacity')::integer, coalesce(v_stage->>'type','main'), v_stage->>'soundCapability', v_stage->>'lightingCapability', v_stage->>'weatherProtection', coalesce((v_stage->>'changeoverMinutes')::integer,30), nullif(v_stage->>'curfew','')::time, jsonb_build_object('created_from','admin_creation_wizard'), v_key || ':stage:' || v_stage_number) RETURNING id INTO v_stage_id;
    v_stage_ids := array_append(v_stage_ids, v_stage_id);
  END LOOP;
  PERFORM public.festival_audit(v_edition.id,'edition_setup_created','festival_edition',v_edition.id,'{}',to_jsonb(v_edition),'admin festival creation wizard',v_key || ':audit');
  v_result := jsonb_build_object('festival_id',p_festival_id,'edition_id',v_edition.id,'stage_ids',to_jsonb(v_stage_ids),'lifecycle_status',v_edition.status,'public_route','/festivals/' || p_festival_id,'management_route','/festivals/' || p_festival_id || '/manage/editions/' || v_edition.id,'created',true);
  INSERT INTO public.admin_festival_creation_requests(actor_profile_id,operation,idempotency_key,request_hash,festival_id,edition_id,result) VALUES (v_actor,'admin_create_festival_edition_with_setup',v_key,v_hash,p_festival_id,v_edition.id,v_result);
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_create_festival_with_first_edition(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor uuid := public.current_profile_id_safe();
  v_key text := coalesce(p_payload->>'idempotencyKey', p_payload->>'idempotency_key');
  v_hash text := md5(coalesce(p_payload,'{}'::jsonb)::text);
  v_existing public.admin_festival_creation_requests%ROWTYPE;
  v_identity jsonb := coalesce(p_payload->'identity','{}'::jsonb);
  v_location jsonb := coalesce(p_payload->'location','{}'::jsonb);
  v_festival public.festivals%ROWTYPE;
  v_result jsonb;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false) THEN RAISE EXCEPTION 'Admin authority required'; END IF;
  IF nullif(trim(v_key),'') IS NULL THEN RAISE EXCEPTION 'Idempotency key is required'; END IF;
  SELECT * INTO v_existing FROM public.admin_festival_creation_requests WHERE actor_profile_id IS NOT DISTINCT FROM v_actor AND operation='admin_create_festival_with_first_edition' AND idempotency_key=v_key FOR UPDATE;
  IF FOUND THEN IF v_existing.request_hash <> v_hash THEN RAISE EXCEPTION 'Idempotency key reused with different festival creation input'; END IF; RETURN v_existing.result || jsonb_build_object('created', false); END IF;
  IF nullif(trim(v_identity->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Festival name is required'; END IF;
  IF jsonb_array_length(coalesce(v_identity->'primaryGenres','[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'At least one primary genre is required'; END IF;
  INSERT INTO public.festivals(name, description, city_id, genre, scale, owner_profile_id, status, public_metadata)
  VALUES (trim(v_identity->>'name'), coalesce(nullif(v_identity->>'fullDescription',''), v_identity->>'shortDescription'), nullif(v_location->>'cityId','')::uuid, (v_identity->'primaryGenres')->>0, v_identity->>'festivalType', NULL, 'planning', jsonb_build_object('short_description',v_identity->>'shortDescription','festival_type',v_identity->>'festivalType','primary_genres',v_identity->'primaryGenres','image_url',v_identity->>'imageUrl','public_visibility',coalesce((v_identity->>'isPublic')::boolean,false),'admin_creation_key',v_key)) RETURNING * INTO v_festival;
  v_result := public.admin_create_festival_edition_with_setup(v_festival.id, p_payload || jsonb_build_object('mode','create_first_edition','existingFestivalId',v_festival.id,'idempotencyKey',v_key || ':edition'));
  v_result := v_result || jsonb_build_object('festival_id',v_festival.id,'public_route','/festivals/' || v_festival.id,'management_route','/festivals/' || v_festival.id || '/manage/editions/' || (v_result->>'edition_id'),'created',true);
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, festival_id, edition_id, operation, target_type, target_id, after_snapshot, reason, idempotency_key) VALUES (v_actor, v_festival.id, (v_result->>'edition_id')::uuid, 'festival_created_with_first_edition', 'festival', v_festival.id, v_result, 'admin creation wizard', v_key);
  INSERT INTO public.admin_festival_creation_requests(actor_profile_id,operation,idempotency_key,request_hash,festival_id,edition_id,result) VALUES (v_actor,'admin_create_festival_with_first_edition',v_key,v_hash,v_festival.id,(v_result->>'edition_id')::uuid,v_result);
  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_create_festival_with_first_edition(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_festival_edition_with_setup(uuid,jsonb) TO authenticated;

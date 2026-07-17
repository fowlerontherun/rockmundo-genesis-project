-- Harden canonical festival editions (migration 2/13)

CREATE OR REPLACE FUNCTION public.is_public_festival_edition_status(p_status public.festival_edition_status)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT p_status IN ('applications_open','booking','announced','on_sale','setup','live','settling','completed')
$$;

DROP VIEW IF EXISTS public.public_festival_editions;
CREATE VIEW public.public_festival_editions
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  id, festival_id, edition_number, edition_year, title, slug, description,
  city_id, venue_id, start_at, end_at, timezone, doors_open_at, curfew_at,
  expected_attendance, capacity, minimum_ticket_price_cents,
  maximum_ticket_price_cents, currency_code, status, public_metadata,
  announced_at, on_sale_at, live_at, completed_at, cancelled_at, created_at, updated_at
FROM public.festival_editions
WHERE public.is_public_festival_edition_status(status);
COMMENT ON VIEW public.public_festival_editions IS 'Public-safe festival edition projection.';
GRANT SELECT ON public.public_festival_editions TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.festival_edition_creation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT festival_creation_request_key_unique UNIQUE (festival_id, idempotency_key),
  CONSTRAINT festival_creation_request_key_not_blank CHECK (length(trim(idempotency_key)) > 0)
);

GRANT SELECT ON public.festival_edition_creation_requests TO authenticated;
GRANT ALL ON public.festival_edition_creation_requests TO service_role;

CREATE TABLE IF NOT EXISTS public.festival_edition_transition_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  target_status public.festival_edition_status NOT NULL,
  reason text,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  lifecycle_event_id uuid REFERENCES public.festival_edition_lifecycle_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT festival_transition_request_key_unique UNIQUE (edition_id, idempotency_key),
  CONSTRAINT festival_transition_request_key_not_blank CHECK (length(trim(idempotency_key)) > 0)
);

GRANT SELECT ON public.festival_edition_transition_requests TO authenticated;
GRANT ALL ON public.festival_edition_transition_requests TO service_role;

ALTER TABLE public.festival_edition_creation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_edition_transition_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "festival_creation_requests_owner_admin_read" ON public.festival_edition_creation_requests;
CREATE POLICY "festival_creation_requests_owner_admin_read" ON public.festival_edition_creation_requests FOR SELECT TO authenticated USING (public.can_manage_festival_brand(festival_id));
DROP POLICY IF EXISTS "festival_transition_requests_owner_admin_read" ON public.festival_edition_transition_requests;
CREATE POLICY "festival_transition_requests_owner_admin_read" ON public.festival_edition_transition_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.festival_editions e WHERE e.id=edition_id AND public.can_manage_festival_brand(e.festival_id)));

CREATE OR REPLACE FUNCTION public.validate_festival_edition_transition(p_from public.festival_edition_status, p_to public.festival_edition_status)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE
    WHEN p_from = p_to THEN false
    WHEN p_from IN ('completed','cancelled','abandoned') THEN false
    WHEN p_to IN ('cancelled','abandoned') THEN p_from NOT IN ('completed','cancelled','abandoned')
    WHEN p_to = 'postponed' THEN p_from NOT IN ('live','settling','completed','cancelled','abandoned')
    WHEN p_from = 'postponed' THEN p_to IN ('planning','announced')
    WHEN p_from = 'concept' THEN p_to = 'planning'
    WHEN p_from = 'planning' THEN p_to IN ('applications_open','booking')
    WHEN p_from = 'applications_open' THEN p_to = 'booking'
    WHEN p_from = 'booking' THEN p_to = 'announced'
    WHEN p_from = 'announced' THEN p_to IN ('on_sale','setup')
    WHEN p_from = 'on_sale' THEN p_to = 'setup'
    WHEN p_from = 'setup' THEN p_to = 'live'
    WHEN p_from = 'live' THEN p_to = 'settling'
    WHEN p_from = 'settling' THEN p_to = 'completed'
    ELSE false END
$$;

CREATE OR REPLACE FUNCTION public.create_festival_edition(
  p_festival_id uuid, p_title text DEFAULT NULL, p_start_at timestamptz DEFAULT NULL,
  p_end_at timestamptz DEFAULT NULL, p_city_id uuid DEFAULT NULL, p_venue_id uuid DEFAULT NULL,
  p_expected_attendance integer DEFAULT NULL, p_capacity integer DEFAULT NULL,
  p_minimum_ticket_price_cents bigint DEFAULT NULL, p_maximum_ticket_price_cents bigint DEFAULT NULL,
  p_public_metadata jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL
) RETURNS public.festival_editions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_festival public.festivals%ROWTYPE; v_edition public.festival_editions%ROWTYPE; v_next integer; v_actor uuid; v_hash text; v_req public.festival_edition_creation_requests%ROWTYPE;
BEGIN
  v_actor := public.current_profile_id();
  SELECT * INTO v_festival FROM public.festivals WHERE id=p_festival_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival not found'; END IF;
  IF NOT public.can_manage_festival_brand(p_festival_id) THEN RAISE EXCEPTION 'Not authorised to create festival editions'; END IF;
  IF p_start_at IS NOT NULL AND p_end_at IS NOT NULL AND p_end_at <= p_start_at THEN RAISE EXCEPTION 'Edition end must be after start'; END IF;
  IF coalesce(p_expected_attendance,0) < 0 OR coalesce(p_capacity,0) < 0 THEN RAISE EXCEPTION 'Attendance and capacity must be non-negative'; END IF;
  IF (p_minimum_ticket_price_cents IS NOT NULL AND p_minimum_ticket_price_cents < 0) OR (p_maximum_ticket_price_cents IS NOT NULL AND p_maximum_ticket_price_cents < 0) OR (p_minimum_ticket_price_cents IS NOT NULL AND p_maximum_ticket_price_cents IS NOT NULL AND p_maximum_ticket_price_cents < p_minimum_ticket_price_cents) THEN RAISE EXCEPTION 'Ticket price range invalid'; END IF;
  v_hash := md5(jsonb_build_object('festival_id',p_festival_id,'title',p_title,'start_at',p_start_at,'end_at',p_end_at,'city_id',p_city_id,'venue_id',p_venue_id,'expected_attendance',p_expected_attendance,'capacity',p_capacity,'min',p_minimum_ticket_price_cents,'max',p_maximum_ticket_price_cents,'public_metadata',coalesce(p_public_metadata,'{}'::jsonb))::text);
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_req FROM public.festival_edition_creation_requests WHERE festival_id=p_festival_id AND idempotency_key=p_idempotency_key FOR UPDATE;
    IF FOUND THEN
      IF v_req.request_hash <> v_hash THEN RAISE EXCEPTION 'Idempotency key reused with different creation input'; END IF;
      SELECT * INTO v_edition FROM public.festival_editions WHERE id=v_req.edition_id; RETURN v_edition;
    END IF;
  END IF;
  SELECT coalesce(max(edition_number),0)+1 INTO v_next FROM public.festival_editions WHERE festival_id=p_festival_id;
  INSERT INTO public.festival_editions(festival_id, edition_number, edition_year, title, description, city_id, venue_id, start_at, end_at, expected_attendance, capacity, minimum_ticket_price_cents, maximum_ticket_price_cents, treasury_allocation_cents, public_metadata, created_by, legacy_metadata)
  VALUES (p_festival_id, v_next, extract(year from coalesce(p_start_at, v_festival.start_date::timestamptz))::int, coalesce(p_title, v_festival.name || ' #' || v_next), v_festival.description, coalesce(p_city_id, v_festival.city_id), coalesce(p_venue_id, v_festival.venue_id), coalesce(p_start_at, v_festival.start_date::timestamptz), coalesce(p_end_at, (v_festival.end_date + 1)::timestamptz), coalesce(p_expected_attendance, v_festival.expected_attendance), coalesce(p_capacity, v_festival.expected_attendance), p_minimum_ticket_price_cents, p_maximum_ticket_price_cents, v_festival.treasury_cents, coalesce(p_public_metadata,'{}'::jsonb), v_actor, jsonb_build_object('created_from_rpc', true)) RETURNING * INTO v_edition;
  INSERT INTO public.festival_edition_lifecycle_events(edition_id, from_status, to_status, actor_profile_id, reason, metadata) VALUES (v_edition.id, NULL, v_edition.status, v_actor, 'edition_created', jsonb_build_object('source','create_festival_edition'));
  IF p_idempotency_key IS NOT NULL THEN INSERT INTO public.festival_edition_creation_requests(festival_id,idempotency_key,request_hash,edition_id,actor_profile_id) VALUES (p_festival_id,p_idempotency_key,v_hash,v_edition.id,v_actor); END IF;
  RETURN v_edition;
END; $$;

CREATE OR REPLACE FUNCTION public.update_festival_edition_planning(p_edition_id uuid, p_patch jsonb DEFAULT '{}'::jsonb)
RETURNS public.festival_editions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.festival_editions%ROWTYPE; n public.festival_editions%ROWTYPE; j jsonb := coalesce(p_patch,'{}'::jsonb);
BEGIN
  SELECT * INTO v FROM public.festival_editions WHERE id=p_edition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival edition not found'; END IF;
  IF NOT public.can_manage_festival_brand(v.festival_id) THEN RAISE EXCEPTION 'Not authorised to update festival edition'; END IF;
  n := v;
  IF j ? 'title' THEN n.title := j->>'title'; END IF;
  IF j ? 'description' THEN n.description := j->>'description'; END IF;
  IF j ? 'start_at' THEN n.start_at := NULLIF(j->>'start_at','')::timestamptz; END IF;
  IF j ? 'end_at' THEN n.end_at := NULLIF(j->>'end_at','')::timestamptz; END IF;
  IF j ? 'city_id' THEN n.city_id := NULLIF(j->>'city_id','')::uuid; END IF;
  IF j ? 'venue_id' THEN n.venue_id := NULLIF(j->>'venue_id','')::uuid; END IF;
  IF j ? 'expected_attendance' THEN n.expected_attendance := NULLIF(j->>'expected_attendance','')::integer; END IF;
  IF j ? 'capacity' THEN n.capacity := NULLIF(j->>'capacity','')::integer; END IF;
  IF j ? 'minimum_ticket_price_cents' THEN n.minimum_ticket_price_cents := NULLIF(j->>'minimum_ticket_price_cents','')::bigint; END IF;
  IF j ? 'maximum_ticket_price_cents' THEN n.maximum_ticket_price_cents := NULLIF(j->>'maximum_ticket_price_cents','')::bigint; END IF;
  IF j ? 'public_metadata' THEN n.public_metadata := coalesce(j->'public_metadata','{}'::jsonb); END IF;
  IF v.status NOT IN ('concept','planning','applications_open','booking') AND (n.start_at IS DISTINCT FROM v.start_at OR n.end_at IS DISTINCT FROM v.end_at OR n.city_id IS DISTINCT FROM v.city_id OR n.venue_id IS DISTINCT FROM v.venue_id OR n.expected_attendance IS DISTINCT FROM v.expected_attendance OR n.capacity IS DISTINCT FROM v.capacity OR n.minimum_ticket_price_cents IS DISTINCT FROM v.minimum_ticket_price_cents OR n.maximum_ticket_price_cents IS DISTINCT FROM v.maximum_ticket_price_cents) THEN RAISE EXCEPTION 'Festival edition planning fields are locked after announcement'; END IF;
  IF n.start_at IS NOT NULL AND n.end_at IS NOT NULL AND n.end_at <= n.start_at THEN RAISE EXCEPTION 'Edition end must be after start'; END IF;
  IF coalesce(n.expected_attendance,0) < 0 OR coalesce(n.capacity,0) < 0 THEN RAISE EXCEPTION 'Attendance and capacity must be non-negative'; END IF;
  IF (n.minimum_ticket_price_cents IS NOT NULL AND n.minimum_ticket_price_cents < 0) OR (n.maximum_ticket_price_cents IS NOT NULL AND n.maximum_ticket_price_cents < 0) OR (n.minimum_ticket_price_cents IS NOT NULL AND n.maximum_ticket_price_cents IS NOT NULL AND n.maximum_ticket_price_cents < n.minimum_ticket_price_cents) THEN RAISE EXCEPTION 'Ticket price range invalid'; END IF;
  IF v.status IN ('announced','on_sale','setup','live','settling','completed') AND (n.city_id IS NULL OR n.venue_id IS NULL OR coalesce(n.capacity,n.expected_attendance,0) <= 0) THEN RAISE EXCEPTION 'Published editions require city, venue and positive capacity or attendance'; END IF;
  UPDATE public.festival_editions SET title=n.title, description=n.description, start_at=n.start_at, end_at=n.end_at, city_id=n.city_id, venue_id=n.venue_id, expected_attendance=n.expected_attendance, capacity=n.capacity, minimum_ticket_price_cents=n.minimum_ticket_price_cents, maximum_ticket_price_cents=n.maximum_ticket_price_cents, public_metadata=n.public_metadata WHERE id=p_edition_id RETURNING * INTO n;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.transition_festival_edition(p_edition_id uuid, p_target_status public.festival_edition_status, p_reason text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_editions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.festival_editions%ROWTYPE; v_actor uuid; v_now timestamptz := now(); v_is_admin boolean; v_from public.festival_edition_status; v_hash text; v_req public.festival_edition_transition_requests%ROWTYPE; v_event uuid; v_override boolean;
BEGIN
  v_actor := public.current_profile_id(); v_is_admin := coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false); v_override := coalesce((p_metadata->>'admin_override')::boolean,false);
  SELECT * INTO v FROM public.festival_editions WHERE id=p_edition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival edition not found'; END IF;
  IF NOT public.can_manage_festival_brand(v.festival_id) THEN RAISE EXCEPTION 'Not authorised to manage this festival edition'; END IF;
  v_hash := md5(jsonb_build_object('edition_id',p_edition_id,'target_status',p_target_status,'reason',p_reason,'metadata',coalesce(p_metadata,'{}'::jsonb))::text);
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_req FROM public.festival_edition_transition_requests WHERE edition_id=p_edition_id AND idempotency_key=p_idempotency_key FOR UPDATE;
    IF FOUND THEN IF v_req.request_hash <> v_hash THEN RAISE EXCEPTION 'Idempotency key reused with different transition input'; END IF; RETURN v; END IF;
    IF EXISTS (SELECT 1 FROM public.festival_edition_lifecycle_events le WHERE le.edition_id=p_edition_id AND le.idempotency_key=p_idempotency_key) THEN
      IF EXISTS (SELECT 1 FROM public.festival_edition_lifecycle_events le WHERE le.edition_id=p_edition_id AND le.idempotency_key=p_idempotency_key AND le.to_status=p_target_status AND le.reason IS NOT DISTINCT FROM p_reason) THEN RETURN v; END IF;
      RAISE EXCEPTION 'Idempotency key reused with different transition input';
    END IF;
  END IF;
  IF v.status = p_target_status THEN RETURN v; END IF;
  v_from := v.status;
  IF p_target_status IN ('cancelled','postponed','abandoned') AND length(trim(coalesce(p_reason,''))) = 0 THEN RAISE EXCEPTION 'A reason is required for % transitions', p_target_status; END IF;
  IF NOT public.validate_festival_edition_transition(v.status, p_target_status) THEN RAISE EXCEPTION 'Invalid festival edition transition from % to %', v.status, p_target_status; END IF;
  IF p_target_status = 'announced' AND (v.start_at IS NULL OR v.end_at IS NULL OR v.start_at <= v_now OR v.city_id IS NULL OR v.venue_id IS NULL OR coalesce(v.capacity, v.expected_attendance, 0) <= 0) THEN RAISE EXCEPTION 'Festival edition requires future dates, city, venue and positive capacity or attendance before announcement'; END IF;
  IF p_target_status = 'on_sale' AND (v.status <> 'announced' OR v.start_at IS NULL OR v.start_at <= v_now OR v.minimum_ticket_price_cents IS NULL OR v.maximum_ticket_price_cents IS NULL OR v.maximum_ticket_price_cents < v.minimum_ticket_price_cents OR v.currency_code !~ '^[A-Z]{3}$') THEN RAISE EXCEPTION 'Festival edition requires announced state, future start and valid ticket price range before on-sale'; END IF;
  IF p_target_status = 'setup' AND (v.start_at IS NULL OR v.end_at IS NULL OR v.end_at <= v.start_at OR v.status IN ('cancelled','postponed')) THEN RAISE EXCEPTION 'Festival edition requires valid active dates before setup'; END IF;
  IF p_target_status = 'live' AND (v.status <> 'setup' OR v.start_at IS NULL OR v.end_at IS NULL OR (NOT (v_is_admin AND v_override) AND (v_now < v.start_at - interval '24 hours' OR v_now > v.end_at + interval '24 hours'))) THEN RAISE EXCEPTION 'Festival edition cannot go live outside the launch window without explicit admin override'; END IF;
  IF v.status = 'postponed' AND p_target_status IN ('planning','announced') AND (v.start_at IS NULL OR v.end_at IS NULL OR v.start_at <= v_now) THEN RAISE EXCEPTION 'Postponed festival edition requires new future dates before recovery'; END IF;
  UPDATE public.festival_editions SET status=p_target_status, lifecycle_metadata = lifecycle_metadata || coalesce(p_metadata,'{}'::jsonb), announced_at = CASE WHEN p_target_status='announced' AND announced_at IS NULL THEN v_now ELSE announced_at END, on_sale_at = CASE WHEN p_target_status='on_sale' AND on_sale_at IS NULL THEN v_now ELSE on_sale_at END, live_at = CASE WHEN p_target_status='live' AND live_at IS NULL THEN v_now ELSE live_at END, completed_at = CASE WHEN p_target_status='completed' AND completed_at IS NULL THEN v_now ELSE completed_at END, cancelled_at = CASE WHEN p_target_status IN ('cancelled','abandoned') AND cancelled_at IS NULL THEN v_now ELSE cancelled_at END WHERE id=p_edition_id RETURNING * INTO v;
  INSERT INTO public.festival_edition_lifecycle_events(edition_id, from_status, to_status, actor_profile_id, reason, metadata, idempotency_key) VALUES (p_edition_id, v_from, p_target_status, v_actor, p_reason, coalesce(p_metadata,'{}'::jsonb), p_idempotency_key) RETURNING id INTO v_event;
  IF p_idempotency_key IS NOT NULL THEN INSERT INTO public.festival_edition_transition_requests(edition_id,idempotency_key,request_hash,target_status,reason,actor_profile_id,lifecycle_event_id) VALUES (p_edition_id,p_idempotency_key,v_hash,p_target_status,p_reason,v_actor,v_event); END IF;
  RETURN v;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_festival_edition(uuid, text, timestamptz, timestamptz, uuid, uuid, integer, integer, bigint, bigint, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_festival_edition_planning(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_festival_edition(uuid, public.festival_edition_status, text, jsonb, text) TO authenticated;
-- Harden canonical festival editions after the historical 20291204090000 migration.
-- This migration is additive/idempotent so it is safe on clean databases and on
-- environments where PR #1190 has already run wholly or partially.

DO $$ BEGIN
  CREATE TYPE public.festival_edition_status AS ENUM (
    'concept','planning','applications_open','booking','announced','on_sale','setup','live','settling','completed','postponed','cancelled','abandoned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.is_public_festival_edition_status(p_status public.festival_edition_status)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT p_status IN ('applications_open','booking','announced','on_sale','setup','live','settling','completed')
$$;

ALTER TABLE IF EXISTS public.festival_editions
  ADD COLUMN IF NOT EXISTS creation_idempotency_key text;

ALTER TABLE IF EXISTS public.festival_edition_lifecycle_events
  ADD COLUMN IF NOT EXISTS request_fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_festival_editions_creation_idempotency
  ON public.festival_editions(festival_id, creation_idempotency_key)
  WHERE creation_idempotency_key IS NOT NULL;

DROP VIEW IF EXISTS public.public_festival_editions;
CREATE VIEW public.public_festival_editions
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  id,
  festival_id,
  edition_number,
  edition_year,
  title,
  slug,
  description,
  city_id,
  venue_id,
  start_at,
  end_at,
  timezone,
  doors_open_at,
  curfew_at,
  expected_attendance,
  capacity,
  minimum_ticket_price_cents,
  maximum_ticket_price_cents,
  currency_code,
  status,
  public_metadata,
  announced_at,
  on_sale_at,
  live_at,
  completed_at,
  cancelled_at,
  created_at,
  updated_at
FROM public.festival_editions
WHERE public.is_public_festival_edition_status(status);

COMMENT ON VIEW public.public_festival_editions IS
  'Public-safe festival edition projection. Excludes budgets, treasury allocations, lifecycle_metadata, legacy_metadata, cancellation reasons, idempotency keys, internal ownership and moderation fields.';

GRANT SELECT ON public.public_festival_editions TO anon, authenticated;

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
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.create_festival_edition(
  p_festival_id uuid,
  p_title text DEFAULT NULL,
  p_start_at timestamptz DEFAULT NULL,
  p_end_at timestamptz DEFAULT NULL,
  p_city_id uuid DEFAULT NULL,
  p_venue_id uuid DEFAULT NULL,
  p_expected_attendance integer DEFAULT NULL,
  p_capacity integer DEFAULT NULL,
  p_minimum_ticket_price_cents bigint DEFAULT NULL,
  p_maximum_ticket_price_cents bigint DEFAULT NULL,
  p_public_metadata jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS public.festival_editions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_festival public.festivals%ROWTYPE; v_edition public.festival_editions%ROWTYPE; v_next integer; v_actor uuid; v_key text := nullif(trim(p_idempotency_key),'');
BEGIN
  v_actor := public.current_profile_id();
  SELECT * INTO v_festival FROM public.festivals WHERE id=p_festival_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival not found'; END IF;
  IF NOT public.can_manage_festival_brand(p_festival_id) THEN RAISE EXCEPTION 'Not authorised to create festival editions'; END IF;
  IF v_key IS NOT NULL THEN
    SELECT * INTO v_edition FROM public.festival_editions WHERE festival_id=p_festival_id AND creation_idempotency_key=v_key;
    IF FOUND THEN RETURN v_edition; END IF;
  END IF;
  IF p_start_at IS NOT NULL AND p_end_at IS NOT NULL AND p_end_at <= p_start_at THEN RAISE EXCEPTION 'Edition end must be after start'; END IF;
  IF coalesce(p_expected_attendance,0) < 0 OR coalesce(p_capacity,0) < 0 THEN RAISE EXCEPTION 'Attendance and capacity must be non-negative'; END IF;
  IF coalesce(p_minimum_ticket_price_cents,0) < 0 OR coalesce(p_maximum_ticket_price_cents,0) < 0 OR (p_minimum_ticket_price_cents IS NOT NULL AND p_maximum_ticket_price_cents IS NOT NULL AND p_maximum_ticket_price_cents < p_minimum_ticket_price_cents) THEN RAISE EXCEPTION 'Ticket price range invalid'; END IF;
  SELECT coalesce(max(edition_number),0)+1 INTO v_next FROM public.festival_editions WHERE festival_id=p_festival_id;
  INSERT INTO public.festival_editions(festival_id, edition_number, edition_year, title, description, city_id, venue_id, start_at, end_at, expected_attendance, capacity, minimum_ticket_price_cents, maximum_ticket_price_cents, treasury_allocation_cents, public_metadata, created_by, legacy_metadata, creation_idempotency_key)
  VALUES (p_festival_id, v_next, extract(year from coalesce(p_start_at, v_festival.start_date::timestamptz))::int, coalesce(p_title, v_festival.name || ' #' || v_next), v_festival.description, coalesce(p_city_id, v_festival.city_id), coalesce(p_venue_id, v_festival.venue_id), coalesce(p_start_at, v_festival.start_date::timestamptz), coalesce(p_end_at, (v_festival.end_date + 1)::timestamptz), coalesce(p_expected_attendance, v_festival.expected_attendance), coalesce(p_capacity, v_festival.expected_attendance), p_minimum_ticket_price_cents, p_maximum_ticket_price_cents, v_festival.treasury_cents, coalesce(p_public_metadata,'{}'::jsonb), v_actor, jsonb_build_object('created_from_rpc', true), v_key)
  RETURNING * INTO v_edition;
  INSERT INTO public.festival_edition_lifecycle_events(edition_id, from_status, to_status, actor_profile_id, reason, metadata, idempotency_key, request_fingerprint)
  VALUES (v_edition.id, NULL, v_edition.status, v_actor, 'edition_created', jsonb_build_object('source','create_festival_edition'), CASE WHEN v_key IS NULL THEN NULL ELSE 'create:'||v_key END, md5(jsonb_build_object('purpose','create','festival_id',p_festival_id,'key',v_key)::text));
  RETURN v_edition;
END; $$;

CREATE OR REPLACE FUNCTION public.update_festival_edition_planning(
  p_edition_id uuid,
  p_patch jsonb DEFAULT '{}'::jsonb
) RETURNS public.festival_editions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_edition public.festival_editions%ROWTYPE; v_new public.festival_editions%ROWTYPE;
BEGIN
  SELECT * INTO v_edition FROM public.festival_editions WHERE id=p_edition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival edition not found'; END IF;
  IF NOT public.can_manage_festival_brand(v_edition.festival_id) THEN RAISE EXCEPTION 'Not authorised to update festival edition'; END IF;
  IF v_edition.status NOT IN ('concept','planning','applications_open','booking') THEN RAISE EXCEPTION 'Festival edition planning fields are locked after announcement'; END IF;
  v_new := v_edition;
  v_new.title := CASE WHEN p_patch ? 'title' THEN NULLIF(p_patch->>'title','') ELSE v_new.title END;
  v_new.description := CASE WHEN p_patch ? 'description' THEN p_patch->>'description' ELSE v_new.description END;
  v_new.start_at := CASE WHEN p_patch ? 'start_at' THEN (p_patch->>'start_at')::timestamptz ELSE v_new.start_at END;
  v_new.end_at := CASE WHEN p_patch ? 'end_at' THEN (p_patch->>'end_at')::timestamptz ELSE v_new.end_at END;
  v_new.city_id := CASE WHEN p_patch ? 'city_id' THEN (p_patch->>'city_id')::uuid ELSE v_new.city_id END;
  v_new.venue_id := CASE WHEN p_patch ? 'venue_id' THEN (p_patch->>'venue_id')::uuid ELSE v_new.venue_id END;
  v_new.expected_attendance := CASE WHEN p_patch ? 'expected_attendance' THEN (p_patch->>'expected_attendance')::integer ELSE v_new.expected_attendance END;
  v_new.capacity := CASE WHEN p_patch ? 'capacity' THEN (p_patch->>'capacity')::integer ELSE v_new.capacity END;
  v_new.minimum_ticket_price_cents := CASE WHEN p_patch ? 'minimum_ticket_price_cents' THEN (p_patch->>'minimum_ticket_price_cents')::bigint ELSE v_new.minimum_ticket_price_cents END;
  v_new.maximum_ticket_price_cents := CASE WHEN p_patch ? 'maximum_ticket_price_cents' THEN (p_patch->>'maximum_ticket_price_cents')::bigint ELSE v_new.maximum_ticket_price_cents END;
  v_new.public_metadata := CASE WHEN p_patch ? 'public_metadata' THEN coalesce(p_patch->'public_metadata','{}'::jsonb) ELSE v_new.public_metadata END;
  IF v_new.start_at IS NOT NULL AND v_new.end_at IS NOT NULL AND v_new.end_at <= v_new.start_at THEN RAISE EXCEPTION 'Edition end must be after start'; END IF;
  IF coalesce(v_new.expected_attendance,0) < 0 OR coalesce(v_new.capacity,0) < 0 THEN RAISE EXCEPTION 'Attendance and capacity must be non-negative'; END IF;
  IF coalesce(v_new.minimum_ticket_price_cents,0) < 0 OR coalesce(v_new.maximum_ticket_price_cents,0) < 0 OR (v_new.minimum_ticket_price_cents IS NOT NULL AND v_new.maximum_ticket_price_cents IS NOT NULL AND v_new.maximum_ticket_price_cents < v_new.minimum_ticket_price_cents) THEN RAISE EXCEPTION 'Ticket price range invalid'; END IF;
  IF v_edition.status IN ('applications_open','booking') AND (v_new.city_id IS NULL OR v_new.venue_id IS NULL) THEN RAISE EXCEPTION 'City and venue are required for this lifecycle stage'; END IF;
  UPDATE public.festival_editions SET title=v_new.title, description=v_new.description, start_at=v_new.start_at, end_at=v_new.end_at, city_id=v_new.city_id, venue_id=v_new.venue_id, expected_attendance=v_new.expected_attendance, capacity=v_new.capacity, minimum_ticket_price_cents=v_new.minimum_ticket_price_cents, maximum_ticket_price_cents=v_new.maximum_ticket_price_cents, public_metadata=v_new.public_metadata
  WHERE id=p_edition_id RETURNING * INTO v_edition;
  RETURN v_edition;
END; $$;

CREATE OR REPLACE FUNCTION public.transition_festival_edition(
  p_edition_id uuid,
  p_target_status public.festival_edition_status,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS public.festival_editions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_edition public.festival_editions%ROWTYPE; v_existing public.festival_edition_lifecycle_events%ROWTYPE; v_actor uuid; v_now timestamptz := now(); v_from public.festival_edition_status; v_key text := nullif(trim(p_idempotency_key),''); v_fingerprint text; v_admin_override boolean;
BEGIN
  v_actor := public.current_profile_id();
  v_fingerprint := md5(jsonb_build_object('purpose','transition','edition_id',p_edition_id,'target_status',p_target_status,'reason',coalesce(p_reason,''),'metadata',coalesce(p_metadata,'{}'::jsonb))::text);
  SELECT * INTO v_edition FROM public.festival_editions WHERE id=p_edition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival edition not found'; END IF;
  IF NOT public.can_manage_festival_brand(v_edition.festival_id) THEN RAISE EXCEPTION 'Not authorised to manage this festival edition'; END IF;
  IF v_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.festival_edition_lifecycle_events WHERE edition_id=p_edition_id AND idempotency_key=v_key FOR UPDATE;
    IF FOUND THEN
      IF v_existing.request_fingerprint IS DISTINCT FROM v_fingerprint THEN RAISE EXCEPTION 'Idempotency key reused with different transition inputs'; END IF;
      RETURN v_edition;
    END IF;
  END IF;
  v_from := v_edition.status;
  IF v_from = p_target_status THEN RETURN v_edition; END IF;
  IF p_target_status IN ('cancelled','postponed','abandoned') AND length(trim(coalesce(p_reason,''))) = 0 THEN RAISE EXCEPTION 'A reason is required for % transitions', p_target_status; END IF;
  IF NOT public.validate_festival_edition_transition(v_from, p_target_status) THEN RAISE EXCEPTION 'Invalid festival edition transition from % to %', v_from, p_target_status; END IF;
  IF p_target_status = 'announced' AND (v_edition.start_at IS NULL OR v_edition.end_at IS NULL OR v_edition.start_at < v_now - interval '1 day' OR v_edition.city_id IS NULL OR v_edition.venue_id IS NULL OR coalesce(v_edition.capacity, v_edition.expected_attendance, 0) <= 0) THEN RAISE EXCEPTION 'Festival edition requires future dates, city, venue and positive capacity or attendance before announcement'; END IF;
  IF p_target_status = 'on_sale' AND (v_from <> 'announced' OR v_edition.minimum_ticket_price_cents IS NULL OR v_edition.maximum_ticket_price_cents IS NULL OR v_edition.maximum_ticket_price_cents < v_edition.minimum_ticket_price_cents OR v_edition.currency_code !~ '^[A-Z]{3}$' OR v_edition.start_at <= v_now) THEN RAISE EXCEPTION 'Festival edition requires announced state, future start and valid non-negative ticket range before on-sale'; END IF;
  IF p_target_status = 'setup' AND (v_edition.start_at IS NULL OR v_edition.end_at IS NULL OR v_edition.end_at <= v_edition.start_at OR v_from IN ('cancelled','postponed','abandoned')) THEN RAISE EXCEPTION 'Festival edition requires valid active dates before setup'; END IF;
  v_admin_override := coalesce((p_metadata->>'admin_override')::boolean, false);
  IF p_target_status = 'live' AND (v_from <> 'setup' OR v_edition.start_at IS NULL OR v_edition.end_at IS NULL OR (NOT v_admin_override AND (v_now < v_edition.start_at - interval '24 hours' OR v_now > v_edition.end_at + interval '24 hours')) OR (v_admin_override AND (v_actor IS NULL OR length(trim(coalesce(p_metadata->>'override_reason',''))) = 0))) THEN RAISE EXCEPTION 'Festival edition cannot go live without setup state, dates and valid launch window or explicit audited admin override'; END IF;
  IF v_from = 'postponed' AND p_target_status IN ('planning','announced') AND (v_edition.start_at IS NULL OR v_edition.end_at IS NULL OR v_edition.start_at <= v_now OR NOT (coalesce(p_metadata,'{}'::jsonb) ? 'previous_start_at') OR NOT (coalesce(p_metadata,'{}'::jsonb) ? 'previous_end_at')) THEN RAISE EXCEPTION 'Postponed festival edition requires new future dates and previous date metadata before recovery'; END IF;
  UPDATE public.festival_editions SET
    status=p_target_status,
    lifecycle_metadata = CASE WHEN p_target_status='postponed' THEN lifecycle_metadata || jsonb_build_object('postponed_at', v_now, 'postponement_reason', p_reason) ELSE lifecycle_metadata || coalesce(p_metadata,'{}'::jsonb) END,
    announced_at = CASE WHEN p_target_status='announced' AND announced_at IS NULL THEN v_now ELSE announced_at END,
    on_sale_at = CASE WHEN p_target_status='on_sale' AND on_sale_at IS NULL THEN v_now ELSE on_sale_at END,
    live_at = CASE WHEN p_target_status='live' AND live_at IS NULL THEN v_now ELSE live_at END,
    completed_at = CASE WHEN p_target_status='completed' AND completed_at IS NULL THEN v_now ELSE completed_at END,
    cancelled_at = CASE WHEN p_target_status IN ('cancelled','abandoned') AND cancelled_at IS NULL THEN v_now ELSE cancelled_at END
  WHERE id=p_edition_id RETURNING * INTO v_edition;
  INSERT INTO public.festival_edition_lifecycle_events(edition_id, from_status, to_status, actor_profile_id, reason, metadata, idempotency_key, request_fingerprint)
  VALUES (p_edition_id, v_from, p_target_status, v_actor, p_reason, coalesce(p_metadata,'{}'::jsonb), v_key, v_fingerprint);
  RETURN v_edition;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_festival_edition(uuid, text, timestamptz, timestamptz, uuid, uuid, integer, integer, bigint, bigint, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_festival_edition_planning(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_festival_edition(uuid, public.festival_edition_status, text, jsonb, text) TO authenticated;

DO $$ BEGIN
  PERFORM 1 FROM public.public_festival_editions LIMIT 1;
END $$;

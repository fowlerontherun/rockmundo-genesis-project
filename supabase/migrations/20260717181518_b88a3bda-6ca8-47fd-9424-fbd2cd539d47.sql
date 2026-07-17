-- Phase B Batch 2 (migration #1 of 13): Festival editions foundation
-- Helper: current_profile_id() maps auth.uid() -> profiles.id
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated, anon;

DO $$ BEGIN
  CREATE TYPE public.festival_edition_status AS ENUM (
    'concept','planning','applications_open','booking','announced','on_sale','setup','live','settling','completed','postponed','cancelled','abandoned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.festival_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  edition_number integer NOT NULL,
  edition_year integer,
  title text,
  slug text,
  description text,
  city_id uuid REFERENCES public.cities(id) ON DELETE RESTRICT,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  start_at timestamptz,
  end_at timestamptz,
  timezone text NOT NULL DEFAULT 'UTC',
  doors_open_at timestamptz,
  curfew_at timestamptz,
  expected_attendance integer,
  capacity integer,
  minimum_ticket_price_cents bigint,
  maximum_ticket_price_cents bigint,
  currency_code text NOT NULL DEFAULT 'USD',
  budget_cents bigint,
  treasury_allocation_cents bigint,
  status public.festival_edition_status NOT NULL DEFAULT 'planning',
  lifecycle_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  legacy_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  announced_at timestamptz,
  on_sale_at timestamptz,
  live_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  CONSTRAINT festival_editions_festival_number_key UNIQUE (festival_id, edition_number),
  CONSTRAINT festival_editions_edition_number_positive CHECK (edition_number > 0),
  CONSTRAINT festival_editions_year_reasonable CHECK (edition_year IS NULL OR edition_year BETWEEN 1900 AND 2200),
  CONSTRAINT festival_editions_dates_order CHECK (start_at IS NULL OR end_at IS NULL OR end_at > start_at),
  CONSTRAINT festival_editions_doors_before_end CHECK (doors_open_at IS NULL OR end_at IS NULL OR doors_open_at <= end_at),
  CONSTRAINT festival_editions_curfew_after_start CHECK (curfew_at IS NULL OR start_at IS NULL OR curfew_at >= start_at),
  CONSTRAINT festival_editions_nonnegative_attendance CHECK (expected_attendance IS NULL OR expected_attendance >= 0),
  CONSTRAINT festival_editions_nonnegative_capacity CHECK (capacity IS NULL OR capacity >= 0),
  CONSTRAINT festival_editions_nonnegative_money CHECK (
    (minimum_ticket_price_cents IS NULL OR minimum_ticket_price_cents >= 0)
    AND (maximum_ticket_price_cents IS NULL OR maximum_ticket_price_cents >= 0)
    AND (budget_cents IS NULL OR budget_cents >= 0)
    AND (treasury_allocation_cents IS NULL OR treasury_allocation_cents >= 0)
  ),
  CONSTRAINT festival_editions_ticket_range CHECK (
    minimum_ticket_price_cents IS NULL OR maximum_ticket_price_cents IS NULL OR maximum_ticket_price_cents >= minimum_ticket_price_cents
  ),
  CONSTRAINT festival_editions_currency_code_format CHECK (currency_code ~ '^[A-Z]{3}$')
);

CREATE TABLE IF NOT EXISTS public.festival_edition_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  from_status public.festival_edition_status,
  to_status public.festival_edition_status NOT NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT festival_lifecycle_reason_required CHECK (to_status NOT IN ('cancelled','postponed','abandoned') OR length(trim(coalesce(reason,''))) > 0),
  CONSTRAINT festival_lifecycle_idempotency_key_not_blank CHECK (idempotency_key IS NULL OR length(trim(idempotency_key)) > 0),
  CONSTRAINT festival_lifecycle_idempotency_unique UNIQUE (edition_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_legacy_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  legacy_source text NOT NULL CHECK (legacy_source IN ('game_event','dedicated_festival_row','festival_lineup_source')),
  legacy_id uuid NOT NULL,
  legacy_festival_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT festival_legacy_mappings_source_id_key UNIQUE (legacy_source, legacy_id),
  CONSTRAINT festival_legacy_mappings_edition_source_id_key UNIQUE (edition_id, legacy_source, legacy_id)
);

GRANT SELECT ON public.festival_editions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.festival_editions TO service_role;
GRANT ALL ON public.festival_editions TO service_role;
GRANT SELECT ON public.festival_edition_lifecycle_events TO authenticated;
GRANT ALL ON public.festival_edition_lifecycle_events TO service_role;
GRANT SELECT ON public.festival_legacy_mappings TO authenticated;
GRANT ALL ON public.festival_legacy_mappings TO service_role;

ALTER TABLE public.festival_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_edition_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_legacy_mappings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_festival_editions_status_start ON public.festival_editions(status, start_at);
CREATE INDEX IF NOT EXISTS idx_festival_editions_city_start ON public.festival_editions(city_id, start_at) WHERE city_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_festival_editions_venue_start ON public.festival_editions(venue_id, start_at) WHERE venue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_festival_editions_visible_upcoming ON public.festival_editions(start_at, status) WHERE status IN ('applications_open','booking','announced','on_sale','setup','live','settling','completed');
CREATE INDEX IF NOT EXISTS idx_festival_editions_processing ON public.festival_editions(status, start_at, end_at) WHERE status IN ('setup','live','settling');
CREATE INDEX IF NOT EXISTS idx_festival_lifecycle_edition_created ON public.festival_edition_lifecycle_events(edition_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_festival_legacy_source_id ON public.festival_legacy_mappings(legacy_source, legacy_id);
CREATE INDEX IF NOT EXISTS idx_festival_legacy_edition ON public.festival_legacy_mappings(edition_id);

CREATE OR REPLACE FUNCTION public.is_public_festival_edition_status(p_status public.festival_edition_status)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT p_status IN ('applications_open','booking','announced','on_sale','setup','live','settling','completed')
$$;

CREATE OR REPLACE VIEW public.public_festival_editions AS
SELECT
  id, festival_id, edition_number, edition_year, title, slug, description, city_id, venue_id,
  start_at, end_at, timezone, doors_open_at, curfew_at, expected_attendance, capacity,
  minimum_ticket_price_cents, maximum_ticket_price_cents, currency_code, status, public_metadata,
  announced_at, on_sale_at, live_at, completed_at, cancelled_at, created_at, updated_at
FROM public.festival_editions
WHERE public.is_public_festival_edition_status(status);
GRANT SELECT ON public.public_festival_editions TO anon, authenticated;

DROP TRIGGER IF EXISTS tg_festival_editions_touch ON public.festival_editions;
CREATE TRIGGER tg_festival_editions_touch BEFORE UPDATE ON public.festival_editions FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE OR REPLACE FUNCTION public.can_manage_festival_brand(p_festival_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false)
    OR EXISTS (SELECT 1 FROM public.festivals f WHERE f.id = p_festival_id AND f.owner_profile_id = public.current_profile_id())
$$;

CREATE OR REPLACE FUNCTION public.validate_festival_edition_transition(p_from public.festival_edition_status, p_to public.festival_edition_status)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE
    WHEN p_from = p_to THEN true
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

CREATE OR REPLACE FUNCTION public.transition_festival_edition(
  p_edition_id uuid,
  p_target_status public.festival_edition_status,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS public.festival_editions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_edition public.festival_editions%ROWTYPE; v_existing public.festival_edition_lifecycle_events%ROWTYPE; v_actor uuid; v_now timestamptz := now(); v_is_admin boolean; v_from public.festival_edition_status;
BEGIN
  v_actor := public.current_profile_id();
  v_is_admin := coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false);
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.festival_edition_lifecycle_events WHERE edition_id=p_edition_id AND idempotency_key=p_idempotency_key;
    IF FOUND THEN SELECT * INTO v_edition FROM public.festival_editions WHERE id=p_edition_id; RETURN v_edition; END IF;
  END IF;
  SELECT * INTO v_edition FROM public.festival_editions WHERE id=p_edition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival edition not found'; END IF;
  IF NOT public.can_manage_festival_brand(v_edition.festival_id) THEN RAISE EXCEPTION 'Not authorised to manage this festival edition'; END IF;
  v_from := v_edition.status;
  IF p_target_status IN ('cancelled','postponed','abandoned') AND length(trim(coalesce(p_reason,''))) = 0 THEN RAISE EXCEPTION 'A reason is required for % transitions', p_target_status; END IF;
  IF NOT public.validate_festival_edition_transition(v_edition.status, p_target_status) THEN RAISE EXCEPTION 'Invalid festival edition transition from % to %', v_edition.status, p_target_status; END IF;
  IF p_target_status = 'announced' AND (v_edition.start_at IS NULL OR v_edition.end_at IS NULL OR v_edition.city_id IS NULL OR v_edition.venue_id IS NULL OR coalesce(v_edition.capacity, v_edition.expected_attendance, 0) <= 0) THEN
    RAISE EXCEPTION 'Festival edition requires dates, city, venue and positive capacity or attendance before announcement';
  END IF;
  IF p_target_status = 'on_sale' AND (v_edition.status <> 'announced' OR v_edition.minimum_ticket_price_cents IS NULL OR v_edition.maximum_ticket_price_cents IS NULL OR v_edition.maximum_ticket_price_cents < v_edition.minimum_ticket_price_cents) THEN
    RAISE EXCEPTION 'Festival edition requires announced state and valid ticket price range before on-sale';
  END IF;
  IF p_target_status = 'live' AND NOT v_is_admin AND (v_now < v_edition.start_at - interval '24 hours' OR v_now > v_edition.end_at + interval '24 hours') THEN
    RAISE EXCEPTION 'Festival edition cannot go live outside the launch window without admin override';
  END IF;
  IF v_edition.status = 'postponed' AND p_target_status IN ('planning','announced') AND (v_edition.start_at IS NULL OR v_edition.end_at IS NULL OR v_edition.start_at <= v_now) THEN
    RAISE EXCEPTION 'Postponed festival edition requires new future dates before recovery';
  END IF;

  UPDATE public.festival_editions SET
    status=p_target_status,
    lifecycle_metadata = lifecycle_metadata || coalesce(p_metadata,'{}'::jsonb),
    announced_at = CASE WHEN p_target_status='announced' AND announced_at IS NULL THEN v_now ELSE announced_at END,
    on_sale_at = CASE WHEN p_target_status='on_sale' AND on_sale_at IS NULL THEN v_now ELSE on_sale_at END,
    live_at = CASE WHEN p_target_status='live' AND live_at IS NULL THEN v_now ELSE live_at END,
    completed_at = CASE WHEN p_target_status='completed' AND completed_at IS NULL THEN v_now ELSE completed_at END,
    cancelled_at = CASE WHEN p_target_status IN ('cancelled','abandoned') AND cancelled_at IS NULL THEN v_now ELSE cancelled_at END
  WHERE id=p_edition_id RETURNING * INTO v_edition;

  INSERT INTO public.festival_edition_lifecycle_events(edition_id, from_status, to_status, actor_profile_id, reason, metadata, idempotency_key)
  VALUES (p_edition_id, v_from, p_target_status, v_actor, p_reason, coalesce(p_metadata,'{}'::jsonb), p_idempotency_key)
  ON CONFLICT (edition_id, idempotency_key) DO NOTHING;
  RETURN v_edition;
END; $$;

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
  p_public_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.festival_editions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_festival public.festivals%ROWTYPE; v_edition public.festival_editions%ROWTYPE; v_next integer; v_actor uuid;
BEGIN
  v_actor := public.current_profile_id();
  SELECT * INTO v_festival FROM public.festivals WHERE id=p_festival_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival not found'; END IF;
  IF NOT public.can_manage_festival_brand(p_festival_id) THEN RAISE EXCEPTION 'Not authorised to create festival editions'; END IF;
  IF p_start_at IS NOT NULL AND p_end_at IS NOT NULL AND p_end_at <= p_start_at THEN RAISE EXCEPTION 'Edition end must be after start'; END IF;
  SELECT coalesce(max(edition_number),0)+1 INTO v_next FROM public.festival_editions WHERE festival_id=p_festival_id;
  INSERT INTO public.festival_editions(festival_id, edition_number, edition_year, title, description, city_id, venue_id, start_at, end_at, expected_attendance, capacity, minimum_ticket_price_cents, maximum_ticket_price_cents, treasury_allocation_cents, public_metadata, created_by, legacy_metadata)
  VALUES (p_festival_id, v_next, extract(year from coalesce(p_start_at, v_festival.start_date::timestamptz))::int, coalesce(p_title, v_festival.name || ' #' || v_next), v_festival.description, coalesce(p_city_id, v_festival.city_id), coalesce(p_venue_id, v_festival.venue_id), coalesce(p_start_at, v_festival.start_date::timestamptz), coalesce(p_end_at, (v_festival.end_date + 1)::timestamptz), coalesce(p_expected_attendance, v_festival.expected_attendance), coalesce(p_capacity, v_festival.expected_attendance), p_minimum_ticket_price_cents, p_maximum_ticket_price_cents, v_festival.treasury_cents, coalesce(p_public_metadata,'{}'::jsonb), v_actor, jsonb_build_object('created_from_rpc', true))
  RETURNING * INTO v_edition;
  INSERT INTO public.festival_edition_lifecycle_events(edition_id, from_status, to_status, actor_profile_id, reason, metadata)
  VALUES (v_edition.id, NULL, v_edition.status, v_actor, 'edition_created', jsonb_build_object('source','create_festival_edition'));
  RETURN v_edition;
END; $$;

CREATE OR REPLACE FUNCTION public.update_festival_edition_planning(
  p_edition_id uuid,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_start_at timestamptz DEFAULT NULL,
  p_end_at timestamptz DEFAULT NULL,
  p_city_id uuid DEFAULT NULL,
  p_venue_id uuid DEFAULT NULL,
  p_expected_attendance integer DEFAULT NULL,
  p_capacity integer DEFAULT NULL,
  p_minimum_ticket_price_cents bigint DEFAULT NULL,
  p_maximum_ticket_price_cents bigint DEFAULT NULL,
  p_public_metadata jsonb DEFAULT NULL
) RETURNS public.festival_editions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_edition public.festival_editions%ROWTYPE;
BEGIN
  SELECT * INTO v_edition FROM public.festival_editions WHERE id=p_edition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival edition not found'; END IF;
  IF NOT public.can_manage_festival_brand(v_edition.festival_id) THEN RAISE EXCEPTION 'Not authorised to update festival edition'; END IF;
  IF v_edition.status NOT IN ('concept','planning','applications_open','booking') THEN RAISE EXCEPTION 'Festival edition planning fields are locked after announcement'; END IF;
  IF p_start_at IS NOT NULL AND p_end_at IS NOT NULL AND p_end_at <= p_start_at THEN RAISE EXCEPTION 'Edition end must be after start'; END IF;
  UPDATE public.festival_editions SET
    title=coalesce(p_title,title), description=coalesce(p_description,description), start_at=coalesce(p_start_at,start_at), end_at=coalesce(p_end_at,end_at), city_id=coalesce(p_city_id,city_id), venue_id=coalesce(p_venue_id,venue_id), expected_attendance=coalesce(p_expected_attendance,expected_attendance), capacity=coalesce(p_capacity,capacity), minimum_ticket_price_cents=coalesce(p_minimum_ticket_price_cents,minimum_ticket_price_cents), maximum_ticket_price_cents=coalesce(p_maximum_ticket_price_cents,maximum_ticket_price_cents), public_metadata=coalesce(p_public_metadata,public_metadata)
  WHERE id=p_edition_id RETURNING * INTO v_edition;
  RETURN v_edition;
END; $$;

GRANT EXECUTE ON FUNCTION public.transition_festival_edition(uuid, public.festival_edition_status, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_festival_edition(uuid, text, timestamptz, timestamptz, uuid, uuid, integer, integer, bigint, bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_festival_edition_planning(uuid, text, text, timestamptz, timestamptz, uuid, uuid, integer, integer, bigint, bigint, jsonb) TO authenticated;

CREATE POLICY "festival_editions_owner_admin_read" ON public.festival_editions FOR SELECT TO authenticated USING (public.can_manage_festival_brand(festival_id));
CREATE POLICY "festival_lifecycle_owner_admin_read" ON public.festival_edition_lifecycle_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.festival_editions e WHERE e.id=edition_id AND public.can_manage_festival_brand(e.festival_id)));
CREATE POLICY "festival_legacy_mappings_owner_admin_read" ON public.festival_legacy_mappings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.festival_editions e WHERE e.id=edition_id AND public.can_manage_festival_brand(e.festival_id)));

-- Backfill dedicated festival rows as their first canonical edition.
WITH source_festivals AS (
  SELECT f.*,
    CASE
      WHEN f.status = 'live' THEN 'live'::public.festival_edition_status
      WHEN f.status = 'completed' THEN 'completed'::public.festival_edition_status
      WHEN f.status = 'postponed' THEN 'postponed'::public.festival_edition_status
      WHEN f.status = 'cancelled' THEN 'cancelled'::public.festival_edition_status
      WHEN f.status IN ('published','announced') THEN 'announced'::public.festival_edition_status
      WHEN f.status = 'confirmed' THEN 'booking'::public.festival_edition_status
      WHEN f.status IN ('upcoming','draft') THEN 'planning'::public.festival_edition_status
      ELSE 'planning'::public.festival_edition_status
    END AS mapped_status
  FROM public.festivals f
), inserted AS (
  INSERT INTO public.festival_editions(festival_id, edition_number, edition_year, title, description, city_id, venue_id, start_at, end_at, expected_attendance, capacity, minimum_ticket_price_cents, maximum_ticket_price_cents, currency_code, treasury_allocation_cents, status, public_metadata, legacy_metadata, created_at, updated_at, announced_at, live_at, completed_at, cancelled_at)
  SELECT sf.id, greatest(coalesce(sf.edition_number,1),1), extract(year from sf.start_date)::int, sf.name || ' ' || extract(year from sf.start_date)::int, sf.description, sf.city_id, sf.venue_id, sf.start_date::timestamptz, (sf.end_date + 1)::timestamptz, sf.expected_attendance, sf.expected_attendance, CASE WHEN sf.ticket_price_low IS NULL THEN NULL ELSE round(sf.ticket_price_low * 100)::bigint END, CASE WHEN sf.ticket_price_high IS NULL THEN NULL ELSE round(sf.ticket_price_high * 100)::bigint END, 'USD', sf.treasury_cents, sf.mapped_status, jsonb_build_object('legacy_brand_public_metadata', sf.metadata), jsonb_build_object('source','dedicated_festival_backfill','original_status',sf.status,'ticket_price_unit','dollars','brand_edition_number',sf.edition_number,'brand_next_edition_start',sf.next_edition_start,'brand_cancellation_reason',sf.cancellation_reason), sf.created_at, sf.updated_at, CASE WHEN sf.mapped_status IN ('announced','on_sale','setup','live','settling','completed') THEN sf.updated_at ELSE NULL END, CASE WHEN sf.mapped_status='live' THEN sf.updated_at ELSE NULL END, CASE WHEN sf.mapped_status='completed' THEN sf.updated_at ELSE NULL END, CASE WHEN sf.mapped_status IN ('cancelled','abandoned') THEN sf.updated_at ELSE NULL END
  FROM source_festivals sf
  WHERE NOT EXISTS (SELECT 1 FROM public.festival_editions e WHERE e.festival_id=sf.id AND e.edition_number=greatest(coalesce(sf.edition_number,1),1))
  RETURNING *
)
INSERT INTO public.festival_edition_lifecycle_events(edition_id, from_status, to_status, reason, metadata)
SELECT id, NULL, status, 'dedicated_festival_backfill', jsonb_build_object('source','migration') FROM inserted;

INSERT INTO public.festival_legacy_mappings(edition_id, legacy_source, legacy_id, legacy_festival_id, metadata)
SELECT e.id, 'dedicated_festival_row', e.festival_id, e.festival_id, jsonb_build_object('source','migration')
FROM public.festival_editions e
ON CONFLICT (legacy_source, legacy_id) DO NOTHING;

INSERT INTO public.festival_legacy_mappings(edition_id, legacy_source, legacy_id, legacy_festival_id, metadata)
SELECT e.id, 'game_event', ge.id, e.festival_id, jsonb_build_object('source','migration','match','exact_title_venue_date_overlap')
FROM public.game_events ge
JOIN public.festival_editions e ON lower(trim(e.title)) = lower(trim(ge.title)) OR lower(trim(split_part(e.title, ' ' || coalesce(e.edition_year::text,''), 1))) = lower(trim(ge.title))
WHERE ge.event_type = 'festival'
  AND (ge.venue_id IS NULL OR e.venue_id IS NULL OR ge.venue_id = e.venue_id)
  AND ge.start_date <= e.end_at::date AND ge.end_date >= e.start_at::date
ON CONFLICT (legacy_source, legacy_id) DO NOTHING;

-- festival_lineups is not present in live DB; guard optional legacy mapping.
DO $$
BEGIN
  IF to_regclass('public.festival_lineups') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.festival_legacy_mappings(edition_id, legacy_source, legacy_id, legacy_festival_id, metadata)
      SELECT e.id, 'festival_lineup_source', fl.id, e.festival_id, jsonb_build_object('source','migration')
      FROM public.festival_lineups fl
      JOIN public.festival_editions e ON e.festival_id = fl.festival_id
      ON CONFLICT (legacy_source, legacy_id) DO NOTHING;
    $sql$;
  END IF;
END $$;
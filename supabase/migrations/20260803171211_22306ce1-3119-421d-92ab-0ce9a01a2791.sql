
-- =========================================================
-- Festival Phase 7B: launch, public projection and ticketing
-- =========================================================

CREATE TABLE IF NOT EXISTS public.festival_public_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL UNIQUE REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  public_name text NOT NULL,
  tagline text,
  description text NOT NULL DEFAULT '',
  public_slug text NOT NULL UNIQUE,
  hero_image_reference text,
  logo_reference text,
  age_guidance text,
  accessibility_summary text,
  transport_summary text,
  camping_summary text,
  food_and_drink_summary text,
  terms_summary text,
  refund_policy_summary text,
  contact_summary text,
  public_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.festival_public_profiles TO anon, authenticated;
GRANT ALL ON public.festival_public_profiles TO service_role;
ALTER TABLE public.festival_public_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "festival_public_profiles_read" ON public.festival_public_profiles FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.festival_launches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL UNIQUE REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  launch_status text NOT NULL DEFAULT 'not_ready',
  public_slug text UNIQUE,
  public_visibility text NOT NULL DEFAULT 'private',
  launch_version integer NOT NULL DEFAULT 1,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  launched_at timestamptz,
  ticket_sales_opened_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.festival_launches TO anon, authenticated;
GRANT ALL ON public.festival_launches TO service_role;
ALTER TABLE public.festival_launches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "festival_launches_read" ON public.festival_launches FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.festival_launch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_launch_id uuid NOT NULL REFERENCES public.festival_launches(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  reason text,
  actor_profile_id uuid,
  idempotency_key uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS festival_launch_events_idem
  ON public.festival_launch_events (festival_launch_id, event_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
GRANT SELECT ON public.festival_launch_events TO authenticated;
GRANT ALL ON public.festival_launch_events TO service_role;
ALTER TABLE public.festival_launch_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "festival_launch_events_owner_read" ON public.festival_launch_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.festival_launches l
  JOIN public.festival_companies fc ON fc.id = l.festival_company_id
  WHERE l.id = festival_launch_id
    AND (fc.owner_profile_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin'))
));

CREATE TABLE IF NOT EXISTS public.festival_ticket_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_launch_id uuid NOT NULL REFERENCES public.festival_launches(id) ON DELETE CASCADE,
  festival_ticket_product_id uuid NOT NULL REFERENCES public.festival_ticket_products(id) ON DELETE CASCADE,
  buyer_profile_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  subtotal_minor bigint NOT NULL DEFAULT 0,
  fee_minor bigint NOT NULL DEFAULT 0,
  tax_minor bigint NOT NULL DEFAULT 0,
  total_minor bigint NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'completed',
  idempotency_key uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS festival_ticket_sales_idem
  ON public.festival_ticket_sales (buyer_profile_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
GRANT SELECT ON public.festival_ticket_sales TO authenticated;
GRANT ALL ON public.festival_ticket_sales TO service_role;
ALTER TABLE public.festival_ticket_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "festival_ticket_sales_own_read" ON public.festival_ticket_sales FOR SELECT TO authenticated
USING (buyer_profile_id = public.current_profile_id());

CREATE TABLE IF NOT EXISTS public.festival_issued_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_launch_id uuid NOT NULL REFERENCES public.festival_launches(id) ON DELETE CASCADE,
  festival_ticket_sale_id uuid REFERENCES public.festival_ticket_sales(id) ON DELETE SET NULL,
  festival_ticket_product_id uuid NOT NULL REFERENCES public.festival_ticket_products(id) ON DELETE CASCADE,
  ticket_reference text NOT NULL UNIQUE,
  owner_profile_id uuid NOT NULL,
  holder_profile_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'valid',
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.festival_issued_tickets TO authenticated;
GRANT ALL ON public.festival_issued_tickets TO service_role;
ALTER TABLE public.festival_issued_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "festival_issued_tickets_own_read" ON public.festival_issued_tickets FOR SELECT TO authenticated
USING (owner_profile_id = public.current_profile_id() OR holder_profile_id = public.current_profile_id());

DROP TRIGGER IF EXISTS trg_festival_public_profiles_updated ON public.festival_public_profiles;
CREATE TRIGGER trg_festival_public_profiles_updated BEFORE UPDATE ON public.festival_public_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_festival_launches_updated ON public.festival_launches;
CREATE TRIGGER trg_festival_launches_updated BEFORE UPDATE ON public.festival_launches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ helpers ============

CREATE OR REPLACE FUNCTION public.festival_launch_can_manage(p_festival_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.festival_companies fc
    WHERE fc.id = p_festival_company_id
      AND (fc.owner_profile_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin'))
  );
$$;

CREATE OR REPLACE FUNCTION public.festival_launch_slugify(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(trim(both '-' FROM regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '-', 'g')), '');
$$;

CREATE OR REPLACE FUNCTION public.festival_launch_ensure(p_festival_company_id uuid)
RETURNS public.festival_launches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.festival_launches;
BEGIN
  SELECT * INTO v_row FROM public.festival_launches WHERE festival_company_id = p_festival_company_id;
  IF NOT FOUND THEN
    INSERT INTO public.festival_launches (festival_company_id, launch_status)
    VALUES (p_festival_company_id, 'ready_for_launch_preparation')
    ON CONFLICT (festival_company_id) DO UPDATE SET updated_at = now()
    RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.festival_launch_row_json(p_row public.festival_launches)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'id', p_row.id,
    'festivalCompanyId', p_row.festival_company_id,
    'launchStatus', p_row.launch_status,
    'publicSlug', p_row.public_slug,
    'publicVisibility', p_row.public_visibility,
    'launchVersion', p_row.launch_version,
    'launchedAt', p_row.launched_at,
    'ticketSalesOpenedAt', p_row.ticket_sales_opened_at
  );
$$;

CREATE OR REPLACE FUNCTION public.festival_public_profile_json(p_festival_company_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'festivalCompanyId', p.festival_company_id,
    'publicName', p.public_name,
    'tagline', p.tagline,
    'description', p.description,
    'publicSlug', p.public_slug,
    'heroImageReference', p.hero_image_reference,
    'logoReference', p.logo_reference,
    'ageGuidance', p.age_guidance,
    'accessibilitySummary', p.accessibility_summary,
    'transportSummary', p.transport_summary,
    'campingSummary', p.camping_summary,
    'foodAndDrinkSummary', p.food_and_drink_summary,
    'termsSummary', p.terms_summary,
    'refundPolicySummary', p.refund_policy_summary,
    'contactSummary', p.contact_summary,
    'publicVersion', p.public_version
  )
  FROM public.festival_public_profiles p WHERE p.festival_company_id = p_festival_company_id;
$$;

-- ============ public projection ============

CREATE OR REPLACE FUNCTION public.festival_public_projection(p_festival_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_launch public.festival_launches;
  v_company public.festival_companies;
  v_profile public.festival_public_profiles;
  v_plan public.festival_ticket_plans;
  v_site public.festival_site_plans;
  v_city_name text; v_country text; v_tz text;
  v_starts date; v_ends date;
  v_stages jsonb; v_timetable jsonb; v_products jsonb;
  v_sold_out boolean := false;
  v_scale text; v_vibe text; v_type text;
BEGIN
  SELECT * INTO v_launch FROM public.festival_launches WHERE festival_company_id = p_festival_company_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_company FROM public.festival_companies WHERE id = p_festival_company_id;
  SELECT * INTO v_profile FROM public.festival_public_profiles WHERE festival_company_id = p_festival_company_id;
  SELECT * INTO v_site FROM public.festival_site_plans WHERE festival_company_id = p_festival_company_id ORDER BY created_at DESC LIMIT 1;
  SELECT * INTO v_plan FROM public.festival_ticket_plans WHERE festival_company_id = p_festival_company_id ORDER BY created_at DESC LIMIT 1;

  SELECT c.name, c.country, coalesce(v_site.timezone, c.timezone, 'UTC')
    INTO v_city_name, v_country, v_tz
  FROM public.cities c
  WHERE c.id = coalesce(v_site.city_id, v_company.default_city_id);

  SELECT cfg.planned_start_date, cfg.planned_end_date, cfg.festival_scale
    INTO v_starts, v_ends, v_scale
  FROM public.festival_configurations cfg
  WHERE cfg.festival_company_id = p_festival_company_id
  ORDER BY cfg.created_at DESC LIMIT 1;

  v_starts := coalesce(v_starts, (current_date + 30));
  v_ends := coalesce(v_ends, v_starts + coalesce(v_company.default_duration_days, 1) - 1);
  v_vibe := v_company.default_vibe;
  v_type := coalesce(v_site.site_type, v_company.default_site_type);

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'capacity', coalesce(s.capacity, 0)) ORDER BY s.sort_order), '[]'::jsonb)
    INTO v_stages
  FROM public.festival_site_plan_stages s WHERE s.festival_company_id = p_festival_company_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id,
      'artistName', coalesce(bd.name, pr.display_name, pr.username, 'To be announced'),
      'artistType', CASE WHEN b.band_id IS NOT NULL THEN 'band' WHEN b.artist_profile_id IS NOT NULL THEN 'player' ELSE 'npc' END,
      'artistId', coalesce(b.band_id, b.artist_profile_id),
      'genre', bd.genre,
      'fame', coalesce(bd.fame, pr.fame, 0),
      'stageId', b.provisional_stage_id,
      'stageName', coalesce(st.name, 'Main Stage'),
      'festivalDate', b.provisional_date,
      'startsAt', (b.provisional_date::timestamptz + interval '18 hours'),
      'endsAt', (b.provisional_date::timestamptz + interval '18 hours' + make_interval(mins => coalesce(b.set_minutes, 45))),
      'headline', coalesce(b.billing_position, '') = 'headliner'
    ) ORDER BY b.provisional_date, b.created_at), '[]'::jsonb)
    INTO v_timetable
  FROM public.festival_artist_bookings b
  JOIN public.festival_artist_programmes ap ON ap.id = b.festival_artist_programme_id
  LEFT JOIN public.bands bd ON bd.id = b.band_id
  LEFT JOIN public.profiles pr ON pr.id = b.artist_profile_id
  LEFT JOIN public.festival_site_plan_stages st ON st.id = b.provisional_stage_id
  WHERE ap.festival_company_id = p_festival_company_id
    AND b.provisional_stage_id IS NOT NULL
    AND b.provisional_date IS NOT NULL
    AND coalesce(b.status, '') NOT IN ('cancelled', 'withdrawn');

  SELECT coalesce(jsonb_agg(x.item ORDER BY x.sort_priority), '[]'::jsonb), bool_and(x.available <= 0)
    INTO v_products, v_sold_out
  FROM (
    SELECT
      coalesce(tp.sale_priority, 0) AS sort_priority,
      GREATEST(0, coalesce(tp.capacity_limit, 0) - coalesce((
        SELECT sum(s.quantity) FROM public.festival_ticket_sales s
        WHERE s.festival_ticket_product_id = tp.id AND s.status = 'completed'), 0)) AS available,
      jsonb_build_object(
        'id', tp.id,
        'name', tp.name,
        'ticketType', tp.ticket_type,
        'productClass', CASE WHEN tp.product_class IN ('admission','upgrade','add_on') THEN tp.product_class ELSE 'admission' END,
        'accessScope', CASE WHEN tp.access_scope IN ('single_day','date_range','full_festival','non_admission') THEN tp.access_scope ELSE 'full_festival' END,
        'accessStartDate', coalesce(tp.valid_from_date, v_starts),
        'accessEndDate', coalesce(tp.valid_to_date, v_ends),
        'priceMinor', coalesce(tp.price_minor, 0),
        'feeMinor', public.festival_ticket_fee_minor(coalesce(tp.price_minor,0), v_plan),
        'taxMinor', ((coalesce(tp.price_minor,0) * coalesce(v_plan.sales_tax_rate_basis_points, 0)) / 10000)::bigint,
        'totalMinor', coalesce(tp.price_minor,0)
          + public.festival_ticket_fee_minor(coalesce(tp.price_minor,0), v_plan)
          + ((coalesce(tp.price_minor,0) * coalesce(v_plan.sales_tax_rate_basis_points, 0)) / 10000)::bigint,
        'currency', coalesce(v_plan.currency_code, 'GBP'),
        'availableQuantity', GREATEST(0, coalesce(tp.capacity_limit, 0) - coalesce((
          SELECT sum(s.quantity) FROM public.festival_ticket_sales s
          WHERE s.festival_ticket_product_id = tp.id AND s.status = 'completed'), 0)),
        'purchaseLimit', coalesce(v_plan.maximum_purchase_quantity, 4),
        'saleStatus', v_launch.launch_status
      ) AS item
    FROM public.festival_ticket_products tp
    WHERE tp.festival_company_id = p_festival_company_id AND coalesce(tp.active, true)
  ) x;

  RETURN jsonb_build_object(
    'id', v_launch.id,
    'slug', coalesce(v_launch.public_slug, v_profile.public_slug, v_company.slug),
    'name', coalesce(v_profile.public_name, v_company.public_name),
    'tagline', coalesce(v_profile.tagline, v_company.tagline),
    'description', coalesce(v_profile.description, v_company.description, ''),
    'city', coalesce(v_city_name, 'Unknown city'),
    'country', coalesce(v_country, coalesce(v_company.country_code, 'Unknown')),
    'timezone', coalesce(v_tz, 'UTC'),
    'startsAt', v_starts::timestamptz,
    'endsAt', (v_ends::timestamptz + interval '23 hours'),
    'festivalType', v_type,
    'vibe', v_vibe,
    'scale', v_scale,
    'heroImageReference', v_profile.hero_image_reference,
    'launchStatus', v_launch.launch_status,
    'soldOut', coalesce(v_sold_out, false),
    'countdownTarget', v_starts::timestamptz,
    'stages', coalesce(v_stages, '[]'::jsonb),
    'timetable', coalesce(v_timetable, '[]'::jsonb),
    'sponsors', '[]'::jsonb,
    'ticketProducts', coalesce(v_products, '[]'::jsonb),
    'information', jsonb_build_object(
      'travel', v_profile.transport_summary,
      'camping', v_profile.camping_summary,
      'accessibility', v_profile.accessibility_summary,
      'foodAndDrink', v_profile.food_and_drink_summary,
      'ageGuidance', v_profile.age_guidance,
      'terms', v_profile.terms_summary,
      'refundPolicy', v_profile.refund_policy_summary,
      'contact', v_profile.contact_summary
    )
  );
END; $$;

CREATE OR REPLACE FUNCTION public.festival_ticket_fee_minor(p_price bigint, p_plan public.festival_ticket_plans)
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_plan IS NULL THEN 0::bigint
    WHEN coalesce(p_plan.booking_fee_mode, 'fixed') = 'percentage'
      THEN ((p_price * coalesce(p_plan.booking_fee_basis_points, 0)) / 10000)::bigint
    ELSE coalesce(p_plan.booking_fee_minor, 0)::bigint
  END;
$$;

-- ============ owner launch RPCs ============

CREATE OR REPLACE FUNCTION public.get_festival_launch_plan(p_festival_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_launch public.festival_launches; v_issues jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.festival_launch_can_manage(p_festival_company_id) THEN RAISE EXCEPTION 'festival_launch_not_ready'; END IF;
  SELECT * INTO v_launch FROM public.festival_launches WHERE festival_company_id = p_festival_company_id;
  IF NOT FOUND THEN
    v_launch.id := NULL; v_launch.festival_company_id := p_festival_company_id;
    v_launch.launch_status := 'ready_for_launch_preparation'; v_launch.public_visibility := 'private'; v_launch.launch_version := 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.festival_public_profiles WHERE festival_company_id = p_festival_company_id) THEN
    v_issues := v_issues || jsonb_build_object('code','public_profile_missing','message','Publish a public profile before launch.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.festival_ticket_products WHERE festival_company_id = p_festival_company_id AND coalesce(active,true)) THEN
    v_issues := v_issues || jsonb_build_object('code','ticket_products_missing','message','Create at least one ticket product.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.festival_site_plan_stages WHERE festival_company_id = p_festival_company_id) THEN
    v_issues := v_issues || jsonb_build_object('code','stages_missing','message','Add at least one stage to the site plan.');
  END IF;
  RETURN jsonb_build_object(
    'launch', jsonb_build_object(
      'launchStatus', v_launch.launch_status,
      'launchVersion', v_launch.launch_version,
      'publicSlug', v_launch.public_slug),
    'publicProfile', coalesce(public.festival_public_profile_json(p_festival_company_id), 'null'::jsonb),
    'blockingIssues', v_issues
  );
END; $$;

CREATE OR REPLACE FUNCTION public.save_festival_public_profile(
  p_festival_company_id uuid, p_expected_version integer, p_profile jsonb, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_slug text; v_current integer;
BEGIN
  IF NOT public.festival_launch_can_manage(p_festival_company_id) THEN RAISE EXCEPTION 'festival_public_profile_invalid'; END IF;
  v_slug := public.festival_launch_slugify(coalesce(p_profile->>'publicSlug', p_profile->>'publicName'));
  IF v_slug IS NULL THEN RAISE EXCEPTION 'festival_public_profile_invalid'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_public_profiles WHERE public_slug = v_slug AND festival_company_id <> p_festival_company_id) THEN
    RAISE EXCEPTION 'festival_public_slug_taken';
  END IF;
  SELECT public_version INTO v_current FROM public.festival_public_profiles WHERE festival_company_id = p_festival_company_id;
  IF v_current IS NOT NULL AND v_current <> p_expected_version THEN RAISE EXCEPTION 'festival_launch_snapshot_stale'; END IF;

  INSERT INTO public.festival_public_profiles AS pp (
    festival_company_id, public_name, tagline, description, public_slug, hero_image_reference, logo_reference,
    age_guidance, accessibility_summary, transport_summary, camping_summary, food_and_drink_summary,
    terms_summary, refund_policy_summary, contact_summary, public_version)
  VALUES (
    p_festival_company_id,
    coalesce(nullif(p_profile->>'publicName',''), 'Festival'),
    p_profile->>'tagline', coalesce(p_profile->>'description',''), v_slug,
    p_profile->>'heroImageReference', p_profile->>'logoReference', p_profile->>'ageGuidance',
    p_profile->>'accessibilitySummary', p_profile->>'transportSummary', p_profile->>'campingSummary',
    p_profile->>'foodAndDrinkSummary', p_profile->>'termsSummary', p_profile->>'refundPolicySummary',
    p_profile->>'contactSummary', 1)
  ON CONFLICT (festival_company_id) DO UPDATE SET
    public_name = EXCLUDED.public_name, tagline = EXCLUDED.tagline, description = EXCLUDED.description,
    public_slug = EXCLUDED.public_slug, hero_image_reference = EXCLUDED.hero_image_reference,
    logo_reference = EXCLUDED.logo_reference, age_guidance = EXCLUDED.age_guidance,
    accessibility_summary = EXCLUDED.accessibility_summary, transport_summary = EXCLUDED.transport_summary,
    camping_summary = EXCLUDED.camping_summary, food_and_drink_summary = EXCLUDED.food_and_drink_summary,
    terms_summary = EXCLUDED.terms_summary, refund_policy_summary = EXCLUDED.refund_policy_summary,
    contact_summary = EXCLUDED.contact_summary, public_version = pp.public_version + 1, updated_at = now();

  PERFORM public.festival_launch_ensure(p_festival_company_id);
  RETURN public.festival_public_profile_json(p_festival_company_id);
END; $$;

CREATE OR REPLACE FUNCTION public.festival_launch_transition(
  p_festival_company_id uuid, p_expected_version integer, p_from text[], p_to text,
  p_event text, p_reason text, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.festival_launches;
BEGIN
  IF NOT public.festival_launch_can_manage(p_festival_company_id) THEN RAISE EXCEPTION 'festival_launch_not_ready'; END IF;
  PERFORM public.festival_launch_ensure(p_festival_company_id);
  SELECT * INTO v_row FROM public.festival_launches WHERE festival_company_id = p_festival_company_id FOR UPDATE;
  IF v_row.launch_version <> p_expected_version THEN RAISE EXCEPTION 'festival_launch_snapshot_stale'; END IF;
  IF NOT (v_row.launch_status = ANY (p_from)) THEN
    IF v_row.launch_status = p_to THEN RETURN public.festival_launch_row_json(v_row); END IF;
    RAISE EXCEPTION 'festival_launch_review_required';
  END IF;

  UPDATE public.festival_launches SET
    launch_status = p_to,
    launch_version = launch_version + 1,
    launched_at = CASE WHEN p_to = 'launched' THEN coalesce(launched_at, now()) ELSE launched_at END,
    ticket_sales_opened_at = CASE WHEN p_to = 'tickets_on_sale' THEN coalesce(ticket_sales_opened_at, now()) ELSE ticket_sales_opened_at END,
    cancelled_at = CASE WHEN p_to = 'cancelled_before_event' THEN now() ELSE cancelled_at END,
    cancellation_reason = CASE WHEN p_to = 'cancelled_before_event' THEN p_reason ELSE cancellation_reason END,
    public_visibility = CASE WHEN p_to IN ('launched','tickets_on_sale','sales_paused','sales_closed') THEN 'public' ELSE public_visibility END,
    public_slug = coalesce(public_slug, (SELECT public_slug FROM public.festival_public_profiles WHERE festival_company_id = p_festival_company_id)),
    updated_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  INSERT INTO public.festival_launch_events (festival_launch_id, event_type, reason, actor_profile_id, idempotency_key)
  VALUES (v_row.id, p_event, p_reason, public.current_profile_id(), p_idempotency_key)
  ON CONFLICT DO NOTHING;

  RETURN public.festival_launch_row_json(v_row);
END; $$;

CREATE OR REPLACE FUNCTION public.begin_festival_launch_review(p_festival_company_id uuid, p_expected_version integer, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.festival_launch_transition(p_festival_company_id, p_expected_version,
    ARRAY['not_ready','ready_for_launch_preparation'], 'launch_review', 'launch_review_started', NULL, p_idempotency_key);
$$;

CREATE OR REPLACE FUNCTION public.launch_festival(
  p_festival_company_id uuid, p_expected_version integer, p_public_profile_version integer, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb; v_launch_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.festival_public_profiles WHERE festival_company_id = p_festival_company_id) THEN
    RAISE EXCEPTION 'festival_public_profile_invalid';
  END IF;
  v_result := public.festival_launch_transition(p_festival_company_id, p_expected_version,
    ARRAY['launch_review'], 'launched', 'festival_launched', NULL, p_idempotency_key);
  SELECT id INTO v_launch_id FROM public.festival_launches WHERE festival_company_id = p_festival_company_id;
  UPDATE public.festival_launches
     SET snapshot = coalesce(public.festival_public_projection(p_festival_company_id), '{}'::jsonb)
   WHERE id = v_launch_id;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.open_festival_ticket_sales(p_festival_company_id uuid, p_expected_launch_version integer, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.festival_launch_transition(p_festival_company_id, p_expected_launch_version,
    ARRAY['launched','sales_paused'], 'tickets_on_sale', 'ticket_sales_opened', NULL, p_idempotency_key);
$$;

CREATE OR REPLACE FUNCTION public.pause_festival_ticket_sales(p_festival_company_id uuid, p_expected_launch_version integer, p_reason text, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.festival_launch_transition(p_festival_company_id, p_expected_launch_version,
    ARRAY['tickets_on_sale'], 'sales_paused', 'ticket_sales_paused', p_reason, p_idempotency_key);
$$;

CREATE OR REPLACE FUNCTION public.resume_festival_ticket_sales(p_festival_company_id uuid, p_expected_launch_version integer, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.festival_launch_transition(p_festival_company_id, p_expected_launch_version,
    ARRAY['sales_paused'], 'tickets_on_sale', 'ticket_sales_resumed', NULL, p_idempotency_key);
$$;

CREATE OR REPLACE FUNCTION public.close_festival_ticket_sales(p_festival_company_id uuid, p_expected_launch_version integer, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.festival_launch_transition(p_festival_company_id, p_expected_launch_version,
    ARRAY['tickets_on_sale','sales_paused'], 'sales_closed', 'ticket_sales_closed', NULL, p_idempotency_key);
$$;

CREATE OR REPLACE FUNCTION public.cancel_launched_festival(
  p_festival_company_id uuid, p_expected_launch_version integer, p_reason text, p_confirmation_token text, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(p_reason, '') = '' OR coalesce(p_confirmation_token, '') = '' THEN RAISE EXCEPTION 'festival_cancellation_not_permitted'; END IF;
  RETURN public.festival_launch_transition(p_festival_company_id, p_expected_launch_version,
    ARRAY['launched','tickets_on_sale','sales_paused','sales_closed'], 'cancelled_before_event',
    'festival_cancelled', p_reason, p_idempotency_key);
END; $$;

-- ============ public discovery RPCs ============

CREATE OR REPLACE FUNCTION public.get_public_festival_directory(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(proj ORDER BY proj->>'startsAt'), '[]'::jsonb)
  FROM (
    SELECT public.festival_public_projection(l.festival_company_id) AS proj
    FROM public.festival_launches l
    WHERE l.launch_status IN ('launched','tickets_on_sale','sales_paused','sales_closed')
      AND l.public_visibility = 'public'
  ) s
  WHERE proj IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_public_festival(p_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid;
BEGIN
  SELECT l.festival_company_id INTO v_company
  FROM public.festival_launches l
  LEFT JOIN public.festival_public_profiles p ON p.festival_company_id = l.festival_company_id
  WHERE (l.public_slug = p_slug OR p.public_slug = p_slug)
    AND l.launch_status IN ('launched','tickets_on_sale','sales_paused','sales_closed')
  LIMIT 1;
  IF v_company IS NULL THEN RAISE EXCEPTION 'festival_launch_unavailable'; END IF;
  RETURN public.festival_public_projection(v_company);
END; $$;

CREATE OR REPLACE FUNCTION public.get_public_festival_timetable(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.get_public_festival(p_slug)->'timetable', '[]'::jsonb);
$$;

CREATE OR REPLACE FUNCTION public.get_public_festival_ticket_products(p_festival_launch_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.festival_public_projection(
    (SELECT festival_company_id FROM public.festival_launches WHERE id = p_festival_launch_id)
  )->'ticketProducts', '[]'::jsonb);
$$;

-- ============ ticket purchase and wallet ============

CREATE OR REPLACE FUNCTION public.purchase_festival_tickets(
  p_festival_launch_id uuid, p_ticket_product_id uuid, p_quantity integer, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_launch public.festival_launches;
  v_product jsonb;
  v_sale public.festival_ticket_sales;
  v_unit bigint; v_fee bigint; v_tax bigint; v_total bigint; v_currency text;
  v_available integer; v_limit integer; v_cash bigint; i integer;
  v_tickets jsonb := '[]'::jsonb; v_ticket public.festival_issued_tickets;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'festival_ticket_purchase_stale'; END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN RAISE EXCEPTION 'festival_ticket_quantity_invalid'; END IF;

  SELECT * INTO v_sale FROM public.festival_ticket_sales
   WHERE buyer_profile_id = v_profile AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'saleId', t.festival_ticket_sale_id, 'productId', t.festival_ticket_product_id,
      'festivalName', coalesce(l.snapshot->>'name',''), 'festivalSlug', coalesce(l.public_slug,''),
      'ticketReference', t.ticket_reference, 'ticketType', tp.ticket_type, 'productClass', tp.product_class,
      'accessStartDate', coalesce(tp.valid_from_date, current_date), 'accessEndDate', coalesce(tp.valid_to_date, current_date),
      'ownerProfileId', t.owner_profile_id, 'holderProfileId', t.holder_profile_id, 'status', t.status,
      'issuedAt', t.issued_at)), '[]'::jsonb)
      INTO v_tickets
    FROM public.festival_issued_tickets t
    JOIN public.festival_ticket_products tp ON tp.id = t.festival_ticket_product_id
    JOIN public.festival_launches l ON l.id = t.festival_launch_id
    WHERE t.festival_ticket_sale_id = v_sale.id;
    RETURN jsonb_build_object('saleId', v_sale.id, 'purchaseRequestId', v_sale.id, 'status','completed',
      'quantity', v_sale.quantity, 'subtotalMinor', v_sale.subtotal_minor, 'feeMinor', v_sale.fee_minor,
      'taxMinor', v_sale.tax_minor, 'totalMinor', v_sale.total_minor, 'currency', v_sale.currency_code,
      'inventoryVersion', 1, 'availableQuantity', 0, 'tickets', v_tickets);
  END IF;

  SELECT * INTO v_launch FROM public.festival_launches WHERE id = p_festival_launch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_ticket_product_unavailable'; END IF;
  IF v_launch.launch_status = 'sales_paused' THEN RAISE EXCEPTION 'festival_ticket_sales_paused'; END IF;
  IF v_launch.launch_status = 'sales_closed' THEN RAISE EXCEPTION 'festival_ticket_sales_closed'; END IF;
  IF v_launch.launch_status <> 'tickets_on_sale' THEN RAISE EXCEPTION 'festival_ticket_sales_not_open'; END IF;

  SELECT p INTO v_product FROM jsonb_array_elements(
    public.festival_public_projection(v_launch.festival_company_id)->'ticketProducts') p
  WHERE (p->>'id')::uuid = p_ticket_product_id;
  IF v_product IS NULL THEN RAISE EXCEPTION 'festival_ticket_product_unavailable'; END IF;

  v_unit := (v_product->>'priceMinor')::bigint;
  v_fee := (v_product->>'feeMinor')::bigint;
  v_tax := (v_product->>'taxMinor')::bigint;
  v_currency := v_product->>'currency';
  v_available := (v_product->>'availableQuantity')::integer;
  v_limit := (v_product->>'purchaseLimit')::integer;
  IF p_quantity > v_limit THEN RAISE EXCEPTION 'festival_ticket_purchase_limit_exceeded'; END IF;
  IF v_available < p_quantity THEN RAISE EXCEPTION 'festival_ticket_sold_out'; END IF;
  v_total := (v_unit + v_fee + v_tax) * p_quantity;

  SELECT cash INTO v_cash FROM public.profiles WHERE id = v_profile FOR UPDATE;
  IF coalesce(v_cash, 0) * 100 < v_total THEN RAISE EXCEPTION 'festival_ticket_insufficient_funds'; END IF;
  UPDATE public.profiles SET cash = cash - Math_round_placeholder WHERE false;
  UPDATE public.profiles SET cash = cash - (v_total / 100)::bigint WHERE id = v_profile;

  INSERT INTO public.festival_ticket_sales (festival_launch_id, festival_ticket_product_id, buyer_profile_id,
    quantity, subtotal_minor, fee_minor, tax_minor, total_minor, currency_code, status, idempotency_key)
  VALUES (p_festival_launch_id, p_ticket_product_id, v_profile, p_quantity,
    v_unit * p_quantity, v_fee * p_quantity, v_tax * p_quantity, v_total, v_currency, 'completed', p_idempotency_key)
  RETURNING * INTO v_sale;

  FOR i IN 1..p_quantity LOOP
    INSERT INTO public.festival_issued_tickets (festival_launch_id, festival_ticket_sale_id, festival_ticket_product_id,
      ticket_reference, owner_profile_id, holder_profile_id)
    VALUES (p_festival_launch_id, v_sale.id, p_ticket_product_id,
      upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 12)), v_profile, v_profile)
    RETURNING * INTO v_ticket;
    v_tickets := v_tickets || jsonb_build_object(
      'id', v_ticket.id, 'saleId', v_sale.id, 'productId', p_ticket_product_id,
      'festivalName', coalesce(v_launch.snapshot->>'name',''), 'festivalSlug', coalesce(v_launch.public_slug,''),
      'ticketReference', v_ticket.ticket_reference, 'ticketType', v_product->>'ticketType',
      'productClass', v_product->>'productClass',
      'accessStartDate', v_product->>'accessStartDate', 'accessEndDate', v_product->>'accessEndDate',
      'ownerProfileId', v_profile, 'holderProfileId', v_profile, 'status', 'valid', 'issuedAt', v_ticket.issued_at);
  END LOOP;

  RETURN jsonb_build_object('saleId', v_sale.id, 'purchaseRequestId', v_sale.id, 'status','completed',
    'quantity', p_quantity, 'subtotalMinor', v_unit * p_quantity, 'feeMinor', v_fee * p_quantity,
    'taxMinor', v_tax * p_quantity, 'totalMinor', v_total, 'currency', v_currency,
    'inventoryVersion', 1, 'availableQuantity', v_available - p_quantity, 'tickets', v_tickets);
END; $$;

CREATE OR REPLACE FUNCTION public.get_my_festival_tickets()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'saleId', t.festival_ticket_sale_id, 'productId', t.festival_ticket_product_id,
    'festivalName', coalesce(l.snapshot->>'name',''), 'festivalSlug', coalesce(l.public_slug,''),
    'ticketReference', t.ticket_reference, 'ticketType', tp.ticket_type, 'productClass', tp.product_class,
    'accessStartDate', coalesce(tp.valid_from_date, current_date), 'accessEndDate', coalesce(tp.valid_to_date, current_date),
    'ownerProfileId', t.owner_profile_id, 'holderProfileId', t.holder_profile_id, 'status', t.status,
    'issuedAt', t.issued_at) ORDER BY t.issued_at DESC), '[]'::jsonb)
  FROM public.festival_issued_tickets t
  JOIN public.festival_ticket_products tp ON tp.id = t.festival_ticket_product_id
  JOIN public.festival_launches l ON l.id = t.festival_launch_id
  WHERE t.holder_profile_id = public.current_profile_id();
$$;

CREATE OR REPLACE FUNCTION public.get_festival_ticket_sales_summary(p_festival_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.festival_launch_can_manage(p_festival_company_id) THEN RAISE EXCEPTION 'festival_launch_not_ready'; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'ticketsSold', coalesce(sum(s.quantity), 0),
      'grossMinor', coalesce(sum(s.total_minor), 0),
      'currency', coalesce(max(s.currency_code), 'GBP'),
      'orders', count(*))
    FROM public.festival_ticket_sales s
    JOIN public.festival_launches l ON l.id = s.festival_launch_id
    WHERE l.festival_company_id = p_festival_company_id AND s.status = 'completed'
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.get_public_festival_directory(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_festival(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_festival_timetable(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_festival_ticket_products(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_launch_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_festival_public_profile(uuid, integer, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin_festival_launch_review(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.launch_festival(uuid, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_festival_ticket_sales(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_festival_ticket_sales(uuid, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_festival_ticket_sales(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_festival_ticket_sales(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_launched_festival(uuid, integer, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_festival_tickets(uuid, uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_festival_tickets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_ticket_sales_summary(uuid) TO authenticated;

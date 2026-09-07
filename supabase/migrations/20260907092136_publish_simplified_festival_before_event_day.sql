CREATE OR REPLACE FUNCTION public.publish_simplified_festival(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_expected_edition_version integer,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := public.current_profile_id();
  v_edition public.festival_editions_v2%ROWTYPE;
  v_launch public.festival_launches%ROWTYPE;
  v_company public.festival_companies%ROWTYPE;
  v_city_name text;
  v_slug text;
  v_description text;
  v_projection jsonb;
  v_public_version integer;
BEGIN
  IF auth.uid() IS NULL OR v_actor IS NULL OR NOT public._festival_edition_runtime_authorised(
    p_festival_company_id,
    p_festival_edition_id,
    v_actor
  ) THEN
    RAISE EXCEPTION 'festival_launch_not_ready' USING ERRCODE = 'P0001';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'festival_launch_idempotency_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_edition
  FROM public.festival_editions_v2
  WHERE id = p_festival_edition_id
    AND festival_company_id = p_festival_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_edition.version <> p_expected_edition_version THEN
    RAISE EXCEPTION 'festival_launch_snapshot_stale' USING ERRCODE = 'P0001';
  END IF;

  IF v_edition.status IN ('cancelled', 'cancelled_before_event', 'completed') THEN
    RAISE EXCEPTION 'festival_launch_not_ready' USING ERRCODE = 'P0001';
  END IF;

  IF coalesce(v_edition.planning_status, '') <> 'ready'
     OR coalesce(v_edition.readiness_score, 0) < 100
     OR v_edition.starts_on IS NULL
     OR v_edition.ends_on IS NULL THEN
    RAISE EXCEPTION 'festival_launch_not_ready' USING ERRCODE = 'P0001';
  END IF;

  IF v_edition.ends_on < current_date THEN
    RAISE EXCEPTION 'festival_launch_not_ready' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.festival_site_plans site
    JOIN public.festival_site_plan_stages stage
      ON stage.festival_site_plan_id = site.id
    WHERE site.festival_edition_id = p_festival_edition_id
      AND stage.status = 'ready'
  ) THEN
    RAISE EXCEPTION 'festival_launch_not_ready' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.festival_ticket_products product
    JOIN public.festival_ticket_plans plan
      ON plan.id = product.festival_ticket_plan_id
    WHERE plan.festival_edition_id = p_festival_edition_id
      AND product.festival_company_id = p_festival_company_id
      AND coalesce(product.active, true)
      AND product.product_class = 'admission'
      AND product.capacity_limit > 0
  ) THEN
    RAISE EXCEPTION 'festival_launch_not_ready' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.festival_artist_bookings booking
    JOIN public.festival_artist_programmes programme
      ON programme.id = booking.festival_artist_programme_id
    WHERE programme.festival_edition_id = p_festival_edition_id
      AND programme.festival_company_id = p_festival_company_id
      AND booking.status IN ('confirmed', 'awaiting_schedule', 'scheduled')
  ) THEN
    RAISE EXCEPTION 'festival_launch_not_ready' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_company
  FROM public.festival_companies
  WHERE id = p_festival_company_id;

  SELECT city.name INTO v_city_name
  FROM public.cities city
  WHERE city.id = v_edition.city_id;

  v_slug := public.festival_launch_slugify(
    coalesce(nullif(v_edition.name, ''), nullif(v_company.public_name, ''), 'festival')
    || '-' || v_edition.edition_year::text
  );

  IF v_slug IS NULL THEN
    v_slug := 'festival-' || substr(replace(p_festival_company_id::text, '-', ''), 1, 8)
      || '-' || v_edition.edition_year::text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.festival_public_profiles profile
    WHERE profile.public_slug = v_slug
      AND profile.festival_company_id <> p_festival_company_id
  ) OR EXISTS (
    SELECT 1
    FROM public.festival_launches launch
    WHERE launch.public_slug = v_slug
      AND launch.festival_company_id <> p_festival_company_id
  ) THEN
    v_slug := v_slug || '-' || substr(replace(p_festival_company_id::text, '-', ''), 1, 8);
  END IF;

  v_description := format(
    '%s is a %s RockMundo Festival in %s, running from %s to %s.',
    coalesce(nullif(v_edition.name, ''), 'Festival'),
    coalesce(nullif(v_edition.festival_scale, ''), 'live music'),
    coalesce(nullif(v_city_name, ''), 'the host city'),
    to_char(v_edition.starts_on, 'FMDD FMMonth YYYY'),
    to_char(v_edition.ends_on, 'FMDD FMMonth YYYY')
  );

  SELECT public_version INTO v_public_version
  FROM public.festival_public_profiles
  WHERE festival_company_id = p_festival_company_id;

  INSERT INTO public.festival_public_profiles AS profile (
    festival_company_id,
    public_name,
    tagline,
    description,
    public_slug,
    age_guidance,
    accessibility_summary,
    transport_summary,
    camping_summary,
    food_and_drink_summary,
    terms_summary,
    refund_policy_summary,
    contact_summary,
    public_version
  ) VALUES (
    p_festival_company_id,
    coalesce(nullif(v_edition.name, ''), nullif(v_company.public_name, ''), 'Festival'),
    'Live the Festival. Live the music.',
    v_description,
    v_slug,
    'Check the Festival ticket and venue information before attending.',
    'Accessibility arrangements are generated from the Festival site and company upgrades.',
    'Plan travel to the host city before the Festival begins.',
    NULL,
    'Food, drink and merchandise are available during Festival Mode.',
    'Festival admission is governed by the active ticket product and Festival attendance rules.',
    'Refunds follow the Festival cancellation and ticket-refund rules.',
    NULL,
    coalesce(v_public_version, 0) + 1
  )
  ON CONFLICT (festival_company_id) DO UPDATE SET
    public_name = EXCLUDED.public_name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    public_slug = EXCLUDED.public_slug,
    age_guidance = EXCLUDED.age_guidance,
    accessibility_summary = EXCLUDED.accessibility_summary,
    transport_summary = EXCLUDED.transport_summary,
    food_and_drink_summary = EXCLUDED.food_and_drink_summary,
    terms_summary = EXCLUDED.terms_summary,
    refund_policy_summary = EXCLUDED.refund_policy_summary,
    public_version = profile.public_version + 1,
    updated_at = now();

  PERFORM public.festival_launch_ensure(p_festival_company_id);

  SELECT * INTO v_launch
  FROM public.festival_launches
  WHERE festival_company_id = p_festival_company_id
  FOR UPDATE;

  IF v_launch.launch_status = 'cancelled_before_event' OR v_launch.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'festival_cancellation_not_permitted' USING ERRCODE = 'P0001';
  END IF;

  IF v_launch.launch_status IN ('launched', 'tickets_on_sale', 'sales_paused', 'sales_closed') THEN
    v_projection := public.festival_public_projection_v2(p_festival_company_id);
    RETURN jsonb_build_object(
      'launch', public.festival_launch_row_json(v_launch),
      'publicFestival', v_projection,
      'idempotent', true
    );
  END IF;

  UPDATE public.festival_launches
  SET launch_status = 'tickets_on_sale',
      public_slug = v_slug,
      public_visibility = 'public',
      launch_version = launch_version + 1,
      launched_at = coalesce(launched_at, now()),
      ticket_sales_opened_at = coalesce(ticket_sales_opened_at, now()),
      updated_at = now()
  WHERE id = v_launch.id
  RETURNING * INTO v_launch;

  v_projection := public.festival_public_projection_v2(p_festival_company_id);

  UPDATE public.festival_launches
  SET snapshot = coalesce(v_projection, '{}'::jsonb)
  WHERE id = v_launch.id
  RETURNING * INTO v_launch;

  INSERT INTO public.festival_launch_events (
    festival_launch_id,
    event_type,
    reason,
    actor_profile_id,
    idempotency_key,
    payload
  )
  SELECT
    v_launch.id,
    'simplified_festival_published',
    'Published from the simplified annual Festival flow.',
    v_actor,
    p_idempotency_key,
    jsonb_build_object(
      'festivalEditionId', p_festival_edition_id,
      'startsOn', v_edition.starts_on,
      'endsOn', v_edition.ends_on,
      'publicSlug', v_slug
    )
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.festival_launch_events event
    WHERE event.festival_launch_id = v_launch.id
      AND event.idempotency_key = p_idempotency_key
  );

  RETURN jsonb_build_object(
    'launch', public.festival_launch_row_json(v_launch),
    'publicFestival', v_projection,
    'idempotent', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.publish_simplified_festival(uuid, uuid, integer, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_simplified_festival(uuid, uuid, integer, uuid)
  TO authenticated, service_role;

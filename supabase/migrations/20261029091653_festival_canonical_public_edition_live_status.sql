-- REVIEW REQUIRED: Public-safe projection over the existing authoritative
-- festival_editions_v2 / festival_edition_runtimes architecture.
-- Deploy as a separately reviewed forward-only migration after disposable
-- permission tests. Do NOT install the undeployed launch-scoped runtime.
-- No write to tickets, balances, simulation, attendance, or settlement.
CREATE OR REPLACE FUNCTION public.get_public_festival_edition_live_status(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $festival_public$
DECLARE
  v_launch_id uuid;
  v_company_id uuid;
  v_public jsonb;
  v_edition_id uuid;
  v_edition public.festival_editions_v2%ROWTYPE;
  v_runtime public.festival_edition_runtimes%ROWTYPE;
  v_timezone text;
  v_today date;
  v_day date;
  v_active boolean;
  v_weather jsonb;
  v_weather_state text;
  v_attendance_band text;
  v_runtime_status text;
BEGIN
  IF p_slug IS NULL OR length(p_slug) > 128 OR p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RETURN NULL;
  END IF;

  -- A public/unlisted launch is the only permitted entry point. This also
  -- prevents access to private, cancelled and draft festivals by guessed slug.
  SELECT l.id, l.festival_company_id INTO v_launch_id, v_company_id
  FROM public.festival_launches l
  LEFT JOIN public.festival_public_profiles p ON p.festival_company_id = l.festival_company_id
  WHERE (l.public_slug = p_slug OR p.public_slug = p_slug)
    AND l.public_visibility IN ('public','unlisted')
    AND l.launch_status IN ('launched','tickets_on_sale','sales_paused','sales_closed')
  LIMIT 1;
  IF v_launch_id IS NULL THEN RETURN NULL; END IF;

  -- Reuse the already-published edition identity. Never infer an edition from
  -- the newest runtime for a company or treat a launch ID as an edition ID.
  v_public := public.festival_public_projection_v2(v_company_id);
  IF v_public IS NULL OR v_public->>'id' IS DISTINCT FROM v_launch_id::text
      OR coalesce(v_public->>'editionId','') = '' THEN
    RETURN NULL;
  END IF;
  v_edition_id := (v_public->>'editionId')::uuid;

  SELECT * INTO v_edition
  FROM public.festival_editions_v2 e
  WHERE e.id = v_edition_id AND e.festival_company_id = v_company_id
    AND e.status NOT IN ('cancelled','cancelled_before_event');
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_runtime
  FROM public.festival_edition_runtimes r
  WHERE r.edition_id = v_edition.id AND r.festival_company_id = v_company_id
  ORDER BY r.created_at DESC, r.id DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT coalesce(nullif(c.timezone,''),'UTC') INTO v_timezone
  FROM public.cities c WHERE c.id = v_edition.city_id;
  v_today := (now() AT TIME ZONE coalesce(v_timezone,'UTC'))::date;
  v_active := v_today BETWEEN v_edition.starts_on AND v_edition.ends_on
              AND v_runtime.state IN ('gates_open','live','paused');
  v_day := CASE WHEN v_active THEN v_today ELSE NULL END;

  v_runtime_status := CASE v_runtime.state
    WHEN 'preparing' THEN 'pre_event'
    WHEN 'ready' THEN 'ready_to_open'
    WHEN 'gates_open' THEN 'gates_open'
    WHEN 'live' THEN 'live'
    WHEN 'paused' THEN 'paused'
    WHEN 'closing' THEN 'public_closed'
    WHEN 'completed' THEN 'runtime_complete'
    WHEN 'aborted' THEN 'cancelled'
    WHEN 'recovery_required' THEN 'emergency_hold'
    ELSE 'pre_event'
  END;

  -- Only report admission bands during an active festival day; the existing
  -- canonical runtime has no independently published per-stage crowd totals.
  IF v_active AND v_runtime.site_capacity > 0 THEN
    v_attendance_band := CASE
      WHEN v_runtime.site_attendance >= v_runtime.site_capacity THEN 'full'
      WHEN v_runtime.site_attendance >= v_runtime.site_capacity * 0.9 THEN 'near_capacity'
      WHEN v_runtime.site_attendance >= v_runtime.site_capacity * 0.7 THEN 'very_busy'
      WHEN v_runtime.site_attendance >= v_runtime.site_capacity * 0.4 THEN 'busy'
      WHEN v_runtime.site_attendance >= v_runtime.site_capacity * 0.15 THEN 'building'
      ELSE 'quiet'
    END;
  END IF;

  -- The preserved weather_sequence is indexed by day of the edition; do not
  -- display a different festival day's conditions or invent a fallback.
  IF v_active AND jsonb_typeof(v_runtime.weather_sequence) = 'array' THEN
    v_weather := v_runtime.weather_sequence -> (v_day - v_edition.starts_on);
    v_weather_state := v_weather->>'condition';
    IF v_weather_state NOT IN
      ('clear','cloudy','light_rain','heavy_rain','hot','cold','high_wind','storm') THEN
      v_weather_state := NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'festivalLaunchId', v_launch_id,
    'editionId', v_edition_id,
    'runtimeStatus', v_runtime_status,
    'gatesStatus', CASE WHEN v_runtime.state IN ('gates_open','live') AND v_active THEN 'open' ELSE 'closed' END,
    'currentDay', v_day,
    'attendanceBand', v_attendance_band,
    'performances', '[]'::jsonb,
    'messages', '[]'::jsonb,
    'weather', CASE WHEN v_weather_state IS NOT NULL
      THEN jsonb_build_object('state',v_weather_state,'groundCondition',NULL)
      ELSE NULL END,
    'stageCrowds', '[]'::jsonb,
    'updatedAt', v_runtime.updated_at
  );
END;
$festival_public$;

-- Never leave default PUBLIC EXECUTE on this SECURITY DEFINER function.
REVOKE ALL ON FUNCTION public.get_public_festival_edition_live_status(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_festival_edition_live_status(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_festival_edition_live_status(text) TO anon, authenticated;

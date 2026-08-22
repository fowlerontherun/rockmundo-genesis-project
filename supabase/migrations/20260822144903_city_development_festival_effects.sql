-- Wire city development into the authoritative Festival planning/runtime paths.
-- Culture + Tourism + Music Scene affect annual-plan ticket demand before the
-- forecast is frozen. Public Safety + Infrastructure affect the deterministic
-- crowd-pressure threshold used by the live incident engine.

CREATE OR REPLACE FUNCTION public._festival_apply_city_development_to_ticket_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_city_id uuid;
  v_demand_multiplier numeric := 1;
BEGIN
  -- Manual/legacy ticket plans retain their explicit operator inputs. Only the
  -- server-generated annual-plan projection receives city simulation effects.
  IF NEW.projection_source IS DISTINCT FROM 'annual_plan'
     OR NEW.festival_edition_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT edition.city_id
  INTO v_city_id
  FROM public.festival_editions_v2 edition
  WHERE edition.id = NEW.festival_edition_id;

  IF v_city_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(modifier.festival_demand_multiplier, 1)
  INTO v_demand_multiplier
  FROM public.city_gameplay_modifiers(v_city_id) modifier;

  v_demand_multiplier := LEAST(1.12, GREATEST(0.88, COALESCE(v_demand_multiplier, 1)));

  NEW.expected_sell_through_basis_points := LEAST(
    9500,
    GREATEST(
      5000,
      ROUND(COALESCE(NEW.expected_sell_through_basis_points, 8000) * v_demand_multiplier)::integer
    )
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._festival_apply_city_development_to_ticket_plan() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_apply_city_development_to_ticket_plan() TO service_role;

DROP TRIGGER IF EXISTS festival_ticket_plan_city_development ON public.festival_ticket_plans;
CREATE TRIGGER festival_ticket_plan_city_development
BEFORE INSERT OR UPDATE OF expected_sell_through_basis_points, festival_edition_id, projection_source
ON public.festival_ticket_plans
FOR EACH ROW
EXECUTE FUNCTION public._festival_apply_city_development_to_ticket_plan();

-- The existing Festival incident engine is deterministic rather than random.
-- Instead of inventing extra random incidents, city investment changes the
-- crowd-pressure level at which the authoritative runtime raises a safety event.
CREATE OR REPLACE FUNCTION public._evaluate_festival_runtime_incidents(
  p_runtime_session_id uuid,
  p_runtime_day_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  c record;
  n integer := 0;
  w public.festival_runtime_weather%ROWTYPE;
  r public.festival_runtime_sessions%ROWTYPE;
  v_city_id uuid;
  v_public_safety integer := 50;
  v_infrastructure integer := 50;
  v_crowd_threshold integer := 92;
BEGIN
  SELECT * INTO r
  FROM public.festival_runtime_sessions
  WHERE id = p_runtime_session_id;

  -- The public edition is created from the launch snapshot and keeps a typed,
  -- immutable city relationship for this launch. Avoid relying on JSON key names.
  SELECT edition.city_id
  INTO v_city_id
  FROM public.festival_public_editions edition
  WHERE edition.festival_launch_id = r.festival_launch_id;

  IF v_city_id IS NOT NULL THEN
    SELECT
      COALESCE(modifier.public_safety_rating, 50),
      COALESCE(modifier.infrastructure_rating, 50)
    INTO v_public_safety, v_infrastructure
    FROM public.city_gameplay_modifiers(v_city_id) modifier;
  END IF;

  -- Neutral city: 92 (unchanged). At the extremes the trigger can move only
  -- six points either way, keeping crowd management and staffing important.
  v_crowd_threshold := LEAST(
    98,
    GREATEST(
      86,
      92
        + ROUND((v_public_safety - 50) * 0.08)::integer
        + ROUND((v_infrastructure - 50) * 0.04)::integer
    )
  );

  SELECT * INTO w
  FROM public.festival_runtime_weather
  WHERE runtime_day_id = p_runtime_day_id;

  FOR c IN
    SELECT *
    FROM public.festival_runtime_stage_crowds
    WHERE runtime_day_id = p_runtime_day_id
  LOOP
    IF c.safety_pressure >= v_crowd_threshold THEN
      INSERT INTO public.festival_runtime_incidents(
        runtime_session_id,
        runtime_day_id,
        runtime_stage_id,
        category,
        incident_type,
        severity,
        seed,
        trigger,
        required_response,
        public_safe_summary,
        private_operational_details,
        dedupe_key
      ) VALUES (
        r.id,
        p_runtime_day_id,
        c.runtime_stage_id,
        'crowd',
        'capacity_pressure',
        CASE
          WHEN c.safety_pressure >= LEAST(100, v_crowd_threshold + 8) THEN 'major'
          ELSE 'moderate'
        END,
        encode(extensions.digest(r.incident_seed || ':crowd:' || c.runtime_stage_id, 'sha256'), 'hex'),
        'stage safety pressure threshold',
        'security and crowd management response',
        'Access to a stage is temporarily being managed.',
        'Crowd pressure threshold exceeded; review ingress, egress and coverage. City safety threshold: '
          || v_crowd_threshold::text || '.',
        'crowd-pressure:' || p_runtime_day_id || ':' || c.runtime_stage_id
      )
      ON CONFLICT DO NOTHING;

      IF FOUND THEN
        n := n + 1;
      END IF;
    END IF;
  END LOOP;

  -- Weather remains weather-driven. Public Safety does not prevent storms.
  IF w.weather_state IN ('storm', 'heavy_rain', 'high_wind')
     AND w.operational_impact >= 65 THEN
    INSERT INTO public.festival_runtime_incidents(
      runtime_session_id,
      runtime_day_id,
      category,
      incident_type,
      severity,
      seed,
      trigger,
      required_response,
      public_safe_summary,
      private_operational_details,
      dedupe_key
    ) VALUES (
      r.id,
      p_runtime_day_id,
      'weather',
      'severe_weather_hold',
      CASE WHEN w.weather_state = 'storm' THEN 'major' ELSE 'moderate' END,
      w.seed,
      'weather operational impact threshold',
      'weather contingency assessment',
      'Some Festival activity may be delayed due to weather.',
      'Apply the published weather contingency and assess outdoor stages.',
      'weather:' || p_runtime_day_id
    )
    ON CONFLICT DO NOTHING;

    IF FOUND THEN
      n := n + 1;
    END IF;
  END IF;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public._evaluate_festival_runtime_incidents(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._evaluate_festival_runtime_incidents(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

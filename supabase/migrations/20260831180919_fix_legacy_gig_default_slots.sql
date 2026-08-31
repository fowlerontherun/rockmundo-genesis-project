CREATE OR REPLACE FUNCTION public.normalize_legacy_gig_schedules(p_gig_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_gigs_updated integer := 0;
  v_activities_updated integer := 0;
BEGIN
  WITH candidates AS (
    SELECT
      g.id,
      CASE lower(coalesce(nullif(g.time_slot, ''), nullif(g.slot_type, ''), 'headline'))
        WHEN 'kids' THEN 'kids'
        WHEN 'opening' THEN 'opening'
        WHEN 'support' THEN 'support'
        WHEN 'headline' THEN 'headline'
        ELSE 'headline'
      END AS slot_key,
      (g.scheduled_date AT TIME ZONE 'UTC')::date AS local_date,
      CASE
        WHEN c.timezone IS NOT NULL
          AND EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names tz WHERE tz.name = c.timezone)
          THEN c.timezone
        ELSE 'UTC'
      END AS venue_timezone
    FROM public.gigs g
    JOIN public.venues v ON v.id = g.venue_id
    LEFT JOIN public.cities c ON c.id = v.city_id
    WHERE (p_gig_id IS NULL OR g.id = p_gig_id)
      AND g.slot_start_time IS NULL
      AND (g.scheduled_date AT TIME ZONE 'UTC')::time = time '00:00:00'
      AND g.status IN ('scheduled', 'confirmed', 'in_progress', 'ready_for_completion', 'processing_outcome', 'live')
  ),
  resolved AS (
    SELECT
      c.id,
      c.slot_key,
      c.local_date,
      c.venue_timezone,
      CASE c.slot_key
        WHEN 'kids' THEN time '15:00'
        WHEN 'opening' THEN time '19:00'
        WHEN 'support' THEN time '19:45'
        ELSE time '20:45'
      END AS start_time,
      CASE c.slot_key
        WHEN 'kids' THEN time '15:30'
        WHEN 'opening' THEN time '19:30'
        WHEN 'support' THEN time '20:30'
        ELSE time '22:00'
      END AS end_time,
      CASE c.slot_key
        WHEN 'kids' THEN 0.30::numeric
        WHEN 'opening' THEN 0.50::numeric
        WHEN 'support' THEN 0.75::numeric
        ELSE 1.00::numeric
      END AS attendance_multiplier
    FROM candidates c
  ),
  updated_gigs AS (
    UPDATE public.gigs g
    SET
      time_slot = r.slot_key,
      slot_type = r.slot_key,
      slot_start_time = r.start_time,
      slot_end_time = r.end_time,
      slot_attendance_multiplier = r.attendance_multiplier,
      scheduled_date = (r.local_date + r.start_time) AT TIME ZONE r.venue_timezone,
      scheduled_end = (
        r.local_date + r.end_time
        + CASE WHEN r.end_time <= r.start_time THEN interval '1 day' ELSE interval '0' END
      ) AT TIME ZONE r.venue_timezone,
      updated_at = now()
    FROM resolved r
    WHERE g.id = r.id
    RETURNING g.id, g.scheduled_date, g.scheduled_end
  ),
  updated_activities AS (
    UPDATE public.player_scheduled_activities a
    SET
      scheduled_start = u.scheduled_date,
      scheduled_end = u.scheduled_end,
      updated_at = now()
    FROM updated_gigs u
    WHERE a.linked_gig_id = u.id
      AND a.status <> 'cancelled'
    RETURNING a.id
  )
  SELECT
    (SELECT count(*) FROM updated_gigs),
    (SELECT count(*) FROM updated_activities)
  INTO v_gigs_updated, v_activities_updated;

  RETURN jsonb_build_object(
    'gigsUpdated', v_gigs_updated,
    'activitiesUpdated', v_activities_updated
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.normalize_legacy_gig_schedules(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_legacy_gig_schedules(uuid) TO service_role;

COMMENT ON FUNCTION public.normalize_legacy_gig_schedules(uuid) IS
  'Repairs date-only gigs stored at 00:00 UTC with no slot_start_time by applying canonical local venue slot times and syncing linked player schedule entries.';

CREATE OR REPLACE FUNCTION public.auto_start_scheduled_gigs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gig record;
  v_started integer := 0;
  v_cancelled integer := 0;
  v_deferred integer := 0;
  v_checked integer := 0;
  v_lenient boolean;
  v_overdue_hours numeric;
  v_present integer;
  v_details jsonb := '[]'::jsonb;
  v_normalization jsonb := jsonb_build_object('gigsUpdated', 0, 'activitiesUpdated', 0);
BEGIN
  BEGIN
    v_normalization := public.normalize_legacy_gig_schedules();
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG '[gig-auto-start] schedule normalization failed code=% message=%', SQLSTATE, SQLERRM;
  END;

  BEGIN
    PERFORM public.auto_prepare_gig_travel();
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG '[gig-auto-start] travel prep failed code=% message=%', SQLSTATE, SQLERRM;
  END;

  FOR v_gig IN
    SELECT g.id, g.band_id, g.scheduled_date, g.absence_decision, v.city_id AS venue_city_id
    FROM public.gigs g
    LEFT JOIN public.venues v ON v.id = g.venue_id
    WHERE g.status = 'scheduled' AND g.scheduled_date <= now() AND g.started_at IS NULL
    ORDER BY g.scheduled_date
  LOOP
    v_checked := v_checked + 1;
    v_overdue_hours := extract(epoch FROM (now() - v_gig.scheduled_date)) / 3600.0;
    v_lenient := v_overdue_hours >= 2 OR v_gig.absence_decision = 'perform';

    SELECT count(*) INTO v_present
    FROM public.band_members bm
    JOIN public.profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = v_gig.band_id
      AND coalesce(bm.member_status, 'active') = 'active'
      AND coalesce(p.is_active, true) = true
      AND p.died_at IS NULL
      AND p.current_city_id = v_gig.venue_city_id
      AND coalesce(p.is_traveling, false) = false;

    IF v_overdue_hours >= 12 AND coalesce(v_present, 0) = 0 THEN
      UPDATE public.gigs
      SET status = 'cancelled',
          cancelled_at = now(),
          cancellation_reason = 'no_show_band_not_in_venue_city',
          failure_reason = 'Automatically cancelled: no active band member was in the venue city.',
          updated_at = now()
      WHERE id = v_gig.id;
      v_cancelled := v_cancelled + 1;
      v_details := v_details || jsonb_build_object('gigId', v_gig.id, 'outcome', 'cancelled');
      CONTINUE;
    END IF;

    BEGIN
      PERFORM public.start_gig_authoritative(v_gig.id, v_lenient);
      v_started := v_started + 1;
      v_details := v_details || jsonb_build_object('gigId', v_gig.id, 'outcome', 'started', 'lenient', v_lenient);
    EXCEPTION WHEN OTHERS THEN
      v_deferred := v_deferred + 1;
      UPDATE public.gigs
      SET failure_reason = format('auto-start deferred (%s): %s', SQLSTATE, SQLERRM),
          updated_at = now()
      WHERE id = v_gig.id;
      v_details := v_details || jsonb_build_object('gigId', v_gig.id, 'outcome', 'deferred', 'error', SQLERRM);
      RAISE LOG '[gig-auto-start] deferred gig=% code=% message=%', v_gig.id, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'normalization', v_normalization,
    'totalChecked', v_checked,
    'started', v_started,
    'cancelled', v_cancelled,
    'deferred', v_deferred,
    'details', v_details
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.auto_start_scheduled_gigs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_start_scheduled_gigs() TO service_role;

SELECT public.normalize_legacy_gig_schedules();
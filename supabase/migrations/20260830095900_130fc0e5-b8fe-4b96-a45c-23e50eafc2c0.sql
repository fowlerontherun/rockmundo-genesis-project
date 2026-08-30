DROP FUNCTION IF EXISTS public.start_gig_authoritative(uuid);
DROP FUNCTION IF EXISTS public.start_gig_authoritative(uuid, boolean);

CREATE OR REPLACE FUNCTION public.start_gig_authoritative(p_gig_id uuid, p_lenient boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  g public.gigs%ROWTYPE;
  v_venue_city uuid;
  v_missing_count integer := 0;
  v_present_count integer := 0;
BEGIN
  SELECT * INTO g FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_not_found' USING ERRCODE='P0002'; END IF;

  IF auth.role() <> 'service_role' AND NOT public.caller_in_band(g.band_id) THEN
    RAISE EXCEPTION 'not_authorised' USING ERRCODE='42501';
  END IF;

  IF g.started_at IS NOT NULL OR g.status IN ('in_progress','ready_for_completion','processing_outcome') THEN
    RETURN jsonb_build_object('alreadyStarted', true, 'startedAt', g.started_at, 'status', g.status);
  END IF;
  IF g.status = 'completed' THEN
    RETURN jsonb_build_object('alreadyStarted', true, 'completed', true, 'status', g.status);
  END IF;
  IF g.status <> 'scheduled' THEN
    RAISE EXCEPTION 'gig_cannot_start_from_status:%', g.status;
  END IF;
  IF g.scheduled_date > now() THEN
    RAISE EXCEPTION 'gig_not_due_yet';
  END IF;

  SELECT city_id INTO v_venue_city FROM public.venues WHERE id = g.venue_id;
  IF v_venue_city IS NULL THEN RAISE EXCEPTION 'gig_venue_city_missing'; END IF;

  SELECT
    count(*) FILTER (
      WHERE p.current_city_id IS DISTINCT FROM v_venue_city OR coalesce(p.is_traveling, false)
    ),
    count(*) FILTER (
      WHERE p.current_city_id = v_venue_city AND coalesce(p.is_traveling, false) = false
    )
  INTO v_missing_count, v_present_count
  FROM public.band_members bm
  JOIN public.profiles p ON p.id = bm.profile_id
  WHERE bm.band_id = g.band_id
    AND coalesce(bm.member_status, 'active') = 'active'
    AND coalesce(p.is_active, true) = true
    AND p.died_at IS NULL;

  IF p_lenient THEN
    IF v_present_count = 0 THEN
      RAISE EXCEPTION 'gig_no_performer_in_venue_city' USING ERRCODE='P0001';
    END IF;
  ELSIF v_missing_count > 0 THEN
    RAISE EXCEPTION 'gig_performer_not_in_venue_city' USING ERRCODE='P0001';
  END IF;

  UPDATE public.gigs
  SET status = 'in_progress',
      started_at = coalesce(started_at, now()),
      current_song_position = coalesce(current_song_position, 0),
      failure_reason = NULL,
      updated_at = now()
  WHERE id = p_gig_id
  RETURNING * INTO g;

  RETURN jsonb_build_object(
    'alreadyStarted', false,
    'startedAt', g.started_at,
    'status', g.status,
    'lenient', p_lenient,
    'absentMembers', v_missing_count,
    'presentMembers', v_present_count
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.start_gig_authoritative(uuid, boolean) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.auto_start_scheduled_gigs();

CREATE OR REPLACE FUNCTION public.auto_start_scheduled_gigs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
BEGIN
  BEGIN
    PERFORM public.auto_prepare_gig_travel();
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG '[gig-auto-start] travel prep failed code=% message=%', SQLSTATE, SQLERRM;
  END;

  FOR v_gig IN
    SELECT g.id, g.band_id, g.scheduled_date, v.city_id AS venue_city_id
    FROM public.gigs g
    LEFT JOIN public.venues v ON v.id = g.venue_id
    WHERE g.status = 'scheduled' AND g.scheduled_date <= now() AND g.started_at IS NULL
    ORDER BY g.scheduled_date
  LOOP
    v_checked := v_checked + 1;
    v_overdue_hours := extract(epoch FROM (now() - v_gig.scheduled_date)) / 3600.0;
    v_lenient := v_overdue_hours >= 2;

    SELECT count(*) INTO v_present
    FROM public.band_members bm
    JOIN public.profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = v_gig.band_id
      AND coalesce(bm.member_status, 'active') = 'active'
      AND coalesce(p.is_active, true) = true
      AND p.died_at IS NULL
      AND p.current_city_id = v_gig.venue_city_id
      AND coalesce(p.is_traveling, false) = false;

    -- Nobody can make the show after half a day: cancel so it stops blocking the pipeline.
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
    'totalChecked', v_checked,
    'started', v_started,
    'cancelled', v_cancelled,
    'deferred', v_deferred,
    'details', v_details
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.auto_start_scheduled_gigs() TO service_role;
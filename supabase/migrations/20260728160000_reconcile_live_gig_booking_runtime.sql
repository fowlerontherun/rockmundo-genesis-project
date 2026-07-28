-- Forward-only reconciliation after live gig-booking catalog diagnosis.
-- Reapplies the canonical definitions under a unique version because the
-- 140000 and 150000 versions collide with unrelated podcast migrations.
-- Gig inserts run set_predicted_tickets() before they are stored. Its legacy helper
-- still read bands.fame, a column that does not exist, so it aborted book_gig even
-- after book_gig itself was corrected to use bands.global_fame.
CREATE OR REPLACE FUNCTION public.calculate_predicted_tickets(
  p_band_id uuid,
  p_venue_capacity integer,
  p_scheduled_date timestamptz
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_band_fame integer;
  v_days_until_gig integer;
  v_predicted integer;
  v_fame_multiplier numeric;
BEGIN
  SELECT COALESCE(global_fame, 0)
  INTO v_band_fame
  FROM public.bands
  WHERE id = p_band_id;

  v_days_until_gig := GREATEST(0, floor(extract(epoch FROM (p_scheduled_date - now())) / 86400)::integer);
  v_fame_multiplier := LEAST(1.0, 0.2 + (COALESCE(v_band_fame, 0)::numeric / 10000.0 * 0.8));
  v_predicted := floor(GREATEST(COALESCE(p_venue_capacity, 100), 1) * v_fame_multiplier);

  IF v_days_until_gig > 7 THEN
    v_predicted := floor(v_predicted * 0.3);
  ELSIF v_days_until_gig > 3 THEN
    v_predicted := floor(v_predicted * 0.6);
  END IF;

  RETURN GREATEST(10, v_predicted);
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_predicted_tickets(uuid, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_predicted_tickets(uuid, integer, timestamptz) TO authenticated, service_role;
-- Runtime gig-booking schema repair.
-- Confirmed production failure: SQLSTATE 42703, column song.duration_seconds,
-- raised by public.book_gig during setlist validation. Duration was calculated but
-- never consumed, so the invalid/legacy dependency is removed rather than papered
-- over with a compatibility column.

CREATE OR REPLACE FUNCTION public.active_band_performing_members(p_band_id uuid)
RETURNS TABLE(profile_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT resolved.profile_id
  FROM (
    SELECT COALESCE(bm.profile_id, member_profile.id) AS profile_id
    FROM public.band_members bm
    LEFT JOIN public.profiles member_profile ON member_profile.user_id = bm.user_id
    WHERE bm.band_id = p_band_id
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND COALESCE(bm.is_touring_member, false) = false
    UNION ALL
    SELECT leader_profile.id
    FROM public.bands b
    JOIN public.profiles leader_profile
      ON leader_profile.id = b.leader_id OR leader_profile.user_id = b.leader_id
    WHERE b.id = p_band_id
  ) resolved
  WHERE resolved.profile_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.active_band_performing_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.active_band_performing_members(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.book_gig(
  p_band_id uuid,
  p_venue_id uuid,
  p_setlist_id uuid,
  p_local_date date,
  p_slot text,
  p_ticket_price integer,
  p_request_id uuid,
  p_rider_id uuid DEFAULT NULL,
  p_ticket_operator_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE; v_band public.bands%ROWTYPE; v_venue public.venues%ROWTYPE;
  v_gig public.gigs%ROWTYPE; v_timezone text; v_start_time time; v_end_time time;
  v_start timestamptz; v_end timestamptz; v_multiplier numeric; v_payment_multiplier numeric;
  v_capacity integer; v_estimated_attendance integer; v_estimated_revenue integer;
  v_booking_fee integer; v_payment integer; v_rider_cost integer := 0;
  v_song_count integer;
  v_stage text := 'resolve_actor';
  v_error_state text; v_error_message text; v_error_detail text; v_error_hint text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'gig_booking_unauthenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_actor FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_profile_missing' USING ERRCODE='P0001'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'gig_booking_request_invalid' USING ERRCODE='22023'; END IF;

  v_stage := 'idempotency_check';
  SELECT * INTO v_gig FROM public.gigs WHERE booking_request_id = p_request_id;
  IF FOUND THEN
    IF v_gig.band_id <> p_band_id OR NOT public.can_manage_band_gigs(v_gig.band_id, auth.uid()) THEN
      RAISE EXCEPTION 'gig_booking_request_conflict' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('gig', to_jsonb(v_gig), 'already_booked', true,
      'booking_fee', COALESCE(v_gig.booking_fee, 0), 'scheduled_start', v_gig.scheduled_date);
  END IF;

  v_stage := 'load_band';
  IF NOT public.can_manage_band_gigs(p_band_id, auth.uid()) THEN
    RAISE EXCEPTION 'gig_booking_forbidden' USING ERRCODE='42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('gig-band:'||p_band_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('gig-venue:'||p_venue_id::text, 0));

  SELECT * INTO v_band FROM public.bands WHERE id = p_band_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_band_invalid' USING ERRCODE='P0001'; END IF;
  v_stage := 'load_venue';
  SELECT * INTO v_venue FROM public.venues WHERE id = p_venue_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_venue_invalid' USING ERRCODE='P0001'; END IF;
  SELECT COALESCE(c.timezone, 'UTC') INTO v_timezone FROM public.cities c WHERE c.id = v_venue.city_id;
  v_timezone := COALESCE(v_timezone, 'UTC');

  v_stage := 'validate_slot';
  SELECT x.start_time, x.end_time, x.attendance_multiplier, x.payment_multiplier
  INTO v_start_time, v_end_time, v_multiplier, v_payment_multiplier
  FROM (VALUES ('kids','15:00'::time,'15:30'::time,0.30,0.50),
               ('opening','19:00','19:30',0.50,0.60),
               ('support','19:45','20:30',0.75,0.80),
               ('headline','20:45','22:00',1.00,1.00))
    AS x(slot,start_time,end_time,attendance_multiplier,payment_multiplier)
  WHERE x.slot = p_slot;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_slot_invalid' USING ERRCODE='22023'; END IF;

  v_start := (p_local_date + v_start_time) AT TIME ZONE v_timezone;
  v_end := (p_local_date + v_end_time
            + CASE WHEN v_end_time <= v_start_time THEN interval '1 day' ELSE interval '0' END)
           AT TIME ZONE v_timezone;
  IF v_start <= now() THEN RAISE EXCEPTION 'gig_booking_past_date' USING ERRCODE='22023'; END IF;
  IF p_ticket_price IS NULL OR p_ticket_price <= 0 OR p_ticket_price > 100000 THEN
    RAISE EXCEPTION 'gig_booking_ticket_price_invalid' USING ERRCODE='22023';
  END IF;

  v_stage := 'validate_setlist';
  -- Duration is not part of booking validation. Avoid an unused dependency on
  -- legacy song duration columns; ownership, active state, and six songs suffice.
  SELECT count(*)
  INTO v_song_count
  FROM public.setlist_songs ss
  JOIN public.setlists s ON s.id = ss.setlist_id
  WHERE s.id = p_setlist_id AND s.band_id = p_band_id AND COALESCE(s.is_active, true)
    AND ss.song_id IS NOT NULL;
  IF COALESCE(v_song_count, 0) < 6 THEN RAISE EXCEPTION 'gig_booking_setlist_invalid' USING ERRCODE='23514'; END IF;

  v_stage := 'validate_rider';
  IF p_rider_id IS NOT NULL THEN
    SELECT COALESCE(total_cost_estimate, 0) INTO v_rider_cost
    FROM public.band_riders WHERE id = p_rider_id AND band_id = p_band_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_rider_invalid' USING ERRCODE='23503'; END IF;
  END IF;

  v_stage := 'conflict_check';
  IF EXISTS (SELECT 1 FROM public.band_activity_lockouts
             WHERE band_id = p_band_id AND locked_until > now()) THEN
    RAISE EXCEPTION 'gig_booking_band_lockout' USING ERRCODE='P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.gigs g WHERE g.band_id = p_band_id
    AND g.status IN ('scheduled','in_progress','ready_for_completion')
    AND g.scheduled_date < v_end
    AND COALESCE(g.scheduled_end, g.scheduled_date + interval '3 hours') > v_start) THEN
    RAISE EXCEPTION 'gig_booking_band_conflict' USING ERRCODE='23P01';
  END IF;

  IF EXISTS (SELECT 1 FROM public.gigs g WHERE g.venue_id = p_venue_id
    AND g.status IN ('scheduled','in_progress','ready_for_completion')
    AND g.scheduled_date < v_end
    AND COALESCE(g.scheduled_end, g.scheduled_date + interval '3 hours') > v_start) THEN
    RAISE EXCEPTION 'gig_booking_venue_conflict' USING ERRCODE='23P01';
  END IF;

  v_stage := 'calculate_finances';
  v_capacity := GREATEST(COALESCE(v_venue.capacity, 100), 1);
  v_estimated_attendance := LEAST(v_capacity, GREATEST(1, round(v_capacity * LEAST(1.0,
    (0.25 + COALESCE(v_band.popularity,0)/200.0 + COALESCE(v_band.global_fame,0)/10000.0)) * v_multiplier))::integer);
  v_estimated_revenue := v_estimated_attendance * p_ticket_price;
  v_booking_fee := GREATEST(50, round(v_estimated_revenue * 0.10)::integer);
  v_payment := GREATEST(0, round(COALESCE(v_venue.base_payment,0) * v_payment_multiplier)::integer - v_rider_cost);

  IF COALESCE(v_band.band_balance, 0) < v_booking_fee THEN
    RAISE EXCEPTION 'gig_booking_insufficient_funds' USING ERRCODE='P0001', DETAIL = v_booking_fee::text;
  END IF;

  v_stage := 'debit_balance';
  UPDATE public.bands SET band_balance = band_balance - v_booking_fee WHERE id = p_band_id;

  v_stage := 'insert_gig';
  INSERT INTO public.gigs (band_id,venue_id,setlist_id,rider_id,ticket_operator_id,scheduled_date,scheduled_end,
    status,show_type,payment,booking_fee,ticket_price,time_slot,slot_start_time,slot_end_time,
    slot_attendance_multiplier,estimated_attendance,estimated_revenue,attendance,fan_gain,predicted_tickets,
    tickets_sold,last_ticket_update,booking_request_id)
  VALUES (p_band_id,p_venue_id,p_setlist_id,p_rider_id,p_ticket_operator_id,v_start,v_end,'scheduled',
    'concert',v_payment,v_booking_fee,p_ticket_price,p_slot,v_start_time,v_end_time,
    v_multiplier,v_estimated_attendance,v_estimated_revenue,0,0,v_estimated_attendance,0,now(),p_request_id)
  RETURNING * INTO v_gig;

  v_stage := 'create_member_activities';
  INSERT INTO public.player_scheduled_activities (user_id,profile_id,activity_type,scheduled_start,scheduled_end,
    status,title,location,linked_gig_id,metadata)
  SELECT p.user_id, p.id, 'gig', v_start, v_end, 'scheduled',
         'Gig at '||v_venue.name, v_venue.name, v_gig.id,
         jsonb_build_object('band_id',p_band_id,'venueId',p_venue_id,'slotId',p_slot,
                            'venue_timezone',v_timezone,'is_band_activity',true)
  FROM public.active_band_performing_members(p_band_id) member
  JOIN public.profiles p ON p.id = member.profile_id
  ON CONFLICT (linked_gig_id, profile_id)
  WHERE linked_gig_id IS NOT NULL AND status <> 'cancelled' DO NOTHING;

  RETURN jsonb_build_object('gig', to_jsonb(v_gig), 'already_booked', false, 'booking_fee', v_booking_fee,
    'band_balance', COALESCE(v_band.band_balance,0) - v_booking_fee,
    'scheduled_start', v_start, 'scheduled_end', v_end, 'venue_timezone', v_timezone);
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS
    v_error_state = RETURNED_SQLSTATE,
    v_error_message = MESSAGE_TEXT,
    v_error_detail = PG_EXCEPTION_DETAIL,
    v_error_hint = PG_EXCEPTION_HINT;
  IF v_error_message LIKE 'gig_booking_%' THEN RAISE; END IF;
  RAISE EXCEPTION USING
    ERRCODE = v_error_state,
    MESSAGE = 'gig_booking_database_failure',
    DETAIL = format('stage=%s; message=%s; detail=%s', v_stage, v_error_message, COALESCE(v_error_detail, '')),
    HINT = COALESCE(NULLIF(v_error_hint, ''), 'Inspect the named book_gig stage.');
END;
$$;

REVOKE ALL ON FUNCTION public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.check_gig_member_schedule_conflicts()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_end timestamptz := COALESCE(NEW.scheduled_end, NEW.scheduled_date + interval '3 hours');
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.player_scheduled_activities a
    JOIN public.active_band_performing_members(NEW.band_id) member ON member.profile_id = a.profile_id
    WHERE a.status IN ('scheduled', 'in_progress')
      AND a.scheduled_start < v_end AND a.scheduled_end > NEW.scheduled_date
  ) THEN
    RAISE EXCEPTION 'gig_booking_band_conflict' USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_gig_member_schedule_conflicts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_gig_member_schedule_conflicts() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
-- Keep the AFTER INSERT gig-lineup trigger on the same canonical membership
-- contract as book_gig and its schedule-conflict trigger.  In particular this
-- includes a row-less leader and excludes inactive/touring members.
CREATE OR REPLACE FUNCTION public.seed_gig_performers(p_gig_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gig public.gigs%ROWTYPE;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id;
  IF NOT FOUND OR COALESCE(v_gig.status, '') IN ('cancelled', 'failed') THEN
    RETURN 0;
  END IF;

  INSERT INTO public.gig_performers
    (gig_id, band_id, profile_id, role_or_instrument, lineup_status, selected_at)
  SELECT v_gig.id,
         v_gig.band_id,
         member.profile_id,
         NULLIF(COALESCE(bm.instrument_role, bm.role), ''),
         'selected',
         now()
  FROM public.active_band_performing_members(v_gig.band_id) member
  LEFT JOIN LATERAL (
    SELECT candidate.instrument_role, candidate.role, candidate.joined_at
    FROM public.band_members candidate
    WHERE candidate.band_id = v_gig.band_id
      AND candidate.profile_id = member.profile_id
    ORDER BY candidate.joined_at NULLS LAST, candidate.id
    LIMIT 1
  ) bm ON true
  WHERE bm.joined_at IS NULL OR bm.joined_at <= v_gig.scheduled_date
  ON CONFLICT ON CONSTRAINT gig_performers_unique DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_gig_performers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_gig_performers(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Deployment invariant: fail the migration rather than leave a function that
-- references either known absent legacy column.
DO $$
DECLARE
  v_identity regprocedure;
  v_definition text;
BEGIN
  FOREACH v_identity IN ARRAY ARRAY[
    'public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text)'::regprocedure,
    'public.active_band_performing_members(uuid)'::regprocedure,
    'public.seed_gig_performers(uuid)'::regprocedure,
    'public.check_gig_member_schedule_conflicts()'::regprocedure,
    'public.calculate_predicted_tickets(uuid,integer,timestamptz)'::regprocedure
  ] LOOP
    v_definition := pg_get_functiondef(v_identity);
    IF v_definition ~ '\mduration_seconds\M' OR v_definition ~ '\mfame\M' THEN
      RAISE EXCEPTION 'gig booking deployment verification failed for %: legacy absent column remains', v_identity;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

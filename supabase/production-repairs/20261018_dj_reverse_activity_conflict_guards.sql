-- P1 DJ booking: protect future DJ slots against other source-of-truth
-- activity writers, including actors who do not use the Schedule UI.
-- DJ reservations remain server-only; no cash/fame/XP or user-facing changes.

CREATE OR REPLACE FUNCTION public._dj_assert_no_reserved_slot(
  p_profile_id uuid, p_start timestamptz, p_end timestamptz, p_kind text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_profile_id IS NULL THEN RETURN; END IF;

  -- Same lock convention/order as reserve_dj_booking_internal and
  -- guard_canonical_dj_schedule; serializes concurrent booking/other writes.
  PERFORM pg_advisory_xact_lock(hashtext('dj:profile:' || p_profile_id::text)::bigint);

  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    IF EXISTS (
      SELECT 1 FROM public.dj_bookings b
      WHERE b.profile_id = p_profile_id
        AND b.status IN ('booked','ready','live','resolving')
    ) THEN
      RAISE EXCEPTION 'Cannot verify % time against reserved DJ slot', p_kind
        USING ERRCODE = '22023';
    END IF;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.dj_bookings b
    WHERE b.profile_id = p_profile_id
      AND b.status IN ('booked','ready','live','resolving')
      AND b.starts_at < p_end AND b.ends_at > p_start
  ) THEN
    RAISE EXCEPTION '% conflicts with an existing nightclub DJ booking', p_kind
      USING ERRCODE = '23P01';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._dj_assert_no_reserved_slot(uuid,timestamptz,timestamptz,text)
 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.guard_dj_reverse_activity_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile record;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF TG_TABLE_NAME = 'player_travel_history' THEN
    IF COALESCE(NEW.status,'') NOT IN ('scheduled','in_progress','traveling')
    THEN RETURN NEW; END IF;
    v_start := COALESCE(NEW.scheduled_departure_time, NEW.departure_time);
    v_end := NEW.arrival_time;
    PERFORM public._dj_assert_no_reserved_slot(NEW.profile_id,v_start,v_end,'Travel');

  ELSIF TG_TABLE_NAME = 'recording_sessions' THEN
    IF NEW.status::text NOT IN ('scheduled','in_progress')
    THEN RETURN NEW; END IF;
    v_start := NEW.scheduled_start;
    v_end := COALESCE(NEW.scheduled_end, NEW.scheduled_start + interval '2 hours');
    PERFORM public._dj_assert_no_reserved_slot(NEW.profile_id,v_start,v_end,'Recording');

  ELSIF TG_TABLE_NAME = 'profile_activity_statuses' THEN
    IF NEW.status::text NOT IN ('active','in_progress')
      OR NEW.activity_type::text NOT IN ('work_shift','travel','recording','education')
    THEN RETURN NEW; END IF;
    v_start := NEW.started_at;
    v_end := COALESCE(NEW.ends_at, NEW.started_at + interval '8 hours');
    PERFORM public._dj_assert_no_reserved_slot(NEW.profile_id,v_start,v_end,'Work or study');

  ELSIF TG_TABLE_NAME = 'band_rehearsals' THEN
    IF NEW.status::text NOT IN ('scheduled','in_progress')
    THEN RETURN NEW; END IF;
    v_start := NEW.scheduled_start;
    v_end := NEW.scheduled_end;
    -- Apply to every current active character in a band, not only the
    -- member initiating this booking. Lock sorted to avoid deadlocks.
    FOR v_profile IN
      SELECT DISTINCT bm.profile_id
      FROM public.band_members bm
      WHERE bm.band_id=NEW.band_id AND bm.member_status='active'
        AND bm.profile_id IS NOT NULL
      ORDER BY bm.profile_id
    LOOP
      PERFORM public._dj_assert_no_reserved_slot(
        v_profile.profile_id,v_start,v_end,'Band rehearsal');
    END LOOP;

  ELSIF TG_TABLE_NAME = 'tour_travel_legs' THEN
    IF NEW.status::text IN ('cancelled','completed') THEN RETURN NEW; END IF;
    v_start := NEW.departure_date;
    v_end := NEW.arrival_date;
    FOR v_profile IN
      SELECT DISTINCT bm.profile_id
      FROM public.tours tour JOIN public.band_members bm ON bm.band_id=tour.band_id
      WHERE tour.id=NEW.tour_id
        AND bm.member_status='active'
        AND COALESCE(bm.travels_with_band,true)
        AND bm.profile_id IS NOT NULL
      ORDER BY bm.profile_id
    LOOP
      PERFORM public._dj_assert_no_reserved_slot(
        v_profile.profile_id,v_start,v_end,'Tour travel');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_dj_reverse_activity_source() FROM PUBLIC;

-- Before mutations prevent downstream side effects/charges from taking place.
DROP TRIGGER IF EXISTS zz_dj_reverse_travel_booking ON public.player_travel_history;
CREATE TRIGGER zz_dj_reverse_travel_booking
 BEFORE INSERT OR UPDATE OF status,profile_id,departure_time,
   scheduled_departure_time,arrival_time ON public.player_travel_history
 FOR EACH ROW EXECUTE FUNCTION public.guard_dj_reverse_activity_source();

DROP TRIGGER IF EXISTS zz_dj_reverse_recording_booking ON public.recording_sessions;
CREATE TRIGGER zz_dj_reverse_recording_booking
 BEFORE INSERT OR UPDATE OF status,profile_id,scheduled_start,scheduled_end
 ON public.recording_sessions
 FOR EACH ROW EXECUTE FUNCTION public.guard_dj_reverse_activity_source();

-- 'zz' intentionally runs after timing normalization in existing triggers.
DROP TRIGGER IF EXISTS zz_dj_reverse_work_study_booking ON public.profile_activity_statuses;
CREATE TRIGGER zz_dj_reverse_work_study_booking
 BEFORE INSERT OR UPDATE OF status,profile_id,activity_type,started_at,ends_at
 ON public.profile_activity_statuses
 FOR EACH ROW EXECUTE FUNCTION public.guard_dj_reverse_activity_source();

DROP TRIGGER IF EXISTS zz_dj_reverse_band_rehearsal_booking ON public.band_rehearsals;
CREATE TRIGGER zz_dj_reverse_band_rehearsal_booking
 BEFORE INSERT OR UPDATE OF status,band_id,scheduled_start,scheduled_end
 ON public.band_rehearsals
 FOR EACH ROW EXECUTE FUNCTION public.guard_dj_reverse_activity_source();

DROP TRIGGER IF EXISTS zz_dj_reverse_tour_leg_booking ON public.tour_travel_legs;
CREATE TRIGGER zz_dj_reverse_tour_leg_booking
 BEFORE INSERT OR UPDATE OF status,tour_id,departure_date,arrival_date
 ON public.tour_travel_legs
 FOR EACH ROW EXECUTE FUNCTION public.guard_dj_reverse_activity_source();

COMMENT ON FUNCTION public.guard_dj_reverse_activity_source() IS
 'Blocks other travel/recording/work/rehearsal/tour writes overlapping private DJ reservations; shares DJ player advisory lock.';

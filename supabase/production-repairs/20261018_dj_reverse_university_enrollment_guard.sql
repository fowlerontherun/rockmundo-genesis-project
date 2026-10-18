-- Protect accepted DJ reservations from newly enrolled/edited recurring
-- university classes (which need not have a canonical calendar mirror).
-- The forward DJ booking check already projects these same daily classes.

CREATE OR REPLACE FUNCTION public._dj_assert_university_enrolment_clear(
  p_profile_id uuid, p_course_id uuid, p_university_id uuid,
  p_enrolled_at timestamptz, p_end_date timestamptz
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
  v_booking record;
  v_zone text;
  v_start_hour int;
  v_end_hour int;
  v_start timestamptz;
  v_end timestamptz;
  v_day date;
  v_offset int;
BEGIN
  IF p_profile_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('dj:profile:'||p_profile_id::text)::bigint);
  IF NOT EXISTS(
    SELECT 1 FROM public.dj_bookings b
    WHERE b.profile_id=p_profile_id
      AND b.status IN ('booked','ready','live','resolving')
  ) THEN RETURN; END IF;

  SELECT city.timezone,c.class_start_hour,c.class_end_hour
    INTO v_zone,v_start_hour,v_end_hour
  FROM public.university_courses c
  JOIN public.universities u ON u.id=p_university_id AND u.id=c.university_id
  LEFT JOIN public.cities city ON city.id=u.city_id
  WHERE c.id=p_course_id;

  IF v_zone IS NULL OR btrim(v_zone)='' OR
     v_start_hour IS NULL OR v_end_hour IS NULL OR p_enrolled_at IS NULL
  THEN
    RAISE EXCEPTION 'Cannot verify university schedule against existing DJ booking'
      USING ERRCODE='22023';
  END IF;

  v_start_hour := least(23,greatest(0,v_start_hour));
  v_end_hour := least(24,greatest(v_start_hour+1,v_end_hour));

  FOR v_booking IN
    SELECT b.starts_at,b.ends_at FROM public.dj_bookings b
    WHERE b.profile_id=p_profile_id
      AND b.status IN ('booked','ready','live','resolving')
    ORDER BY b.starts_at
  LOOP
    -- Include neighbouring days to handle DST and midnight transitions.
    FOR v_offset IN -1..1 LOOP
      v_day := (v_booking.starts_at AT TIME ZONE v_zone)::date+v_offset;
      IF v_day < (p_enrolled_at AT TIME ZONE 'UTC')::date OR
        (p_end_date IS NOT NULL AND
         v_day > (p_end_date AT TIME ZONE 'UTC')::date)
      THEN CONTINUE; END IF;

      v_start := (v_day::timestamp + make_interval(hours=>v_start_hour))
        AT TIME ZONE v_zone;
      v_end := (v_day::timestamp + make_interval(hours=>v_end_hour))
        AT TIME ZONE v_zone;

      IF v_start<v_booking.ends_at AND v_end>v_booking.starts_at THEN
        RAISE EXCEPTION 'University class overlaps an existing nightclub DJ booking'
          USING ERRCODE='23P01';
      END IF;
    END LOOP;
  END LOOP;
EXCEPTION WHEN invalid_parameter_value OR invalid_datetime_format THEN
  RAISE EXCEPTION 'Cannot verify university timezone against DJ reservations'
    USING ERRCODE='22023';
END;
$$;
REVOKE ALL ON FUNCTION public._dj_assert_university_enrolment_clear(
  uuid,uuid,uuid,timestamptz,timestamptz)
 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.guard_dj_reverse_university_enrolment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.status::text IN ('enrolled','in_progress') THEN
    PERFORM public._dj_assert_university_enrolment_clear(
      NEW.profile_id,NEW.course_id,NEW.university_id,
      NEW.enrolled_at,NEW.scheduled_end_date
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_dj_reverse_university_enrolment() FROM PUBLIC;

DROP TRIGGER IF EXISTS zz_dj_reverse_university_enrolment ON public.player_university_enrollments;
CREATE TRIGGER zz_dj_reverse_university_enrolment
BEFORE INSERT OR UPDATE OF status,profile_id,course_id,university_id,
  enrolled_at,scheduled_end_date ON public.player_university_enrollments
FOR EACH ROW EXECUTE FUNCTION public.guard_dj_reverse_university_enrolment();

COMMENT ON FUNCTION public.guard_dj_reverse_university_enrolment() IS
 'Prevent a new recurring university class from overlapping an existing DJ reservation; shared character advisory lock.';

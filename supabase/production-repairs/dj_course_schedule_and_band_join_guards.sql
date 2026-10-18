-- DJ Phase 4: changing a course/campus timezone or joining a band must not
-- erase a previously reserved DJ slot. Do not touch booking/payment UX.

CREATE OR REPLACE FUNCTION public._dj_assert_course_timetable_clear(
  p_profile_id uuid, p_timezone text, p_start_hour int, p_end_hour int,
  p_enrolled_at timestamptz, p_end_date timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking record;
  v_date date;
  v_offset int;
  v_class_start timestamptz;
  v_class_end timestamptz;
BEGIN
  IF p_profile_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(
    hashtext('dj:profile:' || p_profile_id::text)::bigint
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.dj_bookings b
    WHERE b.profile_id=p_profile_id
      AND b.status IN ('booked','ready','live','resolving')
  ) THEN RETURN; END IF;

  IF p_timezone IS NULL OR btrim(p_timezone)=''
     OR p_start_hour IS NULL OR p_end_hour IS NULL
     OR p_start_hour NOT BETWEEN 0 AND 23
     OR p_end_hour NOT BETWEEN 1 AND 24
     OR p_end_hour <= p_start_hour
     OR p_enrolled_at IS NULL
  THEN RAISE EXCEPTION 'Cannot verify changed university hours against existing DJ booking'
    USING ERRCODE='22023'; END IF;

  FOR v_booking IN
    SELECT b.starts_at,b.ends_at FROM public.dj_bookings b
    WHERE b.profile_id=p_profile_id
      AND b.status IN ('booked','ready','live','resolving')
    ORDER BY b.starts_at
  LOOP
    FOR v_offset IN -1..1 LOOP
      v_date := (v_booking.starts_at AT TIME ZONE p_timezone)::date+v_offset;
      IF v_date<(p_enrolled_at AT TIME ZONE 'UTC')::date
        OR (p_end_date IS NOT NULL
          AND v_date>(p_end_date AT TIME ZONE 'UTC')::date)
      THEN CONTINUE; END IF;

      v_class_start := (v_date::timestamp
        + make_interval(hours=>p_start_hour)) AT TIME ZONE p_timezone;
      v_class_end := (v_date::timestamp
        + make_interval(hours=>p_end_hour)) AT TIME ZONE p_timezone;
      IF v_class_start<v_booking.ends_at AND v_class_end>v_booking.starts_at THEN
        RAISE EXCEPTION 'Updated university timetable overlaps an existing DJ booking'
          USING ERRCODE='23P01';
      END IF;
    END LOOP;
  END LOOP;
EXCEPTION WHEN invalid_parameter_value OR invalid_datetime_format THEN
  RAISE EXCEPTION 'University timezone cannot be validated against DJ booking'
    USING ERRCODE='22023';
END;
$$;
REVOKE ALL ON FUNCTION public._dj_assert_course_timetable_clear(
 uuid,text,integer,integer,timestamptz,timestamptz
) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._dj_guard_course_timetable_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE v_timezone text; v_student record;
BEGIN
 IF NEW.class_start_hour IS NOT DISTINCT FROM OLD.class_start_hour
    AND NEW.class_end_hour IS NOT DISTINCT FROM OLD.class_end_hour
    AND NEW.university_id IS NOT DISTINCT FROM OLD.university_id
 THEN RETURN NEW; END IF;

 SELECT city.timezone INTO v_timezone
 FROM public.universities u
 LEFT JOIN public.cities city ON city.id=u.city_id
 WHERE u.id=NEW.university_id;

 FOR v_student IN
  SELECT e.profile_id,e.enrolled_at,e.scheduled_end_date
  FROM public.player_university_enrollments e
  WHERE e.course_id=OLD.id AND e.status::text IN ('enrolled','in_progress')
  ORDER BY e.profile_id
 LOOP
   PERFORM public._dj_assert_course_timetable_clear(
     v_student.profile_id,v_timezone,NEW.class_start_hour,NEW.class_end_hour,
     v_student.enrolled_at,v_student.scheduled_end_date
   );
 END LOOP;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._dj_guard_course_timetable_update() FROM PUBLIC;

DROP TRIGGER IF EXISTS zz_dj_guard_university_course_hours ON public.university_courses;
CREATE TRIGGER zz_dj_guard_university_course_hours
 BEFORE UPDATE OF class_start_hour,class_end_hour,university_id
 ON public.university_courses
 FOR EACH ROW EXECUTE FUNCTION public._dj_guard_course_timetable_update();

-- Moving a campus to a city in a different timezone changes every active
-- enrollee's class times, so it must use the same DJ conflict test.
CREATE OR REPLACE FUNCTION public._dj_guard_university_city_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_timezone text; v_student record;
BEGIN
 IF NEW.city_id IS NOT DISTINCT FROM OLD.city_id THEN RETURN NEW; END IF;
 SELECT city.timezone INTO v_timezone FROM public.cities city WHERE city.id=NEW.city_id;
 FOR v_student IN
   SELECT e.profile_id,e.enrolled_at,e.scheduled_end_date,
      c.class_start_hour,c.class_end_hour
   FROM public.player_university_enrollments e
   JOIN public.university_courses c ON c.id=e.course_id
   WHERE e.university_id=NEW.id AND e.status::text IN ('enrolled','in_progress')
   ORDER BY e.profile_id
 LOOP
   PERFORM public._dj_assert_course_timetable_clear(
     v_student.profile_id,v_timezone,
     v_student.class_start_hour,v_student.class_end_hour,
     v_student.enrolled_at,v_student.scheduled_end_date
   );
 END LOOP;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._dj_guard_university_city_update() FROM PUBLIC;
DROP TRIGGER IF EXISTS zz_dj_guard_university_city ON public.universities;
CREATE TRIGGER zz_dj_guard_university_city
 BEFORE UPDATE OF city_id ON public.universities
 FOR EACH ROW EXECUTE FUNCTION public._dj_guard_university_city_update();

-- City timezone changes can also alter active class times; only inspect
-- universities with actually enrolled characters (normally a tiny set).
CREATE OR REPLACE FUNCTION public._dj_guard_city_timezone_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_student record;
BEGIN
 IF NEW.timezone IS NOT DISTINCT FROM OLD.timezone THEN RETURN NEW; END IF;
 FOR v_student IN
  SELECT e.profile_id,e.enrolled_at,e.scheduled_end_date,
    c.class_start_hour,c.class_end_hour
  FROM public.universities u
  JOIN public.player_university_enrollments e ON e.university_id=u.id
  JOIN public.university_courses c ON c.id=e.course_id
  WHERE u.city_id=NEW.id AND e.status::text IN ('enrolled','in_progress')
  ORDER BY e.profile_id
 LOOP
   PERFORM public._dj_assert_course_timetable_clear(
     v_student.profile_id,NEW.timezone,
     v_student.class_start_hour,v_student.class_end_hour,
     v_student.enrolled_at,v_student.scheduled_end_date
   );
 END LOOP;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._dj_guard_city_timezone_update() FROM PUBLIC;
DROP TRIGGER IF EXISTS zz_dj_guard_city_timezone ON public.cities;
CREATE TRIGGER zz_dj_guard_city_timezone
 BEFORE UPDATE OF timezone ON public.cities
 FOR EACH ROW EXECUTE FUNCTION public._dj_guard_city_timezone_update();

-- Band members joining/rejoining after a DJ booking must respect the
-- band's existing gigs, rehearsals and tour travel legs.
CREATE OR REPLACE FUNCTION public._dj_guard_band_join_conflicts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_booking record;
BEGIN
 IF NEW.profile_id IS NULL OR NEW.member_status::text <> 'active'
 THEN RETURN NEW; END IF;

 IF TG_OP='UPDATE'
    AND OLD.profile_id IS NOT DISTINCT FROM NEW.profile_id
    AND OLD.band_id IS NOT DISTINCT FROM NEW.band_id
    AND OLD.member_status::text='active'
    AND (
      COALESCE(OLD.travels_with_band,true)
      OR NOT COALESCE(NEW.travels_with_band,true)
    )
 THEN RETURN NEW; END IF;

 PERFORM pg_advisory_xact_lock(
   hashtext('dj:profile:'||NEW.profile_id::text)::bigint
 );

 FOR v_booking IN
   SELECT b.starts_at,b.ends_at FROM public.dj_bookings b
   WHERE b.profile_id=NEW.profile_id
     AND b.status IN ('booked','ready','live','resolving')
   ORDER BY b.starts_at
 LOOP
   IF EXISTS (
     SELECT 1 FROM public.gigs g
     WHERE g.band_id=NEW.band_id
       AND g.status IN ('scheduled','confirmed','in_progress')
       AND g.scheduled_date<v_booking.ends_at
       AND COALESCE(g.scheduled_end,g.scheduled_date+interval '2 hours')>v_booking.starts_at
   ) THEN
     RAISE EXCEPTION 'Band gig overlaps an existing personal DJ reservation'
       USING ERRCODE='23P01';
   END IF;

   IF EXISTS (
     SELECT 1 FROM public.band_rehearsals r
     WHERE r.band_id=NEW.band_id
       AND r.status::text IN ('scheduled','in_progress')
       AND r.scheduled_start<v_booking.ends_at
       AND r.scheduled_end>v_booking.starts_at
   ) THEN
     RAISE EXCEPTION 'Band rehearsal overlaps an existing personal DJ reservation'
       USING ERRCODE='23P01';
   END IF;

   IF COALESCE(NEW.travels_with_band,true) AND EXISTS (
     SELECT 1 FROM public.tour_travel_legs leg
     JOIN public.tours t ON t.id=leg.tour_id
     WHERE t.band_id=NEW.band_id
       AND leg.status NOT IN ('cancelled','completed')
       AND leg.departure_date IS NOT NULL AND leg.arrival_date IS NOT NULL
       AND leg.departure_date<v_booking.ends_at
       AND leg.arrival_date>v_booking.starts_at
   ) THEN
     RAISE EXCEPTION 'Band travel overlaps an existing personal DJ reservation'
       USING ERRCODE='23P01';
   END IF;
 END LOOP;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._dj_guard_band_join_conflicts() FROM PUBLIC;
DROP TRIGGER IF EXISTS zz_dj_guard_band_join ON public.band_members;
CREATE TRIGGER zz_dj_guard_band_join
 BEFORE INSERT OR UPDATE OF band_id,profile_id,member_status,travels_with_band
 ON public.band_members FOR EACH ROW
 EXECUTE FUNCTION public._dj_guard_band_join_conflicts();

-- Fail closed on authoritative schedule sources that are shown in the
-- player Schedule but may not have a player_scheduled_activities mirror.
-- Booking is still private/service_role-only; this is a second line of
-- defense for direct trusted writes and for future enablement.

CREATE OR REPLACE FUNCTION public.dj_external_schedule_conflict(
 p_profile_id uuid, p_start timestamptz, p_end timestamptz
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
 v_enrol record;
 v_zone text;
 v_day date;
 v_offset integer;
 v_start_hour integer;
 v_end_hour integer;
 v_class_start timestamptz;
 v_class_end timestamptz;
BEGIN
 IF p_profile_id IS NULL OR p_start IS NULL OR p_end IS NULL OR p_end <= p_start
 THEN RETURN 'Invalid DJ booking window'; END IF;

 IF EXISTS(
   SELECT 1 FROM public.player_travel_history t
   WHERE t.profile_id=p_profile_id AND t.status IN ('scheduled','in_progress','traveling')
     AND coalesce(t.scheduled_departure_time,t.departure_time)<p_end
     AND t.arrival_time>p_start
 ) THEN RETURN 'DJ set overlaps booked or active travel'; END IF;

 IF EXISTS(
   SELECT 1 FROM public.tour_travel_legs leg
   JOIN public.tours tour ON tour.id=leg.tour_id
   JOIN public.band_members bm ON bm.band_id=tour.band_id
   WHERE bm.profile_id=p_profile_id AND bm.member_status='active'
     AND coalesce(bm.travels_with_band,true)
     AND leg.status NOT IN ('cancelled','completed')
     AND leg.departure_date IS NOT NULL AND leg.arrival_date IS NOT NULL
     AND leg.departure_date < p_end AND leg.arrival_date > p_start
 ) THEN RETURN 'DJ set overlaps a band tour journey'; END IF;

 IF EXISTS(
   SELECT 1 FROM public.recording_sessions r
   WHERE r.profile_id=p_profile_id AND r.status IN ('scheduled','in_progress')
     AND r.scheduled_start<p_end
     AND coalesce(r.scheduled_end,r.scheduled_start+interval '2 hours')>p_start
 ) THEN RETURN 'DJ set overlaps a recording session'; END IF;

 IF EXISTS(
   SELECT 1 FROM public.band_rehearsals r
   JOIN public.band_members bm ON bm.band_id=r.band_id
   WHERE bm.profile_id=p_profile_id AND bm.member_status='active'
     AND r.status IN ('scheduled','in_progress')
     AND r.scheduled_start < p_end AND r.scheduled_end > p_start
 ) THEN RETURN 'DJ set overlaps a band rehearsal'; END IF;

 IF EXISTS(
   SELECT 1 FROM public.profile_activity_statuses a
   WHERE a.profile_id=p_profile_id AND a.status IN ('active','in_progress')
     AND a.activity_type IN ('work_shift','travel','recording','education')
     AND a.started_at < p_end AND coalesce(a.ends_at,a.started_at+interval '8 hours')>p_start
 ) THEN RETURN 'DJ set overlaps current work, travel or study'; END IF;

 -- Project recurring *real* daily university class sessions exactly as the
 -- Schedule viewer does, using the campus city IANA timezone and enrolment
 -- start/end dates rather than the player's local time.
 FOR v_enrol IN
   SELECT e.enrolled_at,e.scheduled_end_date,
          course.class_start_hour,course.class_end_hour,city.timezone
   FROM public.player_university_enrollments e
   JOIN public.university_courses course ON course.id=e.course_id
   JOIN public.universities university ON university.id=e.university_id
   LEFT JOIN public.cities city ON city.id=university.city_id
   WHERE e.profile_id=p_profile_id AND e.status::text IN ('enrolled','in_progress')
 LOOP
   v_zone := v_enrol.timezone;
   IF v_zone IS NULL OR btrim(v_zone)='' THEN
     RETURN 'University timetable timezone is unresolved';
   END IF;
   IF v_enrol.class_start_hour IS NULL OR v_enrol.class_end_hour IS NULL THEN
     RETURN 'University timetable is incomplete';
   END IF;
   v_start_hour := LEAST(23,GREATEST(0,v_enrol.class_start_hour));
   v_end_hour := LEAST(24,GREATEST(v_start_hour+1,v_enrol.class_end_hour));

   FOR v_offset IN -1..1 LOOP
     v_day := (p_start AT TIME ZONE v_zone)::date + v_offset;
     IF v_day < (v_enrol.enrolled_at AT TIME ZONE 'UTC')::date
       OR (v_enrol.scheduled_end_date IS NOT NULL
         AND v_day>(v_enrol.scheduled_end_date AT TIME ZONE 'UTC')::date)
     THEN CONTINUE; END IF;

     v_class_start := (v_day::timestamp + make_interval(hours=>v_start_hour))
       AT TIME ZONE v_zone;
     v_class_end := (v_day::timestamp + make_interval(hours=>v_end_hour))
       AT TIME ZONE v_zone;
     IF v_class_start<p_end AND v_class_end>p_start THEN
       RETURN 'DJ set overlaps a scheduled university class';
     END IF;
   END LOOP;
 END LOOP;
 RETURN NULL;
EXCEPTION WHEN invalid_parameter_value OR invalid_datetime_format THEN
  RETURN 'One of the authoritative activity calendars is invalid';
END;
$$;
REVOKE ALL ON FUNCTION public.dj_external_schedule_conflict(uuid,timestamptz,timestamptz)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dj_external_schedule_conflict(uuid,timestamptz,timestamptz)
 TO service_role;

CREATE OR REPLACE FUNCTION public.guard_dj_booking_unmirrored_schedule()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE v_conflict text;
BEGIN
  IF NEW.status NOT IN ('booked','ready','live','resolving') THEN RETURN NEW; END IF;
  v_conflict := public.dj_external_schedule_conflict(
    NEW.profile_id,NEW.starts_at,NEW.ends_at);
  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION '%',v_conflict USING ERRCODE='23P01';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_dj_booking_unmirrored_schedule() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_dj_booking_unmirrored_schedule_on_write ON public.dj_bookings;
CREATE TRIGGER guard_dj_booking_unmirrored_schedule_on_write
 BEFORE INSERT OR UPDATE OF profile_id,starts_at,ends_at,status
 ON public.dj_bookings FOR EACH ROW
 EXECUTE FUNCTION public.guard_dj_booking_unmirrored_schedule();

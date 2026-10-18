-- Phase 4 nightclub operating-hour gate. No persistent writes.
\set ON_ERROR_STOP on
BEGIN;
DO $test$
DECLARE
  v_club uuid;
  v_bad uuid;
  v_missing uuid;
  v_zone text;
  v_start timestamptz;
  v_night timestamptz;
  v_late timestamptz;
BEGIN
 IF public.dj_clock_minutes('midnight')<>0
    OR public.dj_clock_minutes('noon')<>720
    OR public.dj_clock_minutes('12am')<>0
    OR public.dj_clock_minutes('12pm')<>720
    OR public.dj_clock_minutes('10pm')<>1320
    OR public.dj_clock_minutes('4am')<>240
    OR public.dj_clock_minutes('Monday') IS NOT NULL
 THEN RAISE EXCEPTION 'Clock parser regression'; END IF;

 SELECT n.id,c.timezone INTO v_club,v_zone
 FROM public.city_night_clubs n
 JOIN public.cities c ON c.id=n.city_id
 WHERE n.dj_slot_config->>'schedule'='10pm-4am'
 ORDER BY n.id LIMIT 1;
 IF v_club IS NULL THEN RAISE EXCEPTION 'Missing overnight venue fixture'; END IF;

 v_start := (timestamp '2026-11-10 22:30:00' AT TIME ZONE v_zone);
 v_night := (timestamp '2026-11-11 02:30:00' AT TIME ZONE v_zone);
 v_late := (timestamp '2026-11-11 04:30:00' AT TIME ZONE v_zone);

 IF NOT public.dj_booking_inside_club_hours(v_club,v_start,v_start+interval '60 minutes')
 THEN RAISE EXCEPTION 'Valid local venue night opening rejected'; END IF;
 IF NOT public.dj_booking_inside_club_hours(v_club,v_night,v_night+interval '45 minutes')
 THEN RAISE EXCEPTION 'Valid after-midnight set rejected'; END IF;
 IF public.dj_booking_inside_club_hours(v_club,v_late,v_late+interval '30 minutes')
 THEN RAISE EXCEPTION 'Venue accepted set after closing'; END IF;
 IF public.dj_booking_inside_club_hours(v_club,v_start,v_start+interval '8 hours')
 THEN RAISE EXCEPTION 'Venue accepted a set extending after closing'; END IF;

 SELECT id INTO v_bad FROM public.city_night_clubs
 WHERE dj_slot_config->>'schedule'='10pm-12pm' LIMIT 1;
 IF v_bad IS NOT NULL AND public.dj_booking_inside_club_hours(
   v_bad,v_start,v_start+interval '45 minutes')
 THEN RAISE EXCEPTION 'Ambiguous 14-hour schedule was treated as verified'; END IF;
 SELECT id INTO v_bad FROM public.city_night_clubs
 WHERE dj_slot_config->>'schedule'='midnight-Monday' LIMIT 1;
 IF v_bad IS NOT NULL AND public.dj_booking_inside_club_hours(
   v_bad,v_start,v_start+interval '45 minutes')
 THEN RAISE EXCEPTION 'Weekday text was treated as a time'; END IF;

 SELECT id INTO v_missing FROM public.city_night_clubs
 WHERE dj_slot_config->>'schedule' IS NULL LIMIT 1;
 IF v_missing IS NOT NULL AND public.dj_booking_inside_club_hours(
   v_missing,v_start,v_start+interval '45 minutes')
 THEN RAISE EXCEPTION 'Missing DJ schedule was treated as available'; END IF;

 -- Ensure 12-hour legitimate overnight windows are supported, not silently
 -- rewritten as 24h. The entire reservation must fit the local interval.
 SELECT n.id,c.timezone INTO v_club,v_zone
 FROM public.city_night_clubs n JOIN public.cities c ON c.id=n.city_id
 WHERE n.dj_slot_config->>'schedule'='midnight-noon' LIMIT 1;
 IF v_club IS NOT NULL THEN
   v_start := (timestamp '2026-11-10 01:00:00' AT TIME ZONE v_zone);
   IF NOT public.dj_booking_inside_club_hours(
     v_club,v_start,v_start+interval '60 minutes')
   THEN RAISE EXCEPTION 'Legitimate midnight-noon interval rejected'; END IF;
 END IF;
END $test$;
ROLLBACK;

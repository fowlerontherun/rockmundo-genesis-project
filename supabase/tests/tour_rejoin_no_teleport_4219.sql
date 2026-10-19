-- #4219: production-safe integration harness. Every fixture, profile move,
-- timeline row and schedule is inside BEGIN / ROLLBACK.
BEGIN;

CREATE TEMP TABLE rejoin_fixture ON COMMIT DROP AS
SELECT p.id AS profile_id,p.user_id,t.id AS tour_id,
  l.from_city_id,l.to_city_id
FROM public.tours t
JOIN public.band_members bm ON bm.band_id=t.band_id
JOIN public.profiles p ON p.id=bm.profile_id AND p.user_id=bm.user_id
JOIN LATERAL (
 SELECT from_city_id,to_city_id FROM public.tour_travel_legs leg
 WHERE leg.tour_id=t.id AND leg.from_city_id IS NOT NULL
   AND leg.to_city_id IS NOT NULL AND leg.from_city_id<>leg.to_city_id
 LIMIT 1
) l ON TRUE
WHERE t.status IN ('active','scheduled','booked')
 AND NOT coalesce(t.cancelled,false)
 AND bm.member_status='active'
 AND NOT coalesce(bm.is_touring_member,false)
 AND coalesce(p.is_traveling,false)=false
 AND p.is_active=true AND p.died_at IS NULL AND p.deleted_at IS NULL
LIMIT 1;

CREATE TEMP TABLE rejoin_legs ON COMMIT DROP AS
WITH future AS (
 INSERT INTO public.tour_travel_legs(
  tour_id,from_city_id,to_city_id,travel_mode,status,
  departure_date,arrival_date,travel_duration_hours
 ) SELECT tour_id,from_city_id,to_city_id,'tour_bus','scheduled',
    now()+interval '2 days',now()+interval '2 days 3 hours',3
 FROM rejoin_fixture RETURNING id
), progress AS (
 INSERT INTO public.tour_travel_legs(
  tour_id,from_city_id,to_city_id,travel_mode,status,
  departure_date,arrival_date,travel_duration_hours
 ) SELECT tour_id,from_city_id,to_city_id,'tour_bus','in_progress',
    now()-interval '1 hour',now()+interval '2 hours',3
 FROM rejoin_fixture RETURNING id
), past AS (
 INSERT INTO public.tour_travel_legs(
  tour_id,from_city_id,to_city_id,travel_mode,status,
  departure_date,arrival_date,travel_duration_hours
 ) SELECT tour_id,from_city_id,to_city_id,'tour_bus','completed',
    now()-interval '2 days',now()-interval '1 day',3
 FROM rejoin_fixture RETURNING id
)
SELECT future.id future_id,progress.id progress_id,past.id past_id
FROM future CROSS JOIN progress CROSS JOIN past;

-- Attempt from the wrong city: no travel, schedule, or profile move.
UPDATE public.profiles SET current_city_id=(SELECT to_city_id FROM rejoin_fixture)
WHERE id=(SELECT profile_id FROM rejoin_fixture);
CREATE TEMP TABLE rejoin_wrong_city AS
SELECT public.schedule_tour_rejoin_atomic(
 (SELECT user_id FROM rejoin_fixture),(SELECT profile_id FROM rejoin_fixture),
 (SELECT future_id FROM rejoin_legs)) result;

-- Place fixture character at the correct departure city, retry safely.
UPDATE public.profiles SET current_city_id=(SELECT from_city_id FROM rejoin_fixture)
WHERE id=(SELECT profile_id FROM rejoin_fixture);
CREATE TEMP TABLE rejoin_future AS
SELECT public.schedule_tour_rejoin_atomic(
 (SELECT user_id FROM rejoin_fixture),(SELECT profile_id FROM rejoin_fixture),
 (SELECT future_id FROM rejoin_legs)) result;
CREATE TEMP TABLE rejoin_future_retry AS
SELECT public.schedule_tour_rejoin_atomic(
 (SELECT user_id FROM rejoin_fixture),(SELECT profile_id FROM rejoin_fixture),
 (SELECT future_id FROM rejoin_legs)) result;

CREATE TEMP TABLE rejoin_past AS
SELECT public.schedule_tour_rejoin_atomic(
 (SELECT user_id FROM rejoin_fixture),(SELECT profile_id FROM rejoin_fixture),
 (SELECT past_id FROM rejoin_legs)) result;
CREATE TEMP TABLE rejoin_wrong_account AS
SELECT public.schedule_tour_rejoin_atomic(
 '00000000-0000-4000-8000-000000000008'::uuid,
 (SELECT profile_id FROM rejoin_fixture),(SELECT progress_id FROM rejoin_legs)) result;

-- In-progress travel may start ONLY from the actual departure city.
CREATE TEMP TABLE rejoin_in_progress AS
SELECT public.schedule_tour_rejoin_atomic(
 (SELECT user_id FROM rejoin_fixture),(SELECT profile_id FROM rejoin_fixture),
 (SELECT progress_id FROM rejoin_legs)) result;

-- One active journey blocks a different future request (same profile).
CREATE TEMP TABLE rejoin_overlapping AS
SELECT public.schedule_tour_rejoin_atomic(
 (SELECT user_id FROM rejoin_fixture),(SELECT profile_id FROM rejoin_fixture),
 (SELECT future_id FROM rejoin_legs)) result;

SELECT
 (SELECT count(*)=1 FROM rejoin_fixture) fixture_found,
 (SELECT result->>'reason'='not_in_departure_city' FROM rejoin_wrong_city) wrong_city_rejected,
 (SELECT result->>'success'='true' AND result->>'status'='scheduled' FROM rejoin_future) future_scheduled,
 (SELECT result->>'success'='true' AND result->>'already_booked'='true' FROM rejoin_future_retry) retry_idempotent,
 (SELECT f.result->>'travel_history_id'=r.result->>'travel_history_id'
   AND f.result->>'schedule_id'=r.result->>'schedule_id'
  FROM rejoin_future f CROSS JOIN rejoin_future_retry r) same_receipts_on_retry,
 (SELECT count(*)=1 FROM public.player_travel_history
  WHERE profile_id=(SELECT profile_id FROM rejoin_fixture)
    AND tour_leg_id=(SELECT future_id FROM rejoin_legs)) one_future_history,
 (SELECT count(*)=1 FROM public.player_scheduled_activities
  WHERE profile_id=(SELECT profile_id FROM rejoin_fixture)
    AND activity_type='travel' AND metadata->>'tour_leg_id'=(SELECT future_id::text FROM rejoin_legs)) one_future_schedule,
 (SELECT count(*)=1 FROM public.travel_timeline_events
  WHERE profile_id=(SELECT profile_id FROM rejoin_fixture)
   AND tour_leg_id=(SELECT future_id FROM rejoin_legs) AND event_type='rejoined') one_rejoin_event,
 (SELECT result->>'reason'='leg_already_finished' FROM rejoin_past) past_leg_rejected,
 (SELECT result->>'reason'='character_not_found' FROM rejoin_wrong_account) another_account_rejected,
 (SELECT result->>'success'='true' AND result->>'status'='in_progress'
  FROM rejoin_in_progress) in_progress_leg_started,
 (SELECT p.current_city_id=f.from_city_id AND p.is_traveling IS TRUE
  FROM public.profiles p JOIN rejoin_fixture f ON f.profile_id=p.id) no_city_teleport,
 (SELECT result->>'reason'='another_journey_active' FROM rejoin_overlapping) overlapping_journey_blocked,
 NOT has_function_privilege('authenticated','public.schedule_tour_rejoin_atomic(uuid,uuid,uuid)','EXECUTE') browser_denied,
 has_function_privilege('service_role','public.schedule_tour_rejoin_atomic(uuid,uuid,uuid)','EXECUTE') service_allowed;

ROLLBACK;

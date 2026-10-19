-- #4219: a rejoin books transport; only transport departure can begin a
-- journey. A future leg must NEVER reposition a character instantly.
-- #4251: history and calendar are created/repaired in the SAME transaction.
CREATE UNIQUE INDEX IF NOT EXISTS player_travel_history_profile_leg_unique
 ON public.player_travel_history(profile_id,tour_leg_id)
 WHERE profile_id IS NOT NULL AND tour_leg_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS player_scheduled_travel_profile_leg_unique
 ON public.player_scheduled_activities(profile_id,(metadata->>'tour_leg_id'))
 WHERE activity_type='travel' AND metadata ? 'tour_leg_id';

CREATE OR REPLACE FUNCTION public.schedule_tour_rejoin_atomic(
 p_user_id uuid,p_profile_id uuid,p_tour_leg_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_profile public.profiles%ROWTYPE;
 v_leg public.tour_travel_legs%ROWTYPE;
 v_tour public.tours%ROWTYPE;
 v_history public.player_travel_history%ROWTYPE;
 v_schedule public.player_scheduled_activities%ROWTYPE;
 v_departure_city text;
 v_arrival_city text;
 v_arrival timestamptz;
 v_duration numeric;
 v_state text;
 v_existing boolean:=false;
 v_now timestamptz:=now();
BEGIN
 IF p_user_id IS NULL OR p_profile_id IS NULL OR p_tour_leg_id IS NULL THEN
   RAISE EXCEPTION 'TOUR_REJOIN_ARGUMENTS_REQUIRED';
 END IF;
 -- The profile row serializes retries and competing journeys for a character.
 SELECT * INTO v_profile FROM public.profiles
 WHERE id=p_profile_id AND user_id=p_user_id AND is_active IS TRUE
   AND died_at IS NULL AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'reason','character_not_found'); END IF;

 SELECT * INTO v_leg FROM public.tour_travel_legs
 WHERE id=p_tour_leg_id FOR SHARE;
 IF NOT FOUND OR v_leg.status='cancelled' OR v_leg.from_city_id IS NULL
   OR v_leg.to_city_id IS NULL OR v_leg.departure_date IS NULL THEN
   RETURN jsonb_build_object('success',false,'reason','invalid_tour_leg');
 END IF;

 SELECT * INTO v_tour FROM public.tours
 WHERE id=v_leg.tour_id;
 IF NOT FOUND OR v_tour.status NOT IN ('active','scheduled','booked')
   OR coalesce(v_tour.cancelled,false) THEN
   RETURN jsonb_build_object('success',false,'reason','tour_not_active');
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.band_members bm
   WHERE bm.band_id=v_tour.band_id AND bm.profile_id=p_profile_id
     AND bm.user_id=p_user_id AND bm.member_status='active'
     AND NOT coalesce(bm.is_touring_member,false)
 ) THEN RETURN jsonb_build_object('success',false,'reason','not_tour_band_member');
 END IF;

 -- Repaired dates are derived solely from tour-leg data; never from a
 -- browser-supplied destination, status, duration or timestamp.
 IF v_leg.arrival_date>v_leg.departure_date
   AND v_leg.arrival_date<=v_leg.departure_date+interval '20 hours' THEN
   v_arrival:=v_leg.arrival_date;
 ELSE
   v_arrival:=v_leg.departure_date+
     (least(20::numeric,greatest(0.5::numeric,coalesce(nullif(v_leg.travel_duration_hours,0),3.5)))*interval '1 hour');
 END IF;
 v_duration:=extract(epoch from (v_arrival-v_leg.departure_date))/3600;
 IF v_arrival<=v_now THEN
   RETURN jsonb_build_object('success',false,'reason','leg_already_finished');
 END IF;
 v_state:=CASE WHEN v_leg.departure_date>v_now THEN 'scheduled' ELSE 'in_progress' END;

 SELECT * INTO v_history FROM public.player_travel_history
 WHERE profile_id=p_profile_id AND tour_leg_id=p_tour_leg_id FOR UPDATE;
 v_existing:=FOUND;
 IF v_existing AND v_history.status IN ('cancelled','completed') THEN
   RETURN jsonb_build_object('success',false,'reason','travel_already_finalized');
 END IF;

 -- The selected character must physically be in the departure city. Do not
 -- teleport them to catch a future tour leg or to join an ongoing journey.
 IF v_profile.current_city_id IS DISTINCT FROM v_leg.from_city_id THEN
   RETURN jsonb_build_object('success',false,'reason','not_in_departure_city',
     'from_city_id',v_leg.from_city_id);
 END IF;
 IF coalesce(v_profile.is_traveling,false)
   AND NOT (v_existing AND v_history.status='in_progress'
     AND v_history.arrival_time=v_arrival) THEN
   RETURN jsonb_build_object('success',false,'reason','another_journey_active');
 END IF;

 SELECT concat_ws(', ',c.name,c.country) INTO v_departure_city
 FROM public.cities c WHERE c.id=v_leg.from_city_id;
 SELECT concat_ws(', ',c.name,c.country) INTO v_arrival_city
 FROM public.cities c WHERE c.id=v_leg.to_city_id;

 IF v_existing THEN
   UPDATE public.player_travel_history SET
     user_id=p_user_id,from_city_id=v_leg.from_city_id,
     to_city_id=v_leg.to_city_id,transport_type=v_leg.travel_mode,
     departure_time=v_leg.departure_date,scheduled_departure_time=v_leg.departure_date,
     arrival_time=v_arrival,travel_duration_hours=v_duration,status=v_state
   WHERE id=v_history.id;
 ELSE
   INSERT INTO public.player_travel_history(
     user_id,profile_id,tour_leg_id,from_city_id,to_city_id,
     transport_type,cost_paid,departure_time,scheduled_departure_time,
     arrival_time,travel_duration_hours,status
   ) VALUES (
     p_user_id,p_profile_id,p_tour_leg_id,v_leg.from_city_id,v_leg.to_city_id,
     v_leg.travel_mode,0,v_leg.departure_date,v_leg.departure_date,
     v_arrival,v_duration,v_state
   ) RETURNING * INTO v_history;
 END IF;

 SELECT * INTO v_schedule FROM public.player_scheduled_activities
 WHERE profile_id=p_profile_id AND activity_type='travel'
   AND metadata->>'tour_leg_id'=p_tour_leg_id::text FOR UPDATE;
 IF FOUND AND v_schedule.status IN ('cancelled','completed') THEN
   RAISE EXCEPTION 'TOUR_REJOIN_SCHEDULE_FINALIZED';
 END IF;

 IF v_schedule.id IS NULL THEN
   INSERT INTO public.player_scheduled_activities(
     user_id,profile_id,activity_type,status,scheduled_start,scheduled_end,
     title,description,location,metadata
   ) VALUES (
     p_user_id,p_profile_id,'travel',v_state,v_leg.departure_date,v_arrival,
     'Tour Travel: '||coalesce(v_departure_city,'Unknown')||' → '||coalesce(v_arrival_city,'Unknown'),
     v_leg.travel_mode||' journey ('||round(v_duration,1)||'h) — Rejoined',
     v_arrival_city,
     jsonb_build_object('travel_history_id',v_history.id,'tour_leg_id',v_leg.id,
       'tour_id',v_tour.id,'from_city_id',v_leg.from_city_id,
       'to_city_id',v_leg.to_city_id,'transport_type',v_leg.travel_mode,
       'rejoined',true)
   ) RETURNING * INTO v_schedule;
 ELSE
   UPDATE public.player_scheduled_activities SET
     status=v_state,scheduled_start=v_leg.departure_date,scheduled_end=v_arrival,
     metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
       'travel_history_id',v_history.id,'tour_leg_id',v_leg.id,
       'tour_id',v_tour.id,'from_city_id',v_leg.from_city_id,
       'to_city_id',v_leg.to_city_id,'rejoined',true)
   WHERE id=v_schedule.id;
 END IF;

 -- Future legs only create bookings. No profile UPDATE or implied position!
 -- In-progress legs can begin only from the actual departure city; this
 -- leaves current_city_id untouched until the regular arrival worker runs.
 IF v_state='in_progress' THEN
   UPDATE public.profiles SET is_traveling=true,travel_arrives_at=v_arrival
   WHERE id=p_profile_id AND user_id=p_user_id;
 END IF;

 IF NOT EXISTS (
   SELECT 1 FROM public.travel_timeline_events
   WHERE profile_id=p_profile_id AND tour_leg_id=p_tour_leg_id
     AND event_type='rejoined'
 ) THEN
   INSERT INTO public.travel_timeline_events(
     profile_id,user_id,band_id,tour_id,tour_leg_id,travel_history_id,
     from_city_id,to_city_id,event_type,message,new_eta,metadata
   ) VALUES (
     p_profile_id,p_user_id,v_tour.band_id,v_tour.id,v_leg.id,v_history.id,
     v_leg.from_city_id,v_leg.to_city_id,'rejoined',
     CASE WHEN v_state='scheduled' THEN 'Scheduled tour transport to ' ELSE
       'Rejoined tour transport — heading to ' END ||coalesce(v_arrival_city,'Unknown'),
     v_arrival,jsonb_build_object('status',v_state,
       'transport_type',v_leg.travel_mode,'source','schedule_tour_rejoin_atomic')
   );
 END IF;

 RETURN jsonb_build_object(
   'success',true,'status',v_state,'tour_leg_id',v_leg.id,
   'travel_history_id',v_history.id,'schedule_id',v_schedule.id,
   'from_city',v_departure_city,'to_city',v_arrival_city,
   'arrival_time',v_arrival,'current_city_unchanged',true,
   'already_booked',v_existing
 );
END;
$fn$;

REVOKE ALL ON FUNCTION public.schedule_tour_rejoin_atomic(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_tour_rejoin_atomic(uuid,uuid,uuid)
 TO service_role;

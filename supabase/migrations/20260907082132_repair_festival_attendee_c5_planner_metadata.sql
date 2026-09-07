-- Production reconciliation: bring the attendee My Day contract up to the C5 shape
-- expected by the current frontend without depending on the later schedule-revision domain.

ALTER TABLE public.festival_attendee_plan_items
  DROP CONSTRAINT IF EXISTS festival_attendee_plan_items_duration_minutes_check;
ALTER TABLE public.festival_attendee_plan_items
  ADD CONSTRAINT festival_attendee_plan_items_duration_minutes_check CHECK (duration_minutes BETWEEN 5 AND 360);

ALTER TABLE public.festival_attendee_plan_items
  DROP CONSTRAINT IF EXISTS festival_attendee_plan_items_activity_type_check;
ALTER TABLE public.festival_attendee_plan_items
  ADD CONSTRAINT festival_attendee_plan_items_activity_type_check CHECK (activity_type IN ('watch_act','eat','drink','explore','rest','camping','vip','vendor','free_time'));

ALTER TABLE public.festival_attendee_plan_items
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS schedule_item_id uuid,
  ADD COLUMN IF NOT EXISTS stage_id uuid,
  ADD COLUMN IF NOT EXISTS location_key text NOT NULL DEFAULT 'site:general',
  ADD COLUMN IF NOT EXISTS location_label text NOT NULL DEFAULT 'Festival site';

ALTER TABLE public.festival_attendee_plan_items
  DROP CONSTRAINT IF EXISTS festival_attendee_plan_items_source_check;
ALTER TABLE public.festival_attendee_plan_items
  ADD CONSTRAINT festival_attendee_plan_items_source_check CHECK (source IN ('manual','stage_schedule'));
ALTER TABLE public.festival_attendee_plan_items
  DROP CONSTRAINT IF EXISTS festival_attendee_plan_items_schedule_booking_fkey;
ALTER TABLE public.festival_attendee_plan_items
  ADD CONSTRAINT festival_attendee_plan_items_schedule_booking_fkey FOREIGN KEY (schedule_item_id) REFERENCES public.festival_artist_bookings(id) ON DELETE SET NULL;
ALTER TABLE public.festival_attendee_plan_items
  DROP CONSTRAINT IF EXISTS festival_attendee_plan_items_stage_id_fkey;
ALTER TABLE public.festival_attendee_plan_items
  ADD CONSTRAINT festival_attendee_plan_items_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.festival_site_plan_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS festival_attendee_plan_items_schedule_item_idx ON public.festival_attendee_plan_items(attendance_id,schedule_item_id) WHERE schedule_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_attendee_plan_items_active_schedule_uidx ON public.festival_attendee_plan_items(attendance_id,schedule_item_id) WHERE schedule_item_id IS NOT NULL AND status='planned';

CREATE OR REPLACE FUNCTION public._festival_plan_location_key(p_activity_type text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT CASE p_activity_type WHEN 'eat' THEN 'area:food' WHEN 'drink' THEN 'area:bar' WHEN 'rest' THEN 'area:rest' WHEN 'camping' THEN 'area:camping' WHEN 'vip' THEN 'area:vip' WHEN 'vendor' THEN 'area:vendors' ELSE 'site:general' END
$$;
CREATE OR REPLACE FUNCTION public._festival_plan_location_label(p_activity_type text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT CASE p_activity_type WHEN 'eat' THEN 'Food area' WHEN 'drink' THEN 'Bar area' WHEN 'rest' THEN 'Rest area' WHEN 'camping' THEN 'Campsite' WHEN 'vip' THEN 'VIP area' WHEN 'vendor' THEN 'Vendor area' ELSE 'Festival site' END
$$;
CREATE OR REPLACE FUNCTION public._festival_plan_travel_minutes(p_from_location text,p_to_location text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT CASE WHEN p_from_location IS NULL OR p_to_location IS NULL THEN 0 WHEN p_from_location=p_to_location THEN 0 WHEN p_from_location='area:camping' OR p_to_location='area:camping' THEN 20 WHEN p_from_location LIKE 'stage:%' AND p_to_location LIKE 'stage:%' THEN 15 WHEN p_from_location LIKE 'stage:%' OR p_to_location LIKE 'stage:%' THEN 10 ELSE 5 END
$$;

CREATE OR REPLACE FUNCTION public._festival_plan_preview_window(p_attendance_id uuid,p_festival_date date,p_start_at timestamptz,p_end_at timestamptz,p_activity_type text,p_location_key text,p_location_label text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  c jsonb; profile_id uuid; tz text; starts_on date; ends_on date;
  prev public.festival_attendee_plan_items%ROWTYPE; nxt public.festival_attendee_plan_items%ROWTYPE; overlap_item public.festival_attendee_plan_items%ROWTYPE;
  before_minutes integer:=0; after_minutes integer:=0; blockers jsonb:='[]'::jsonb; warnings jsonb:='[]'::jsonb;
BEGIN
  c:=public._festival_day_plan_context(p_attendance_id); profile_id:=(c->>'profileId')::uuid; tz:=c->>'timezone'; starts_on:=(c->>'startsOn')::date; ends_on:=(c->>'endsOn')::date;
  IF p_activity_type NOT IN ('watch_act','eat','drink','explore','rest','camping','vip','vendor','free_time') THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','festival_plan_activity_invalid','message','That Festival activity type is not available.')); END IF;
  IF p_festival_date IS NULL OR p_festival_date<starts_on OR p_festival_date>ends_on THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','festival_plan_date_outside_event','message','Choose a day within this Festival edition.')); END IF;
  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at<=p_start_at THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','festival_plan_window_invalid','message','The planned time window is invalid.'));
  ELSE
    IF p_start_at<now() THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','festival_plan_start_in_past','message','Festival plans must start in the future.')); END IF;
    IF (p_start_at AT TIME ZONE tz)::date<>p_festival_date OR ((p_end_at-interval '1 microsecond') AT TIME ZONE tz)::date<>p_festival_date THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','festival_plan_crosses_day_boundary','message','A Festival plan block must stay within one Festival day.')); END IF;
    SELECT i.* INTO overlap_item FROM public.festival_attendee_plan_items i WHERE i.attendance_id=p_attendance_id AND i.profile_id=profile_id AND i.status='planned' AND tstzrange(i.starts_at,i.ends_at,'[)')&&tstzrange(p_start_at,p_end_at,'[)') ORDER BY i.starts_at LIMIT 1;
    IF FOUND THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','festival_plan_overlap','message','This block overlaps '||overlap_item.title||'.','conflictingItemId',overlap_item.id)); END IF;
    SELECT i.* INTO prev FROM public.festival_attendee_plan_items i WHERE i.attendance_id=p_attendance_id AND i.profile_id=profile_id AND i.status='planned' AND i.ends_at<=p_start_at ORDER BY i.ends_at DESC,i.created_at DESC LIMIT 1;
    IF FOUND THEN before_minutes:=public._festival_plan_travel_minutes(prev.location_key,p_location_key); IF prev.ends_at+make_interval(mins=>before_minutes)>p_start_at THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','festival_plan_travel_conflict','message','There is not enough travel time after '||prev.title||'.','conflictingItemId',prev.id,'requiredTravelMinutes',before_minutes)); ELSIF before_minutes>0 THEN warnings:=warnings||jsonb_build_array(jsonb_build_object('code','festival_plan_travel_before','message','Allow '||before_minutes||' minutes to get here from '||prev.location_label||'.','minutes',before_minutes)); END IF; END IF;
    SELECT i.* INTO nxt FROM public.festival_attendee_plan_items i WHERE i.attendance_id=p_attendance_id AND i.profile_id=profile_id AND i.status='planned' AND i.starts_at>=p_end_at ORDER BY i.starts_at,i.created_at LIMIT 1;
    IF FOUND THEN after_minutes:=public._festival_plan_travel_minutes(p_location_key,nxt.location_key); IF p_end_at+make_interval(mins=>after_minutes)>nxt.starts_at THEN blockers:=blockers||jsonb_build_array(jsonb_build_object('code','festival_plan_travel_conflict','message','There is not enough travel time before '||nxt.title||'.','conflictingItemId',nxt.id,'requiredTravelMinutes',after_minutes)); ELSIF after_minutes>0 THEN warnings:=warnings||jsonb_build_array(jsonb_build_object('code','festival_plan_travel_after','message','Allow '||after_minutes||' minutes afterwards to reach '||nxt.location_label||'.','minutes',after_minutes)); END IF; END IF;
  END IF;
  RETURN jsonb_build_object('feasible',jsonb_array_length(blockers)=0,'startsAt',p_start_at,'endsAt',p_end_at,'locationKey',p_location_key,'locationLabel',p_location_label,'travelBeforeMinutes',before_minutes,'travelAfterMinutes',after_minutes,'blockers',blockers,'warnings',warnings);
END $$;

CREATE OR REPLACE FUNCTION public.preview_festival_day_plan_item(p_attendance_id uuid,p_festival_date date,p_local_start time without time zone,p_duration_minutes integer,p_activity_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE c jsonb; tz text; start_at timestamptz; end_at timestamptz;
BEGIN
  IF p_festival_date IS NULL THEN RAISE EXCEPTION 'festival_plan_date_required' USING ERRCODE='P0001'; END IF;
  IF p_local_start IS NULL THEN RAISE EXCEPTION 'festival_plan_start_required' USING ERRCODE='P0001'; END IF;
  IF p_duration_minutes NOT IN(30,60,90) THEN RAISE EXCEPTION 'festival_plan_duration_invalid' USING ERRCODE='P0001'; END IF;
  IF extract(second FROM p_local_start)<>0 OR mod(extract(minute FROM p_local_start)::integer,30)<>0 THEN RAISE EXCEPTION 'festival_plan_start_grid_invalid' USING ERRCODE='P0001'; END IF;
  c:=public._festival_day_plan_context(p_attendance_id); tz:=c->>'timezone'; start_at:=(p_festival_date+p_local_start) AT TIME ZONE tz; end_at:=start_at+make_interval(mins=>p_duration_minutes);
  RETURN public._festival_plan_preview_window(p_attendance_id,p_festival_date,start_at,end_at,p_activity_type,public._festival_plan_location_key(p_activity_type),public._festival_plan_location_label(p_activity_type));
END $$;

CREATE OR REPLACE FUNCTION public.create_festival_day_plan_item(p_attendance_id uuid,p_festival_date date,p_local_start time without time zone,p_duration_minutes integer,p_activity_type text,p_title text,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE c jsonb; profile_id uuid; edition_id uuid; tz text; start_at timestamptz; end_at timestamptz; existing public.festival_attendee_plan_items%ROWTYPE; item public.festival_attendee_plan_items%ROWTYPE; preview jsonb; code text; loc_key text; loc_label text;
BEGIN
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'festival_plan_idempotency_required' USING ERRCODE='P0001'; END IF;
  IF p_festival_date IS NULL OR p_local_start IS NULL OR p_duration_minutes NOT IN(30,60,90) THEN RAISE EXCEPTION 'festival_plan_invalid' USING ERRCODE='P0001'; END IF;
  IF p_activity_type='watch_act' THEN RAISE EXCEPTION 'festival_plan_watch_act_requires_stage_schedule' USING ERRCODE='P0001'; END IF;
  IF p_activity_type NOT IN('eat','drink','explore','rest','camping','vip','vendor','free_time') THEN RAISE EXCEPTION 'festival_plan_activity_invalid' USING ERRCODE='P0001'; END IF;
  IF NULLIF(btrim(p_title),'') IS NULL OR char_length(btrim(p_title))>120 THEN RAISE EXCEPTION 'festival_plan_title_invalid' USING ERRCODE='P0001'; END IF;
  c:=public._festival_day_plan_context(p_attendance_id); profile_id:=(c->>'profileId')::uuid; edition_id:=(c->>'festivalEditionId')::uuid; tz:=c->>'timezone'; start_at:=(p_festival_date+p_local_start) AT TIME ZONE tz; end_at:=start_at+make_interval(mins=>p_duration_minutes); loc_key:=public._festival_plan_location_key(p_activity_type); loc_label:=public._festival_plan_location_label(p_activity_type);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_attendance_id::text||':festival-plan:'||p_idempotency_key::text,0));
  SELECT i.* INTO existing FROM public.festival_attendee_plan_items i WHERE i.attendance_id=p_attendance_id AND i.idempotency_key=p_idempotency_key;
  IF FOUND THEN IF existing.festival_date<>p_festival_date OR existing.starts_at<>start_at OR existing.ends_at<>end_at OR existing.duration_minutes<>p_duration_minutes OR existing.activity_type<>p_activity_type OR existing.title<>btrim(p_title) THEN RAISE EXCEPTION 'festival_plan_idempotency_conflict' USING ERRCODE='P0001'; END IF; RETURN jsonb_build_object('id',existing.id,'status',existing.status,'startsAt',existing.starts_at,'endsAt',existing.ends_at,'duplicate',true); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_attendance_id::text||':festival-date:'||p_festival_date::text,0));
  preview:=public.preview_festival_day_plan_item(p_attendance_id,p_festival_date,p_local_start,p_duration_minutes,p_activity_type); IF NOT coalesce((preview->>'feasible')::boolean,false) THEN code:=preview->'blockers'->0->>'code'; RAISE EXCEPTION '%',coalesce(code,'festival_plan_not_feasible') USING ERRCODE='P0001'; END IF;
  INSERT INTO public.festival_attendee_plan_items(attendance_id,festival_edition_id,profile_id,festival_date,starts_at,ends_at,duration_minutes,activity_type,title,idempotency_key,source,location_key,location_label) VALUES(p_attendance_id,edition_id,profile_id,p_festival_date,start_at,end_at,p_duration_minutes,p_activity_type,btrim(p_title),p_idempotency_key,'manual',loc_key,loc_label) RETURNING * INTO item;
  RETURN jsonb_build_object('id',item.id,'status',item.status,'startsAt',item.starts_at,'endsAt',item.ends_at,'duplicate',false);
END $$;

CREATE OR REPLACE FUNCTION public.get_my_festival_day_plan(p_attendance_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE c jsonb; profile_id uuid; starts_on date; ends_on date; items jsonb; days jsonb; nxt jsonb;
BEGIN
 c:=public._festival_day_plan_context(p_attendance_id); profile_id:=(c->>'profileId')::uuid; starts_on:=(c->>'startsOn')::date; ends_on:=(c->>'endsOn')::date;
 UPDATE public.festival_attendee_plan_items i SET status='missed',resolved_at=coalesce(i.resolved_at,i.ends_at),updated_at=now() WHERE i.attendance_id=p_attendance_id AND i.profile_id=profile_id AND i.status='planned' AND i.ends_at<=now();
 SELECT coalesce(jsonb_agg(jsonb_build_object('date',d.day_value::date,'dayNumber',((d.day_value::date-starts_on)+1)) ORDER BY d.day_value),'[]'::jsonb) INTO days FROM generate_series(starts_on::timestamp,ends_on::timestamp,interval '1 day') d(day_value);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'attendanceId',i.attendance_id,'festivalEditionId',i.festival_edition_id,'festivalDate',i.festival_date,'startsAt',i.starts_at,'endsAt',i.ends_at,'durationMinutes',i.duration_minutes,'activityType',i.activity_type,'title',i.title,'status',i.status,'resolvedAt',i.resolved_at,'createdAt',i.created_at,'source',i.source,'scheduleItemId',i.schedule_item_id,'stageId',i.stage_id,'locationKey',i.location_key,'locationLabel',i.location_label,'travelBeforeMinutes',0,'travelAfterMinutes',0) ORDER BY i.starts_at,i.created_at),'[]'::jsonb) INTO items FROM public.festival_attendee_plan_items i WHERE i.attendance_id=p_attendance_id AND i.profile_id=profile_id;
 SELECT jsonb_build_object('id',i.id,'festivalDate',i.festival_date,'startsAt',i.starts_at,'endsAt',i.ends_at,'durationMinutes',i.duration_minutes,'activityType',i.activity_type,'title',i.title,'status',i.status,'source',i.source,'scheduleItemId',i.schedule_item_id,'stageId',i.stage_id,'locationKey',i.location_key,'locationLabel',i.location_label,'travelBeforeMinutes',0,'travelAfterMinutes',0) INTO nxt FROM public.festival_attendee_plan_items i WHERE i.attendance_id=p_attendance_id AND i.profile_id=profile_id AND i.status='planned' AND i.ends_at>now() ORDER BY i.starts_at,i.created_at LIMIT 1;
 RETURN (c-'profileId')||jsonb_build_object('days',days,'items',items,'nextActivity',nxt,'serverNow',now());
END $$;

REVOKE ALL ON FUNCTION public._festival_plan_location_key(text),public._festival_plan_location_label(text),public._festival_plan_travel_minutes(text,text),public._festival_plan_preview_window(uuid,date,timestamptz,timestamptz,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._festival_plan_location_key(text),public._festival_plan_location_label(text),public._festival_plan_travel_minutes(text,text),public._festival_plan_preview_window(uuid,date,timestamptz,timestamptz,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.preview_festival_day_plan_item(uuid,date,time without time zone,integer,text),public.create_festival_day_plan_item(uuid,date,time without time zone,integer,text,text,uuid),public.get_my_festival_day_plan(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.preview_festival_day_plan_item(uuid,date,time without time zone,integer,text),public.create_festival_day_plan_item(uuid,date,time without time zone,integer,text,text,uuid),public.get_my_festival_day_plan(uuid) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
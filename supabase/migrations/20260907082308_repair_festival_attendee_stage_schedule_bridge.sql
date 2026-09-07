-- Production reconciliation: expose the simplified Festival booking timetable to
-- both the public Festival projection and attendee Festival Mode. The live system
-- uses artist bookings + site-plan stages; later schedule-revision migrations may
-- supersede this compatibility layer.

CREATE OR REPLACE FUNCTION public._festival_simplified_timetable_projection(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_timezone text := 'UTC';
  v_items jsonb := '[]'::jsonb;
BEGIN
  SELECT coalesce(nullif(c.timezone,''),'UTC') INTO v_timezone
  FROM public.festival_editions_v2 e
  LEFT JOIN public.cities c ON c.id=e.city_id
  WHERE e.id=p_edition_id;

  WITH stages AS (
    SELECT st.id,st.name,st.sort_order
    FROM public.festival_site_plan_stages st
    JOIN public.festival_site_plans sp ON sp.id=st.festival_site_plan_id
    WHERE sp.festival_edition_id=p_edition_id AND st.status='ready'
    ORDER BY st.sort_order,st.id
  ), booked AS (
    SELECT b.id,b.artist_type,b.artist_profile_id,b.band_id,b.npc_artist_id,b.set_minutes,b.billing_position,
           coalesce(b.provisional_date,e.starts_on) festival_date,b.confirmed_at,
           coalesce(bd.name,pr.display_name,pr.username,'Confirmed act') artist_name,
           bd.genre,
           greatest(0,coalesce(bd.fame,pr.fame,0)) fame,
           b.provisional_stage_id,
           row_number() OVER (
             PARTITION BY coalesce(b.provisional_date,e.starts_on)
             ORDER BY CASE b.billing_position WHEN 'emerging' THEN 10 WHEN 'support' THEN 20 WHEN 'special_guest' THEN 30 WHEN 'featured' THEN 40 WHEN 'sub_headliner' THEN 50 WHEN 'headliner' THEN 60 ELSE 20 END,
                      b.confirmed_at,b.id
           ) rn
    FROM public.festival_artist_bookings b
    JOIN public.festival_artist_programmes ap ON ap.id=b.festival_artist_programme_id
    JOIN public.festival_editions_v2 e ON e.id=ap.festival_edition_id
    LEFT JOIN public.bands bd ON bd.id=b.band_id
    LEFT JOIN public.profiles pr ON pr.id=b.artist_profile_id
    WHERE ap.festival_edition_id=p_edition_id
      AND b.status NOT IN ('cancelled','withdrawn','artist_withdrawn','festival_cancelled')
      AND coalesce(b.provisional_date,e.starts_on) IS NOT NULL
  ), scheduled AS (
    SELECT b.*,
      coalesce(
        (SELECT s.id FROM stages s WHERE s.id=b.provisional_stage_id LIMIT 1),
        (SELECT s.id FROM stages s ORDER BY s.sort_order,s.id OFFSET ((b.rn-1)%greatest(1,(SELECT count(*) FROM stages))) LIMIT 1)
      ) stage_id,
      ((b.festival_date::timestamp + time '14:00')
        + make_interval(mins => (((b.rn-1)/greatest(1,(SELECT count(*) FROM stages)))::integer*90))) AT TIME ZONE v_timezone AS starts_at
    FROM booked b
    WHERE EXISTS(SELECT 1 FROM stages)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,
    'artistName',s.artist_name,
    'artistType',CASE WHEN s.band_id IS NOT NULL THEN 'band' WHEN s.artist_profile_id IS NOT NULL THEN 'player' ELSE 'npc' END,
    'artistId',coalesce(s.band_id,s.artist_profile_id),
    'genre',s.genre,
    'fame',s.fame,
    'stageId',s.stage_id,
    'stageName',coalesce((SELECT st.name FROM stages st WHERE st.id=s.stage_id),'Main Stage'),
    'festivalDate',s.festival_date,
    'startsAt',s.starts_at,
    'endsAt',s.starts_at+make_interval(mins=>greatest(10,coalesce(s.set_minutes,45))),
    'headline',coalesce(s.billing_position,'')='headliner'
  ) ORDER BY s.festival_date,s.starts_at,s.id),'[]'::jsonb)
  INTO v_items
  FROM scheduled s;

  RETURN v_items;
END $$;

CREATE OR REPLACE FUNCTION public.festival_public_projection_v2(p_festival_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE base jsonb; edition_id uuid; timetable jsonb;
BEGIN
  base:=public.festival_public_projection(p_festival_company_id);
  IF base IS NULL THEN RETURN NULL; END IF;
  SELECT e.id INTO edition_id FROM public.festival_editions_v2 e
  WHERE e.festival_company_id=p_festival_company_id AND e.status NOT IN ('cancelled','cancelled_before_event')
  ORDER BY e.edition_year DESC,e.created_at DESC LIMIT 1;
  IF edition_id IS NULL THEN RETURN base; END IF;
  timetable:=public._festival_simplified_timetable_projection(edition_id);
  RETURN jsonb_set(base,'{timetable}',coalesce(timetable,'[]'::jsonb),true);
END $$;

CREATE OR REPLACE FUNCTION public.get_public_festival(p_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_company uuid;
BEGIN
  SELECT l.festival_company_id INTO v_company
  FROM public.festival_launches l
  LEFT JOIN public.festival_public_profiles p ON p.festival_company_id=l.festival_company_id
  WHERE (l.public_slug=p_slug OR p.public_slug=p_slug)
    AND l.launch_status IN ('launched','tickets_on_sale','sales_paused','sales_closed')
  LIMIT 1;
  IF v_company IS NULL THEN RAISE EXCEPTION 'festival_launch_unavailable'; END IF;
  RETURN public.festival_public_projection_v2(v_company);
END $$;

CREATE OR REPLACE FUNCTION public.get_public_festival_directory(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT coalesce(jsonb_agg(proj ORDER BY proj->>'startsAt'),'[]'::jsonb)
  FROM (
    SELECT public.festival_public_projection_v2(l.festival_company_id) proj
    FROM public.festival_launches l
    WHERE l.launch_status IN ('launched','tickets_on_sale','sales_paused','sales_closed') AND l.public_visibility='public'
  ) s WHERE proj IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.get_my_festival_stage_schedule(p_attendance_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE c jsonb; profile_id uuid; edition_id uuid; starts_on date; ends_on date; raw jsonb; items jsonb; days jsonb;
BEGIN
  c:=public._festival_day_plan_context(p_attendance_id); profile_id:=(c->>'profileId')::uuid; edition_id:=(c->>'festivalEditionId')::uuid; starts_on:=(c->>'startsOn')::date; ends_on:=(c->>'endsOn')::date;
  raw:=public._festival_simplified_timetable_projection(edition_id);
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',(x->>'id')::uuid,'festivalDate',x->>'festivalDate','startsAt',x->>'startsAt','endsAt',x->>'endsAt',
    'durationMinutes',greatest(5,ceil(extract(epoch FROM ((x->>'endsAt')::timestamptz-(x->>'startsAt')::timestamptz))/60.0)::integer),
    'stageId',(x->>'stageId')::uuid,'stageName',x->>'stageName','artistName',x->>'artistName','title',x->>'artistName',
    'locationKey','stage:'||(x->>'stageId'),'isPlanned',EXISTS(SELECT 1 FROM public.festival_attendee_plan_items p WHERE p.attendance_id=p_attendance_id AND p.profile_id=profile_id AND p.schedule_item_id=(x->>'id')::uuid AND p.status='planned'),
    'plannedItemId',(SELECT p.id FROM public.festival_attendee_plan_items p WHERE p.attendance_id=p_attendance_id AND p.profile_id=profile_id AND p.schedule_item_id=(x->>'id')::uuid AND p.status='planned' ORDER BY p.created_at DESC LIMIT 1)
  ) ORDER BY (x->>'festivalDate')::date,(x->>'startsAt')::timestamptz),'[]'::jsonb) INTO items
  FROM jsonb_array_elements(coalesce(raw,'[]'::jsonb)) x;
  SELECT coalesce(jsonb_agg(jsonb_build_object('date',d.day_value::date,'dayNumber',((d.day_value::date-starts_on)+1)) ORDER BY d.day_value),'[]'::jsonb) INTO days FROM generate_series(starts_on::timestamp,ends_on::timestamp,interval '1 day') d(day_value);
  RETURN jsonb_build_object('attendanceId',p_attendance_id,'festivalEditionId',edition_id,'revisionId',NULL,'scheduleState',CASE WHEN jsonb_array_length(coalesce(items,'[]'::jsonb))>0 THEN 'published' ELSE NULL END,'scheduleAvailable',jsonb_array_length(coalesce(items,'[]'::jsonb))>0,'timezone',c->>'timezone','days',days,'items',coalesce(items,'[]'::jsonb),'serverNow',now());
END $$;

CREATE OR REPLACE FUNCTION public.preview_festival_stage_plan_item(p_attendance_id uuid,p_schedule_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE c jsonb; edition_id uuid; profile_id uuid; x jsonb; result jsonb; existing uuid; blockers jsonb;
BEGIN
  c:=public._festival_day_plan_context(p_attendance_id); edition_id:=(c->>'festivalEditionId')::uuid; profile_id:=(c->>'profileId')::uuid;
  SELECT value INTO x FROM jsonb_array_elements(public._festival_simplified_timetable_projection(edition_id)) value WHERE (value->>'id')::uuid=p_schedule_item_id LIMIT 1;
  IF x IS NULL THEN RAISE EXCEPTION 'festival_stage_schedule_item_unavailable' USING ERRCODE='P0001'; END IF;
  result:=public._festival_plan_preview_window(p_attendance_id,(x->>'festivalDate')::date,(x->>'startsAt')::timestamptz,(x->>'endsAt')::timestamptz,'watch_act','stage:'||(x->>'stageId'),x->>'stageName');
  SELECT p.id INTO existing FROM public.festival_attendee_plan_items p WHERE p.attendance_id=p_attendance_id AND p.profile_id=profile_id AND p.schedule_item_id=p_schedule_item_id AND p.status='planned' ORDER BY p.created_at DESC LIMIT 1;
  IF existing IS NOT NULL THEN blockers:=coalesce(result->'blockers','[]'::jsonb)||jsonb_build_array(jsonb_build_object('code','festival_stage_schedule_already_planned','message','This performance is already in My Day.','conflictingItemId',existing)); result:=jsonb_set(result,'{blockers}',blockers,true); result:=jsonb_set(result,'{feasible}','false'::jsonb,true); END IF;
  RETURN result||jsonb_build_object('scheduleItemId',p_schedule_item_id,'stageId',(x->>'stageId')::uuid,'stageName',x->>'stageName','artistName',x->>'artistName','title',x->>'artistName','festivalDate',x->>'festivalDate');
END $$;

CREATE OR REPLACE FUNCTION public.add_festival_stage_performance_to_day_plan(p_attendance_id uuid,p_schedule_item_id uuid,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE c jsonb; profile_id uuid; edition_id uuid; x jsonb; preview jsonb; existing public.festival_attendee_plan_items%ROWTYPE; item public.festival_attendee_plan_items%ROWTYPE; code text; duration integer;
BEGIN
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'festival_plan_idempotency_required' USING ERRCODE='P0001'; END IF;
  c:=public._festival_day_plan_context(p_attendance_id); profile_id:=(c->>'profileId')::uuid; edition_id:=(c->>'festivalEditionId')::uuid;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_attendance_id::text||':festival-stage-plan:'||p_idempotency_key::text,0));
  SELECT p.* INTO existing FROM public.festival_attendee_plan_items p WHERE p.attendance_id=p_attendance_id AND p.idempotency_key=p_idempotency_key;
  IF FOUND THEN IF existing.schedule_item_id IS DISTINCT FROM p_schedule_item_id THEN RAISE EXCEPTION 'festival_plan_idempotency_conflict' USING ERRCODE='P0001'; END IF; RETURN jsonb_build_object('id',existing.id,'status',existing.status,'startsAt',existing.starts_at,'endsAt',existing.ends_at,'duplicate',true); END IF;
  preview:=public.preview_festival_stage_plan_item(p_attendance_id,p_schedule_item_id); IF NOT coalesce((preview->>'feasible')::boolean,false) THEN code:=preview->'blockers'->0->>'code'; RAISE EXCEPTION '%',coalesce(code,'festival_plan_not_feasible') USING ERRCODE='P0001'; END IF;
  SELECT value INTO x FROM jsonb_array_elements(public._festival_simplified_timetable_projection(edition_id)) value WHERE (value->>'id')::uuid=p_schedule_item_id LIMIT 1;
  IF x IS NULL THEN RAISE EXCEPTION 'festival_stage_schedule_item_unavailable' USING ERRCODE='P0001'; END IF;
  duration:=greatest(5,ceil(extract(epoch FROM ((x->>'endsAt')::timestamptz-(x->>'startsAt')::timestamptz))/60.0)::integer);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_attendance_id::text||':festival-date:'||(x->>'festivalDate'),0));
  preview:=public.preview_festival_stage_plan_item(p_attendance_id,p_schedule_item_id); IF NOT coalesce((preview->>'feasible')::boolean,false) THEN code:=preview->'blockers'->0->>'code'; RAISE EXCEPTION '%',coalesce(code,'festival_plan_not_feasible') USING ERRCODE='P0001'; END IF;
  INSERT INTO public.festival_attendee_plan_items(attendance_id,festival_edition_id,profile_id,festival_date,starts_at,ends_at,duration_minutes,activity_type,title,status,idempotency_key,source,schedule_item_id,stage_id,location_key,location_label)
  VALUES(p_attendance_id,edition_id,profile_id,(x->>'festivalDate')::date,(x->>'startsAt')::timestamptz,(x->>'endsAt')::timestamptz,duration,'watch_act',x->>'artistName','planned',p_idempotency_key,'stage_schedule',p_schedule_item_id,(x->>'stageId')::uuid,'stage:'||(x->>'stageId'),x->>'stageName') RETURNING * INTO item;
  RETURN jsonb_build_object('id',item.id,'status',item.status,'startsAt',item.starts_at,'endsAt',item.ends_at,'duplicate',false);
END $$;

REVOKE ALL ON FUNCTION public._festival_simplified_timetable_projection(uuid),public.festival_public_projection_v2(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._festival_simplified_timetable_projection(uuid),public.festival_public_projection_v2(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_my_festival_stage_schedule(uuid),public.preview_festival_stage_plan_item(uuid,uuid),public.add_festival_stage_performance_to_day_plan(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_stage_schedule(uuid),public.preview_festival_stage_plan_item(uuid,uuid),public.add_festival_stage_performance_to_day_plan(uuid,uuid,uuid) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
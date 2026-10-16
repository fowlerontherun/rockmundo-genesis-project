-- Extends production repair 20261016053201 while preserving venue/recording/rehearsal upgrades.
-- Adds ONLY venue/recording/rehearsal staff and security guards with server-calculated
-- salaries/skill-based pricing, owner check, max-guard capacity and stable request ids.
-- Equipment purchases remain intentionally unsupported. Server deployment is recorded separately.
CREATE TABLE IF NOT EXISTS public.subsidiary_staff_hire_requests (
  actor_user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('venue_staff','recording_staff','rehearsal_staff','security_guard')),
  subsidiary_id uuid NOT NULL,
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_user_id,request_id)
);
ALTER TABLE public.subsidiary_staff_hire_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subsidiary_staff_hire_requests FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._hire_subsidiary_staff_atomic(
 p_kind text,p_subsidiary_id uuid,p_fields jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,extensions,pg_temp AS $hire$
DECLARE
 v_actor uuid:=auth.uid();
 v_req uuid;
 v_name text;
 v_role text;
 v_specialty text;
 v_skill integer;
 v_company_id uuid;
 v_max_guards integer;
 v_salary numeric;
 v_charge numeric;
 v_base numeric;
 v_result jsonb;
 v_hash text;
 v_previous public.subsidiary_staff_hire_requests%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR jsonb_typeof(p_fields) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'authenticated_staff_payload_required'; END IF;
 IF p_kind NOT IN ('venue_staff','recording_staff','rehearsal_staff','security_guard') OR p_kind IS NULL
 THEN RAISE EXCEPTION 'unsupported_staff_kind'; END IF;
 IF p_fields->>'request_id' IS NULL THEN RAISE EXCEPTION 'request_id_required'; END IF;
 v_req := (p_fields->>'request_id')::uuid;
 v_name := btrim(coalesce(p_fields->>'name',''));
 IF char_length(v_name) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'invalid_staff_name'; END IF;
 v_role := coalesce(p_fields->>'role','');
 v_hash := encode(extensions.digest(p_kind||'|'||p_subsidiary_id::text||'|'||p_fields::text,'sha256'),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text||':'||v_req::text,0));
 SELECT * INTO v_previous FROM public.subsidiary_staff_hire_requests
  WHERE actor_user_id=v_actor AND request_id=v_req FOR UPDATE;
 IF FOUND THEN
  IF v_previous.kind IS DISTINCT FROM p_kind OR v_previous.subsidiary_id IS DISTINCT FROM p_subsidiary_id
   OR v_previous.request_hash IS DISTINCT FROM v_hash
  THEN RAISE EXCEPTION 'staff_hire_request_conflict'; END IF;
  RETURN v_previous.result;
 END IF;

 IF p_kind='venue_staff' THEN
   SELECT company_id INTO v_company_id FROM public.venues WHERE id=p_subsidiary_id FOR UPDATE;
   v_base := CASE v_role WHEN 'manager' THEN 800 WHEN 'sound_engineer' THEN 600
    WHEN 'lighting_tech' THEN 500 WHEN 'security' THEN 450 WHEN 'bartender' THEN 350
    WHEN 'door_staff' THEN 300 WHEN 'cleaner' THEN 250 WHEN 'stage_hand' THEN 400 END;
   IF v_base IS NULL THEN RAISE EXCEPTION 'unknown_venue_staff_role'; END IF;
   v_skill := 1; -- venue staff always begin at skill 1
   v_salary := v_base;
   v_charge := v_salary*4;
 ELSIF p_kind='recording_staff' THEN
   SELECT company_id INTO v_company_id FROM public.city_studios WHERE id=p_subsidiary_id FOR UPDATE;
   v_base := CASE v_role WHEN 'chief_engineer' THEN 1200 WHEN 'assistant_engineer' THEN 800
    WHEN 'producer' THEN 1000 WHEN 'studio_manager' THEN 900 WHEN 'maintenance_tech' THEN 600
    WHEN 'runner' THEN 400 END;
   IF v_base IS NULL THEN RAISE EXCEPTION 'unknown_recording_staff_role'; END IF;
   v_skill := coalesce((p_fields->>'skill_level')::integer,50);
   IF v_skill NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'invalid_staff_skill'; END IF;
   v_specialty := coalesce(nullif(btrim(p_fields->>'specialty'),''),'all_genres');
   IF v_specialty NOT IN ('rock','pop','hip_hop','electronic','jazz','classical','metal','country','all_genres')
   THEN RAISE EXCEPTION 'invalid_studio_staff_specialty'; END IF;
   v_salary := round(v_base * (0.5::numeric + v_skill::numeric*0.015::numeric));
   v_charge := v_salary;
 ELSIF p_kind='rehearsal_staff' THEN
   SELECT company_id INTO v_company_id FROM public.rehearsal_rooms WHERE id=p_subsidiary_id FOR UPDATE;
   v_base := CASE v_role WHEN 'manager' THEN 800 WHEN 'technician' THEN 600
    WHEN 'receptionist' THEN 400 WHEN 'security' THEN 500 WHEN 'maintenance' THEN 450 END;
   IF v_base IS NULL THEN RAISE EXCEPTION 'unknown_rehearsal_staff_role'; END IF;
   v_skill := coalesce((p_fields->>'skill_level')::integer,50);
   IF v_skill NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'invalid_staff_skill'; END IF;
   v_salary := round(v_base * (0.5::numeric + v_skill::numeric*0.015::numeric));
   v_charge := v_salary;
 ELSE
   SELECT company_id,max_guards INTO v_company_id,v_max_guards FROM public.security_firms
   WHERE id=p_subsidiary_id FOR UPDATE;
   v_skill := coalesce((p_fields->>'skill_level')::integer,3);
   v_salary := CASE v_skill WHEN 1 THEN 50 WHEN 2 THEN 75 WHEN 3 THEN 100 WHEN 4 THEN 150
    WHEN 5 THEN 200 WHEN 6 THEN 300 WHEN 7 THEN 450 WHEN 8 THEN 600
    WHEN 9 THEN 800 WHEN 10 THEN 1000 END;
   IF v_salary IS NULL THEN RAISE EXCEPTION 'invalid_guard_skill'; END IF;
   IF (SELECT count(*) FROM public.security_guards WHERE security_firm_id=p_subsidiary_id
      AND status IS DISTINCT FROM 'inactive') >= coalesce(v_max_guards,0)
   THEN RAISE EXCEPTION 'security_firm_guard_capacity_reached'; END IF;
   v_charge := v_salary*10;
 END IF;
 IF v_company_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.companies WHERE id=v_company_id AND owner_id=v_actor
 ) THEN RAISE EXCEPTION 'subsidiary_not_owned'; END IF;
 PERFORM public.deduct_company_balance(
   v_company_id,v_charge,'Hire subsidiary staff: '||p_kind||' - '||v_name,
   'staff','subsidiary-staff-'||v_req::text
 );
 IF p_kind='venue_staff' THEN
   INSERT INTO public.venue_staff(venue_id,name,role,skill_level,salary_weekly)
   VALUES(p_subsidiary_id,v_name,v_role,v_skill,v_salary)
   RETURNING to_jsonb(venue_staff.*) INTO v_result;
 ELSIF p_kind='recording_staff' THEN
   INSERT INTO public.recording_studio_staff(studio_id,name,role,skill_level,specialty,salary)
   VALUES(p_subsidiary_id,v_name,v_role,v_skill,v_specialty,v_salary)
   RETURNING to_jsonb(recording_studio_staff.*) INTO v_result;
 ELSIF p_kind='rehearsal_staff' THEN
   INSERT INTO public.rehearsal_room_staff(room_id,name,role,skill_level,salary)
   VALUES(p_subsidiary_id,v_name,v_role,v_skill,v_salary)
   RETURNING to_jsonb(rehearsal_room_staff.*) INTO v_result;
 ELSE
   INSERT INTO public.security_guards(security_firm_id,name,skill_level,salary_per_event,is_npc)
   VALUES(p_subsidiary_id,v_name,v_skill,v_salary,true)
   RETURNING to_jsonb(security_guards.*) INTO v_result;
 END IF;
 IF v_result IS NULL THEN RAISE EXCEPTION 'staff_hire_insert_failed'; END IF;
 INSERT INTO public.subsidiary_staff_hire_requests
  (actor_user_id,request_id,kind,subsidiary_id,request_hash,result)
 VALUES(v_actor,v_req,p_kind,p_subsidiary_id,v_hash,v_result);
 RETURN v_result;
END $hire$;
REVOKE ALL ON FUNCTION public._hire_subsidiary_staff_atomic(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;

-- Preserve the existing upgrades while enabling the four server-priced staffing branches:
CREATE OR REPLACE FUNCTION public.buy_subsidiary_asset_atomic(
  p_kind text,p_subsidiary_id uuid,p_fields jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,extensions,pg_temp
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_req uuid;
  v_type text;
  v_company_id uuid;
  v_base numeric;
  v_level integer;
  v_cost numeric;
  v_name text;
  v_out jsonb;
  v_previous public.subsidiary_upgrade_purchase_requests%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object'
    THEN RAISE EXCEPTION 'authenticated_upgrade_payload_required'; END IF;
  IF p_kind IN ('venue_staff','recording_staff','rehearsal_staff','security_guard') THEN
    RETURN public._hire_subsidiary_staff_atomic(p_kind,p_subsidiary_id,p_fields);
  END IF;
  IF p_kind NOT IN ('venue_upgrade','recording_upgrade','rehearsal_upgrade')
    OR p_kind IS NULL THEN RAISE EXCEPTION 'subsidiary_purchase_kind_not_yet_supported'; END IF;
  IF p_fields->>'request_id' IS NULL THEN RAISE EXCEPTION 'request_id_required'; END IF;
  v_req := (p_fields->>'request_id')::uuid;
  v_type := p_fields->>'upgrade_type';
  IF v_type IS NULL OR length(v_type) NOT BETWEEN 2 AND 80
    THEN RAISE EXCEPTION 'upgrade_type_required'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text||':'||v_req::text,0));
  SELECT * INTO v_previous
  FROM public.subsidiary_upgrade_purchase_requests
  WHERE actor_user_id=v_actor AND request_id=v_req FOR UPDATE;
  IF FOUND THEN
    IF v_previous.kind IS DISTINCT FROM p_kind
      OR v_previous.subsidiary_id IS DISTINCT FROM p_subsidiary_id
      OR v_previous.upgrade_type IS DISTINCT FROM v_type
      OR (p_fields->>'level' IS NOT NULL
          AND (p_fields->>'level')::integer IS DISTINCT FROM v_previous.upgrade_level)
      OR (p_fields->>'upgrade_level' IS NOT NULL
          AND (p_fields->>'upgrade_level')::integer IS DISTINCT FROM v_previous.upgrade_level)
    THEN RAISE EXCEPTION 'subsidiary_upgrade_request_conflict'; END IF;
    RETURN v_previous.result;
  END IF;

  -- Serialize level assignment by locking the parent before reading upgrades.
  IF p_kind='venue_upgrade' THEN
    SELECT company_id INTO v_company_id FROM public.venues
    WHERE id=p_subsidiary_id FOR UPDATE;
    v_base:=CASE v_type
      WHEN 'sound_system' THEN 25000 WHEN 'lighting' THEN 15000
      WHEN 'capacity' THEN 100000 WHEN 'backstage' THEN 20000
      WHEN 'bar' THEN 30000 WHEN 'parking' THEN 50000
      WHEN 'green_room' THEN 15000 WHEN 'recording' THEN 40000
      WHEN 'security' THEN 10000 ELSE NULL END;
    SELECT coalesce(max(upgrade_level),0)+1 INTO v_level
    FROM public.venue_upgrades WHERE venue_id=p_subsidiary_id AND upgrade_type=v_type;
  ELSIF p_kind='recording_upgrade' THEN
    SELECT company_id INTO v_company_id FROM public.city_studios
    WHERE id=p_subsidiary_id FOR UPDATE;
    v_base:=CASE v_type
      WHEN 'console' THEN 25000 WHEN 'monitors' THEN 5000
      WHEN 'microphones' THEN 8000 WHEN 'preamps' THEN 10000
      WHEN 'outboard_gear' THEN 15000 WHEN 'live_room' THEN 20000
      WHEN 'isolation_booth' THEN 10000 WHEN 'control_room' THEN 15000
      WHEN 'mastering_suite' THEN 50000 ELSE NULL END;
    SELECT coalesce(max(level),0)+1 INTO v_level
    FROM public.recording_studio_upgrades WHERE studio_id=p_subsidiary_id AND upgrade_type=v_type;
  ELSE
    SELECT company_id INTO v_company_id FROM public.rehearsal_rooms
    WHERE id=p_subsidiary_id FOR UPDATE;
    v_base:=CASE v_type
      WHEN 'soundproofing' THEN 5000 WHEN 'equipment' THEN 3000
      WHEN 'recording_gear' THEN 8000 WHEN 'climate_control' THEN 2000
      WHEN 'lounge_area' THEN 2500 WHEN 'storage' THEN 1500
      WHEN 'lighting' THEN 3000 ELSE NULL END;
    SELECT coalesce(max(level),0)+1 INTO v_level
    FROM public.rehearsal_room_upgrades WHERE room_id=p_subsidiary_id AND upgrade_type=v_type;
  END IF;
  IF v_company_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.companies
    WHERE id=v_company_id AND owner_id=v_actor
  ) THEN RAISE EXCEPTION 'subsidiary_not_owned'; END IF;
  IF v_base IS NULL THEN RAISE EXCEPTION 'unknown_upgrade_type'; END IF;
  IF v_level NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'upgrade_level_maximum'; END IF;
  IF (p_fields->>'level' IS NOT NULL AND (p_fields->>'level')::integer<>v_level)
    OR (p_fields->>'upgrade_level' IS NOT NULL AND (p_fields->>'upgrade_level')::integer<>v_level)
  THEN RAISE EXCEPTION 'stale_upgrade_level'; END IF;

  v_cost := round(v_base*power(1.5::numeric,(v_level-1)::numeric));
  v_name := initcap(replace(v_type,'_',' '))||' Level '||v_level::text;
  PERFORM public.deduct_company_balance(
    v_company_id,v_cost,'Subsidiary upgrade: '||p_kind||' / '||v_name,
    'upgrade','subsidiary-upgrade-'||v_req::text
  );

  IF p_kind='venue_upgrade' THEN
    INSERT INTO public.venue_upgrades(venue_id,upgrade_type,upgrade_level,cost,description)
    VALUES(p_subsidiary_id,v_type,v_level,v_cost,v_name)
    RETURNING to_jsonb(venue_upgrades.*) INTO v_out;
    IF v_type='capacity' THEN
      UPDATE public.venues
      SET capacity=least(50000,round(greatest(1,coalesce(capacity,100))*1.25))
      WHERE id=p_subsidiary_id;
    END IF;
  ELSIF p_kind='recording_upgrade' THEN
    INSERT INTO public.recording_studio_upgrades
      (studio_id,upgrade_type,name,level,cost,effect_value,effect_description)
    VALUES(p_subsidiary_id,v_type,v_name,v_level,v_cost,v_level*10,
      'Improves '||replace(v_type,'_',' ')||' quality by '||(v_level*10)::text||'%')
    RETURNING to_jsonb(recording_studio_upgrades.*) INTO v_out;
  ELSE
    INSERT INTO public.rehearsal_room_upgrades
      (room_id,upgrade_type,name,level,cost,effect_value,effect_description)
    VALUES(p_subsidiary_id,v_type,v_name,v_level,v_cost,v_level*10,
      'Improves '||replace(v_type,'_',' ')||' quality by '||(v_level*10)::text||'%')
    RETURNING to_jsonb(rehearsal_room_upgrades.*) INTO v_out;
  END IF;
  IF v_out IS NULL THEN RAISE EXCEPTION 'subsidiary_upgrade_creation_failed'; END IF;
  INSERT INTO public.subsidiary_upgrade_purchase_requests
    (actor_user_id,request_id,kind,subsidiary_id,upgrade_type,upgrade_level,result)
  VALUES(v_actor,v_req,p_kind,p_subsidiary_id,v_type,v_level,v_out);
  RETURN v_out;
END $fn$;


REVOKE ALL ON FUNCTION public.buy_subsidiary_asset_atomic(text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buy_subsidiary_asset_atomic(text,uuid,jsonb) TO authenticated;

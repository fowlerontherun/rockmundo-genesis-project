-- Atomic subsidiary staffing, equipment and upgrade actions.
-- Lock the subsidiary before debiting; debit_company_balance joins this same transaction.
CREATE OR REPLACE FUNCTION public.buy_subsidiary_asset_atomic(
 p_kind text,p_subsidiary_id uuid,p_fields jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_company_id uuid;v_amount numeric;v_row jsonb;v_level integer;
 v_name text:=left(trim(coalesce(p_fields->>'name',p_fields->>'equipment_name','')),160);
 v_type text:=p_fields->>'upgrade_type';v_salary numeric;
 v_key text;
BEGIN
 IF auth.uid() IS NULL OR jsonb_typeof(p_fields)<>'object' THEN RAISE EXCEPTION 'not_authenticated_or_invalid_fields'; END IF;
 IF p_kind IN ('venue_staff','venue_upgrade') THEN
  SELECT company_id INTO v_company_id FROM public.venues WHERE id=p_subsidiary_id FOR UPDATE;
 ELSIF p_kind IN ('recording_staff','recording_equipment','recording_upgrade') THEN
  SELECT company_id INTO v_company_id FROM public.city_studios WHERE id=p_subsidiary_id FOR UPDATE;
 ELSIF p_kind IN ('rehearsal_staff','rehearsal_equipment','rehearsal_upgrade') THEN
  SELECT company_id INTO v_company_id FROM public.rehearsal_rooms WHERE id=p_subsidiary_id FOR UPDATE;
 ELSIF p_kind='security_guard' THEN
  SELECT company_id INTO v_company_id FROM public.security_firms WHERE id=p_subsidiary_id FOR UPDATE;
 ELSE RAISE EXCEPTION 'unsupported_subsidiary_purchase'; END IF;
 IF v_company_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.companies WHERE id=v_company_id AND owner_id=auth.uid())
 THEN RAISE EXCEPTION 'subsidiary_not_owned'; END IF;
 IF p_kind='venue_staff' THEN
  v_salary:=coalesce((p_fields->>'salary_weekly')::numeric,400);
  IF v_salary NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'invalid_staff_salary'; END IF;
  v_amount:=v_salary*4;
 ELSIF p_kind='recording_staff' OR p_kind='rehearsal_staff' THEN
  v_salary:=coalesce((p_fields->>'salary')::numeric,800);
  IF v_salary NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'invalid_staff_salary'; END IF;
  v_amount:=v_salary;
 ELSIF p_kind='security_guard' THEN
  v_salary:=coalesce((p_fields->>'salary_per_event')::numeric,150);
  IF v_salary NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'invalid_guard_salary'; END IF;
  v_amount:=v_salary*10;
 ELSIF p_kind='rehearsal_equipment' THEN
  v_amount:=CASE WHEN (p_fields->>'hourly_rate')::numeric>0
    THEN (p_fields->>'hourly_rate')::numeric*100 ELSE 5000 END;
 ELSIF p_kind='recording_equipment' THEN
  v_amount:=(p_fields->>'value')::numeric;
 ELSE
  v_amount:=(p_fields->>'cost')::numeric;
 END IF;
 IF v_amount IS NULL OR v_amount<=0 OR v_amount>100000000 THEN RAISE EXCEPTION 'invalid_purchase_amount'; END IF;
 IF p_kind LIKE '%_upgrade' THEN
  IF length(v_name)<2 THEN v_name:=initcap(replace(coalesce(v_type,''),'_',' ')); END IF;
  IF v_type IS NULL THEN RAISE EXCEPTION 'upgrade_type_required'; END IF;

  IF p_kind='venue_upgrade' THEN
   SELECT coalesce(max(upgrade_level),0)+1 INTO v_level FROM public.venue_upgrades
   WHERE venue_id=p_subsidiary_id AND upgrade_type=v_type;
  ELSIF p_kind='recording_upgrade' THEN
   SELECT coalesce(max(level),0)+1 INTO v_level FROM public.recording_studio_upgrades
   WHERE studio_id=p_subsidiary_id AND upgrade_type=v_type;
  ELSE
   SELECT coalesce(max(level),0)+1 INTO v_level FROM public.rehearsal_room_upgrades
   WHERE room_id=p_subsidiary_id AND upgrade_type=v_type;
  END IF;
  IF (v_level>5 AND p_kind<>'venue_upgrade') OR v_level>20 THEN RAISE EXCEPTION 'upgrade_level_maximum'; END IF;
  IF (p_fields->>'level') IS NOT NULL AND (p_fields->>'level')::integer<>v_level
   OR (p_fields->>'upgrade_level') IS NOT NULL AND (p_fields->>'upgrade_level')::integer<>v_level
   THEN RAISE EXCEPTION 'stale_upgrade_level'; END IF;
 END IF;
 IF length(v_name)<2 THEN RAISE EXCEPTION 'name_required'; END IF;
 v_key:='subsidiary-asset-'||gen_random_uuid()::text;
 PERFORM public.deduct_company_balance(v_company_id,v_amount,
   'Subsidiary asset: '||p_kind||' - '||v_name,
   CASE WHEN p_kind LIKE '%_upgrade' THEN 'upgrade' ELSE 'staff' END,v_key);
 IF p_kind='venue_staff' THEN
  INSERT INTO public.venue_staff(venue_id,name,role,skill_level,salary_weekly)
  VALUES(p_subsidiary_id,v_name,p_fields->>'role',
   coalesce((p_fields->>'skill_level')::numeric,1),v_salary)
  RETURNING to_jsonb(venue_staff.*) INTO v_row;
 ELSIF p_kind='venue_upgrade' THEN
  INSERT INTO public.venue_upgrades(venue_id,upgrade_type,upgrade_level,cost,description)
  VALUES(p_subsidiary_id,v_type,v_level,v_amount,p_fields->>'description')
  RETURNING to_jsonb(venue_upgrades.*) INTO v_row;
  IF v_type='capacity' THEN
   UPDATE public.venues SET capacity=least(50000,round(greatest(1,coalesce(capacity,100))*1.25))
   WHERE id=p_subsidiary_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'capacity_update_failed'; END IF;
  END IF;
 ELSIF p_kind='recording_staff' THEN
  INSERT INTO public.recording_studio_staff(studio_id,name,role,skill_level,specialty,salary)
  VALUES(p_subsidiary_id,v_name,p_fields->>'role',
   coalesce((p_fields->>'skill_level')::integer,50),p_fields->>'specialty',v_salary)
  RETURNING to_jsonb(recording_studio_staff.*) INTO v_row;
 ELSIF p_kind='recording_equipment' THEN
  INSERT INTO public.recording_studio_equipment(studio_id,equipment_name,equipment_type,brand,model,value,hourly_rental_rate,is_vintage)
  VALUES(p_subsidiary_id,v_name,p_fields->>'equipment_type',p_fields->>'brand',p_fields->>'model',
   v_amount,coalesce((p_fields->>'hourly_rental_rate')::integer,25),
   coalesce((p_fields->>'is_vintage')::boolean,false))
  RETURNING to_jsonb(recording_studio_equipment.*) INTO v_row;
 ELSIF p_kind='recording_upgrade' THEN
  INSERT INTO public.recording_studio_upgrades(studio_id,upgrade_type,name,level,cost,effect_value,effect_description)
  VALUES(p_subsidiary_id,v_type,v_name,v_level,v_amount,
   coalesce((p_fields->>'effect_value')::integer,0),p_fields->>'effect_description')
  RETURNING to_jsonb(recording_studio_upgrades.*) INTO v_row;
 ELSIF p_kind='rehearsal_staff' THEN
  INSERT INTO public.rehearsal_room_staff(room_id,name,role,skill_level,salary)
  VALUES(p_subsidiary_id,v_name,p_fields->>'role',
   coalesce((p_fields->>'skill_level')::integer,50),v_salary)
  RETURNING to_jsonb(rehearsal_room_staff.*) INTO v_row;
 ELSIF p_kind='rehearsal_equipment' THEN
  INSERT INTO public.rehearsal_room_equipment(room_id,equipment_name,equipment_type,hourly_rate,daily_rate)
  VALUES(p_subsidiary_id,v_name,p_fields->>'equipment_type',
   coalesce((p_fields->>'hourly_rate')::integer,10),
   coalesce((p_fields->>'daily_rate')::integer,50))
  RETURNING to_jsonb(rehearsal_room_equipment.*) INTO v_row;
 ELSIF p_kind='rehearsal_upgrade' THEN
  INSERT INTO public.rehearsal_room_upgrades(room_id,upgrade_type,name,level,cost,effect_value,effect_description)
  VALUES(p_subsidiary_id,v_type,v_name,v_level,v_amount,
   coalesce((p_fields->>'effect_value')::integer,0),p_fields->>'effect_description')
  RETURNING to_jsonb(rehearsal_room_upgrades.*) INTO v_row;
 ELSIF p_kind='security_guard' THEN
  INSERT INTO public.security_guards(security_firm_id,name,skill_level,salary_per_event,is_npc)
  VALUES(p_subsidiary_id,v_name,coalesce((p_fields->>'skill_level')::integer,1),v_salary,true)
  RETURNING to_jsonb(security_guards.*) INTO v_row;
 END IF;
 IF v_row IS NULL THEN RAISE EXCEPTION 'subsidiary_asset_insertion_failed'; END IF;
 RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.buy_subsidiary_asset_atomic(text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buy_subsidiary_asset_atomic(text,uuid,jsonb) TO authenticated;

-- Server-authoritative business purchases. All writes share one Postgres transaction
-- with the existing finance_debit_owner/company transaction ledger.
CREATE OR REPLACE FUNCTION public.hire_label_staff_atomic(
 p_label_id uuid,p_name text,p_role text,p_skill_level numeric DEFAULT 1,
 p_specialty_genre text DEFAULT NULL,p_salary_monthly numeric DEFAULT 3000
) RETURNS public.label_staff LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.labels%rowtype; v_staff public.label_staff%rowtype;v_cost numeric;
BEGIN
 SELECT * INTO l FROM public.labels WHERE id=p_label_id FOR UPDATE;
 IF NOT FOUND OR (l.owner_id IS DISTINCT FROM auth.uid() AND
  NOT EXISTS(SELECT 1 FROM public.companies c WHERE c.id=l.company_id AND c.owner_id=auth.uid()))
 THEN RAISE EXCEPTION 'label_staff_not_authorized'; END IF;
 IF p_name IS NULL OR length(trim(p_name))<2 OR length(p_name)>120 OR
  p_role NOT IN ('a_and_r','marketing','promoter','accountant','legal','producer','manager') OR
  p_skill_level NOT BETWEEN 1 AND 5 OR p_salary_monthly NOT BETWEEN 100 AND 100000
 THEN RAISE EXCEPTION 'invalid_label_staff_terms'; END IF;
 v_cost:=p_salary_monthly;
 IF l.company_id IS NOT NULL THEN
  PERFORM public.deduct_company_balance(l.company_id,v_cost,
   'Hire label employee: '||p_name,'staff','label-staff-'||gen_random_uuid()::text);
 ELSE
  UPDATE public.labels SET balance=balance-v_cost WHERE id=l.id AND balance>=v_cost;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_label_funds'; END IF;
  INSERT INTO public.label_financial_transactions(label_id,transaction_type,amount,description)
  VALUES(l.id,'expense',v_cost,'Hire label employee: '||p_name);
 END IF;
 INSERT INTO public.label_staff(label_id,name,role,skill_level,specialty_genre,salary_monthly)
 VALUES(l.id,trim(p_name),p_role,p_skill_level,p_specialty_genre,p_salary_monthly)
 RETURNING * INTO v_staff;
 RETURN v_staff;
END $$;

CREATE OR REPLACE FUNCTION public.hire_logistics_driver_atomic(
 p_logistics_id uuid,p_driver jsonb
) RETURNS public.logistics_drivers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.logistics_companies%rowtype;v_row public.logistics_drivers%rowtype;
 v_salary numeric;v_name text;
BEGIN
 SELECT * INTO l FROM public.logistics_companies WHERE id=p_logistics_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=l.company_id AND owner_id=auth.uid())
 THEN RAISE EXCEPTION 'logistics_owner_required'; END IF;
 v_name:=trim(coalesce(p_driver->>'name',''));
 v_salary:=coalesce((p_driver->>'salary_per_day')::numeric,150);
 IF length(v_name) NOT BETWEEN 2 AND 120 OR v_salary NOT BETWEEN 1 AND 10000
 THEN RAISE EXCEPTION 'invalid_driver_terms'; END IF;
 PERFORM public.deduct_company_balance(l.company_id,v_salary*30,
  'Hire logistics driver: '||v_name,'staff','logistics-driver-'||gen_random_uuid()::text);
 INSERT INTO public.logistics_drivers(logistics_company_id,name,is_npc,license_type,experience_years,
  skill_level,reliability_rating,salary_per_day)
 VALUES(l.id,v_name,coalesce((p_driver->>'is_npc')::boolean,true),
  coalesce(p_driver->>'license_type','standard'),
  coalesce((p_driver->>'experience_years')::integer,0),
  coalesce((p_driver->>'skill_level')::integer,1),
  coalesce((p_driver->>'reliability_rating')::integer,70),v_salary)
 RETURNING * INTO v_row;
 RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.hire_merch_factory_worker_atomic(
 p_factory_id uuid,p_worker jsonb
) RETURNS public.merch_factory_workers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.merch_factories%rowtype;v_row public.merch_factory_workers%rowtype;
 v_salary numeric;v_name text;
BEGIN
 SELECT * INTO f FROM public.merch_factories WHERE id=p_factory_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=f.company_id AND owner_id=auth.uid())
 THEN RAISE EXCEPTION 'factory_owner_required'; END IF;
 v_name:=trim(coalesce(p_worker->>'name',''));
 v_salary:=coalesce((p_worker->>'salary_weekly')::numeric,500);
 IF length(v_name) NOT BETWEEN 2 AND 120 OR v_salary NOT BETWEEN 1 AND 100000
 THEN RAISE EXCEPTION 'invalid_factory_worker_terms'; END IF;
 PERFORM public.deduct_company_balance(f.company_id,v_salary*4,
  'Hire factory worker: '||v_name,'staff','factory-worker-'||gen_random_uuid()::text);
 INSERT INTO public.merch_factory_workers(factory_id,name,role,skill_level,salary_weekly)
 VALUES(f.id,v_name,coalesce(p_worker->>'role','production'),
  coalesce((p_worker->>'skill_level')::numeric,1),v_salary)
 RETURNING * INTO v_row;
 RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.purchase_logistics_fleet_vehicle_atomic(
 p_logistics_id uuid,p_vehicle jsonb
) RETURNS public.logistics_fleet_vehicles LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.logistics_companies%rowtype;v_row public.logistics_fleet_vehicles%rowtype;v_cost numeric;
BEGIN
 SELECT * INTO l FROM public.logistics_companies WHERE id=p_logistics_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=l.company_id AND owner_id=auth.uid())
 THEN RAISE EXCEPTION 'logistics_owner_required'; END IF;
 IF (SELECT count(*) FROM public.logistics_fleet_vehicles WHERE logistics_company_id=l.id AND status<>'retired')
 >=l.fleet_capacity THEN RAISE EXCEPTION 'logistics_fleet_at_capacity'; END IF;
 v_cost:=coalesce((p_vehicle->>'purchase_cost')::numeric,0);
 IF v_cost<=0 OR v_cost>100000000 OR length(trim(coalesce(p_vehicle->>'name','')))<2
 THEN RAISE EXCEPTION 'invalid_fleet_vehicle'; END IF;
 -- A fleet vehicle with a catalog entry uses the catalog's listed cost.
 -- The submitted cost is retained only where there is no catalog selection.
 IF p_vehicle->>'vehicle_catalog_id' IS NOT NULL THEN
  SELECT coalesce(purchase_cost,0) INTO v_cost FROM public.vehicle_catalog
  WHERE id=(p_vehicle->>'vehicle_catalog_id')::uuid;
  IF NOT FOUND OR v_cost<=0 THEN RAISE EXCEPTION 'vehicle_catalog_price_missing'; END IF;
 END IF;
 PERFORM public.deduct_company_balance(l.company_id,v_cost,
  'Purchase logistics vehicle: '||(p_vehicle->>'name'),'upgrade','logistics-fleet-'||gen_random_uuid()::text);
 INSERT INTO public.logistics_fleet_vehicles(logistics_company_id,vehicle_catalog_id,name,vehicle_type,
  capacity_units,condition_percent,purchase_cost,purchase_date)
 VALUES(l.id,(p_vehicle->>'vehicle_catalog_id')::uuid,trim(p_vehicle->>'name'),
  coalesce(p_vehicle->>'vehicle_type','van'),
  coalesce((p_vehicle->>'capacity_units')::integer,100),100,v_cost,now())
 RETURNING * INTO v_row;
 UPDATE public.logistics_companies SET current_fleet_size=
  (SELECT count(*) FROM public.logistics_fleet_vehicles WHERE logistics_company_id=l.id AND status<>'retired')
 WHERE id=l.id;
 RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.purchase_logistics_upgrade_atomic(
 p_logistics_id uuid,p_upgrade_type text
) RETURNS public.logistics_upgrades LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.logistics_companies%rowtype;v_row public.logistics_upgrades%rowtype;
 v_level integer;v_cost numeric;
BEGIN
 SELECT * INTO l FROM public.logistics_companies WHERE id=p_logistics_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=l.company_id AND owner_id=auth.uid())
 THEN RAISE EXCEPTION 'logistics_owner_required'; END IF;
 IF p_upgrade_type NOT IN ('fleet_capacity','gps_tracking','climate_control','insurance_premium',
  'regional_expansion','hazmat_certification','oversize_permit')
 THEN RAISE EXCEPTION 'unknown_logistics_upgrade'; END IF;
 SELECT coalesce(max(upgrade_level),0)+1 INTO v_level FROM public.logistics_upgrades
 WHERE logistics_company_id=l.id AND upgrade_type=p_upgrade_type AND active=true;
 IF v_level>10 THEN RAISE EXCEPTION 'logistics_upgrade_maximum'; END IF;
 v_cost:=(CASE p_upgrade_type
  WHEN 'fleet_capacity' THEN 10000 WHEN 'regional_expansion' THEN 20000
  WHEN 'insurance_premium' THEN 10000 ELSE 5000 END)*v_level;
 PERFORM public.deduct_company_balance(l.company_id,v_cost,
  'Logistics upgrade: '||p_upgrade_type||' '||v_level,'upgrade',
  'logistics-upgrade-'||gen_random_uuid()::text);
 INSERT INTO public.logistics_upgrades(logistics_company_id,upgrade_type,upgrade_level,cost)
 VALUES(l.id,p_upgrade_type,v_level,v_cost) RETURNING * INTO v_row;
 IF p_upgrade_type='fleet_capacity' THEN
  UPDATE public.logistics_companies SET fleet_capacity=fleet_capacity+1 WHERE id=l.id;
 END IF;
 RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.purchase_security_firm_upgrade_atomic(
 p_firm_id uuid,p_upgrade_type text
) RETURNS public.security_firm_upgrades LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.security_firms%rowtype;v_row public.security_firm_upgrades%rowtype;
 v_level integer;v_base integer;v_effect integer;v_name text;
BEGIN
 SELECT * INTO f FROM public.security_firms WHERE id=p_firm_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=f.company_id AND owner_id=auth.uid())
 THEN RAISE EXCEPTION 'security_firm_owner_required'; END IF;
 SELECT coalesce(max(level),0)+1 INTO v_level FROM public.security_firm_upgrades
 WHERE security_firm_id=p_firm_id AND upgrade_type=p_upgrade_type;
 IF v_level>20 THEN RAISE EXCEPTION 'security_upgrade_maximum'; END IF;
 v_base:=CASE p_upgrade_type WHEN 'basic_training' THEN 10000 WHEN 'crowd_control' THEN 25000
  WHEN 'vip_protection' THEN 50000 WHEN 'emergency_response' THEN 35000
  WHEN 'equipment' THEN 20000 ELSE 0 END;
 v_effect:=CASE p_upgrade_type WHEN 'basic_training' THEN 5 WHEN 'crowd_control' THEN 10
  WHEN 'vip_protection' THEN 15 WHEN 'emergency_response' THEN 5
  WHEN 'equipment' THEN 4 ELSE 0 END;
 IF v_base=0 THEN RAISE EXCEPTION 'unknown_security_upgrade'; END IF;
 v_name:=initcap(replace(p_upgrade_type,'_',' '));
 PERFORM public.deduct_company_balance(f.company_id,v_base*v_level,
  'Security upgrade: '||v_name||' '||v_level,'upgrade',
  'security-upgrade-'||gen_random_uuid()::text);
 UPDATE public.security_firm_upgrades SET level=v_level,cost=v_base*v_level,
  name=v_name,effect_value=v_effect*v_level,
  effect_description='+'||(v_effect*v_level)::text||'%'
 WHERE security_firm_id=f.id AND upgrade_type=p_upgrade_type
 RETURNING * INTO v_row;
 IF NOT FOUND THEN
  INSERT INTO public.security_firm_upgrades(security_firm_id,upgrade_type,name,level,cost,effect_value,effect_description)
  VALUES(f.id,p_upgrade_type,v_name,v_level,v_base*v_level,v_effect*v_level,
   '+'||(v_effect*v_level)::text||'%')
  RETURNING * INTO v_row;
 END IF;
 RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.hire_label_staff_atomic(uuid,text,text,numeric,text,numeric) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.hire_logistics_driver_atomic(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.hire_merch_factory_worker_atomic(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.purchase_logistics_fleet_vehicle_atomic(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.purchase_logistics_upgrade_atomic(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.purchase_security_firm_upgrade_atomic(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hire_label_staff_atomic(uuid,text,text,numeric,text,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hire_logistics_driver_atomic(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hire_merch_factory_worker_atomic(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_logistics_fleet_vehicle_atomic(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_logistics_upgrade_atomic(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_security_firm_upgrade_atomic(uuid,text) TO authenticated;

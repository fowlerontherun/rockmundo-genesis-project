-- Exact production SQL deployed in Supabase migration 20261015222945.
-- Other business purchase RPCs from the source migration are deliberately excluded
-- pending pricing/idempotency and authorization hardening. Do not replay automatically.
CREATE OR REPLACE FUNCTION public.purchase_logistics_upgrade_atomic(
 p_logistics_id uuid,p_upgrade_type text
) RETURNS public.logistics_upgrades LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
) RETURNS public.security_firm_upgrades LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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

REVOKE ALL ON FUNCTION public.purchase_logistics_upgrade_atomic(uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.purchase_logistics_upgrade_atomic(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.purchase_security_firm_upgrade_atomic(uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.purchase_security_firm_upgrade_atomic(uuid,text) TO authenticated;

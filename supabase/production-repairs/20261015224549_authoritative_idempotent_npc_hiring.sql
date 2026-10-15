-- Applied production migration 20261015224549. Archive only; do not replay automatically.
CREATE TABLE IF NOT EXISTS public.atomic_business_hire_requests (
 actor_user_id uuid NOT NULL, request_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('driver','factory_worker')),
 parent_id uuid NOT NULL, employee_name text NOT NULL, employee_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_user_id,request_id)
);
ALTER TABLE public.atomic_business_hire_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atomic_business_hire_requests FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.hire_logistics_driver_atomic(p_logistics_id uuid, p_driver jsonb)
 RETURNS logistics_drivers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
 v_actor uuid:=auth.uid();v_req uuid;v_name text;v_company uuid;
 v_existing public.atomic_business_hire_requests%rowtype;
 v_row public.logistics_drivers%rowtype;
BEGIN
 IF v_actor IS NULL OR p_driver IS NULL OR jsonb_typeof(p_driver)<>'object' OR p_driver->>'request_id' IS NULL
 THEN RAISE EXCEPTION 'authenticated_hire_request_id_required'; END IF;
 v_req:=(p_driver->>'request_id')::uuid;
 v_name:=btrim(coalesce(p_driver->>'name',''));
 IF char_length(v_name) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'invalid_driver_name'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text||':'||v_req::text,0));
 SELECT * INTO v_existing FROM public.atomic_business_hire_requests WHERE actor_user_id=v_actor AND request_id=v_req FOR UPDATE;
 IF FOUND THEN
  IF v_existing.kind<>'driver' OR v_existing.parent_id IS DISTINCT FROM p_logistics_id OR v_existing.employee_name IS DISTINCT FROM v_name
  THEN RAISE EXCEPTION 'hire_idempotency_conflict'; END IF;
  SELECT * INTO v_row FROM public.logistics_drivers WHERE id=v_existing.employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'hired_driver_missing'; END IF;
  RETURN v_row;
 END IF;
 SELECT company_id INTO v_company FROM public.logistics_companies WHERE id=p_logistics_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=v_company AND owner_id=v_actor)
 THEN RAISE EXCEPTION 'logistics_owner_required'; END IF;
 PERFORM public.deduct_company_balance(v_company,4500,'Hire logistics driver: '||v_name,'staff','logistics-driver-'||v_req::text);
 INSERT INTO public.logistics_drivers(logistics_company_id,name,is_npc,license_type,experience_years,skill_level,reliability_rating,salary_per_day)
 VALUES(p_logistics_id,v_name,true,'standard',0,1,70,150) RETURNING * INTO v_row;
 INSERT INTO public.atomic_business_hire_requests(actor_user_id,request_id,kind,parent_id,employee_name,employee_id)
 VALUES(v_actor,v_req,'driver',p_logistics_id,v_name,v_row.id);
 RETURN v_row;
END $function$
;

CREATE OR REPLACE FUNCTION public.hire_merch_factory_worker_atomic(p_factory_id uuid, p_worker jsonb)
 RETURNS merch_factory_workers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
 v_actor uuid:=auth.uid();v_req uuid;v_name text;v_company uuid;
 v_existing public.atomic_business_hire_requests%rowtype;
 v_row public.merch_factory_workers%rowtype;
BEGIN
 IF v_actor IS NULL OR p_worker IS NULL OR jsonb_typeof(p_worker)<>'object' OR p_worker->>'request_id' IS NULL
 THEN RAISE EXCEPTION 'authenticated_hire_request_id_required'; END IF;
 v_req:=(p_worker->>'request_id')::uuid;
 v_name:=btrim(coalesce(p_worker->>'name',''));
 IF char_length(v_name) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'invalid_worker_name'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text||':'||v_req::text,0));
 SELECT * INTO v_existing FROM public.atomic_business_hire_requests WHERE actor_user_id=v_actor AND request_id=v_req FOR UPDATE;
 IF FOUND THEN
  IF v_existing.kind<>'factory_worker' OR v_existing.parent_id IS DISTINCT FROM p_factory_id OR v_existing.employee_name IS DISTINCT FROM v_name
  THEN RAISE EXCEPTION 'hire_idempotency_conflict'; END IF;
  SELECT * INTO v_row FROM public.merch_factory_workers WHERE id=v_existing.employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'hired_worker_missing'; END IF;
  RETURN v_row;
 END IF;
 SELECT company_id INTO v_company FROM public.merch_factories WHERE id=p_factory_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=v_company AND owner_id=v_actor)
 THEN RAISE EXCEPTION 'factory_owner_required'; END IF;
 PERFORM public.deduct_company_balance(v_company,2000,'Hire factory worker: '||v_name,'staff','factory-worker-'||v_req::text);
 INSERT INTO public.merch_factory_workers(factory_id,name,role,skill_level,salary_weekly)
 VALUES(p_factory_id,v_name,'production',1,500) RETURNING * INTO v_row;
 INSERT INTO public.atomic_business_hire_requests(actor_user_id,request_id,kind,parent_id,employee_name,employee_id)
 VALUES(v_actor,v_req,'factory_worker',p_factory_id,v_name,v_row.id);
 RETURN v_row;
END $function$
;
REVOKE ALL ON FUNCTION public.hire_logistics_driver_atomic(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.hire_merch_factory_worker_atomic(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hire_logistics_driver_atomic(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hire_merch_factory_worker_atomic(uuid,jsonb) TO authenticated;

-- Production archive, migration 20261015224409. Do not replay automatically.
CREATE TABLE IF NOT EXISTS public.logistics_fleet_purchase_requests (
 actor_user_id uuid NOT NULL, request_id uuid NOT NULL,
 logistics_company_id uuid NOT NULL REFERENCES public.logistics_companies(id),
 catalog_id uuid NOT NULL REFERENCES public.vehicle_catalog(id),
 vehicle_name text NOT NULL, vehicle_id uuid NOT NULL REFERENCES public.logistics_fleet_vehicles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_user_id,request_id)
);
ALTER TABLE public.logistics_fleet_purchase_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.logistics_fleet_purchase_requests FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.purchase_logistics_fleet_vehicle_atomic(p_logistics_id uuid, p_vehicle jsonb)
 RETURNS logistics_fleet_vehicles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
 v_actor uuid := auth.uid();
 v_catalog_id uuid;
 v_request_id uuid;
 v_name text;
 v_company_id uuid;
 v_capacity integer;
 v_catalog public.vehicle_catalog%ROWTYPE;
 v_existing public.logistics_fleet_purchase_requests%ROWTYPE;
 v_vehicle public.logistics_fleet_vehicles%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR p_vehicle IS NULL OR jsonb_typeof(p_vehicle) <> 'object' THEN
   RAISE EXCEPTION 'authentication_and_vehicle_payload_required';
 END IF;
 IF p_vehicle->>'request_id' IS NULL OR p_vehicle->>'vehicle_catalog_id' IS NULL THEN
   RAISE EXCEPTION 'request_id_and_vehicle_catalog_id_required';
 END IF;
 v_request_id := (p_vehicle->>'request_id')::uuid;
 v_catalog_id := (p_vehicle->>'vehicle_catalog_id')::uuid;
 v_name := btrim(coalesce(p_vehicle->>'name',''));
 IF char_length(v_name) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'invalid_vehicle_name'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text || ':' || v_request_id::text,0));
 SELECT * INTO v_existing FROM public.logistics_fleet_purchase_requests
 WHERE actor_user_id=v_actor AND request_id=v_request_id FOR UPDATE;
 IF FOUND THEN
   IF v_existing.logistics_company_id IS DISTINCT FROM p_logistics_id
      OR v_existing.catalog_id IS DISTINCT FROM v_catalog_id
      OR v_existing.vehicle_name IS DISTINCT FROM v_name THEN
      RAISE EXCEPTION 'fleet_purchase_idempotency_conflict';
   END IF;
   SELECT * INTO v_vehicle FROM public.logistics_fleet_vehicles WHERE id=v_existing.vehicle_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'fleet_purchase_missing_vehicle'; END IF;
   RETURN v_vehicle;
 END IF;
 SELECT company_id, fleet_capacity INTO v_company_id,v_capacity
 FROM public.logistics_companies WHERE id=p_logistics_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS (
   SELECT 1 FROM public.companies WHERE id=v_company_id AND owner_id=v_actor
 ) THEN RAISE EXCEPTION 'logistics_owner_required'; END IF;
 SELECT * INTO v_catalog FROM public.vehicle_catalog WHERE id=v_catalog_id;
 IF NOT FOUND OR v_catalog.purchase_cost IS NULL OR v_catalog.purchase_cost<=0
 OR v_catalog.capacity_units IS NULL OR v_catalog.capacity_units<=0
 OR v_catalog.vehicle_type IS NULL THEN RAISE EXCEPTION 'invalid_vehicle_catalog_entry'; END IF;
 IF (SELECT count(*) FROM public.logistics_fleet_vehicles
     WHERE logistics_company_id=p_logistics_id AND status IS DISTINCT FROM 'retired') >= coalesce(v_capacity,0)
 THEN RAISE EXCEPTION 'logistics_fleet_at_capacity'; END IF;
 PERFORM public.deduct_company_balance(v_company_id,v_catalog.purchase_cost,
    'Purchase logistics vehicle: '||v_catalog.name,'upgrade',
    'logistics-fleet-'||v_request_id::text);
 INSERT INTO public.logistics_fleet_vehicles
    (logistics_company_id,vehicle_catalog_id,name,vehicle_type,capacity_units,condition_percent,purchase_cost,purchase_date)
 VALUES (p_logistics_id,v_catalog_id,v_name,v_catalog.vehicle_type,v_catalog.capacity_units,100,v_catalog.purchase_cost,now())
 RETURNING * INTO v_vehicle;
 INSERT INTO public.logistics_fleet_purchase_requests
    (actor_user_id,request_id,logistics_company_id,catalog_id,vehicle_name,vehicle_id)
 VALUES (v_actor,v_request_id,p_logistics_id,v_catalog_id,v_name,v_vehicle.id);
 UPDATE public.logistics_companies SET current_fleet_size=
    (SELECT count(*) FROM public.logistics_fleet_vehicles WHERE logistics_company_id=p_logistics_id
      AND status IS DISTINCT FROM 'retired')
 WHERE id=p_logistics_id;
 RETURN v_vehicle;
END $function$
;
REVOKE ALL ON FUNCTION public.purchase_logistics_fleet_vehicle_atomic(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purchase_logistics_fleet_vehicle_atomic(uuid,jsonb) TO authenticated;

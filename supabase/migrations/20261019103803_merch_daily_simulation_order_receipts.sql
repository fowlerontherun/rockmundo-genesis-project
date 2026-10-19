-- Receipt 20261019103803: #4249 durable unique per-order receipts.
-- The service-only simulation wrapper holds the day lock and atomically
-- calls the existing stock/order RPC. A duplicate sale key cannot charge twice.
CREATE TABLE IF NOT EXISTS public.merch_simulation_sale_receipts (
  run_id uuid NOT NULL REFERENCES public.merch_sales_simulation_runs(run_id) ON DELETE RESTRICT,
  sale_sequence integer NOT NULL CHECK (sale_sequence>0),
  order_id uuid NOT NULL UNIQUE REFERENCES public.merch_orders(id) ON DELETE RESTRICT,
  band_id uuid NOT NULL REFERENCES public.bands(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id,sale_sequence)
);
ALTER TABLE public.merch_simulation_sale_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merch_simulation_sale_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.merch_simulation_sale_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.record_simulated_merch_sale_atomic(p_run_id uuid, p_sale_sequence integer, p_band_id uuid, p_merchandise_id uuid, p_variant_id uuid, p_quantity integer, p_unit_price integer, p_total_price integer, p_sales_tax numeric, p_vat numeric, p_net_revenue numeric, p_order_type text, p_customer_type text, p_country text, p_discount_pct numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_run public.merch_sales_simulation_runs%rowtype;
  v_existing uuid;
  v_sale jsonb;
begin
  if p_run_id is null or p_sale_sequence is null or p_sale_sequence<=0 then
    raise exception 'merch_simulation_invalid_sale_identity';
  end if;
  select * into v_run from public.merch_sales_simulation_runs
  where run_id=p_run_id and status='running'
    and sales_day=(now() at time zone 'UTC')::date
  for update;
  if not found then
    raise exception 'merch_simulation_run_not_active';
  end if;
  select order_id into v_existing from public.merch_simulation_sale_receipts
    where run_id=p_run_id and sale_sequence=p_sale_sequence;
  if found then
    return jsonb_build_object('sold',false,'reason','already_recorded','order_id',v_existing);
  end if;
  v_sale:=public.record_merch_sale_atomic(
    p_band_id,p_merchandise_id,p_variant_id,p_quantity,
    p_unit_price,p_total_price,p_sales_tax,p_vat,p_net_revenue,
    p_order_type,p_customer_type,p_country,p_discount_pct);
  if v_sale->>'sold'='true' then
    insert into public.merch_simulation_sale_receipts
      (run_id,sale_sequence,order_id,band_id)
    values (p_run_id,p_sale_sequence,(v_sale->>'order_id')::uuid,p_band_id);
  end if;
  return v_sale;
end
$function$
;
REVOKE ALL ON FUNCTION public.record_simulated_merch_sale_atomic(
uuid,integer,uuid,uuid,uuid,integer,integer,integer,numeric,numeric,numeric,text,text,text,numeric)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_simulated_merch_sale_atomic(
uuid,integer,uuid,uuid,uuid,integer,integer,integer,numeric,numeric,numeric,text,text,text,numeric)
 TO service_role;

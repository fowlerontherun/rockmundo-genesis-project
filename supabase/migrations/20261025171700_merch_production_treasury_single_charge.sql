-- Single-charge merchandise order / restock repair. No data backfills.
-- Merch production must use the SAME spendable treasury as Band Finances.
-- Do not debit financial_accounts here: production previously charged two
-- distinct finance systems, and initial orders bypassed band_earnings entirely.
CREATE OR REPLACE FUNCTION public.merch_assert_band_funds(
  p_band_id uuid, p_amount integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_balance bigint;
  v_treasury public.band_treasuries%ROWTYPE;
BEGIN
  IF p_amount < 0 THEN RAISE EXCEPTION 'Invalid merchandise order amount'; END IF;
  SELECT b.band_balance INTO v_balance
    FROM public.bands b WHERE b.id = p_band_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Band not found'; END IF;
  SELECT * INTO v_treasury FROM public.band_treasuries
   WHERE band_id=p_band_id ORDER BY is_primary DESC, created_at LIMIT 1 FOR UPDATE;
  IF v_treasury.id IS NULL THEN RAISE EXCEPTION 'Band treasury not found. Open Band Finances and try again.'; END IF;
  IF v_treasury.currency_code <> 'USD' THEN RAISE EXCEPTION 'Unsupported merchandise treasury currency'; END IF;
  IF v_treasury.balance_minor <> COALESCE(v_balance,0)*100 THEN
    RAISE EXCEPTION 'Band treasury balance requires reconciliation before ordering merchandise';
  END IF;
  IF v_treasury.balance_minor - v_treasury.reserved_balance_minor < p_amount::bigint*100 THEN
    RAISE EXCEPTION 'Insufficient band funds: production costs $%, available $%',
      p_amount, greatest(0,(v_treasury.balance_minor-v_treasury.reserved_balance_minor)/100);
  END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.merch_assert_band_funds(uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merch_assert_band_funds(uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.queue_merch_restock_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  added_qty integer;
  requirement record;
  discount_pct numeric := 0;
  effective_cost numeric;
  total_cost numeric;
  charge_amount integer;
  ready_days integer;
  quality_score numeric;
  current_balance integer;
begin
  if coalesce(current_setting('app.merch_variant_transfer', true), '') = 'on' then
    return new;
  end if;

  if new.stock_quantity <= old.stock_quantity
     or new.pending_quantity is distinct from old.pending_quantity
     or new.production_ready_at is distinct from old.production_ready_at then
    return new;
  end if;

  if coalesce(old.pending_quantity,0) > 0 then
    raise exception 'This product already has stock in production';
  end if;

  added_qty := new.stock_quantity - old.stock_quantity;

  select r.id, r.base_cost, r.min_order_qty, r.lead_time_days, r.supplier_tier, r.base_quality_tier
    into requirement
  from public.merch_item_requirements r
  where r.id = new.product_requirement_id
     or (new.product_requirement_id is null and r.item_type = new.item_type)
  order by (r.id = new.product_requirement_id) desc
  limit 1;

  if not found then
    raise exception 'No supplier configuration exists for merchandise type %', new.item_type;
  end if;

  if added_qty < coalesce(requirement.min_order_qty, 1) then
    raise exception 'Minimum production run for % is % units', new.item_type, coalesce(requirement.min_order_qty, 1);
  end if;

  ready_days := greatest(1, coalesce(requirement.lead_time_days, new.lead_time_days, 1));
  discount_pct := case when added_qty >= 1000 then 0.15 when added_qty >= 500 then 0.10 when added_qty >= 100 then 0.05 else 0 end;
  effective_cost := coalesce(requirement.base_cost, new.cost_to_produce, 0) * (1 - discount_pct);
  total_cost := round((effective_cost * added_qty)::numeric, 2);
  charge_amount := greatest(0, round(total_cost)::integer);

  -- Lock the gameplay band treasury, including reservations, before spending.
  -- The earnings insert below is the only debit (bands + treasury projection).
  PERFORM public.merch_assert_band_funds(new.band_id, charge_amount);

  quality_score := case coalesce(requirement.supplier_tier, requirement.base_quality_tier, new.supplier_tier, 'standard') when 'premium' then 88 when 'budget' then 60 else 74 end;

  insert into public.band_earnings(band_id, amount, source, description, metadata)
  values (
    new.band_id,
    -charge_amount,
    'merchandise_production',
    format('Merch production: %s units of %s', added_qty, coalesce(new.design_name,new.item_type,'merchandise')),
    jsonb_build_object('merchandise_id',new.id,'quantity',added_qty,'unit_cost',effective_cost,'total_cost',total_cost,'discount_pct',discount_pct)
  );

  new.stock_quantity := old.stock_quantity;
  new.pending_quantity := added_qty;
  new.production_status := 'ordered';
  new.production_ordered_at := now();
  new.production_ready_at := now() + make_interval(days => ready_days);
  new.is_rush_order := false;
  new.production_discount_pct := discount_pct;
  new.production_total_cost := total_cost;
  new.production_quality := quality_score;
  new.product_requirement_id := coalesce(new.product_requirement_id, requirement.id);
  new.cost_to_produce := coalesce(requirement.base_cost, new.cost_to_produce, 0);
  new.lead_time_days := ready_days;
  new.supplier_tier := coalesce(requirement.supplier_tier, requirement.base_quality_tier, new.supplier_tier);
  new.updated_at := now();
  return new;
end;
$function$

-- Runs after trg_prepare_merch_production_insert (alphabetical trigger order):
-- preparation moves initial stock_quantity into pending_quantity; charge the
-- PREPARED quantity/cost, not zero stock_quantity, and retain rush settings.
CREATE OR REPLACE FUNCTION public.queue_initial_merch_production()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  requested_qty integer;
  charge_amount integer;
BEGIN
  requested_qty := greatest(0,coalesce(new.stock_quantity,0))
                 + greatest(0,coalesce(new.pending_quantity,0));
  IF requested_qty <= 0 THEN RETURN new; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.merch_item_requirements r
     WHERE r.id=new.product_requirement_id
        OR (new.product_requirement_id IS NULL AND r.item_type=new.item_type)
  ) THEN
    RAISE EXCEPTION 'No supplier configuration exists for merchandise type %',new.item_type;
  END IF;
  -- Cost, lead time, discount and rush fee were already computed by PREPARE.
  charge_amount := greatest(0,round(coalesce(new.production_total_cost,0))::integer);
  PERFORM public.merch_assert_band_funds(new.band_id,charge_amount);
  IF charge_amount > 0 THEN
    INSERT INTO public.band_earnings(band_id,amount,source,description,metadata)
    VALUES (
      new.band_id, -charge_amount, 'merchandise_production',
      format('Initial merch production: %s units of %s',requested_qty,coalesce(new.design_name,new.item_type,'merchandise')),
      jsonb_build_object('merchandise_id',new.id,'quantity',requested_qty,
        'total_cost',new.production_total_cost,'discount_pct',new.production_discount_pct,
        'rush_order',coalesce(new.is_rush_order,false))
    );
  END IF;
  RETURN new;
END;
$fn$;
REVOKE ALL ON FUNCTION public.queue_initial_merch_production() FROM PUBLIC, anon, authenticated;

-- AFTER triggers used a second, divergent financial account as payment authority.
DROP TRIGGER IF EXISTS trg_charge_merch_production_insert ON public.player_merchandise;
DROP TRIGGER IF EXISTS trg_charge_merch_production_restock ON public.player_merchandise;
DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.player_merchandise'::regclass
      AND NOT t.tgisinternal AND t.tgname LIKE 'trg_charge_merch_production_%'
  ) THEN RAISE EXCEPTION 'Old duplicate merch debit trigger still installed'; END IF;
END
$verify$;

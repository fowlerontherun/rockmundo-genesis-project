create or replace function public.queue_merch_restock_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  if coalesce(current_setting('app.merch_variant_transfer', true), '') = 'on' then return new; end if;
  if new.stock_quantity <= old.stock_quantity
     or new.pending_quantity is distinct from old.pending_quantity
     or new.production_ready_at is distinct from old.production_ready_at then return new; end if;
  if coalesce(old.pending_quantity,0) > 0 then raise exception 'This product already has stock in production'; end if;

  added_qty := new.stock_quantity - old.stock_quantity;
  select r.id, r.base_cost, r.min_order_qty, r.lead_time_days, r.supplier_tier, r.base_quality_tier into requirement
  from public.merch_item_requirements r
  where r.id = new.product_requirement_id or (new.product_requirement_id is null and r.item_type = new.item_type)
  order by (r.id = new.product_requirement_id) desc limit 1;
  if not found then raise exception 'No supplier configuration exists for merchandise type %', new.item_type; end if;
  if added_qty < coalesce(requirement.min_order_qty,1) then raise exception 'Minimum production run for % is % units', new.item_type, coalesce(requirement.min_order_qty,1); end if;

  ready_days := greatest(1, coalesce(requirement.lead_time_days,new.lead_time_days,1));
  discount_pct := case when added_qty >= 1000 then 0.15 when added_qty >= 500 then 0.10 when added_qty >= 100 then 0.05 else 0 end;
  effective_cost := coalesce(requirement.base_cost,new.cost_to_produce,0) * (1-discount_pct);
  total_cost := round((effective_cost * added_qty)::numeric,2);
  charge_amount := greatest(0,round(total_cost)::integer);

  select coalesce(band_balance,0) into current_balance from public.bands where id=new.band_id for update;
  if not found then raise exception 'Band not found'; end if;
  if current_balance < charge_amount then raise exception 'Insufficient band funds: production costs $%, available $%', charge_amount, current_balance; end if;

  quality_score := case coalesce(requirement.supplier_tier,requirement.base_quality_tier,new.supplier_tier,'standard') when 'premium' then 88 when 'budget' then 60 else 74 end;
  insert into public.band_earnings(band_id,amount,source,description,metadata)
  values(new.band_id,-charge_amount,'merchandise_production',format('Merch production: %s units of %s',added_qty,coalesce(new.design_name,new.item_type,'merchandise')),jsonb_build_object('merchandise_id',new.id,'quantity',added_qty,'unit_cost',effective_cost,'total_cost',total_cost,'discount_pct',discount_pct));

  new.stock_quantity := old.stock_quantity;
  new.pending_quantity := added_qty;
  new.production_status := 'ordered';
  new.production_ordered_at := now();
  new.production_ready_at := now() + make_interval(days => ready_days);
  new.is_rush_order := false;
  new.production_discount_pct := discount_pct;
  new.production_total_cost := total_cost;
  new.production_quality := quality_score;
  new.product_requirement_id := coalesce(new.product_requirement_id,requirement.id);
  new.cost_to_produce := coalesce(requirement.base_cost,new.cost_to_produce,0);
  new.lead_time_days := ready_days;
  new.supplier_tier := coalesce(requirement.supplier_tier,requirement.base_quality_tier,new.supplier_tier);
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.queue_initial_merch_production()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_qty integer := greatest(0,coalesce(new.stock_quantity,0));
  requirement record;
  discount_pct numeric := 0;
  effective_cost numeric;
  total_cost numeric;
  charge_amount integer;
  ready_days integer;
  quality_score numeric;
  current_balance integer;
begin
  if requested_qty <= 0 then new.stock_quantity := 0; return new; end if;
  select r.id,r.base_cost,r.min_order_qty,r.lead_time_days,r.supplier_tier,r.base_quality_tier into requirement
  from public.merch_item_requirements r
  where r.id=new.product_requirement_id or (new.product_requirement_id is null and r.item_type=new.item_type)
  order by (r.id=new.product_requirement_id) desc limit 1;
  if not found then raise exception 'No supplier configuration exists for merchandise type %',new.item_type; end if;
  if requested_qty < coalesce(requirement.min_order_qty,1) then raise exception 'Minimum production run for % is % units',new.item_type,coalesce(requirement.min_order_qty,1); end if;

  ready_days := greatest(1,coalesce(requirement.lead_time_days,new.lead_time_days,1));
  discount_pct := case when requested_qty >= 1000 then 0.15 when requested_qty >= 500 then 0.10 when requested_qty >= 100 then 0.05 else 0 end;
  effective_cost := coalesce(requirement.base_cost,new.cost_to_produce,0) * (1-discount_pct);
  total_cost := round((effective_cost * requested_qty)::numeric,2);
  charge_amount := greatest(0,round(total_cost)::integer);
  select coalesce(band_balance,0) into current_balance from public.bands where id=new.band_id for update;
  if not found then raise exception 'Band not found'; end if;
  if current_balance < charge_amount then raise exception 'Insufficient band funds: production costs $%, available $%',charge_amount,current_balance; end if;

  quality_score := case coalesce(requirement.supplier_tier,requirement.base_quality_tier,new.supplier_tier,'standard') when 'premium' then 88 when 'budget' then 60 else 74 end;
  new.stock_quantity := 0;
  new.pending_quantity := requested_qty;
  new.production_status := 'ordered';
  new.production_ordered_at := now();
  new.production_ready_at := now() + make_interval(days => ready_days);
  new.is_rush_order := false;
  new.production_discount_pct := discount_pct;
  new.production_total_cost := total_cost;
  new.production_quality := quality_score;
  new.product_requirement_id := coalesce(new.product_requirement_id,requirement.id);
  new.cost_to_produce := coalesce(requirement.base_cost,new.cost_to_produce,0);
  new.lead_time_days := ready_days;
  new.supplier_tier := coalesce(requirement.supplier_tier,requirement.base_quality_tier,new.supplier_tier);
  new.updated_at := now();

  insert into public.band_earnings(band_id,amount,source,description,metadata)
  values(new.band_id,-charge_amount,'merchandise_production',format('Initial merch production: %s units of %s',requested_qty,coalesce(new.design_name,new.item_type,'merchandise')),jsonb_build_object('merchandise_id',new.id,'quantity',requested_qty,'unit_cost',effective_cost,'total_cost',total_cost,'discount_pct',discount_pct));
  return new;
end;
$$;

drop trigger if exists trg_queue_initial_merch_production on public.player_merchandise;
create trigger trg_queue_initial_merch_production before insert on public.player_merchandise for each row execute function public.queue_initial_merch_production();

revoke all on function public.queue_merch_restock_order() from public, anon, authenticated;
revoke all on function public.queue_initial_merch_production() from public, anon, authenticated;

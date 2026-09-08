-- Enforce merchandise manufacturing and payment at the database boundary.
-- This prevents old or alternate clients from creating free physical stock.

create or replace function public.prepare_merch_production_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  requirement record;
  requested_qty integer;
  discount_pct numeric := 0;
  rush_multiplier numeric := 1;
  effective_cost numeric := 0;
  ready_days integer := 0;
  quality_score numeric := 74;
begin
  select r.base_cost, r.min_order_qty, r.lead_time_days, r.supplier_tier,
         r.base_quality_tier, r.product_kind
    into requirement
  from public.merch_item_requirements r
  where r.id = new.product_requirement_id
     or (new.product_requirement_id is null and r.item_type = new.item_type)
  order by (r.id = new.product_requirement_id) desc
  limit 1;

  requested_qty := greatest(0, coalesce(new.stock_quantity, 0)) +
                   greatest(0, coalesce(new.pending_quantity, 0));
  if requested_qty <= 0 then
    return new;
  end if;

  discount_pct := case
    when requested_qty >= 1000 then 0.15
    when requested_qty >= 500 then 0.10
    when requested_qty >= 100 then 0.05
    else 0
  end;

  rush_multiplier := case when coalesce(new.is_rush_order, false) then 1.25 else 1 end;
  effective_cost := coalesce(requirement.base_cost, new.cost_to_produce, 0) *
                    (1 - discount_pct) * rush_multiplier;
  ready_days := coalesce(requirement.lead_time_days, new.lead_time_days, 0);

  if coalesce(new.is_rush_order, false) and ready_days > 1 then
    ready_days := greatest(1, ceil(ready_days::numeric / 2)::integer);
  end if;

  quality_score := case coalesce(
    requirement.supplier_tier,
    requirement.base_quality_tier,
    new.supplier_tier,
    'standard'
  )
    when 'premium' then 88
    when 'budget' then 60
    else 74
  end - case when coalesce(new.is_rush_order, false) then 5 else 0 end;

  if coalesce(requirement.product_kind, 'physical') = 'physical' and ready_days > 0 then
    if requested_qty < coalesce(requirement.min_order_qty, 1) then
      raise exception 'Minimum production run for % is % units',
        new.item_type,
        coalesce(requirement.min_order_qty, 1);
    end if;

    new.stock_quantity := 0;
    new.pending_quantity := requested_qty;
    new.production_status := 'ordered';
    new.production_ordered_at := now();
    new.production_ready_at := now() + make_interval(days => ready_days);
    new.lead_time_days := ready_days;
  else
    new.stock_quantity := requested_qty;
    new.pending_quantity := 0;
    new.production_status := 'ready';
    new.production_ordered_at := coalesce(new.production_ordered_at, now());
    new.production_ready_at := coalesce(new.production_ready_at, now());
  end if;

  new.production_discount_pct := discount_pct;
  new.cost_to_produce := round(effective_cost::numeric, 2);
  new.production_total_cost := round((effective_cost * requested_qty)::numeric, 2);
  new.production_quality := greatest(1, quality_score);
  new.supplier_tier := coalesce(
    requirement.supplier_tier,
    requirement.base_quality_tier,
    new.supplier_tier
  );

  return new;
end;
$$;

drop trigger if exists trg_prepare_merch_production_insert on public.player_merchandise;
create trigger trg_prepare_merch_production_insert
before insert on public.player_merchandise
for each row
execute function public.prepare_merch_production_insert();

create or replace function public.charge_merch_production_order()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  amount_minor bigint;
  key_suffix text;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.production_total_cost, 0) <= 0 then
      return new;
    end if;
    key_suffix := 'initial';
  else
    if new.production_ordered_at is not distinct from old.production_ordered_at
       or coalesce(new.pending_quantity, 0) <= coalesce(old.pending_quantity, 0)
       or coalesce(new.production_total_cost, 0) <= 0 then
      return new;
    end if;
    key_suffix := replace(new.production_ordered_at::text, ' ', 'T');
  end if;

  amount_minor := round(new.production_total_cost * 100)::bigint;
  if amount_minor <= 0 then
    return new;
  end if;

  perform public.finance_debit_owner(
    'band'::public.financial_owner_type,
    new.band_id,
    amount_minor,
    'merchandise_production_cost'::public.financial_transaction_category,
    'Merchandise production: ' || coalesce(new.design_name, new.item_type, 'product'),
    'merch-production:' || new.id::text || ':' || key_suffix,
    null,
    jsonb_build_object(
      'merchandise_id', new.id,
      'item_type', new.item_type,
      'quantity', case
        when tg_op = 'INSERT' then coalesce(new.pending_quantity, new.stock_quantity, 0)
        else coalesce(new.pending_quantity, 0) - coalesce(old.pending_quantity, 0)
      end,
      'rush_order', coalesce(new.is_rush_order, false),
      'bulk_discount_pct', coalesce(new.production_discount_pct, 0),
      'supplier_tier', new.supplier_tier
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_charge_merch_production_insert on public.player_merchandise;
create trigger trg_charge_merch_production_insert
after insert on public.player_merchandise
for each row
execute function public.charge_merch_production_order();

drop trigger if exists trg_charge_merch_production_restock on public.player_merchandise;
create trigger trg_charge_merch_production_restock
after update of stock_quantity on public.player_merchandise
for each row
execute function public.charge_merch_production_order();

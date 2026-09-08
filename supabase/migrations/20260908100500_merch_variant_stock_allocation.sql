-- Keep merch variant stock conserved against manufactured parent inventory.

create or replace function public.queue_merch_restock_order()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  added_qty integer;
  requirement record;
  discount_pct numeric := 0;
  effective_cost numeric;
  ready_days integer;
  quality_score numeric;
begin
  if coalesce(current_setting('app.merch_variant_transfer', true), '') = 'on' then
    return new;
  end if;

  if new.stock_quantity <= old.stock_quantity
     or new.pending_quantity is distinct from old.pending_quantity
     or new.production_ready_at is distinct from old.production_ready_at then
    return new;
  end if;

  added_qty := new.stock_quantity - old.stock_quantity;

  select r.base_cost, r.min_order_qty, r.lead_time_days, r.supplier_tier, r.base_quality_tier
    into requirement
  from public.merch_item_requirements r
  where r.id = new.product_requirement_id
     or (new.product_requirement_id is null and r.item_type = new.item_type)
  order by (r.id = new.product_requirement_id) desc
  limit 1;

  ready_days := coalesce(requirement.lead_time_days, new.lead_time_days, 0);
  if ready_days <= 0 then return new; end if;

  if added_qty < coalesce(requirement.min_order_qty, 1) then
    raise exception 'Minimum production run for % is % units', new.item_type, coalesce(requirement.min_order_qty, 1);
  end if;

  discount_pct := case
    when added_qty >= 1000 then 0.15
    when added_qty >= 500 then 0.10
    when added_qty >= 100 then 0.05
    else 0
  end;
  effective_cost := coalesce(requirement.base_cost, new.cost_to_produce, 0) * (1 - discount_pct);
  quality_score := case coalesce(requirement.supplier_tier, requirement.base_quality_tier, new.supplier_tier, 'standard')
    when 'premium' then 88
    when 'budget' then 60
    else 74
  end;

  new.stock_quantity := old.stock_quantity;
  new.pending_quantity := coalesce(old.pending_quantity, 0) + added_qty;
  new.production_status := 'ordered';
  new.production_ordered_at := now();
  new.production_ready_at := greatest(coalesce(old.production_ready_at, now()), now() + make_interval(days => ready_days));
  new.is_rush_order := false;
  new.production_discount_pct := discount_pct;
  new.production_total_cost := round((effective_cost * added_qty)::numeric, 2);
  new.production_quality := quality_score;
  new.lead_time_days := ready_days;
  new.supplier_tier := coalesce(requirement.supplier_tier, requirement.base_quality_tier, new.supplier_tier);
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.guard_merch_variant_stock()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(current_setting('app.merch_variant_transfer', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT' and coalesce(new.stock_quantity, 0) > 0 then
    raise exception 'Variant stock must be allocated from manufactured parent inventory';
  end if;
  if tg_op = 'UPDATE' and coalesce(new.stock_quantity, 0) > coalesce(old.stock_quantity, 0) then
    raise exception 'Variant stock increases must be allocated from manufactured parent inventory';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_merch_variant_stock on public.merch_variants;
create trigger trg_guard_merch_variant_stock
before insert or update of stock_quantity on public.merch_variants
for each row execute function public.guard_merch_variant_stock();

create or replace function public.allocate_merch_variant_stock(p_variant_id uuid, p_quantity integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v record;
  p record;
begin
  if p_quantity <= 0 then raise exception 'Allocation quantity must be greater than zero'; end if;
  select * into v from public.merch_variants where id = p_variant_id for update;
  if not found then raise exception 'Variant not found'; end if;
  select id, band_id, stock_quantity into p from public.player_merchandise where id = v.merchandise_id for update;
  if not found then raise exception 'Parent merchandise not found'; end if;
  if not public.user_has_band_access(p.band_id) then raise exception 'You do not have access to this band merchandise'; end if;
  if coalesce(p.stock_quantity, 0) < p_quantity then
    raise exception 'Only % unallocated sellable units are available', coalesce(p.stock_quantity, 0);
  end if;

  perform set_config('app.merch_variant_transfer', 'on', true);
  update public.player_merchandise set stock_quantity = stock_quantity - p_quantity, updated_at = now() where id = p.id;
  update public.merch_variants set stock_quantity = stock_quantity + p_quantity, updated_at = now() where id = p_variant_id;

  return jsonb_build_object('variant_id', p_variant_id, 'allocated', p_quantity, 'parent_remaining', p.stock_quantity - p_quantity);
end;
$$;

create or replace function public.release_merch_variant_stock(p_variant_id uuid, p_quantity integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v record;
  p record;
begin
  if p_quantity <= 0 then raise exception 'Release quantity must be greater than zero'; end if;
  select * into v from public.merch_variants where id = p_variant_id for update;
  if not found then raise exception 'Variant not found'; end if;
  if coalesce(v.stock_quantity, 0) < p_quantity then
    raise exception 'Variant only has % units available', coalesce(v.stock_quantity, 0);
  end if;
  select id, band_id, stock_quantity into p from public.player_merchandise where id = v.merchandise_id for update;
  if not found then raise exception 'Parent merchandise not found'; end if;
  if not public.user_has_band_access(p.band_id) then raise exception 'You do not have access to this band merchandise'; end if;

  perform set_config('app.merch_variant_transfer', 'on', true);
  update public.merch_variants set stock_quantity = stock_quantity - p_quantity, updated_at = now() where id = p_variant_id;
  update public.player_merchandise set stock_quantity = stock_quantity + p_quantity, updated_at = now() where id = p.id;

  return jsonb_build_object('variant_id', p_variant_id, 'released', p_quantity, 'parent_stock', p.stock_quantity + p_quantity);
end;
$$;

create or replace function public.return_merch_variant_stock_on_delete()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(old.stock_quantity, 0) > 0 then
    perform set_config('app.merch_variant_transfer', 'on', true);
    update public.player_merchandise
    set stock_quantity = stock_quantity + old.stock_quantity, updated_at = now()
    where id = old.merchandise_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_return_merch_variant_stock_on_delete on public.merch_variants;
create trigger trg_return_merch_variant_stock_on_delete
before delete on public.merch_variants
for each row execute function public.return_merch_variant_stock_on_delete();

revoke all on function public.allocate_merch_variant_stock(uuid, integer) from public, anon;
revoke all on function public.release_merch_variant_stock(uuid, integer) from public, anon;
grant execute on function public.allocate_merch_variant_stock(uuid, integer) to authenticated;
grant execute on function public.release_merch_variant_stock(uuid, integer) to authenticated;

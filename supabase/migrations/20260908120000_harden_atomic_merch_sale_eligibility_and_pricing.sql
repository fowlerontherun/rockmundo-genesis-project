-- Make the atomic merch sale RPC authoritative for sale eligibility and pricing.
create or replace function public.record_merch_sale_atomic(
  p_band_id uuid,
  p_merchandise_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_unit_price integer,
  p_total_price integer,
  p_sales_tax numeric,
  p_vat numeric,
  p_net_revenue numeric,
  p_order_type text,
  p_customer_type text,
  p_country text,
  p_discount_pct numeric default 0
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_merch record;
  v_variant record;
  v_order_id uuid;
  v_remaining integer;
  v_has_active_variants boolean;
  v_customer_type text := coalesce(nullif(p_customer_type,''), 'fan');
  v_discount_pct numeric;
  v_base_price integer;
  v_unit_price integer;
  v_subtotal integer;
  v_sales_tax numeric := greatest(0, coalesce(p_sales_tax,0));
  v_vat numeric := greatest(0, coalesce(p_vat,0));
  v_total_price integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Merch sale quantity must be greater than zero';
  end if;

  select id, band_id, stock_quantity, selling_price, drop_starts_at,
         available_until, superfan_only
  into v_merch
  from public.player_merchandise
  where id = p_merchandise_id
  for update;

  if not found then raise exception 'Merchandise not found'; end if;
  if v_merch.band_id <> p_band_id then raise exception 'Merchandise does not belong to this band'; end if;
  if v_merch.drop_starts_at is not null and v_merch.drop_starts_at > now() then
    return jsonb_build_object('sold', false, 'reason', 'not_released', 'remaining_stock', coalesce(v_merch.stock_quantity,0));
  end if;
  if v_merch.available_until is not null and v_merch.available_until <= now() then
    return jsonb_build_object('sold', false, 'reason', 'expired', 'remaining_stock', coalesce(v_merch.stock_quantity,0));
  end if;
  if coalesce(v_merch.superfan_only,false) and v_customer_type <> 'superfan' then
    return jsonb_build_object('sold', false, 'reason', 'superfan_only', 'remaining_stock', coalesce(v_merch.stock_quantity,0));
  end if;

  select exists(
    select 1 from public.merch_variants mv
    where mv.merchandise_id = p_merchandise_id and mv.is_active = true
  ) into v_has_active_variants;

  if p_variant_id is null and v_has_active_variants then
    return jsonb_build_object('sold', false, 'reason', 'variant_required', 'remaining_stock', coalesce(v_merch.stock_quantity,0));
  end if;

  if p_variant_id is null then
    if coalesce(v_merch.stock_quantity, 0) < p_quantity then
      return jsonb_build_object('sold', false, 'reason', 'insufficient_stock', 'remaining_stock', coalesce(v_merch.stock_quantity, 0));
    end if;
    v_base_price := greatest(1, coalesce(v_merch.selling_price, 1));
  else
    select id, merchandise_id, stock_quantity, is_active, selling_price_override
    into v_variant
    from public.merch_variants
    where id = p_variant_id
    for update;

    if not found or v_variant.merchandise_id <> p_merchandise_id then raise exception 'Variant does not belong to this merchandise'; end if;
    if not coalesce(v_variant.is_active, false) then
      return jsonb_build_object('sold', false, 'reason', 'variant_inactive', 'remaining_stock', coalesce(v_variant.stock_quantity, 0));
    end if;
    if coalesce(v_variant.stock_quantity, 0) < p_quantity then
      return jsonb_build_object('sold', false, 'reason', 'insufficient_stock', 'remaining_stock', coalesce(v_variant.stock_quantity, 0));
    end if;
    v_base_price := greatest(1, coalesce(v_variant.selling_price_override, v_merch.selling_price, 1));
  end if;

  v_discount_pct := case v_customer_type when 'superfan' then 10 when 'collector' then 5 else 0 end;
  v_unit_price := greatest(1, round(v_base_price * (1 - v_discount_pct / 100.0))::integer);
  v_subtotal := v_unit_price * p_quantity;
  v_total_price := greatest(0, round(v_subtotal + v_sales_tax + v_vat)::integer);

  if p_variant_id is null then
    update public.player_merchandise
      set stock_quantity = stock_quantity - p_quantity, updated_at = now()
    where id = p_merchandise_id
    returning stock_quantity into v_remaining;
  else
    update public.merch_variants
      set stock_quantity = stock_quantity - p_quantity, updated_at = now()
    where id = p_variant_id
    returning stock_quantity into v_remaining;
  end if;

  insert into public.merch_orders(
    band_id, merchandise_id, variant_id, quantity, unit_price, total_price,
    sales_tax, vat, net_revenue, order_type, customer_type, country, discount_pct
  ) values (
    p_band_id, p_merchandise_id, p_variant_id, p_quantity, v_unit_price, v_total_price,
    v_sales_tax, v_vat, v_subtotal,
    coalesce(nullif(p_order_type,''),'online'), v_customer_type,
    p_country, v_discount_pct
  ) returning id into v_order_id;

  if v_remaining = 0 then
    insert into public.merch_stockout_events(band_id, merchandise_id, variant_id, channel)
    values (p_band_id, p_merchandise_id, p_variant_id, coalesce(nullif(p_order_type,''),'online'));
  end if;

  return jsonb_build_object(
    'sold', true,
    'order_id', v_order_id,
    'remaining_stock', v_remaining,
    'stockout', v_remaining = 0,
    'unit_price', v_unit_price,
    'subtotal', v_subtotal,
    'total_price', v_total_price,
    'discount_pct', v_discount_pct
  );
end;
$$;

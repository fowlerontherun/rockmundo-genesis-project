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
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_merch record;
  v_variant record;
  v_order_id uuid;
  v_remaining integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Merch sale quantity must be greater than zero';
  end if;
  if p_unit_price is null or p_unit_price < 0 or p_total_price is null or p_total_price < 0 then
    raise exception 'Merch sale prices cannot be negative';
  end if;

  select id, band_id, stock_quantity
    into v_merch
  from public.player_merchandise
  where id = p_merchandise_id
  for update;

  if not found then
    raise exception 'Merchandise not found';
  end if;
  if v_merch.band_id <> p_band_id then
    raise exception 'Merchandise does not belong to this band';
  end if;

  if p_variant_id is null then
    if coalesce(v_merch.stock_quantity, 0) < p_quantity then
      return jsonb_build_object('sold', false, 'reason', 'insufficient_stock', 'remaining_stock', coalesce(v_merch.stock_quantity, 0));
    end if;

    update public.player_merchandise
      set stock_quantity = stock_quantity - p_quantity,
          updated_at = now()
    where id = p_merchandise_id
    returning stock_quantity into v_remaining;
  else
    select id, merchandise_id, stock_quantity, is_active
      into v_variant
    from public.merch_variants
    where id = p_variant_id
    for update;

    if not found or v_variant.merchandise_id <> p_merchandise_id then
      raise exception 'Variant does not belong to this merchandise';
    end if;
    if not coalesce(v_variant.is_active, false) then
      return jsonb_build_object('sold', false, 'reason', 'variant_inactive', 'remaining_stock', coalesce(v_variant.stock_quantity, 0));
    end if;
    if coalesce(v_variant.stock_quantity, 0) < p_quantity then
      return jsonb_build_object('sold', false, 'reason', 'insufficient_stock', 'remaining_stock', coalesce(v_variant.stock_quantity, 0));
    end if;

    update public.merch_variants
      set stock_quantity = stock_quantity - p_quantity,
          updated_at = now()
    where id = p_variant_id
    returning stock_quantity into v_remaining;
  end if;

  insert into public.merch_orders(
    band_id, merchandise_id, variant_id, quantity, unit_price, total_price,
    sales_tax, vat, net_revenue, order_type, customer_type, country, discount_pct
  ) values (
    p_band_id, p_merchandise_id, p_variant_id, p_quantity, p_unit_price, p_total_price,
    coalesce(p_sales_tax,0), coalesce(p_vat,0), coalesce(p_net_revenue,0),
    coalesce(nullif(p_order_type,''),'online'), coalesce(nullif(p_customer_type,''),'fan'),
    p_country, coalesce(p_discount_pct,0)
  ) returning id into v_order_id;

  if v_remaining = 0 then
    insert into public.merch_stockout_events(band_id, merchandise_id, variant_id, channel)
    values (p_band_id, p_merchandise_id, p_variant_id, coalesce(nullif(p_order_type,''),'online'));
  end if;

  return jsonb_build_object(
    'sold', true,
    'order_id', v_order_id,
    'remaining_stock', v_remaining,
    'stockout', v_remaining = 0
  );
end;
$$;

revoke all on function public.record_merch_sale_atomic(uuid,uuid,uuid,integer,integer,integer,numeric,numeric,numeric,text,text,text,numeric) from public, anon, authenticated;
grant execute on function public.record_merch_sale_atomic(uuid,uuid,uuid,integer,integer,integer,numeric,numeric,numeric,text,text,text,numeric) to service_role, postgres;

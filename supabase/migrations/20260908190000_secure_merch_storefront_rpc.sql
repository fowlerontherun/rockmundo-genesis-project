drop policy if exists "Authenticated users view public merchandise" on public.player_merchandise;
drop policy if exists "Authenticated users view sellable merch variants" on public.merch_variants;

create or replace function public.get_public_band_merch_storefront(p_band_id uuid)
returns table (
  id uuid,
  band_id uuid,
  design_name text,
  item_type text,
  selling_price numeric,
  stock_quantity integer,
  design_data jsonb,
  artwork_url text,
  garment_color text,
  design_preview_url text,
  is_limited_edition boolean,
  limited_quantity integer,
  available_until timestamptz,
  variants jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    pm.id,
    pm.band_id,
    pm.design_name,
    pm.item_type,
    pm.selling_price,
    pm.stock_quantity,
    pm.design_data,
    pm.artwork_url,
    pm.garment_color,
    pm.design_preview_url,
    pm.is_limited_edition,
    pm.limited_quantity,
    pm.available_until,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', mv.id,
            'size', mv.size,
            'color', mv.color,
            'stock_quantity', mv.stock_quantity,
            'selling_price_override', mv.selling_price_override
          ) order by mv.size nulls last, mv.color nulls last
        )
        from public.merch_variants mv
        where mv.merchandise_id = pm.id
          and mv.is_active = true
          and mv.stock_quantity > 0
      ),
      '[]'::jsonb
    ) as variants
  from public.player_merchandise pm
  where pm.band_id = p_band_id
    and coalesce(pm.superfan_only, false) = false
    and pm.tour_exclusive_tour_id is null
    and (pm.drop_starts_at is null or pm.drop_starts_at <= now())
    and (pm.available_until is null or pm.available_until >= now())
    and (
      pm.stock_quantity > 0
      or exists (
        select 1
        from public.merch_variants mv
        where mv.merchandise_id = pm.id
          and mv.is_active = true
          and mv.stock_quantity > 0
      )
    )
  order by pm.created_at desc;
$$;

create or replace function public.get_festival_merch_storefront(p_festival_id uuid)
returns table (
  assignment_id uuid,
  band_id uuid,
  band_name text,
  merchandise_id uuid,
  design_name text,
  item_type text,
  selling_price numeric,
  stock_quantity integer,
  design_data jsonb,
  artwork_url text,
  garment_color text,
  design_preview_url text,
  is_limited_edition boolean,
  limited_quantity integer,
  available_until timestamptz,
  variants jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    fma.id as assignment_id,
    fma.band_id,
    b.name as band_name,
    pm.id as merchandise_id,
    pm.design_name,
    pm.item_type,
    pm.selling_price,
    pm.stock_quantity,
    pm.design_data,
    pm.artwork_url,
    pm.garment_color,
    pm.design_preview_url,
    pm.is_limited_edition,
    pm.limited_quantity,
    pm.available_until,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', mv.id,
            'size', mv.size,
            'color', mv.color,
            'stock_quantity', mv.stock_quantity,
            'selling_price_override', mv.selling_price_override
          ) order by mv.size nulls last, mv.color nulls last
        )
        from public.merch_variants mv
        where mv.merchandise_id = pm.id
          and mv.is_active = true
          and mv.stock_quantity > 0
      ),
      '[]'::jsonb
    ) as variants
  from public.festival_merch_assignments fma
  join public.bands b on b.id = fma.band_id
  join public.player_merchandise pm on pm.id = fma.merchandise_id and pm.band_id = fma.band_id
  where fma.festival_id = p_festival_id
    and coalesce(pm.superfan_only, false) = false
    and pm.tour_exclusive_tour_id is null
    and (pm.drop_starts_at is null or pm.drop_starts_at <= now())
    and (pm.available_until is null or pm.available_until >= now())
    and (
      pm.stock_quantity > 0
      or exists (
        select 1
        from public.merch_variants mv
        where mv.merchandise_id = pm.id
          and mv.is_active = true
          and mv.stock_quantity > 0
      )
    )
  order by fma.created_at asc;
$$;

revoke all on function public.get_public_band_merch_storefront(uuid) from public;
revoke all on function public.get_public_band_merch_storefront(uuid) from anon;
grant execute on function public.get_public_band_merch_storefront(uuid) to authenticated;

revoke all on function public.get_festival_merch_storefront(uuid) from public;
revoke all on function public.get_festival_merch_storefront(uuid) from anon;
grant execute on function public.get_festival_merch_storefront(uuid) to authenticated;

comment on function public.get_public_band_merch_storefront(uuid) is 'Returns only safe, currently sellable merchandise fields for authenticated band-profile storefronts.';
comment on function public.get_festival_merch_storefront(uuid) is 'Returns only safe, currently sellable merchandise fields assigned to a festival.';

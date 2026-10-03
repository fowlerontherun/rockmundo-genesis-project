-- Authoritative, read-only crowd adoption inputs for gig merch rendering.
-- Uses persisted band fame, real merch orders, stock and sale windows. Fan loyalty
-- remains neutral until RockMundo has a canonical persisted band/fan loyalty metric.
create or replace function public.get_gig_merch_crowd_signal(p_gig_id uuid)
returns table (
  gig_id uuid,
  band_id uuid,
  design_id uuid,
  fame_score integer,
  merch_popularity_score integer,
  on_sale boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with gig_band as (
    select g.id gig_id, g.band_id, greatest(0, coalesce(b.fame, 0))::bigint fame
    from public.gigs g
    join public.bands b on b.id = g.band_id
    where g.id = p_gig_id
  ),
  equipped as (
    select distinct on (td.id)
      gb.gig_id, gb.band_id, gb.fame, td.id design_id
    from gig_band gb
    join public.band_members bm on bm.band_id = gb.band_id and bm.status = 'active'
    join public.player_merch_wearables pmw on pmw.profile_id = bm.profile_id
    join public.tshirt_designs td on td.id = pmw.design_id and td.band_id = gb.band_id
    order by td.id, pmw.equipped_at desc
  ),
  product as (
    select e.*, pm.id merchandise_id,
      (coalesce(pm.stock_quantity, 0) > 0
       and (pm.drop_starts_at is null or pm.drop_starts_at <= now())
       and (pm.available_until is null or pm.available_until > now())
       and not coalesce(pm.superfan_only, false)) on_sale
    from equipped e
    left join lateral (
      select x.*
      from public.player_merchandise x
      where x.band_id = e.band_id
        and (
          x.design_data ->> 'tshirtDesignId' = e.design_id::text
          or x.design_data ->> 'designId' = e.design_id::text
          or x.design_name = (select design_name from public.tshirt_designs where id=e.design_id)
        )
      order by x.created_at desc
      limit 1
    ) pm on true
  ),
  sales as (
    select p.design_id, coalesce(sum(mo.quantity), 0)::bigint units
    from product p
    left join public.merch_orders mo on mo.merchandise_id = p.merchandise_id
    group by p.design_id
  ),
  ranked as (
    select p.*, s.units, max(s.units) over () max_units
    from product p join sales s using (design_id)
  )
  select r.gig_id, r.band_id, r.design_id,
    least(100, round(100 * ln(1 + r.fame::numeric) / ln(1 + 50000000::numeric)))::integer fame_score,
    case when r.max_units > 0 then round(100 * r.units::numeric / r.max_units)::integer else 0 end merch_popularity_score,
    coalesce(r.on_sale, false)
  from ranked r;
$$;

revoke all on function public.get_gig_merch_crowd_signal(uuid) from public, anon;
grant execute on function public.get_gig_merch_crowd_signal(uuid) to authenticated;
comment on function public.get_gig_merch_crowd_signal(uuid) is
  'Returns replay-safe crowd merch adoption inputs from authoritative fame, merch sales and current sale availability. Loyalty is intentionally omitted until canonical fan loyalty exists.';

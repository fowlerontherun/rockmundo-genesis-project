-- Harden gig crowd merch signals to use the canonical merchandise/design link.
-- Released Merch Studio products persist tshirt_designs.id in custom_design_id.
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
  products as (
    select e.gig_id, e.band_id, e.fame, e.design_id, pm.id merchandise_id,
      (
        (pm.drop_starts_at is null or pm.drop_starts_at <= now())
        and (pm.available_until is null or pm.available_until > now())
        and not coalesce(pm.superfan_only, false)
        and (
          coalesce(pm.stock_quantity, 0) > 0
          or exists (
            select 1 from public.merch_variants mv
            where mv.merchandise_id = pm.id
              and mv.is_active
              and coalesce(mv.stock_quantity, 0) > 0
          )
        )
      ) on_sale
    from equipped e
    left join public.player_merchandise pm
      on pm.band_id = e.band_id
     and pm.custom_design_id = e.design_id
  ),
  sales as (
    select p.design_id,
      coalesce(sum(mo.quantity) filter (where mo.id is not null), 0)::bigint units
    from products p
    left join public.merch_orders mo on mo.merchandise_id = p.merchandise_id
    group by p.design_id
  ),
  per_design as (
    select p.gig_id, p.band_id, p.fame, p.design_id,
      bool_or(coalesce(p.on_sale, false)) on_sale,
      s.units
    from products p
    join sales s using (design_id)
    group by p.gig_id, p.band_id, p.fame, p.design_id, s.units
  ),
  ranked as (
    select d.*, max(d.units) over () max_units
    from per_design d
  )
  select r.gig_id, r.band_id, r.design_id,
    least(100, round(100 * ln(1 + r.fame::numeric) / ln(1 + 50000000::numeric)))::integer fame_score,
    case when r.max_units > 0 then round(100 * r.units::numeric / r.max_units)::integer else 0 end merch_popularity_score,
    r.on_sale
  from ranked r;
$$;

revoke all on function public.get_gig_merch_crowd_signal(uuid) from public, anon;
grant execute on function public.get_gig_merch_crowd_signal(uuid) to authenticated;

comment on function public.get_gig_merch_crowd_signal(uuid) is
  'Returns crowd merch adoption inputs using canonical custom_design_id, persisted band fame, real merch order quantities, stock and sale windows.';

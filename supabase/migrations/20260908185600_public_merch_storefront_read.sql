drop policy if exists "Authenticated users view sellable merch variants" on public.merch_variants;
create policy "Authenticated users view sellable merch variants"
on public.merch_variants for select
to authenticated
using (is_active = true and stock_quantity > 0);

drop policy if exists "Authenticated users view public merchandise" on public.player_merchandise;
create policy "Authenticated users view public merchandise"
on public.player_merchandise for select
to authenticated
using (
  coalesce(superfan_only, false) = false
  and tour_exclusive_tour_id is null
  and (drop_starts_at is null or drop_starts_at <= now())
  and (available_until is null or available_until >= now())
  and (
    stock_quantity > 0
    or exists (
      select 1
      from public.merch_variants mv
      where mv.merchandise_id = player_merchandise.id
        and mv.is_active = true
        and mv.stock_quantity > 0
    )
  )
);

-- Notify active band members when a merchandise production run completes.
-- The scheduled completion function remains service-role-only.

create or replace function public.complete_due_merch_production()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  completed_count integer;
begin
  with completed as (
    update public.player_merchandise pm
    set stock_quantity = coalesce(pm.stock_quantity, 0) + pm.pending_quantity,
        pending_quantity = 0,
        production_status = 'ready',
        updated_at = now()
    where pm.production_status in ('ordered', 'in_production')
      and pm.pending_quantity > 0
      and pm.production_ready_at is not null
      and pm.production_ready_at <= now()
    returning
      pm.id,
      pm.band_id,
      pm.design_name,
      pm.item_type,
      pm.pending_quantity as completed_quantity,
      pm.is_rush_order,
      pm.production_discount_pct,
      pm.production_quality
  ), notified as (
    insert into public.notifications (
      user_id,
      profile_id,
      category,
      type,
      title,
      message,
      action_path,
      metadata
    )
    select
      bm.user_id,
      bm.profile_id,
      'band',
      'merch_production_complete',
      'Merch production complete',
      coalesce(c.design_name, c.item_type, 'Merchandise') ||
        ' is ready to sell (' || c.completed_quantity || ' units added to stock).',
      '/merchandise',
      jsonb_build_object(
        'merchandise_id', c.id,
        'band_id', c.band_id,
        'quantity', c.completed_quantity,
        'rush_order', c.is_rush_order,
        'bulk_discount_pct', c.production_discount_pct,
        'production_quality', c.production_quality
      )
    from completed c
    join public.band_members bm on bm.band_id = c.band_id
    where coalesce(bm.member_status, 'active') = 'active'
      and bm.user_id is not null
    returning 1
  )
  select count(*) into completed_count from completed;

  return completed_count;
end;
$$;

revoke all on function public.complete_due_merch_production() from public, anon, authenticated;
grant execute on function public.complete_due_merch_production() to service_role;

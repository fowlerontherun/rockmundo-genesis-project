-- Make the advertised Merch Manager auto-restock setting functional.
-- Orders route through the existing production and finance triggers.

create or replace function public.run_merch_manager_auto_restock()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  candidate record;
  order_qty integer;
  ordered_count integer := 0;
  failure_message text;
begin
  for candidate in
    select
      pm.id as merchandise_id,
      pm.band_id,
      pm.design_name,
      pm.item_type,
      pm.stock_quantity,
      pm.pending_quantity,
      mm.restock_threshold,
      mm.restock_quantity,
      coalesce(req.min_order_qty, 1) as min_order_qty
    from public.player_merchandise pm
    join public.merch_managers mm
      on mm.band_id = pm.band_id
     and mm.is_active = true
     and mm.auto_restock_enabled = true
    join public.merch_item_requirements req
      on req.id = pm.product_requirement_id
      or (pm.product_requirement_id is null and req.item_type = pm.item_type)
    where coalesce(req.product_kind, 'physical') = 'physical'
      and coalesce(pm.stock_quantity, 0) < greatest(1, mm.restock_threshold)
      and coalesce(pm.pending_quantity, 0) = 0
      and coalesce(pm.production_status, 'ready') not in ('ordered', 'in_production')
    order by pm.band_id, pm.stock_quantity asc
  loop
    order_qty := greatest(candidate.restock_quantity, candidate.min_order_qty, 1);

    begin
      update public.player_merchandise
      set stock_quantity = coalesce(stock_quantity, 0) + order_qty
      where id = candidate.merchandise_id;

      ordered_count := ordered_count + 1;
    exception when others then
      failure_message := sqlerrm;

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
        'merch_auto_restock_failed',
        'Merch auto-restock needs attention',
        coalesce(candidate.design_name, candidate.item_type, 'A merchandise item') ||
          ' could not be reordered: ' || failure_message,
        '/merchandise',
        jsonb_build_object(
          'merchandise_id', candidate.merchandise_id,
          'band_id', candidate.band_id,
          'quantity', order_qty,
          'error', failure_message
        )
      from public.band_members bm
      where bm.band_id = candidate.band_id
        and coalesce(bm.member_status, 'active') = 'active'
        and bm.user_id is not null;
    end;
  end loop;

  return ordered_count;
end;
$$;

revoke all on function public.run_merch_manager_auto_restock() from public, anon, authenticated;
grant execute on function public.run_merch_manager_auto_restock() to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'merch-manager-auto-restock';

select cron.schedule(
  'merch-manager-auto-restock',
  '27 * * * *',
  'select public.run_merch_manager_auto_restock();'
);

-- Merchandise production lifecycle
-- Keeps newly ordered merchandise out of sellable stock until supplier lead time completes.

alter table public.player_merchandise
  add column if not exists pending_quantity integer not null default 0,
  add column if not exists production_ordered_at timestamptz,
  add column if not exists production_ready_at timestamptz,
  add column if not exists is_rush_order boolean not null default false,
  add column if not exists production_discount_pct numeric not null default 0,
  add column if not exists production_total_cost numeric not null default 0,
  add column if not exists production_quality numeric;

alter table public.player_merchandise
  drop constraint if exists player_merchandise_pending_quantity_nonnegative,
  add constraint player_merchandise_pending_quantity_nonnegative
    check (pending_quantity >= 0),
  drop constraint if exists player_merchandise_production_discount_range,
  add constraint player_merchandise_production_discount_range
    check (production_discount_pct >= 0 and production_discount_pct <= 0.5);

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
    update public.player_merchandise
    set stock_quantity = coalesce(stock_quantity, 0) + pending_quantity,
        pending_quantity = 0,
        production_status = 'ready',
        updated_at = now()
    where production_status in ('ordered', 'in_production')
      and pending_quantity > 0
      and production_ready_at is not null
      and production_ready_at <= now()
    returning id
  )
  select count(*) into completed_count from completed;

  return completed_count;
end;
$$;

-- This is an internal scheduled maintenance function, not a player-facing RPC.
revoke all on function public.complete_due_merch_production() from public, anon, authenticated;
grant execute on function public.complete_due_merch_production() to service_role;

create index if not exists idx_player_merchandise_production_due
  on public.player_merchandise (production_status, production_ready_at)
  where pending_quantity > 0;

-- Catch the existing inventory page's direct stock increases and convert them
-- into supplier orders. This makes old restock clients respect manufacturing
-- lead times without allowing a client-side stock edit to bypass production.
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
  if ready_days <= 0 then
    return new;
  end if;

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
  new.production_ready_at := greatest(
    coalesce(old.production_ready_at, now()),
    now() + make_interval(days => ready_days)
  );
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

drop trigger if exists trg_queue_merch_restock_order on public.player_merchandise;
create trigger trg_queue_merch_restock_order
before update of stock_quantity on public.player_merchandise
for each row
execute function public.queue_merch_restock_order();

-- Managed Supabase runs pg_cron jobs as a privileged database role.
select cron.unschedule(jobid)
from cron.job
where jobname = 'complete-due-merch-production';

select cron.schedule(
  'complete-due-merch-production',
  '17 * * * *',
  'select public.complete_due_merch_production();'
);

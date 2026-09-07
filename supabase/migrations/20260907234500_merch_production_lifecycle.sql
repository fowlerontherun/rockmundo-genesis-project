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

-- Managed Supabase runs pg_cron jobs as a privileged database role.
select cron.unschedule(jobid)
from cron.job
where jobname = 'complete-due-merch-production';

select cron.schedule(
  'complete-due-merch-production',
  '17 * * * *',
  'select public.complete_due_merch_production();'
);

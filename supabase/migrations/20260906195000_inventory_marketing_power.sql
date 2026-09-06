-- Apply paid label marketing to physical record demand at the same atomic stock boundary
-- that prevents overselling. This keeps marketing effective even when ordinary hype is capped.
create or replace function public.claim_release_inventory(
  p_format_id uuid,
  p_organic_demand integer,
  p_backlog_request integer default 0,
  p_accumulate_unmet boolean default true
)
returns table(
  actual_sold integer,
  remaining_stock integer,
  stockout_demand integer,
  backlog_sold integer,
  unmet_demand_added integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_format public.release_formats%rowtype;
  v_stock integer;
  v_existing_backlog integer;
  v_marketing_power integer := 0;
  v_marketing_multiplier numeric := 1;
  v_organic integer;
  v_backlog_requested integer := greatest(coalesce(p_backlog_request, 0), 0);
  v_organic_sold integer;
  v_remaining_after_organic integer;
  v_backlog_sold integer;
  v_unmet integer;
  v_new_backlog integer;
begin
  select * into v_format
  from public.release_formats
  where id = p_format_id
  for update;

  if not found then
    raise exception 'Release format not found';
  end if;

  if v_format.format_type in ('digital', 'streaming') then
    raise exception 'Inventory claims are only valid for physical formats';
  end if;

  select greatest(0, least(100, coalesce(r.label_marketing_power,0)))
    into v_marketing_power
  from public.releases r
  where r.id = v_format.release_id;

  v_marketing_multiplier := 1 + (coalesce(v_marketing_power,0)::numeric / 200.0);
  v_organic := greatest(round(coalesce(p_organic_demand,0) * v_marketing_multiplier)::integer, 0);

  v_stock := greatest(coalesce(v_format.quantity, 0), 0);
  v_existing_backlog := greatest(coalesce(v_format.stockout_demand, 0), 0);

  v_organic_sold := least(v_stock, v_organic);
  v_remaining_after_organic := v_stock - v_organic_sold;
  v_backlog_sold := least(v_remaining_after_organic, least(v_backlog_requested, v_existing_backlog));
  v_unmet := case when p_accumulate_unmet then greatest(v_organic - v_organic_sold, 0) else 0 end;
  v_new_backlog := greatest(0, least(1000000, v_existing_backlog - v_backlog_sold + v_unmet));

  update public.release_formats
  set quantity = v_stock - v_organic_sold - v_backlog_sold,
      stockout_demand = v_new_backlog,
      last_stockout_at = case
        when v_unmet > 0 or (v_stock > 0 and v_stock - v_organic_sold - v_backlog_sold = 0 and v_organic > 0)
          then now()
        else last_stockout_at
      end,
      updated_at = now()
  where id = p_format_id;

  return query select
    v_organic_sold + v_backlog_sold,
    v_stock - v_organic_sold - v_backlog_sold,
    v_new_backlog,
    v_backlog_sold,
    v_unmet;
end;
$$;

revoke all on function public.claim_release_inventory(uuid,integer,integer,boolean) from public, anon, authenticated;
grant execute on function public.claim_release_inventory(uuid,integer,integer,boolean) to service_role;
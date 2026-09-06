-- Prevent physical release overselling, preserve sell-out demand momentum,
-- and make label marketing a real, upgradeable economic system.

alter table public.release_formats
  add column if not exists stockout_demand integer not null default 0,
  add column if not exists last_stockout_at timestamptz;

alter table public.release_formats
  drop constraint if exists release_formats_stockout_demand_check;
alter table public.release_formats
  add constraint release_formats_stockout_demand_check check (stockout_demand >= 0);

comment on column public.release_formats.stockout_demand is
  'Unfulfilled organic physical demand accumulated while stock is unavailable. Used as a capped sales-momentum boost after restocking.';

alter table public.labels
  add column if not exists marketing_level integer not null default 1;

alter table public.labels
  drop constraint if exists labels_marketing_level_check;
alter table public.labels
  add constraint labels_marketing_level_check check (marketing_level between 1 and 5);

comment on column public.labels.marketing_level is
  'Marketing department upgrade level (1-5). Higher levels improve campaign effectiveness and unlock larger weekly budgets.';

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
  v_organic integer := greatest(coalesce(p_organic_demand, 0), 0);
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

create or replace function public.restore_release_inventory_claim(
  p_format_id uuid,
  p_actual_sold integer,
  p_backlog_sold integer,
  p_unmet_demand_added integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.release_formats
  set quantity = greatest(0, coalesce(quantity,0) + greatest(coalesce(p_actual_sold,0),0)),
      stockout_demand = greatest(
        0,
        coalesce(stockout_demand,0)
          + greatest(coalesce(p_backlog_sold,0),0)
          - greatest(coalesce(p_unmet_demand_added,0),0)
      ),
      updated_at = now()
  where id = p_format_id;
end;
$$;
revoke all on function public.restore_release_inventory_claim(uuid,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.restore_release_inventory_claim(uuid,integer,integer,integer) to service_role;

create or replace function public.label_marketing_budget_cap(p_level integer)
returns numeric
language sql
immutable
as $$
  select case greatest(1, least(5, coalesce(p_level,1)))
    when 1 then 10000::numeric
    when 2 then 20000::numeric
    when 3 then 35000::numeric
    when 4 then 50000::numeric
    else 75000::numeric
  end;
$$;

create or replace function public.label_marketing_multiplier(p_level integer)
returns numeric
language sql
immutable
as $$
  select case greatest(1, least(5, coalesce(p_level,1)))
    when 1 then 1.00::numeric
    when 2 then 1.25::numeric
    when 3 then 1.55::numeric
    when 4 then 1.90::numeric
    else 2.30::numeric
  end;
$$;

grant execute on function public.label_marketing_budget_cap(integer) to authenticated, service_role;
grant execute on function public.label_marketing_multiplier(integer) to authenticated, service_role;

create or replace function public.set_label_marketing_budget(
  p_label_id uuid,
  p_weekly_budget numeric
)
returns table(weekly_budget numeric, marketing_level integer, budget_cap numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_label public.labels%rowtype;
  v_cap numeric;
begin
  if not public.is_label_team_member(p_label_id, array['owner','manager']::text[]) then
    raise exception 'Not authorized to manage label marketing';
  end if;

  select * into v_label from public.labels where id=p_label_id for update;
  if not found then raise exception 'Label not found'; end if;

  v_cap := public.label_marketing_budget_cap(v_label.marketing_level);
  if coalesce(p_weekly_budget,0) < 0 or p_weekly_budget > v_cap then
    raise exception 'Weekly marketing budget must be between $0 and $%', trim(to_char(v_cap,'FM999G999G990'));
  end if;

  update public.labels
  set weekly_marketing_budget = round(p_weekly_budget,2), updated_at=now()
  where id=p_label_id;

  return query select round(p_weekly_budget,2), v_label.marketing_level, v_cap;
end;
$$;
revoke all on function public.set_label_marketing_budget(uuid,numeric) from public, anon;
grant execute on function public.set_label_marketing_budget(uuid,numeric) to authenticated;

create or replace function public.upgrade_label_marketing(p_label_id uuid)
returns table(new_level integer, upgrade_cost numeric, effectiveness_multiplier numeric, weekly_budget_cap numeric, remaining_balance numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_label public.labels%rowtype;
  v_next integer;
  v_cost numeric;
begin
  if not public.is_label_team_member(p_label_id, array['owner','manager']::text[]) then
    raise exception 'Not authorized to upgrade label marketing';
  end if;

  select * into v_label from public.labels where id=p_label_id for update;
  if not found then raise exception 'Label not found'; end if;
  if coalesce(v_label.marketing_level,1) >= 5 then raise exception 'Marketing department is already max level'; end if;

  v_next := coalesce(v_label.marketing_level,1) + 1;
  v_cost := case v_next
    when 2 then 25000
    when 3 then 75000
    when 4 then 175000
    else 400000
  end;

  if coalesce(v_label.balance,0) < v_cost then
    raise exception 'Insufficient label balance for marketing upgrade';
  end if;

  update public.labels
  set balance=balance-v_cost, marketing_level=v_next, updated_at=now()
  where id=p_label_id
  returning balance into v_label.balance;

  insert into public.label_financial_transactions(label_id,transaction_type,amount,description)
  values(p_label_id,'expense',v_cost,format('Marketing department upgrade to level %s',v_next));

  return query select v_next, v_cost, public.label_marketing_multiplier(v_next), public.label_marketing_budget_cap(v_next), v_label.balance;
end;
$$;
revoke all on function public.upgrade_label_marketing(uuid) from public, anon;
grant execute on function public.upgrade_label_marketing(uuid) to authenticated;

create or replace function public.create_label_promotion_campaign(
  p_release_id uuid,
  p_campaign_type text,
  p_budget integer,
  p_start_date date,
  p_end_date date,
  p_channels text[],
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_label_release public.label_releases%rowtype;
  v_contract public.artist_label_contracts%rowtype;
  v_label public.labels%rowtype;
  v_campaign_id uuid;
  v_start date := coalesce(p_start_date,current_date);
  v_end date := coalesce(p_end_date,coalesce(p_start_date,current_date));
  v_effect numeric;
begin
  if coalesce(p_budget,0) <= 0 then raise exception 'Promotion budget must be greater than zero'; end if;
  if v_end < v_start then raise exception 'Campaign end date cannot be before start date'; end if;

  select * into v_label_release from public.label_releases where id=p_release_id;
  if not found then raise exception 'Label release not found'; end if;
  select * into v_contract from public.artist_label_contracts where id=v_label_release.contract_id;
  if not found then raise exception 'Label contract not found'; end if;

  if not public.is_label_team_member(v_contract.label_id,array['owner','manager']::text[]) then
    raise exception 'Not authorized to create label campaigns';
  end if;

  select * into v_label from public.labels where id=v_contract.label_id for update;
  if coalesce(v_label.balance,0) < p_budget then raise exception 'Insufficient label balance for promotion campaign'; end if;

  v_effect := least(100, round(sqrt(p_budget::numeric / 100.0) * 5 * public.label_marketing_multiplier(v_label.marketing_level),2));

  update public.labels set balance=balance-p_budget, updated_at=now() where id=v_label.id;
  insert into public.label_financial_transactions(label_id,transaction_type,amount,description,related_contract_id)
  values(v_label.id,'marketing',p_budget,format('%s campaign for "%s"',coalesce(nullif(trim(p_campaign_type),''),'Promotion'),v_label_release.title),v_contract.id);

  insert into public.label_promotion_campaigns(release_id,campaign_type,budget,start_date,end_date,channels,effectiveness,notes)
  values(p_release_id,coalesce(nullif(trim(p_campaign_type),''),'Campaign'),p_budget,v_start,v_end,coalesce(p_channels,'{}'::text[]),v_effect,p_notes)
  returning id into v_campaign_id;

  return v_campaign_id;
end;
$$;
revoke all on function public.create_label_promotion_campaign(uuid,text,integer,date,date,text[],text) from public, anon;
grant execute on function public.create_label_promotion_campaign(uuid,text,integer,date,date,text[],text) to authenticated;

create or replace function public.process_label_marketing_daily()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_label record;
  v_campaign record;
  v_budget numeric;
  v_daily_spend numeric;
  v_release_count integer;
  v_per_release numeric;
  v_hype integer;
  v_multiplier numeric;
  v_labels_processed integer := 0;
  v_releases_boosted integer := 0;
  v_campaigns_processed integer := 0;
  v_total_spend numeric := 0;
begin
  for v_label in
    select l.id,l.balance,l.weekly_marketing_budget,l.marketing_level
    from public.labels l
    where coalesce(l.weekly_marketing_budget,0)>0 and coalesce(l.is_bankrupt,false)=false
    for update
  loop
    v_budget := least(v_label.weekly_marketing_budget,public.label_marketing_budget_cap(v_label.marketing_level));
    v_daily_spend := round(v_budget/7.0,2);
    if v_daily_spend<=0 or coalesce(v_label.balance,0)<v_daily_spend then continue; end if;

    select count(*) into v_release_count
    from public.releases r
    where r.band_id in (
      select alc.band_id from public.artist_label_contracts alc
      where alc.label_id=v_label.id and alc.status='active' and alc.band_id is not null
    )
    and r.release_status in ('released','manufacturing')
    and (r.release_status='manufacturing' or (r.manufacturing_complete_at is not null and r.manufacturing_complete_at >= now()-interval '90 days'));

    if v_release_count=0 then continue; end if;

    v_per_release := v_daily_spend/v_release_count;
    v_multiplier := public.label_marketing_multiplier(v_label.marketing_level);
    v_hype := least(80,greatest(1,round(sqrt(v_per_release/10.0)*v_multiplier)::integer));

    update public.labels set balance=balance-v_daily_spend, updated_at=now() where id=v_label.id;
    insert into public.label_financial_transactions(label_id,transaction_type,amount,description)
    values(v_label.id,'marketing',v_daily_spend,format('Daily label marketing: %s release(s), level %s, +%s hype each',v_release_count,v_label.marketing_level,v_hype));

    update public.releases r
    set hype_score=least(1000,coalesce(r.hype_score,0)+v_hype), updated_at=now()
    where r.band_id in (
      select alc.band_id from public.artist_label_contracts alc
      where alc.label_id=v_label.id and alc.status='active' and alc.band_id is not null
    )
    and r.release_status in ('released','manufacturing')
    and (r.release_status='manufacturing' or (r.manufacturing_complete_at is not null and r.manufacturing_complete_at >= now()-interval '90 days'));

    v_labels_processed := v_labels_processed+1;
    v_releases_boosted := v_releases_boosted+v_release_count;
    v_total_spend := v_total_spend+v_daily_spend;
  end loop;

  for v_campaign in
    select c.id,c.budget,c.start_date,c.end_date,c.effectiveness,
           lr.release_id as canonical_release_id,
           alc.label_id,l.marketing_level
    from public.label_promotion_campaigns c
    join public.label_releases lr on lr.id=c.release_id
    join public.artist_label_contracts alc on alc.id=lr.contract_id
    join public.labels l on l.id=alc.label_id
    where current_date between coalesce(c.start_date,current_date) and coalesce(c.end_date,current_date)
      and lr.release_id is not null
  loop
    v_multiplier := public.label_marketing_multiplier(v_campaign.marketing_level);
    v_hype := least(100,greatest(1,round(
      sqrt((v_campaign.budget::numeric / greatest(1,(coalesce(v_campaign.end_date,current_date)-coalesce(v_campaign.start_date,current_date)+1))) / 10.0)
      * v_multiplier
    )::integer));

    update public.releases
    set hype_score=least(1000,coalesce(hype_score,0)+v_hype), updated_at=now()
    where id=v_campaign.canonical_release_id;

    update public.label_promotion_campaigns
    set effectiveness=greatest(coalesce(effectiveness,0),v_hype), updated_at=now()
    where id=v_campaign.id;

    v_campaigns_processed:=v_campaigns_processed+1;
    v_releases_boosted:=v_releases_boosted+1;
  end loop;

  return jsonb_build_object(
    'labels_processed',v_labels_processed,
    'releases_boosted',v_releases_boosted,
    'campaigns_processed',v_campaigns_processed,
    'total_spend',round(v_total_spend,2)
  );
end;
$$;
revoke all on function public.process_label_marketing_daily() from public, anon, authenticated;
grant execute on function public.process_label_marketing_daily() to service_role;

create or replace function public.mark_label_manufacturing_paid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delta integer;
begin
  v_delta := case when tg_op='INSERT' then coalesce(new.manufacturing_cost,0)
                  else greatest(coalesce(new.manufacturing_cost,0)-coalesce(old.manufacturing_cost,0),0) end;
  if v_delta>0 and exists(
    select 1 from public.releases r
    join public.artist_label_contracts alc on alc.id=r.label_contract_id
    where r.id=new.release_id and alc.status='active' and coalesce(alc.manufacturing_covered,false)
  ) then
    update public.releases set manufacturing_paid_by_label=true where id=new.release_id;
  end if;
  return new;
end;
$$;

drop trigger if exists mark_label_manufacturing_paid_trigger on public.release_formats;
create trigger mark_label_manufacturing_paid_trigger
after insert or update of manufacturing_cost on public.release_formats
for each row execute function public.mark_label_manufacturing_paid();

update public.releases r
set manufacturing_paid_by_label=true
where coalesce(r.manufacturing_paid_by_label,false)=false
  and exists(
    select 1 from public.release_cost_transactions rct
    where rct.release_id=r.id and rct.payer_type='label'
      and rct.cost_type in ('manufacturing','stock_reorder','additional_format')
  );
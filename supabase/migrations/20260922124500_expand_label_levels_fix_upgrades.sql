-- Expand record-label progression and repair marketing upgrade authority/stat foundations.

alter table public.labels drop constraint if exists labels_marketing_level_check;
alter table public.labels add constraint labels_marketing_level_check check (marketing_level between 1 and 10);

comment on column public.labels.marketing_level is
  'Marketing department level (1-10). Higher levels improve effectiveness and unlock larger weekly budgets.';

create or replace function public.label_marketing_budget_cap(p_level integer)
returns numeric language sql immutable as $$
  select case greatest(1,least(10,coalesce(p_level,1)))
    when 1 then 10000::numeric
    when 2 then 25000::numeric
    when 3 then 60000::numeric
    when 4 then 150000::numeric
    when 5 then 500000::numeric
    when 6 then 750000::numeric
    when 7 then 1000000::numeric
    when 8 then 1500000::numeric
    when 9 then 2250000::numeric
    else 3000000::numeric
  end
$$;

create or replace function public.label_marketing_multiplier(p_level integer)
returns numeric language sql immutable as $$
  select case greatest(1,least(10,coalesce(p_level,1)))
    when 1 then 1.00::numeric
    when 2 then 1.25::numeric
    when 3 then 1.55::numeric
    when 4 then 1.90::numeric
    when 5 then 2.30::numeric
    when 6 then 2.70::numeric
    when 7 then 3.15::numeric
    when 8 then 3.65::numeric
    when 9 then 4.20::numeric
    else 4.80::numeric
  end
$$;

create or replace function public.label_marketing_upgrade_cost(p_next_level integer)
returns numeric language sql immutable as $$
  select case greatest(2,least(10,coalesce(p_next_level,2)))
    when 2 then 25000::numeric
    when 3 then 75000::numeric
    when 4 then 175000::numeric
    when 5 then 400000::numeric
    when 6 then 750000::numeric
    when 7 then 1250000::numeric
    when 8 then 2000000::numeric
    when 9 then 3250000::numeric
    else 5000000::numeric
  end
$$;

grant execute on function public.label_marketing_budget_cap(integer) to authenticated,service_role;
grant execute on function public.label_marketing_multiplier(integer) to authenticated,service_role;
grant execute on function public.label_marketing_upgrade_cost(integer) to authenticated,service_role;

create or replace function public.set_label_marketing_budget(p_label_id uuid,p_weekly_budget numeric)
returns table(weekly_budget numeric,marketing_level integer,budget_cap numeric)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_label public.labels%rowtype; v_cap numeric;
begin
  if not public._can_manage_label(p_label_id) then raise exception 'Not authorised to manage label marketing'; end if;
  select * into v_label from public.labels where id=p_label_id for update;
  if not found then raise exception 'Label not found'; end if;
  v_cap:=public.label_marketing_budget_cap(v_label.marketing_level);
  if coalesce(p_weekly_budget,0)<0 or p_weekly_budget>v_cap then
    raise exception 'Weekly marketing budget must be between $0 and $%',trim(to_char(v_cap,'FM999G999G999G990'));
  end if;
  update public.labels set weekly_marketing_budget=round(p_weekly_budget,2),updated_at=now() where id=p_label_id;
  return query select round(p_weekly_budget,2),v_label.marketing_level,v_cap;
end $$;

revoke all on function public.set_label_marketing_budget(uuid,numeric) from public,anon;
grant execute on function public.set_label_marketing_budget(uuid,numeric) to authenticated;

create or replace function public.upgrade_label_marketing(p_label_id uuid)
returns table(new_level integer,upgrade_cost numeric,effectiveness_multiplier numeric,weekly_budget_cap numeric,remaining_balance numeric)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_label public.labels%rowtype; v_next integer; v_cost numeric;
begin
  if not public._can_manage_label(p_label_id) then raise exception 'Not authorised to upgrade label marketing'; end if;
  select * into v_label from public.labels where id=p_label_id for update;
  if not found then raise exception 'Label not found'; end if;
  if coalesce(v_label.marketing_level,1)>=10 then raise exception 'Marketing department is already max level'; end if;

  v_next:=coalesce(v_label.marketing_level,1)+1;
  v_cost:=public.label_marketing_upgrade_cost(v_next);
  if coalesce(v_label.balance,0)<v_cost then raise exception 'Insufficient label balance for marketing upgrade'; end if;

  update public.labels
  set balance=balance-v_cost,marketing_level=v_next,updated_at=now()
  where id=p_label_id returning balance into v_label.balance;

  insert into public.label_financial_transactions(label_id,transaction_type,amount,description)
  values(p_label_id,'expense',v_cost,format('Marketing department upgrade to level %s',v_next));

  return query select v_next,v_cost,public.label_marketing_multiplier(v_next),public.label_marketing_budget_cap(v_next),v_label.balance;
end $$;

revoke all on function public.upgrade_label_marketing(uuid) from public,anon;
grant execute on function public.upgrade_label_marketing(uuid) to authenticated;

-- Collapse any historical duplicate upgrade rows before enforcing one row per type.
delete from public.label_upgrades a
using public.label_upgrades b
where a.label_id=b.label_id
  and a.upgrade_type=b.upgrade_type
  and (a.upgrade_level<b.upgrade_level or (a.upgrade_level=b.upgrade_level and a.id>b.id));

create unique index if not exists uq_label_upgrades_label_type
  on public.label_upgrades(label_id,upgrade_type);

-- Generic label upgrades: atomic, server-authoritative, and ten levels deep.
create or replace function public.purchase_label_upgrade(p_label_id uuid,p_upgrade_type text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_label public.labels%rowtype; v_current integer:=0; v_next integer; v_base numeric; v_cost numeric; v_max integer:=10;
begin
  if not public._can_manage_label(p_label_id) then raise exception 'Not authorised'; end if;
  if p_upgrade_type not in ('roster_expansion','reputation_boost','studio_discount') then raise exception 'Invalid upgrade type'; end if;

  select * into v_label from public.labels where id=p_label_id for update;
  if not found then raise exception 'Label not found'; end if;

  select coalesce(upgrade_level,0) into v_current from public.label_upgrades
  where label_id=p_label_id and upgrade_type=p_upgrade_type limit 1;
  v_current:=coalesce(v_current,0);
  if v_current>=v_max then raise exception 'Upgrade already at maximum level'; end if;
  v_next:=v_current+1;

  v_base:=case p_upgrade_type
    when 'roster_expansion' then 250000
    when 'reputation_boost' then 200000
    else 500000 end;
  v_cost:=round(v_base*(1+((v_next-1)*0.65)),0);

  if coalesce(v_label.balance,0)<v_cost then raise exception 'Insufficient label funds'; end if;

  update public.labels set balance=balance-v_cost,updated_at=now() where id=p_label_id;

  insert into public.label_upgrades(label_id,upgrade_type,upgrade_level)
  values(p_label_id,p_upgrade_type,v_next)
  on conflict (label_id,upgrade_type) do update set upgrade_level=excluded.upgrade_level,purchased_at=now();

  if p_upgrade_type='roster_expansion' then
    update public.labels set roster_slot_capacity=coalesce(roster_slot_capacity,5)+3 where id=p_label_id;
  elsif p_upgrade_type='reputation_boost' then
    update public.labels set reputation_score=least(100,coalesce(reputation_score,0)+3) where id=p_label_id;
  end if;

  insert into public.label_transactions(label_id,transaction_type,amount,description)
  values(p_label_id,'upgrade',-v_cost,format('%s upgrade (Level %s)',replace(initcap(p_upgrade_type),'_',' '),v_next));

  insert into public.label_financial_transactions(label_id,transaction_type,amount,description)
  values(p_label_id,'expense',v_cost,format('%s upgrade (Level %s)',replace(initcap(p_upgrade_type),'_',' '),v_next));

  return jsonb_build_object('upgrade_type',p_upgrade_type,'new_level',v_next,'cost',v_cost);
end $$;

revoke all on function public.purchase_label_upgrade(uuid,text) from public,anon;
grant execute on function public.purchase_label_upgrade(uuid,text) to authenticated;

alter table public.labels
  add column if not exists upgrade_cooldowns jsonb not null default '{}'::jsonb;

comment on column public.labels.upgrade_cooldowns is
  'Server-authoritative last-upgrade timestamps keyed by label upgrade track. Each track has a 72-hour cooldown.';

update public.labels l
set upgrade_cooldowns = coalesce(l.upgrade_cooldowns,'{}'::jsonb) || coalesce(src.cooldowns,'{}'::jsonb)
from (
  select label_id,jsonb_object_agg(upgrade_type,to_jsonb(purchased_at)) as cooldowns
  from public.label_upgrades
  where purchased_at is not null
  group by label_id
) src
where src.label_id=l.id;

update public.labels l
set upgrade_cooldowns = coalesce(l.upgrade_cooldowns,'{}'::jsonb)
  || jsonb_build_object('marketing_department',to_jsonb(src.last_upgrade))
from (
  select label_id,max(created_at) as last_upgrade
  from public.label_financial_transactions
  where description ilike 'Marketing department upgrade to level %'
  group by label_id
) src
where src.label_id=l.id and src.last_upgrade is not null;

create or replace function public.get_label_upgrade_state(p_label_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare v_cooldowns jsonb; v_upgrades jsonb;
begin
  if not public._can_manage_label(p_label_id) then raise exception 'Not authorised'; end if;

  select coalesce(upgrade_cooldowns,'{}'::jsonb) into v_cooldowns
  from public.labels where id=p_label_id;
  if not found then raise exception 'Label not found'; end if;

  select coalesce(
    jsonb_object_agg(
      upgrade_type,
      jsonb_build_object(
        'level',upgrade_level,
        'last_upgraded_at',purchased_at,
        'cooldown_until',purchased_at+interval '3 days'
      )
    ),
    '{}'::jsonb
  )
  into v_upgrades
  from public.label_upgrades
  where label_id=p_label_id;

  return jsonb_build_object(
    'cooldown_hours',72,
    'server_now',now(),
    'generic',v_upgrades,
    'marketing',jsonb_build_object(
      'last_upgraded_at',v_cooldowns->>'marketing_department',
      'cooldown_until',case
        when nullif(v_cooldowns->>'marketing_department','') is null then null
        else ((v_cooldowns->>'marketing_department')::timestamptz+interval '3 days')
      end
    )
  );
end;
$$;

revoke all on function public.get_label_upgrade_state(uuid) from public,anon;
grant execute on function public.get_label_upgrade_state(uuid) to authenticated;

create or replace function public.upgrade_label_marketing(p_label_id uuid)
returns table(new_level integer,upgrade_cost numeric,effectiveness_multiplier numeric,weekly_budget_cap numeric,remaining_balance numeric)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_label public.labels%rowtype; v_next integer; v_cost numeric; v_last timestamptz;
begin
  if not public._can_manage_label(p_label_id) then raise exception 'Not authorised to upgrade label marketing'; end if;
  select * into v_label from public.labels where id=p_label_id for update;
  if not found then raise exception 'Label not found'; end if;
  if coalesce(v_label.marketing_level,1)>=10 then raise exception 'Marketing department is already max level'; end if;

  v_last:=nullif(v_label.upgrade_cooldowns->>'marketing_department','')::timestamptz;
  if v_last is not null and now()<v_last+interval '3 days' then
    raise exception 'Marketing Department is on cooldown until %',
      to_char(v_last+interval '3 days','DD Mon YYYY HH24:MI UTC');
  end if;

  v_next:=coalesce(v_label.marketing_level,1)+1;
  v_cost:=public.label_marketing_upgrade_cost(v_next);
  if coalesce(v_label.balance,0)<v_cost then raise exception 'Insufficient label balance for marketing upgrade'; end if;

  update public.labels
  set balance=balance-v_cost,
      marketing_level=v_next,
      upgrade_cooldowns=coalesce(upgrade_cooldowns,'{}'::jsonb)
        || jsonb_build_object('marketing_department',to_jsonb(now())),
      updated_at=now()
  where id=p_label_id
  returning balance into v_label.balance;

  insert into public.label_financial_transactions(label_id,transaction_type,amount,description)
  values(p_label_id,'expense',v_cost,format('Marketing department upgrade to level %s',v_next));

  return query select
    v_next::integer,
    v_cost::numeric,
    public.label_marketing_multiplier(v_next)::numeric,
    public.label_marketing_budget_cap(v_next)::numeric,
    v_label.balance::numeric;
end;
$$;

revoke all on function public.upgrade_label_marketing(uuid) from public,anon;
grant execute on function public.upgrade_label_marketing(uuid) to authenticated;

create or replace function public.purchase_label_upgrade(p_label_id uuid,p_upgrade_type text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_label public.labels%rowtype; v_current integer:=0; v_next integer;
  v_base numeric; v_cost numeric; v_max integer:=10; v_last timestamptz;
begin
  if not public._can_manage_label(p_label_id) then raise exception 'Not authorised'; end if;
  if p_upgrade_type not in ('roster_expansion','reputation_boost') then raise exception 'Invalid upgrade type'; end if;

  select * into v_label from public.labels where id=p_label_id for update;
  if not found then raise exception 'Label not found'; end if;

  select coalesce(upgrade_level,0),purchased_at into v_current,v_last
  from public.label_upgrades
  where label_id=p_label_id and upgrade_type=p_upgrade_type
  limit 1;
  v_current:=coalesce(v_current,0);

  if v_current>=v_max then raise exception 'Upgrade already at maximum level'; end if;
  if v_last is not null and now()<v_last+interval '3 days' then
    raise exception '% is on cooldown until %',
      replace(initcap(p_upgrade_type),'_',' '),
      to_char(v_last+interval '3 days','DD Mon YYYY HH24:MI UTC');
  end if;

  v_next:=v_current+1;
  v_base:=case p_upgrade_type
    when 'roster_expansion' then 250000
    when 'reputation_boost' then 200000
  end;
  v_cost:=round(v_base*(1+((v_next-1)*0.65)),0);

  if coalesce(v_label.balance,0)<v_cost then raise exception 'Insufficient label funds'; end if;

  update public.labels
  set balance=balance-v_cost,
      upgrade_cooldowns=coalesce(upgrade_cooldowns,'{}'::jsonb)
        || jsonb_build_object(p_upgrade_type,to_jsonb(now())),
      updated_at=now()
  where id=p_label_id;

  insert into public.label_upgrades(label_id,upgrade_type,upgrade_level,purchased_at)
  values(p_label_id,p_upgrade_type,v_next,now())
  on conflict (label_id,upgrade_type)
  do update set upgrade_level=excluded.upgrade_level,purchased_at=excluded.purchased_at;

  if p_upgrade_type='roster_expansion' then
    update public.labels set roster_slot_capacity=coalesce(roster_slot_capacity,5)+3 where id=p_label_id;
  elsif p_upgrade_type='reputation_boost' then
    update public.labels set reputation_score=least(100,coalesce(reputation_score,0)+3) where id=p_label_id;
  end if;

  insert into public.label_transactions(label_id,transaction_type,amount,description)
  values(p_label_id,'upgrade',-v_cost,format('%s upgrade (Level %s)',replace(initcap(p_upgrade_type),'_',' '),v_next));

  insert into public.label_financial_transactions(label_id,transaction_type,amount,description)
  values(p_label_id,'expense',v_cost,format('%s upgrade (Level %s)',replace(initcap(p_upgrade_type),'_',' '),v_next));

  return jsonb_build_object(
    'upgrade_type',p_upgrade_type,
    'new_level',v_next,
    'cost',v_cost,
    'cooldown_until',now()+interval '3 days'
  );
end;
$$;

revoke all on function public.purchase_label_upgrade(uuid,text) from public,anon;
grant execute on function public.purchase_label_upgrade(uuid,text) to authenticated;

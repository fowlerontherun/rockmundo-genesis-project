-- Label campaign strategy + finance integrity.
-- Gives labels priority-release targeting, channel/region focus and saturation,
-- while moving critical money movements behind atomic database boundaries.

alter table public.labels
  add column if not exists priority_release_id uuid references public.releases(id) on delete set null,
  add column if not exists marketing_focus text not null default 'balanced',
  add column if not exists marketing_regions text[] not null default array['global']::text[];

alter table public.labels drop constraint if exists labels_marketing_focus_check;
alter table public.labels add constraint labels_marketing_focus_check
  check (marketing_focus in ('balanced','radio','playlist','social','retail'));

alter table public.releases
  add column if not exists label_marketing_focus text not null default 'balanced',
  add column if not exists label_marketing_regions text[] not null default array['global']::text[],
  add column if not exists label_marketing_saturation numeric(6,2) not null default 0;

alter table public.releases drop constraint if exists releases_label_marketing_saturation_check;
alter table public.releases add constraint releases_label_marketing_saturation_check
  check (label_marketing_saturation between 0 and 100);

create or replace function public._can_manage_label(p_label_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.role()='service_role'
    or exists (
      select 1 from public.labels l
      left join public.companies c on c.id=l.company_id
      left join public.profiles p on p.id=l.owner_id
      left join public.profiles cp on cp.id=c.owner_id
      where l.id=p_label_id
        and (p.user_id=auth.uid() or cp.user_id=auth.uid())
    );
$$;

revoke all on function public._can_manage_label(uuid) from public,anon,authenticated;
grant execute on function public._can_manage_label(uuid) to authenticated,service_role;

create or replace function public.set_label_marketing_strategy(
  p_label_id uuid,
  p_priority_release_id uuid default null,
  p_focus text default 'balanced',
  p_regions text[] default array['global']::text[]
)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public._can_manage_label(p_label_id) then raise exception 'Not authorised'; end if;
  if p_focus not in ('balanced','radio','playlist','social','retail') then raise exception 'Invalid focus'; end if;
  if p_priority_release_id is not null and not exists (
    select 1 from public.releases r
    join public.artist_label_contracts c on c.id=r.label_contract_id
    where r.id=p_priority_release_id and c.label_id=p_label_id and c.status='active'
  ) then raise exception 'Priority release is not an active release for this label'; end if;

  update public.labels
  set priority_release_id=p_priority_release_id,
      marketing_focus=p_focus,
      marketing_regions=case when coalesce(array_length(p_regions,1),0)=0 then array['global']::text[] else p_regions end,
      updated_at=now()
  where id=p_label_id;
end $$;

revoke all on function public.set_label_marketing_strategy(uuid,uuid,text,text[]) from public,anon;
grant execute on function public.set_label_marketing_strategy(uuid,uuid,text,text[]) to authenticated,service_role;

create or replace function public.post_label_financial_transaction(
  p_label_id uuid,
  p_amount numeric,
  p_transaction_type text,
  p_description text,
  p_related_contract_id uuid default null
)
returns numeric language plpgsql security definer set search_path=public,pg_temp as $$
declare v_balance numeric;
begin
  if auth.role()<>'service_role' and not public._can_manage_label(p_label_id) then raise exception 'Not authorised'; end if;
  if coalesce(p_amount,0)=0 then raise exception 'Amount cannot be zero'; end if;

  update public.labels
  set balance=coalesce(balance,0)+p_amount,
      balance_went_negative_at=case
        when coalesce(balance,0)+p_amount<0 then coalesce(balance_went_negative_at,now())
        else null end,
      updated_at=now()
  where id=p_label_id
  returning balance into v_balance;
  if not found then raise exception 'Label not found'; end if;

  insert into public.label_financial_transactions(label_id,transaction_type,amount,description,related_contract_id)
  values(p_label_id,p_transaction_type,abs(p_amount),p_description,p_related_contract_id);
  return v_balance;
end $$;

revoke all on function public.post_label_financial_transaction(uuid,numeric,text,text,uuid) from public,anon,authenticated;
grant execute on function public.post_label_financial_transaction(uuid,numeric,text,text,uuid) to service_role;

create or replace function public.transfer_label_owner_funds(
  p_label_id uuid,
  p_amount numeric,
  p_direction text
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_profile public.profiles%rowtype; v_label public.labels%rowtype; v_new_label numeric; v_new_cash numeric;
begin
  if p_amount<=0 then raise exception 'Amount must be positive'; end if;
  if p_direction not in ('deposit','withdrawal') then raise exception 'Invalid direction'; end if;
  if not public._can_manage_label(p_label_id) then raise exception 'Not authorised'; end if;

  select p.* into v_profile from public.profiles p where p.user_id=auth.uid() and p.is_active=true and p.died_at is null for update;
  if not found then raise exception 'Active profile not found'; end if;
  select * into v_label from public.labels where id=p_label_id for update;
  if not found then raise exception 'Label not found'; end if;

  if p_direction='deposit' then
    if coalesce(v_profile.cash,0)<p_amount then raise exception 'Insufficient personal funds'; end if;
    v_new_cash:=coalesce(v_profile.cash,0)-p_amount; v_new_label:=coalesce(v_label.balance,0)+p_amount;
  else
    if coalesce(v_label.balance,0)-p_amount<100000 then raise exception 'Withdrawal would breach minimum label reserve'; end if;
    v_new_cash:=coalesce(v_profile.cash,0)+p_amount; v_new_label:=coalesce(v_label.balance,0)-p_amount;
  end if;

  update public.profiles set cash=v_new_cash where id=v_profile.id;
  update public.labels set balance=v_new_label,
    balance_went_negative_at=case when v_new_label<0 then coalesce(balance_went_negative_at,now()) else null end,
    is_bankrupt=case when v_new_label>=100000 then false else is_bankrupt end,
    updated_at=now()
  where id=p_label_id;

  insert into public.label_transactions(label_id,transaction_type,amount,description,initiated_by)
  values(p_label_id,p_direction,case when p_direction='withdrawal' then -p_amount else p_amount end,
    case when p_direction='deposit' then 'Owner deposit' else 'Owner withdrawal' end,v_profile.id);

  return jsonb_build_object('label_balance',v_new_label,'personal_cash',v_new_cash);
end $$;

revoke all on function public.transfer_label_owner_funds(uuid,numeric,text) from public,anon;
grant execute on function public.transfer_label_owner_funds(uuid,numeric,text) to authenticated;

create or replace function public.activate_label_contract_atomic(p_contract_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_contract public.artist_label_contracts%rowtype; v_label public.labels%rowtype; v_band public.bands%rowtype;
        v_advance numeric; v_already_paid boolean; v_term integer; v_end timestamptz;
begin
  select * into v_contract from public.artist_label_contracts where id=p_contract_id for update;
  if not found then raise exception 'Contract not found'; end if;
  if not public._can_manage_label(v_contract.label_id) then raise exception 'Not authorised'; end if;
  if v_contract.status='active' then return jsonb_build_object('status','active','advance_paid',0); end if;
  if v_contract.status<>'accepted_by_artist' then raise exception 'Artist must accept the offer first'; end if;

  select * into v_label from public.labels where id=v_contract.label_id for update;
  v_advance:=greatest(0,coalesce(v_contract.advance_amount,0));
  select exists(select 1 from public.label_financial_transactions
    where label_id=v_contract.label_id and related_contract_id=p_contract_id and transaction_type='advance')
    into v_already_paid;

  if v_advance>0 and not v_already_paid then
    if coalesce(v_label.balance,0)<v_advance then raise exception 'Insufficient label balance for advance'; end if;
    if v_contract.band_id is null then raise exception 'Band contract required for advance payment'; end if;
    select * into v_band from public.bands where id=v_contract.band_id for update;
    update public.labels set balance=balance-v_advance,updated_at=now() where id=v_contract.label_id;
    update public.bands set band_balance=coalesce(band_balance,0)+v_advance where id=v_contract.band_id;
    insert into public.label_financial_transactions(label_id,transaction_type,amount,description,related_contract_id)
      values(v_contract.label_id,'advance',v_advance,'Artist advance paid on contract activation',p_contract_id);
    insert into public.band_earnings(band_id,amount,source,description)
      values(v_contract.band_id,v_advance,'label_advance','Record label contract advance');
  end if;

  v_term:=case when v_contract.start_date is not null and v_contract.end_date is not null
    then greatest(1,round(extract(epoch from (v_contract.end_date::timestamptz-v_contract.start_date::timestamptz))/2592000.0)::int)
    else 24 end;
  v_end:=now()+(v_term||' months')::interval;
  update public.artist_label_contracts set status='active',start_date=current_date,end_date=v_end::date,updated_at=now() where id=p_contract_id;
  return jsonb_build_object('status','active','advance_paid',case when v_already_paid then 0 else v_advance end);
end $$;

revoke all on function public.activate_label_contract_atomic(uuid) from public,anon;
grant execute on function public.activate_label_contract_atomic(uuid) to authenticated,service_role;

create or replace function public.process_label_marketing_daily()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  l record; r record; c record; v_budget numeric; v_daily numeric; v_count integer; v_base numeric;
  v_spend numeric; v_mult numeric; v_hype integer; v_power integer; v_priority boolean;
  v_labels integer:=0; v_releases integer:=0; v_campaigns integer:=0; v_total numeric:=0;
begin
  update public.releases set label_marketing_power=0 where label_marketing_power<>0;

  for l in select id,balance,weekly_marketing_budget,marketing_level,priority_release_id,marketing_focus,marketing_regions
           from public.labels where coalesce(weekly_marketing_budget,0)>0 and coalesce(is_bankrupt,false)=false for update
  loop
    v_budget:=least(l.weekly_marketing_budget,public.label_marketing_budget_cap(l.marketing_level));
    v_daily:=round(v_budget/7.0,2);
    if v_daily<=0 or coalesce(l.balance,0)<v_daily then continue; end if;

    select count(*) into v_count from public.releases x
      join public.artist_label_contracts ac on ac.id=x.label_contract_id
      where ac.label_id=l.id and ac.status='active' and x.release_status in ('released','manufacturing')
        and (x.release_status='manufacturing' or coalesce(x.manufacturing_complete_at,now())>=now()-interval '90 days');
    if v_count=0 then continue; end if;

    update public.labels set balance=balance-v_daily,updated_at=now() where id=l.id;
    insert into public.label_financial_transactions(label_id,transaction_type,amount,description)
      values(l.id,'marketing',v_daily,format('Daily label marketing strategy: %s focus, %s release(s)',l.marketing_focus,v_count));

    for r in select x.id from public.releases x
      join public.artist_label_contracts ac on ac.id=x.label_contract_id
      where ac.label_id=l.id and ac.status='active' and x.release_status in ('released','manufacturing')
        and (x.release_status='manufacturing' or coalesce(x.manufacturing_complete_at,now())>=now()-interval '90 days')
    loop
      v_priority := l.priority_release_id is not null and r.id=l.priority_release_id;
      if l.priority_release_id is not null and v_count>1 then
        v_spend := case when v_priority then v_daily*0.65 else (v_daily*0.35)/(v_count-1) end;
      else v_spend:=v_daily/v_count; end if;
      v_mult:=public.label_marketing_multiplier(l.marketing_level);
      v_hype:=least(120,greatest(1,round(sqrt(v_spend/10.0)*v_mult)::integer));
      v_power:=least(100,greatest(1,round(sqrt(v_spend/10.0)*v_mult*2.5)::integer));

      update public.releases set
        hype_score=least(1000,coalesce(hype_score,0)+v_hype),
        label_marketing_power=least(100,v_power),
        label_marketing_focus=l.marketing_focus,
        label_marketing_regions=l.marketing_regions,
        label_marketing_saturation=least(100,coalesce(label_marketing_saturation,0)*0.75+v_power*0.4),
        updated_at=now()
      where id=r.id;
      v_releases:=v_releases+1;
    end loop;
    v_labels:=v_labels+1; v_total:=v_total+v_daily;
  end loop;

  for c in select pc.id,pc.budget,pc.start_date,pc.end_date,pc.channels,lr.release_id canonical_release_id,
                  lab.marketing_level,lab.marketing_focus,lab.marketing_regions
    from public.label_promotion_campaigns pc
    join public.label_releases lr on lr.id=pc.release_id
    join public.artist_label_contracts ac on ac.id=lr.contract_id
    join public.labels lab on lab.id=ac.label_id
    where current_date between coalesce(pc.start_date,current_date) and coalesce(pc.end_date,current_date) and lr.release_id is not null
  loop
    v_spend:=c.budget::numeric/greatest(1,(coalesce(c.end_date,current_date)-coalesce(c.start_date,current_date)+1));
    v_mult:=public.label_marketing_multiplier(c.marketing_level);
    v_power:=least(100,greatest(1,round(sqrt(v_spend/10.0)*v_mult*2.5)::integer));
    v_hype:=least(140,greatest(1,round(sqrt(v_spend/10.0)*v_mult)::integer));
    update public.releases set hype_score=least(1000,coalesce(hype_score,0)+v_hype),
      label_marketing_power=least(100,coalesce(label_marketing_power,0)+v_power),
      label_marketing_focus=coalesce(c.channels[1],c.marketing_focus,'balanced'),
      label_marketing_regions=c.marketing_regions,
      label_marketing_saturation=least(100,coalesce(label_marketing_saturation,0)*0.8+v_power*0.5),
      updated_at=now()
    where id=c.canonical_release_id;
    update public.label_promotion_campaigns set effectiveness=greatest(coalesce(effectiveness,0),v_power),updated_at=now() where id=c.id;
    v_campaigns:=v_campaigns+1;
  end loop;

  return jsonb_build_object('labels_processed',v_labels,'releases_boosted',v_releases,'campaigns_processed',v_campaigns,'total_spend',round(v_total,2));
end $$;

revoke all on function public.process_label_marketing_daily() from public,anon,authenticated;
grant execute on function public.process_label_marketing_daily() to service_role;

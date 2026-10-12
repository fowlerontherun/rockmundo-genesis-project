-- Campaign expenses must resolve to an eligible active release; previously
-- campaigns could charge a label while pointing at no playable release.
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
  if not found or v_contract.status<>'active' then raise exception 'Active label contract required'; end if;
  if v_label_release.release_id is null or not exists (
    select 1 from public.releases r where r.id=v_label_release.release_id
    and r.label_contract_id=v_contract.id and r.release_status in ('released','manufacturing')
  ) then raise exception 'Campaign requires a canonical eligible release'; end if;

  if not public.is_label_team_member(v_contract.label_id,array['owner','manager']::text[]) then
    raise exception 'Not authorized to create label campaigns';
  end if;

  select * into v_label from public.labels where id=v_contract.label_id for update;
  if coalesce(v_label.is_bankrupt,false) then raise exception 'Bankrupt labels cannot fund promotion'; end if;
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
    where current_date between coalesce(pc.start_date,current_date) and coalesce(pc.end_date,current_date)
    and lr.release_id is not null and ac.status='active' and coalesce(lab.is_bankrupt,false)=false
    and exists (select 1 from public.releases target
      where target.id=lr.release_id and target.label_contract_id=ac.id
        and target.release_status in ('released','manufacturing'))
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


REVOKE ALL ON FUNCTION public.create_label_promotion_campaign(uuid,text,integer,date,date,text[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_label_promotion_campaign(uuid,text,integer,date,date,text[],text) TO authenticated;
REVOKE ALL ON FUNCTION public.process_label_marketing_daily() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_label_marketing_daily() TO service_role;

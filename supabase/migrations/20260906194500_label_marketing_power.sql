-- Paid label marketing must remain valuable even when ordinary release hype is capped.
alter table public.releases
  add column if not exists label_marketing_power integer not null default 0;

alter table public.releases
  drop constraint if exists releases_label_marketing_power_check;
alter table public.releases
  add constraint releases_label_marketing_power_check check (label_marketing_power between 0 and 100);

comment on column public.releases.label_marketing_power is
  'Daily paid label-marketing strength (0-100), refreshed by process_label_marketing_daily. It directly boosts sales and streaming independently of the ordinary hype cap.';

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
  v_power integer;
  v_multiplier numeric;
  v_labels_processed integer := 0;
  v_releases_boosted integer := 0;
  v_campaigns_processed integer := 0;
  v_total_spend numeric := 0;
begin
  update public.releases set label_marketing_power=0 where label_marketing_power<>0;

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
    v_power := least(60,greatest(1,round(sqrt(v_per_release/10.0)*v_multiplier*2.5)::integer));

    update public.labels set balance=balance-v_daily_spend, updated_at=now() where id=v_label.id;
    insert into public.label_financial_transactions(label_id,transaction_type,amount,description)
    values(v_label.id,'marketing',v_daily_spend,format('Daily label marketing: %s release(s), level %s, +%s marketing power each',v_release_count,v_label.marketing_level,v_power));

    update public.releases r
    set hype_score=least(1000,coalesce(r.hype_score,0)+v_hype),
        label_marketing_power=least(100,coalesce(r.label_marketing_power,0)+v_power),
        updated_at=now()
    where r.band_id in (
      select alc.band_id from public.artist_label_contracts alc
      where alc.label_id=v_label.id and alc.status='active' and alc.band_id is not null
    )
    and r.release_status in ('released','manufacturing')
    and (r.release_status='manufacturing' or (r.manufacturing_complete_at is not null and r.manufacturing_complete_at >= now()-interval '90 days'));

    v_labels_processed:=v_labels_processed+1;
    v_releases_boosted:=v_releases_boosted+v_release_count;
    v_total_spend:=v_total_spend+v_daily_spend;
  end loop;

  for v_campaign in
    select c.id,c.budget,c.start_date,c.end_date,c.effectiveness,
           lr.release_id as canonical_release_id,l.marketing_level
    from public.label_promotion_campaigns c
    join public.label_releases lr on lr.id=c.release_id
    join public.artist_label_contracts alc on alc.id=lr.contract_id
    join public.labels l on l.id=alc.label_id
    where current_date between coalesce(c.start_date,current_date) and coalesce(c.end_date,current_date)
      and lr.release_id is not null
  loop
    v_multiplier:=public.label_marketing_multiplier(v_campaign.marketing_level);
    v_per_release := v_campaign.budget::numeric / greatest(1,(coalesce(v_campaign.end_date,current_date)-coalesce(v_campaign.start_date,current_date)+1));
    v_hype:=least(100,greatest(1,round(sqrt(v_per_release/10.0)*v_multiplier)::integer));
    v_power:=least(70,greatest(1,round(sqrt(v_per_release/10.0)*v_multiplier*2.5)::integer));

    update public.releases
    set hype_score=least(1000,coalesce(hype_score,0)+v_hype),
        label_marketing_power=least(100,coalesce(label_marketing_power,0)+v_power),
        updated_at=now()
    where id=v_campaign.canonical_release_id;

    update public.label_promotion_campaigns
    set effectiveness=greatest(coalesce(effectiveness,0),v_power),updated_at=now()
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
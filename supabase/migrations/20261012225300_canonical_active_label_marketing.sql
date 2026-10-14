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

-- The service-owned daily processor must stay separate. Do not override it here:
-- 20261013094500_label_marketing_daily_idempotency.sql wraps that processor
-- to prevent duplicate daily charges when workers retry.
REVOKE ALL ON FUNCTION public.create_label_promotion_campaign(uuid,text,integer,date,date,text[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_label_promotion_campaign(uuid,text,integer,date,date,text[],text) TO authenticated;

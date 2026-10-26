alter table public.streaming_release_day_claims add column if not exists region_breakdown jsonb;

CREATE OR REPLACE FUNCTION public.settle_streaming_release_day(p_day date, p_song_release_id uuid, p_streams bigint, p_revenue integer, p_analytics jsonb, p_earnings jsonb, p_label_id uuid DEFAULT NULL::uuid, p_contract_id uuid DEFAULT NULL::uuid, p_label_amount integer DEFAULT 0, p_recoup_amount integer DEFAULT 0)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_status text;
  v_song_id uuid;
  v_analytics_streams bigint;
  v_analytics_revenue bigint;
  v_band_payout bigint;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select status into v_status
  from public.streaming_release_day_claims
  where run_date=p_day and song_release_id=p_song_release_id for update;
  if v_status='completed' then return false; end if;
  if v_status is distinct from 'processing' then raise exception 'No processing claim for release/day'; end if;
  if p_streams < 0 or p_revenue < 0 or p_label_amount < 0 or p_recoup_amount < 0 or p_recoup_amount > p_label_amount
     or jsonb_typeof(p_analytics) <> 'array' or jsonb_typeof(p_earnings) <> 'array' then
    raise exception 'Invalid streaming settlement payload';
  end if;
  select coalesce(sum((a->>'daily_streams')::bigint),0),
         coalesce(sum((a->>'daily_revenue')::bigint),0)
    into v_analytics_streams,v_analytics_revenue
  from jsonb_array_elements(p_analytics) a;
  select coalesce(sum((e->>'amount')::bigint),0) into v_band_payout
  from jsonb_array_elements(p_earnings) e;
  if v_analytics_streams<>p_streams or v_analytics_revenue<>p_revenue
     or v_band_payout<0 or v_band_payout+p_label_amount>p_revenue then
    raise exception 'Streaming units or royalty split do not reconcile';
  end if;
  if p_label_amount>0 and (p_label_id is null or p_contract_id is null) then
    raise exception 'Label royalty missing label or contract';
  end if;
  update public.song_releases
  set total_streams=coalesce(total_streams,0)+p_streams,
      total_revenue=coalesce(total_revenue,0)+p_revenue
  where id=p_song_release_id and is_active=true
  returning song_id into v_song_id;
  if not found then raise exception 'Streaming entry inactive or missing'; end if;
  -- The main analytics table is unique per (song release, day, platform);
  -- store full per-region breakdown separately in the settlement receipt.
  insert into public.streaming_analytics_daily
    (song_release_id,analytics_date,daily_streams,daily_revenue,
     platform_id,unique_listeners,skip_rate,completion_rate,listener_age_group,listener_region)
  select p_song_release_id,p_day,
    coalesce(sum((a->>'daily_streams')::bigint),0)::integer,
    coalesce(sum((a->>'daily_revenue')::bigint),0)::integer,
    (select nullif(one_region->>'platform_id','')::uuid
     from jsonb_array_elements(p_analytics) one_region limit 1),
    coalesce(sum((a->>'unique_listeners')::bigint),0)::integer,
    coalesce(round(sum(coalesce((a->>'skip_rate')::numeric,0) *
       coalesce((a->>'daily_streams')::numeric,0)) /
       nullif(sum(coalesce((a->>'daily_streams')::numeric,0)),0),1),0),
    coalesce(round(sum(coalesce((a->>'completion_rate')::numeric,0) *
       coalesce((a->>'daily_streams')::numeric,0)) /
       nullif(sum(coalesce((a->>'daily_streams')::numeric,0)),0),1),0),
    'all','all'
  from jsonb_array_elements(p_analytics) a;
  insert into public.band_earnings(band_id,amount,source,description,metadata)
  select (e->>'band_id')::uuid,(e->>'amount')::integer,
    'streaming',e->>'description',
    coalesce(e->'metadata','{}'::jsonb) ||
       jsonb_build_object('streaming_run_date',p_day,'song_release_id',p_song_release_id)
  from jsonb_array_elements(p_earnings) e;
  if p_label_amount>0 then
    perform public.credit_label_revenue_atomic(
      p_label_id,p_label_amount,
      'Daily streaming royalty share (settled '||p_day::text||' / '||p_song_release_id::text||')',
      p_contract_id,p_recoup_amount
    );
  end if;
  if v_song_id is not null then
    if p_streams >= 1000 then
      perform public.update_song_fame(v_song_id,least(2147483647,(p_streams/1000)::bigint)::integer,'streaming');
    end if;
    perform public.update_song_hype(v_song_id,least(2147483647,(p_streams/5000-1))::integer);
  end if;
  update public.streaming_release_day_claims set
    status='completed', finished_at=now(),
    settled_streams=p_streams,settled_revenue=p_revenue,
    region_breakdown=p_analytics,last_error=null
  where run_date=p_day and song_release_id=p_song_release_id;
  return true;
end $function$


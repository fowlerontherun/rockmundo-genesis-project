
-- Bounded, idempotent streaming settlement: one stream entry per scheduled run.
create table if not exists public.streaming_release_day_claims (
  run_date date not null,
  song_release_id uuid not null references public.song_releases(id) on delete cascade,
  status text not null default 'processing' check(status in ('processing','completed','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  last_error text,
  settled_streams bigint,
  settled_revenue integer,
  primary key(run_date,song_release_id)
);
alter table public.streaming_release_day_claims enable row level security;
revoke all on table public.streaming_release_day_claims from public, anon, authenticated;
grant select,insert,update on table public.streaming_release_day_claims to service_role;

create or replace function public.claim_next_streaming_release(p_day date)
returns uuid language plpgsql security definer set search_path = '' as $fn$
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_day is null or p_day<> (now() at time zone 'UTC')::date then
    raise exception 'Only the current UTC streaming day can be claimed';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('streaming-release:'||p_day::text,0));
  select sr.id into v_id
  from public.song_releases sr
  join public.songs s on s.id=sr.song_id
  where sr.is_active is true and sr.release_type='streaming'
    and sr.release_date <= now()
    and s.status in ('recorded','released')
    and not exists (
      select 1 from public.streaming_release_day_claims c
      where c.run_date=p_day and c.song_release_id=sr.id
    )
  order by sr.id
  limit 1
  for update of sr skip locked;
  if v_id is null then return null; end if;
  insert into public.streaming_release_day_claims(run_date,song_release_id)
  values(p_day,v_id);
  return v_id;
end $fn$;

-- Atomic financial receipt. Any failed statement rolls back streams, analytics,
-- artist earnings, label revenue and the completion status together.
create or replace function public.settle_streaming_release_day(
  p_day date,
  p_song_release_id uuid,
  p_streams bigint,
  p_revenue integer,
  p_analytics jsonb,
  p_earnings jsonb,
  p_label_id uuid default null,
  p_contract_id uuid default null,
  p_label_amount integer default 0,
  p_recoup_amount integer default 0
) returns boolean language plpgsql security definer set search_path = '' as $fn$
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
  insert into public.streaming_analytics_daily
    (song_release_id,analytics_date,daily_streams,daily_revenue,
     platform_id,unique_listeners,skip_rate,completion_rate,listener_age_group,listener_region)
  select p_song_release_id,p_day,
    (a->>'daily_streams')::integer,(a->>'daily_revenue')::integer,
    nullif(a->>'platform_id','')::uuid,
    (a->>'unique_listeners')::integer,
    (a->>'skip_rate')::numeric,(a->>'completion_rate')::numeric,
    a->>'listener_age_group',a->>'listener_region'
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
    settled_streams=p_streams,settled_revenue=p_revenue,last_error=null
  where run_date=p_day and song_release_id=p_song_release_id;
  return true;
end $fn$;

create or replace function public.fail_streaming_release_day(p_day date,p_song_release_id uuid,p_error text)
returns boolean language plpgsql security definer set search_path = '' as $fn$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.streaming_release_day_claims
    set status='failed',finished_at=now(),last_error=left(p_error,500)
  where run_date=p_day and song_release_id=p_song_release_id and status='processing';
  return found;
end $fn$;

revoke all on function public.claim_next_streaming_release(date) from public, anon, authenticated;
revoke all on function public.settle_streaming_release_day(date,uuid,bigint,integer,jsonb,jsonb,uuid,uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.fail_streaming_release_day(date,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_next_streaming_release(date) to service_role;
grant execute on function public.settle_streaming_release_day(date,uuid,bigint,integer,jsonb,jsonb,uuid,uuid,integer,integer) to service_role;
grant execute on function public.fail_streaming_release_day(date,uuid,text) to service_role;

-- Retire the interrupted all-catalogue claim; the replacement uses per-entry receipts.
update public.streaming_simulation_day_claims
set status='failed',finished_at=now(),
    last_error='Legacy all-catalogue worker exceeded CPU limit; superseded by per-release settlement'
where run_date=(now() at time zone 'UTC')::date and status='started';

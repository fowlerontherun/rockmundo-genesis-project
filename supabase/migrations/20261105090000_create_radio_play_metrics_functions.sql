create or replace function public.get_radio_station_play_summary(
  p_station_id uuid,
  p_days integer default 14
)
returns table (
  total_spins bigint,
  total_listeners bigint,
  total_streams bigint,
  total_revenue numeric,
  total_hype bigint
)
language sql
stable
as $$
  select
    count(*) as total_spins,
    coalesce(sum(listeners), 0) as total_listeners,
    coalesce(sum(streams_boost), 0) as total_streams,
    coalesce(sum(sales_boost), 0) as total_revenue,
    coalesce(sum(hype_gained), 0) as total_hype
  from radio_plays
  where station_id = p_station_id
    and played_at >= now() - (p_days || ' days')::interval;
$$;

create or replace function public.get_radio_station_play_timeline(
  p_station_id uuid,
  p_days integer default 14
)
returns table (
  play_date date,
  spins bigint,
  revenue numeric,
  listeners bigint,
  streams bigint,
  hype bigint
)
language sql
stable
as $$
  select
    date_trunc('day', played_at)::date as play_date,
    count(*) as spins,
    coalesce(sum(sales_boost), 0) as revenue,
    coalesce(sum(listeners), 0) as listeners,
    coalesce(sum(streams_boost), 0) as streams,
    coalesce(sum(hype_gained), 0) as hype
  from radio_plays
  where station_id = p_station_id
    and played_at >= now() - (p_days || ' days')::interval
  group by 1
  order by 1;
$$;

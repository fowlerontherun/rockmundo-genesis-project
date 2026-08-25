alter table public.streaming_analytics_daily
  add column if not exists city_id uuid references public.cities(id);

create index if not exists idx_streaming_analytics_daily_city_date
  on public.streaming_analytics_daily (city_id, analytics_date desc);

create index if not exists idx_release_sales_format_date_city
  on public.release_sales (release_format_id, sale_date desc, city_id);

create or replace function public.assign_release_sale_city()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.city_id is null and new.country is not null then
    select c.id
      into new.city_id
      from public.cities c
     where lower(c.country) = lower(new.country)
     order by md5(c.id::text || new.id::text)
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_release_sale_city on public.release_sales;
create trigger trg_assign_release_sale_city
before insert on public.release_sales
for each row execute function public.assign_release_sale_city();

create or replace function public.assign_streaming_analytics_city()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.city_id is null and new.listener_region is not null then
    select c.id
      into new.city_id
      from public.cities c
     where lower(c.country) = lower(new.listener_region)
     order by md5(c.id::text || new.id::text)
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_streaming_analytics_city on public.streaming_analytics_daily;
create trigger trg_assign_streaming_analytics_city
before insert on public.streaming_analytics_daily
for each row execute function public.assign_streaming_analytics_city();

create or replace function public.get_release_manager_city_analytics(
  p_band_id uuid,
  p_release_id uuid default null,
  p_period_kind text default 'day'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_period text := lower(coalesce(p_period_kind, 'day'));
begin
  if p_band_id is null or not public.is_authorized_band_member(p_band_id) then
    raise exception 'Not authorized for band';
  end if;

  if v_period not in ('day', 'week', 'month') then
    raise exception 'Invalid period kind';
  end if;

  if p_release_id is not null and not exists (
    select 1 from public.releases r
    where r.id = p_release_id and r.band_id = p_band_id
  ) then
    raise exception 'Release does not belong to band';
  end if;

  with release_scope as (
    select r.id, r.title
    from public.releases r
    where r.band_id = p_band_id
      and r.release_status = 'released'
      and (p_release_id is null or r.id = p_release_id)
  ),
  sales as (
    select
      rf.release_id,
      case v_period
        when 'day' then date_trunc('day', rs.sale_date at time zone 'UTC')::date
        when 'week' then date_trunc('week', rs.sale_date at time zone 'UTC')::date
        else date_trunc('month', rs.sale_date at time zone 'UTC')::date
      end as bucket_start,
      rs.city_id,
      coalesce(c.name, 'Unknown city') as city_name,
      coalesce(c.country, rs.country, 'Unknown') as country,
      sum(coalesce(rs.quantity_sold, 0))::bigint as units,
      sum(coalesce(rs.total_amount, 0))::bigint as sales_gross_cents,
      sum(coalesce(rs.net_revenue, 0))::bigint as sales_net_cents
    from release_scope scope
    join public.release_formats rf on rf.release_id = scope.id
    join public.release_sales rs on rs.release_format_id = rf.id
    left join public.cities c on c.id = rs.city_id
    group by rf.release_id, bucket_start, rs.city_id, coalesce(c.name, 'Unknown city'), coalesce(c.country, rs.country, 'Unknown')
  ),
  streams as (
    select
      sr.release_id,
      case v_period
        when 'day' then sad.analytics_date
        when 'week' then date_trunc('week', sad.analytics_date::timestamp)::date
        else date_trunc('month', sad.analytics_date::timestamp)::date
      end as bucket_start,
      sad.city_id,
      coalesce(c.name, 'Unknown city') as city_name,
      coalesce(c.country, sad.listener_region, sr.country, 'Unknown') as country,
      sum(coalesce(sad.daily_streams, 0))::bigint as streams,
      sum(coalesce(sad.daily_revenue, 0))::bigint as streaming_revenue
    from release_scope scope
    join public.song_releases sr on sr.release_id = scope.id and sr.is_active = true and sr.release_type = 'streaming'
    join public.streaming_analytics_daily sad on sad.song_release_id = sr.id
    left join public.cities c on c.id = sad.city_id
    group by sr.release_id, bucket_start, sad.city_id, coalesce(c.name, 'Unknown city'), coalesce(c.country, sad.listener_region, sr.country, 'Unknown')
  ),
  keys as (
    select release_id, bucket_start, city_id, city_name, country from sales
    union
    select release_id, bucket_start, city_id, city_name, country from streams
  ),
  combined as (
    select
      k.release_id,
      scope.title as release_title,
      k.bucket_start,
      k.city_id,
      k.city_name,
      k.country,
      coalesce(s.units, 0)::bigint as units,
      coalesce(s.sales_gross_cents, 0)::bigint as sales_gross_cents,
      coalesce(s.sales_net_cents, 0)::bigint as sales_net_cents,
      coalesce(st.streams, 0)::bigint as streams,
      coalesce(st.streaming_revenue, 0)::bigint as streaming_revenue
    from keys k
    join release_scope scope on scope.id = k.release_id
    left join sales s
      on s.release_id = k.release_id
     and s.bucket_start = k.bucket_start
     and s.city_id is not distinct from k.city_id
     and s.country = k.country
    left join streams st
      on st.release_id = k.release_id
     and st.bucket_start = k.bucket_start
     and st.city_id is not distinct from k.city_id
     and st.country = k.country
  ),
  rolled as (
    select
      bucket_start,
      city_id,
      city_name,
      country,
      sum(units)::bigint as units,
      sum(sales_gross_cents)::bigint as sales_gross_cents,
      sum(sales_net_cents)::bigint as sales_net_cents,
      sum(streams)::bigint as streams,
      sum(streaming_revenue)::bigint as streaming_revenue
    from combined
    group by bucket_start, city_id, city_name, country
  ),
  release_totals as (
    select
      release_id,
      release_title,
      sum(units)::bigint as units,
      sum(sales_gross_cents)::bigint as sales_gross_cents,
      sum(sales_net_cents)::bigint as sales_net_cents,
      sum(streams)::bigint as streams,
      sum(streaming_revenue)::bigint as streaming_revenue
    from combined
    group by release_id, release_title
  ),
  coverage as (
    select
      coalesce(sum(units) filter (where city_id is not null), 0)::bigint as known_sales_units,
      coalesce(sum(units), 0)::bigint as total_sales_units,
      coalesce(sum(streams) filter (where city_id is not null), 0)::bigint as known_streams,
      coalesce(sum(streams), 0)::bigint as total_streams
    from rolled
  )
  select jsonb_build_object(
    'period_kind', v_period,
    'scope', case when p_release_id is null then 'all' else 'release' end,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'period_start', r.bucket_start,
        'city_id', r.city_id,
        'city_name', r.city_name,
        'country', r.country,
        'units', r.units,
        'sales_gross_cents', r.sales_gross_cents,
        'sales_net_cents', r.sales_net_cents,
        'streams', r.streams,
        'streaming_revenue', r.streaming_revenue
      ) order by r.bucket_start desc, r.streams desc, r.units desc, r.city_name)
      from rolled r
    ), '[]'::jsonb),
    'release_totals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'release_id', rt.release_id,
        'release_title', rt.release_title,
        'units', rt.units,
        'sales_gross_cents', rt.sales_gross_cents,
        'sales_net_cents', rt.sales_net_cents,
        'streams', rt.streams,
        'streaming_revenue', rt.streaming_revenue
      ) order by (rt.sales_gross_cents + rt.streaming_revenue * 100) desc, rt.release_title)
      from release_totals rt
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'units', coalesce((select sum(units) from rolled), 0),
      'sales_gross_cents', coalesce((select sum(sales_gross_cents) from rolled), 0),
      'sales_net_cents', coalesce((select sum(sales_net_cents) from rolled), 0),
      'streams', coalesce((select sum(streams) from rolled), 0),
      'streaming_revenue', coalesce((select sum(streaming_revenue) from rolled), 0)
    ),
    'coverage', jsonb_build_object(
      'sales_pct', case when cv.total_sales_units = 0 then 100 else round((cv.known_sales_units::numeric / cv.total_sales_units::numeric) * 100, 1) end,
      'streams_pct', case when cv.total_streams = 0 then 100 else round((cv.known_streams::numeric / cv.total_streams::numeric) * 100, 1) end
    )
  ) into v_result
  from coverage cv;

  return coalesce(v_result, jsonb_build_object('period_kind', v_period, 'rows', '[]'::jsonb, 'release_totals', '[]'::jsonb));
end;
$$;

revoke all on function public.get_release_manager_city_analytics(uuid, uuid, text) from public;
grant execute on function public.get_release_manager_city_analytics(uuid, uuid, text) to authenticated;

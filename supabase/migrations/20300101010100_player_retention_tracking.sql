-- UTC account-day activity: no page URLs, IP addresses, names or message content.
-- This is a forward-only migration; repo migration history does not match live history.
create table if not exists public.player_engagement_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null default ((now() at time zone 'utc')::date),
  first_seen_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create index if not exists player_engagement_days_date_idx
  on public.player_engagement_days (activity_date desc);

alter table public.player_engagement_days enable row level security;
revoke all on public.player_engagement_days from public, anon, authenticated;

-- The caller never supplies an identity or date; the server records one row per
-- authenticated account per UTC day. Direct table access remains revoked.
create or replace function public.record_player_open()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return false; end if;

  insert into public.player_engagement_days (user_id, activity_date)
  values (v_user_id, (now() at time zone 'utc')::date)
  on conflict (user_id, activity_date) do nothing;
  return true;
end;
$$;

revoke all on function public.record_player_open() from public, anon, authenticated;
grant execute on function public.record_player_open() to authenticated;

-- Aggregated metrics only. An admin role is checked in the database even if
-- someone bypasses the client-side admin route guard.
create or replace function public.admin_get_player_retention_analytics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_tracking_since timestamptz;
  v_result jsonb;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;

  select min(first_seen_at) into v_tracking_since from public.player_engagement_days;

  with accounts as (
    select id, created_at, (created_at at time zone 'utc')::date signup_day
    from auth.users
    where deleted_at is null and not coalesce(is_anonymous, false)
  ),
  recent_signups as (
    select id from accounts where created_at >= now() - interval '30 days'
  ),
  new_player_funnel as (
    select
      count(*)::int signups,
      count(*) filter (where exists (
        select 1 from public.profiles p where p.user_id = n.id and p.deleted_at is null
      ))::int characters_created,
      count(*) filter (where exists (
        select 1 from public.songwriting_projects sp where sp.user_id = n.id
      ))::int projects_started,
      count(*) filter (where exists (
        select 1 from public.songs s where s.user_id = n.id
      ))::int songs_created,
      count(*) filter (where exists (
        select 1 from public.player_scheduled_activities a
        join public.profiles p on p.id = a.profile_id
        where p.user_id = n.id
      ))::int activities_scheduled,
      count(*) filter (where exists (
        select 1 from public.band_members bm
        join public.profiles p on p.id = bm.profile_id
        where p.user_id = n.id and bm.member_status = 'active'
      ))::int band_members
    from recent_signups n
  ),
  cohort_accounts as (
    -- No historical day-by-day log existed before the first recorded visit.
    -- Exclude signups before collection began instead of inventing retention.
    select id, signup_day
    from accounts
    where v_tracking_since is not null and created_at >= v_tracking_since
  ),
  cohort_metrics as (
    select
      count(*) filter (where signup_day <= v_today - 1)::int d1_eligible,
      count(*) filter (where signup_day <= v_today - 1 and exists (
        select 1 from public.player_engagement_days d
        where d.user_id = c.id and d.activity_date = c.signup_day + 1
      ))::int d1_returned,
      count(*) filter (where signup_day <= v_today - 7)::int d7_eligible,
      count(*) filter (where signup_day <= v_today - 7 and exists (
        select 1 from public.player_engagement_days d
        where d.user_id = c.id and d.activity_date = c.signup_day + 7
      ))::int d7_returned,
      count(*) filter (where signup_day <= v_today - 30)::int d30_eligible,
      count(*) filter (where signup_day <= v_today - 30 and exists (
        select 1 from public.player_engagement_days d
        where d.user_id = c.id and d.activity_date = c.signup_day + 30
      ))::int d30_returned
    from cohort_accounts c
  ),
  active_days as (
    select d.activity_date, count(*)::int accounts
    from public.player_engagement_days d
    join accounts a on a.id = d.user_id
    where d.activity_date between v_today - 13 and v_today
    group by d.activity_date
  ),
  daily_series as (
    select day::date activity_date, coalesce(a.accounts, 0) active_accounts
    from generate_series((v_today - 13)::timestamp, v_today::timestamp, interval '1 day') as days(day)
    left join active_days a on a.activity_date = days.day::date
  )
  select jsonb_build_object(
    'tracking_since', v_tracking_since,
    'total_accounts', (select count(*)::int from accounts),
    'signups_7d', (select count(*)::int from accounts where created_at >= now() - interval '7 days'),
    'signups_30d', (select count(*)::int from recent_signups),
    'dau', (select count(*)::int from public.player_engagement_days d join accounts a on a.id = d.user_id where d.activity_date = v_today),
    'wau', (select count(distinct d.user_id)::int from public.player_engagement_days d join accounts a on a.id = d.user_id where d.activity_date between v_today - 6 and v_today),
    'mau', (select count(distinct d.user_id)::int from public.player_engagement_days d join accounts a on a.id = d.user_id where d.activity_date between v_today - 29 and v_today),
    'established_active_7d', (select count(distinct d.user_id)::int from public.player_engagement_days d join accounts a on a.id = d.user_id where d.activity_date between v_today - 6 and v_today and a.signup_day < v_today - 7),
    'cohorts', (select to_jsonb(c) from cohort_metrics c),
    'funnel_30d', (select to_jsonb(f) from new_player_funnel f),
    'daily_activity', (select coalesce(jsonb_agg(jsonb_build_object('date', activity_date, 'accounts', active_accounts) order by activity_date), '[]'::jsonb) from daily_series)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_get_player_retention_analytics() from public, anon, authenticated;
grant execute on function public.admin_get_player_retention_analytics() to authenticated;

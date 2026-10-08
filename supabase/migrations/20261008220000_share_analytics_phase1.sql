-- Persistent, privacy-minimised analytics for the shared social sharing engine.
create table if not exists public.share_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in (
    'share_prompt_viewed',
    'share_studio_opened',
    'share_rendered',
    'share_native_started',
    'share_downloaded',
    'share_link_copied'
  )),
  moment_type text,
  share_format text check (share_format is null or share_format in ('square','story','landscape')),
  template text,
  channel text check (channel is null or channel in ('native','download','copy_link','twaater','studio','prompt','render')),
  created_at timestamptz not null default now()
);

create index if not exists share_analytics_events_created_idx
  on public.share_analytics_events(created_at desc);
create index if not exists share_analytics_events_name_created_idx
  on public.share_analytics_events(event_name, created_at desc);

alter table public.share_analytics_events enable row level security;
revoke all on public.share_analytics_events from public, anon, authenticated;

create or replace function public.record_share_analytics_event(
  p_event_name text,
  p_moment_type text default null,
  p_share_format text default null,
  p_template text default null,
  p_channel text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return false; end if;

  if p_event_name not in (
    'share_prompt_viewed',
    'share_studio_opened',
    'share_rendered',
    'share_native_started',
    'share_downloaded',
    'share_link_copied'
  ) then
    raise exception 'Unsupported share analytics event';
  end if;

  if p_share_format is not null and p_share_format not in ('square','story','landscape') then
    raise exception 'Unsupported share format';
  end if;

  if p_channel is not null and p_channel not in ('native','download','copy_link','twaater','studio','prompt','render') then
    raise exception 'Unsupported share analytics channel';
  end if;

  insert into public.share_analytics_events(user_id,event_name,moment_type,share_format,template,channel)
  values(
    v_user_id,
    p_event_name,
    left(nullif(trim(p_moment_type),''),40),
    p_share_format,
    left(nullif(trim(p_template),''),40),
    p_channel
  );

  return true;
end;
$$;

revoke all on function public.record_share_analytics_event(text,text,text,text,text) from public, anon;
grant execute on function public.record_share_analytics_event(text,text,text,text,text) to authenticated;

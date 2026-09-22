-- Unified release PR reach.
-- Paid label marketing remains separate: this score represents earned/owned reach from
-- press, radio, social, influencer activity, promo tours and similar publicity.

alter table public.releases
  add column if not exists pr_reach_power numeric(6,2) not null default 0,
  add column if not exists pr_reach_updated_at timestamptz;

alter table public.releases
  drop constraint if exists releases_pr_reach_power_check;
alter table public.releases
  add constraint releases_pr_reach_power_check check (pr_reach_power between 0 and 100);

comment on column public.releases.pr_reach_power is
  'Earned/owned publicity reach (0-100). Effective reach decays by 8% per real day since pr_reach_updated_at.';
comment on column public.releases.pr_reach_updated_at is
  'Timestamp from which PR reach decay is calculated. New PR first decays stored reach to now, then adds fresh reach.';

create table if not exists public.release_pr_events (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  channel text not null,
  reach_delta numeric(6,2) not null default 0,
  hype_delta integer not null default 0,
  source_ref text,
  created_at timestamptz not null default now()
);

create index if not exists release_pr_events_release_created_idx
  on public.release_pr_events(release_id, created_at desc);

alter table public.release_pr_events enable row level security;

drop policy if exists "release pr events visible with release" on public.release_pr_events;
create policy "release pr events visible with release"
on public.release_pr_events for select to authenticated
using (
  exists (
    select 1 from public.releases r
    where r.id=release_pr_events.release_id
      and (
        r.user_id=auth.uid()
        or exists (
          select 1 from public.band_members bm
          join public.profiles p on p.id=bm.profile_id
          where bm.band_id=r.band_id
            and bm.member_status='active'
            and (bm.user_id=auth.uid() or p.user_id=auth.uid())
        )
      )
  )
);

create or replace function public.apply_release_pr_reach(
  p_release_id uuid,
  p_channel text,
  p_reach_delta numeric,
  p_hype_delta integer default 0,
  p_source_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public, pg_temp
as $$
declare
  v_release public.releases%rowtype;
  v_elapsed_days numeric;
  v_effective numeric;
  v_new_reach numeric;
  v_new_hype integer;
  v_role text := coalesce(auth.role(),'');
begin
  select * into v_release from public.releases where id=p_release_id for update;
  if not found then raise exception 'Release not found'; end if;

  if v_role <> 'service_role' and not (
    v_release.user_id=auth.uid()
    or exists (
      select 1 from public.band_members bm
      left join public.profiles p on p.id=bm.profile_id
      where bm.band_id=v_release.band_id
        and bm.member_status='active'
        and (bm.user_id=auth.uid() or p.user_id=auth.uid())
    )
  ) then
    raise exception 'Not authorised for this release';
  end if;

  v_elapsed_days := case
    when v_release.pr_reach_updated_at is null then 0
    else greatest(0, extract(epoch from (now()-v_release.pr_reach_updated_at))/86400.0)
  end;
  v_effective := greatest(0,least(100,coalesce(v_release.pr_reach_power,0))) * power(0.92,v_elapsed_days);
  v_new_reach := least(100,greatest(0,v_effective + greatest(0,least(100,coalesce(p_reach_delta,0)))));
  v_new_hype := least(1000,greatest(0,coalesce(v_release.hype_score,0)+coalesce(p_hype_delta,0)));

  update public.releases
  set pr_reach_power=round(v_new_reach,2),
      pr_reach_updated_at=now(),
      hype_score=v_new_hype,
      updated_at=now()
  where id=p_release_id;

  insert into public.release_pr_events(release_id,channel,reach_delta,hype_delta,source_ref)
  values(p_release_id,left(coalesce(nullif(trim(p_channel),''),'other'),64),
         greatest(0,least(100,coalesce(p_reach_delta,0))),coalesce(p_hype_delta,0),p_source_ref);

  return jsonb_build_object('release_id',p_release_id,'pr_reach_power',round(v_new_reach,2),'hype_score',v_new_hype);
end;
$$;

revoke all on function public.apply_release_pr_reach(uuid,text,numeric,integer,text) from public, anon;
grant execute on function public.apply_release_pr_reach(uuid,text,numeric,integer,text) to authenticated, service_role;

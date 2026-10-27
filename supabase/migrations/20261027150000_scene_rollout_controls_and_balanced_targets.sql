-- City Scene controlled rollout and participation-scaled targets.
-- Data and processor are OFF by default. No cron or automatic awards.
begin;

create table public.scene_rollout_controls (
  singleton boolean primary key default true check(singleton is true),
  cycle_generation_enabled boolean not null default false,
  scoring_enabled boolean not null default false,
  monthly_first_start date not null default '2026-11-01',
  updated_at timestamptz not null default now()
);
insert into public.scene_rollout_controls(singleton,cycle_generation_enabled,scoring_enabled)
values(true,false,false) on conflict(singleton) do nothing;
alter table public.scene_rollout_controls enable row level security;
revoke all on public.scene_rollout_controls from public,anon,authenticated;
grant all on public.scene_rollout_controls to service_role;

create table public.scene_source_controls (
  action_type text primary key check(length(action_type) between 3 and 80),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.scene_source_controls(action_type,enabled)
values
  ('rehearsal:completed',false),
  ('gig:verified_performance',false),
  ('recording:completed',false),
  ('scene:verified_community',false),
  ('jam:verified_collaboration',false)
on conflict(action_type) do nothing;
alter table public.scene_source_controls enable row level security;
revoke all on public.scene_source_controls from public,anon,authenticated;
grant all on public.scene_source_controls to service_role;

-- The previous 3/6/12 per-person multipliers could require every player
-- to perform several different activities, daily. Start with smaller,
-- source-balanced community targets that scale with expected participation.
-- Example for 19 active accounts: daily=3, weekly=9, monthly=15.
create or replace function private.reconcile_city_scene_cycles(
  p_at timestamptz default now(),
  p_city_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_city uuid;
  v_cadence text;
  v_start timestamptz;
  v_end timestamptz;
  v_snapshot integer;
  v_target integer;
  v_needed integer;
  v_cycle uuid;
  v_created integer:=0;
  v_launch record;
begin
  if p_at is null or p_at > now()+interval '1 day'
    or p_at < now()-interval '14 days' then
    raise exception 'Invalid scene reconciliation instant';
  end if;

  select * into v_launch from public.scene_rollout_controls
  where singleton is true;
  if not found or v_launch.cycle_generation_enabled is not true then
    return 0;
  end if;

  perform pg_advisory_xact_lock(hashtext('rockmundo:city-scene-reconcile'));

  update public.scene_challenge_cycles
  set status='expired'
  where status in ('scheduled','active') and ends_at<=p_at
    and (p_city_id is null or city_id=p_city_id);

  -- Never generate dormant, zero-population city cycles across all 180 cities.
  for v_city in
    select c.id
    from public.cities c
    where (p_city_id is null or c.id=p_city_id)
      and exists(
        select 1 from public.profiles p
        where p.current_city_id=c.id
          and p.user_id is not null
          and p.is_active is true and p.deleted_at is null
          and p.last_login_at >= p_at - interval '14 days'
          and p.last_login_at <= p_at
      )
    order by c.id
  loop
    select count(distinct p.user_id)::int into v_snapshot
    from public.profiles p
    where p.current_city_id=v_city and p.user_id is not null
      and p.is_active is true and p.deleted_at is null
      and p.last_login_at >= p_at-interval '14 days'
      and p.last_login_at <= p_at;

    for v_cadence in select unnest(array['daily','weekly','monthly']) loop
      v_needed:=case v_cadence when 'monthly' then 1 else 3 end;
      if (select count(*) from public.scene_challenge_templates t
          where t.cadence=v_cadence and t.enabled) < v_needed
      then continue; end if;

      -- October pilot starts daily/weekly; do not launch a monthly challenge
      -- with only four days left. Future months begin on day 1, 2 or 3 UTC.
      if v_cadence='monthly'
        and (
          (p_at at time zone 'UTC')::date < v_launch.monthly_first_start
          or extract(day from p_at at time zone 'UTC') > 3
        )
      then continue; end if;

      v_start:=case v_cadence
        when 'daily' then date_trunc('day',p_at at time zone 'UTC') at time zone 'UTC'
        when 'weekly' then date_trunc('week',p_at at time zone 'UTC') at time zone 'UTC'
        else date_trunc('month',p_at at time zone 'UTC') at time zone 'UTC'
      end;
      v_end:=case v_cadence
        when 'daily' then v_start+interval '1 day'
        when 'weekly' then v_start+interval '7 days'
        else (date_trunc('month',p_at at time zone 'UTC')+interval '1 month') at time zone 'UTC'
      end;

      v_target:=case v_cadence
        when 'daily' then 3 * greatest(1,ceil(v_snapshot::numeric/20)::int)
        when 'weekly' then 3 * greatest(1,ceil(v_snapshot::numeric/8)::int)
        else 3 * greatest(1,ceil(v_snapshot::numeric/4)::int)
      end;

      insert into public.scene_challenge_cycles(
        city_id,cadence,starts_at,ends_at,active_population_snapshot,
        theme_slug,target_total,status
      ) values (
        v_city,v_cadence,v_start,v_end,v_snapshot,
        'city-mural',v_target,'active'
      ) on conflict(city_id,cadence,starts_at) do nothing
      returning id into v_cycle;

      if v_cycle is null then continue; end if;
      v_created:=v_created+1;

      insert into public.scene_challenge_objectives(
        cycle_id,template_id,target_points,source_health_snapshot
      )
      select v_cycle,ranked.template_id,
        (v_target/v_needed)+case when ranked.rn <= (v_target%v_needed) then 1 else 0 end,
        jsonb_build_object(
          'adapter',ranked.action_type,
          'scoring_enabled',v_launch.scoring_enabled and coalesce(s.enabled,false)
        )
      from (
        select t.id template_id,t.action_type,
          row_number() over(order by t.slug) rn
        from public.scene_challenge_templates t
        where t.cadence=v_cadence and t.enabled
        order by t.slug limit v_needed
      ) ranked
      left join public.scene_source_controls s on s.action_type=ranked.action_type;
    end loop;
  end loop;
  return v_created;
end;
$$;
revoke all on function private.reconcile_city_scene_cycles(timestamptz,uuid)
  from public,anon,authenticated;
grant execute on function private.reconcile_city_scene_cycles(timestamptz,uuid)
  to service_role;
commit;
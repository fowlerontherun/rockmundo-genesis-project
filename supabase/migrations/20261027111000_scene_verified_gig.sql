-- Verified completed gig performance source. Only actual performers count:
-- never infer participation from band membership or scheduled lineups.
begin;
alter table public.scene_processor_cursors
  drop constraint if exists scene_processor_cursors_source_key_check;
alter table public.scene_processor_cursors
  add constraint scene_processor_cursors_source_key_check
  check (source_key in ('verified_jam','completed_recording','verified_gig'));

update public.scene_challenge_templates
set action_type='gig:verified_performance',
    title='Rock Your Local Stage',
    description='Play a completed gig with a verified performed lineup.',
    art_theme='stage-lights',
    version=version+1
where slug='daily-afterparty' and enabled is false;

update public.scene_challenge_templates
set action_type='gig:verified_performance',
    title='Support Live Performers',
    description='Help your city complete gigs with real performer attendance.',
    art_theme='stage-lights',
    version=version+1
where slug='weekly-gig-support' and enabled is false;

create or replace function private.ingest_scene_verified_gig(p_outcome_id uuid)
returns integer language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_gig record;
  v_actor record;
  v_obj record;
  v_affiliation uuid;
  v_points int;
  v_cap int;
  v_credited int := 0;
begin
  if p_outcome_id is null then return 0; end if;
  perform pg_advisory_xact_lock(hashtext('rockmundo:scene:gig:'||p_outcome_id::text));

  select go.id as outcome_id, go.gig_id, go.completed_at, go.band_id,
    g.status as gig_status, g.cancelled_at, g.band_id as booked_band_id,
    v.city_id
  into v_gig
  from public.gig_outcomes go
  join public.gigs g on g.id=go.gig_id
  join public.venues v on v.id=g.venue_id
  where go.id=p_outcome_id;

  if not found or v_gig.city_id is null
    or v_gig.completed_at is null
    or v_gig.completed_at > now()
    or v_gig.completed_at < now()-interval '7 days'
    or v_gig.gig_status <> 'completed'
    or v_gig.cancelled_at is not null
    or v_gig.booked_band_id is distinct from v_gig.band_id
  then return 0; end if;

  -- A performed_at timestamp and completed-gig outcome are both mandatory.
  if not exists (
    select 1 from public.gig_performers gp
    where gp.gig_id=v_gig.gig_id
      and gp.lineup_status='performed'
      and gp.performed_at is not null
      and gp.performed_at <= v_gig.completed_at
      and gp.band_id=v_gig.band_id
  ) then return 0; end if;

  if not exists (
    select 1 from public.scene_challenge_cycles c
    join public.scene_challenge_objectives o on o.cycle_id=c.id
    join public.scene_challenge_templates t on t.id=o.template_id
    where c.city_id=v_gig.city_id
      and c.starts_at<=v_gig.completed_at and c.ends_at>v_gig.completed_at
      and c.status in ('active','completed','expired')
      and o.status in ('active','completed') and t.enabled
      and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
      and (t.action_type='gig:verified_performance'
        or (c.cadence='monthly' and t.action_type='scene:verified_community'))
  ) then return 0; end if;

  for v_actor in
    select distinct on (p.user_id)
      p.user_id as account_id,p.id as profile_id
    from public.gig_performers gp
    join public.profiles p on p.id=gp.profile_id
    where gp.gig_id=v_gig.gig_id
      and gp.band_id=v_gig.band_id
      and gp.lineup_status='performed'
      and gp.performed_at is not null
      and gp.performed_at<=v_gig.completed_at
      and p.user_id is not null and p.deleted_at is null
    order by p.user_id,p.id
  loop
    perform pg_advisory_xact_lock(hashtext(
      'rockmundo:scene:acct:'||v_actor.account_id::text||':'||
      (v_gig.completed_at at time zone 'UTC')::date::text
    ));

    insert into public.scene_daily_affiliations(account_id,date_utc,city_id,profile_id)
    values(v_actor.account_id,(v_gig.completed_at at time zone 'UTC')::date,
      v_gig.city_id,v_actor.profile_id)
    on conflict(account_id,date_utc) do nothing;

    select city_id into v_affiliation
    from public.scene_daily_affiliations
    where account_id=v_actor.account_id
      and date_utc=(v_gig.completed_at at time zone 'UTC')::date;
    if v_affiliation is distinct from v_gig.city_id then continue; end if;

    for v_obj in
      select o.id as objective_id,c.id as cycle_id,c.cadence
      from public.scene_challenge_cycles c
      join public.scene_challenge_objectives o on o.cycle_id=c.id
      join public.scene_challenge_templates t on t.id=o.template_id
      where c.city_id=v_gig.city_id
        and c.starts_at<=v_gig.completed_at and c.ends_at>v_gig.completed_at
        and c.status in ('active','completed','expired')
        and o.status in ('active','completed') and t.enabled
        and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
        and (t.action_type='gig:verified_performance'
          or (c.cadence='monthly' and t.action_type='scene:verified_community'))
      order by c.starts_at,c.cadence,o.id
    loop
      v_cap := case v_obj.cadence when 'daily' then 5 when 'weekly' then 10 else 25 end;
      perform pg_advisory_xact_lock(hashtext(
        'rockmundo:scene:cycle:'||v_actor.account_id::text||':'||v_obj.cycle_id::text
      ));

      if exists (
        select 1 from public.scene_contributions sc
        where sc.objective_id=v_obj.objective_id
          and sc.account_id=v_actor.account_id
          and sc.source_type='verified_gig_performance'
          and sc.source_event_id=p_outcome_id::text
      ) then continue; end if;

      select coalesce(sum(sc.points),0)::int into v_points
      from public.scene_contributions sc
      join public.scene_challenge_objectives o on o.id=sc.objective_id
      where o.cycle_id=v_obj.cycle_id and sc.account_id=v_actor.account_id
        and sc.invalidated_at is null;
      if v_points>=v_cap then continue; end if;

      insert into public.scene_contributions(
        objective_id,account_id,profile_id,band_id,city_id,
        source_type,source_event_id,source_completed_at,points
      ) values(
        v_obj.objective_id,v_actor.account_id,v_actor.profile_id,
        v_gig.band_id,v_gig.city_id,'verified_gig_performance',
        p_outcome_id::text,v_gig.completed_at,1
      )
      on conflict(objective_id,source_type,source_event_id,account_id)
      do nothing;
      if found then v_credited:=v_credited+1; end if;
    end loop;
  end loop;
  return v_credited;
end;
$$;
revoke all on function private.ingest_scene_verified_gig(uuid)
  from public,anon,authenticated;
grant execute on function private.ingest_scene_verified_gig(uuid) to service_role;

create or replace function public.scene_ingest_verified_gig(p_outcome_id uuid)
returns integer language sql security invoker
set search_path=pg_catalog,public,private
as $$ select private.ingest_scene_verified_gig(p_outcome_id); $$;
revoke all on function public.scene_ingest_verified_gig(uuid) from public,anon,authenticated;
grant execute on function public.scene_ingest_verified_gig(uuid) to service_role;
commit;
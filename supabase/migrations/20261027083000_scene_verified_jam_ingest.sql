-- Canonical jam adapter: requires finalisation, resolved slots and distinct
-- accounts with independently stored slot results. Service-role only.
-- No scheduler/trigger and no automatic template activation.
begin;

create or replace function private.ingest_scene_verified_jam(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_session public.jam_sessions%rowtype;
  v_actor record;
  v_obj record;
  v_affiliation uuid;
  v_current_points integer;
  v_cap integer;
  v_credited integer := 0;
begin
  if p_session_id is null then return 0; end if;
  perform pg_advisory_xact_lock(hashtext('rockmundo:scene:jam:' || p_session_id::text));

  select * into v_session
    from public.jam_sessions where id = p_session_id
      and status = 'completed' and completed_at is not null;
  if not found or v_session.city_id is null
    or v_session.completed_at > now()
    or v_session.completed_at < now() - interval '7 days'
    or v_session.scheduled_end is null
    or v_session.completed_at < v_session.scheduled_end
    or not exists (
      select 1 from public.jam_session_finalizations f
      where f.session_id = p_session_id
        and f.applied_at >= coalesce(v_session.started_at, v_session.created_at)
        and f.applied_at <= now()
    )
  then
    return 0;
  end if;

  -- A booking, participant RSVP or automatic "completed" status alone
  -- cannot score. At least two different accounts actually need resolved slot
  -- records in the jam's finalised performance.
  if (
    select count(distinct p.user_id)
      from public.jam_session_slot_participants sp
      join public.jam_session_slots sl on sl.id = sp.slot_id
      join public.profiles p on p.id = sp.profile_id
     where sl.session_id = p_session_id
       and sp.session_id = p_session_id
       and sl.resolved_at is not null
       and sl.resolved_at <= v_session.completed_at
       and p.deleted_at is null
       and p.user_id is not null
  ) < 2 then
    return 0;
  end if;

  -- Never lock in the account's city if no healthy active objective qualifies.
  if not exists (
    select 1 from public.scene_challenge_cycles c
    join public.scene_challenge_objectives o on o.cycle_id = c.id
    join public.scene_challenge_templates t on t.id = o.template_id
    where c.city_id = v_session.city_id
      and c.starts_at <= v_session.completed_at
      and c.ends_at > v_session.completed_at
      and c.status in ('active', 'completed', 'expired')
      and o.status in ('active', 'completed')
      and t.enabled is true
      and coalesce(o.source_health_snapshot->>'scoring_enabled', 'false') = 'true'
      and (t.action_type = 'jam:verified_collaboration'
        or (c.cadence = 'monthly' and t.action_type = 'scene:verified_community'))
  ) then return 0; end if;

  -- One character per account; travel after completion can prevent credit,
  -- never reassign points to an incorrect city.
  for v_actor in
    select distinct on (p.user_id) p.user_id as account_id, p.id as profile_id
    from public.jam_session_slot_participants sp
    join public.jam_session_slots sl on sl.id = sp.slot_id
    join public.profiles p on p.id = sp.profile_id
    where sl.session_id = p_session_id and sp.session_id = p_session_id
      and sl.resolved_at is not null
      and sl.resolved_at <= v_session.completed_at
      and p.deleted_at is null and p.user_id is not null
      and p.current_city_id = v_session.city_id
    order by p.user_id, p.id
  loop
    perform pg_advisory_xact_lock(hashtext(
      'rockmundo:scene:acct:' || v_actor.account_id::text || ':' ||
      (v_session.completed_at at time zone 'UTC')::date::text
    ));

    insert into public.scene_daily_affiliations
      (account_id, date_utc, city_id, profile_id)
    values (
      v_actor.account_id,
      (v_session.completed_at at time zone 'UTC')::date,
      v_session.city_id, v_actor.profile_id
    )
    on conflict (account_id, date_utc) do nothing;

    select city_id into v_affiliation
    from public.scene_daily_affiliations
    where account_id = v_actor.account_id
      and date_utc = (v_session.completed_at at time zone 'UTC')::date;

    if v_affiliation is distinct from v_session.city_id then continue; end if;

    for v_obj in
      select o.id as objective_id, c.id as cycle_id, c.cadence
      from public.scene_challenge_cycles c
      join public.scene_challenge_objectives o on o.cycle_id = c.id
      join public.scene_challenge_templates t on t.id = o.template_id
      where c.city_id = v_session.city_id
        and c.starts_at <= v_session.completed_at
        and c.ends_at > v_session.completed_at
        and c.status in ('active', 'completed', 'expired')
        and o.status in ('active', 'completed')
        and t.enabled is true
        and coalesce(o.source_health_snapshot->>'scoring_enabled', 'false') = 'true'
        and (t.action_type = 'jam:verified_collaboration'
          or (c.cadence = 'monthly' and t.action_type = 'scene:verified_community'))
      order by c.starts_at, c.cadence, o.id
    loop
      v_cap := case v_obj.cadence when 'daily' then 3 when 'weekly' then 10 else 25 end;
      if exists (
        select 1 from public.scene_contributions
        where objective_id = v_obj.objective_id
          and account_id = v_actor.account_id
          and source_type = 'completed_verified_jam'
          and source_event_id = p_session_id::text
      ) then continue; end if;

      perform pg_advisory_xact_lock(hashtext(
        'rockmundo:scene:cycle:' || v_actor.account_id::text || ':' || v_obj.cycle_id::text
      ));

      select coalesce(sum(sc.points),0)::integer into v_current_points
      from public.scene_contributions sc
      join public.scene_challenge_objectives so on so.id = sc.objective_id
      where so.cycle_id = v_obj.cycle_id
        and sc.account_id = v_actor.account_id
        and sc.invalidated_at is null;

      if v_current_points >= v_cap then continue; end if;

      insert into public.scene_contributions (
        objective_id, account_id, profile_id, band_id, city_id,
        source_type, source_event_id, source_completed_at, points
      ) values (
        v_obj.objective_id, v_actor.account_id, v_actor.profile_id,
        v_session.band_id, v_session.city_id,
        'completed_verified_jam', p_session_id::text,
        v_session.completed_at, 1
      )
      on conflict (objective_id, source_type, source_event_id, account_id)
        do nothing;

      if found then v_credited := v_credited + 1; end if;
    end loop;
  end loop;
  return v_credited;
end;
$$;

revoke all on function private.ingest_scene_verified_jam(uuid)
  from public, anon, authenticated;
grant execute on function private.ingest_scene_verified_jam(uuid) to service_role;

create or replace function public.scene_ingest_verified_jam(p_session_id uuid)
returns integer
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.ingest_scene_verified_jam(p_session_id);
$$;
revoke all on function public.scene_ingest_verified_jam(uuid)
  from public, anon, authenticated;
grant execute on function public.scene_ingest_verified_jam(uuid) to service_role;
commit;
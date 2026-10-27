-- Trusted-source adapter (server-only). An event must be a genuinely completed,
-- past-due social activity with >=2 distinct attending human accounts.
-- Not connected to the client, scheduler or a trigger in this migration.
begin;

create or replace function private.ingest_scene_social_activity(p_activity_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_activity public.social_activities%rowtype;
  v_actor record;
  v_obj record;
  v_affiliation uuid;
  v_credited integer := 0;
  v_current_points integer;
  v_cap integer;
begin
  -- Social attendance is currently inferred from accepted invitations by
  -- the host-owned completion RPC, not independently observed. Until that
  -- system has a verified participation receipt, NEVER score this source.
  -- Keep the adapter staged for future contract-hardening.
  return 0;

  if p_activity_id is null then
    return 0;
  end if;

  -- At most one ingester per source event, even during job retries.
  perform pg_advisory_xact_lock(hashtext('rockmundo:scene:social:' || p_activity_id::text));

  select * into v_activity
    from public.social_activities
   where id = p_activity_id and status = 'completed';
  if not found or v_activity.city_id is null
    or v_activity.completed_at is null
    or v_activity.completed_at > now()
    or v_activity.end_at > v_activity.completed_at
    or v_activity.completed_at < now() - interval '7 days'
  then
    return 0;
  end if;

  -- Hosts can currently finalise a social activity before its scheduled end.
  -- Never trust status='completed' alone.
  if (select count(distinct p.user_id)
        from public.social_activity_participants sap
        join public.profiles p on p.id = sap.profile_id
       where sap.activity_id = p_activity_id
         and sap.attended is true
         and sap.response = 'accepted'
         and p.deleted_at is null
         and p.user_id is not null) < 2
  then
    return 0;
  end if;

  -- Never claim a city affiliation if no active, healthy objective can score.
  if not exists (
    select 1 from public.scene_challenge_cycles c
    join public.scene_challenge_objectives o on o.cycle_id = c.id
    join public.scene_challenge_templates t on t.id = o.template_id
    where c.city_id = v_activity.city_id
      and c.starts_at <= v_activity.completed_at and c.ends_at > v_activity.completed_at
      and c.status in ('active','completed','expired')
      and o.status in ('active','completed') and t.enabled is true
      and coalesce(o.source_health_snapshot->>'scoring_enabled', 'false') = 'true'
      and (t.action_type = 'social:' || v_activity.activity_type
        or (c.cadence = 'monthly' and t.action_type = 'scene:verified_community'))
  ) then
    return 0;
  end if;

  -- Choose one character per account so alternate characters cannot stack.
  for v_actor in
    select distinct on (p.user_id)
      p.user_id as account_id, p.id as profile_id
    from public.social_activity_participants sap
    join public.profiles p on p.id = sap.profile_id
    where sap.activity_id = p_activity_id and sap.attended is true
      and sap.response = 'accepted' and p.deleted_at is null
      and p.user_id is not null
      and p.current_city_id = v_activity.city_id
    order by p.user_id, p.id
  loop
    perform pg_advisory_xact_lock(hashtext(
      'rockmundo:scene:acct:' || v_actor.account_id::text || ':' ||
      (v_activity.completed_at at time zone 'UTC')::date::text
    ));

    insert into public.scene_daily_affiliations
      (account_id, date_utc, city_id, profile_id)
    values (
      v_actor.account_id, (v_activity.completed_at at time zone 'UTC')::date,
      v_activity.city_id, v_actor.profile_id
    )
    on conflict (account_id, date_utc) do nothing;

    select city_id into v_affiliation
      from public.scene_daily_affiliations
     where account_id = v_actor.account_id
       and date_utc = (v_activity.completed_at at time zone 'UTC')::date;

    if v_affiliation is distinct from v_activity.city_id then
      continue;
    end if;

    for v_obj in
      select o.id as objective_id, c.id as cycle_id, c.cadence
      from public.scene_challenge_cycles c
      join public.scene_challenge_objectives o on o.cycle_id = c.id
      join public.scene_challenge_templates t on t.id = o.template_id
      where c.city_id = v_activity.city_id
        and c.starts_at <= v_activity.completed_at
        and c.ends_at > v_activity.completed_at
        and c.status in ('active','completed','expired')
        and o.status in ('active','completed')
        and t.enabled is true
        and coalesce(o.source_health_snapshot->>'scoring_enabled', 'false') = 'true'
        and (
          t.action_type = 'social:' || v_activity.activity_type
          or (c.cadence = 'monthly' and t.action_type = 'scene:verified_community')
        )
      order by c.starts_at, c.cadence, o.id
    loop
      v_cap := case v_obj.cadence when 'daily' then 5 when 'weekly' then 10 else 25 end;

      -- Account/cycle lock serialises the full-period cap across all dates.
      -- A single event may count in different cadences; never double-count
      -- the same event within the same objective.
      if exists (
        select 1 from public.scene_contributions
        where objective_id = v_obj.objective_id
          and account_id = v_actor.account_id
          and source_type = 'completed_social_activity'
          and source_event_id = p_activity_id::text
      ) then
        continue;
      end if;

      perform pg_advisory_xact_lock(hashtext(
        'rockmundo:scene:cycle:' || v_actor.account_id::text || ':' || v_obj.cycle_id::text
      ));

      select coalesce(sum(sc.points), 0)::integer into v_current_points
        from public.scene_contributions sc
        join public.scene_challenge_objectives so on so.id = sc.objective_id
       where so.cycle_id = v_obj.cycle_id
         and sc.account_id = v_actor.account_id
         and sc.invalidated_at is null;

      if v_current_points >= v_cap then
        continue;
      end if;

      insert into public.scene_contributions (
        objective_id, account_id, profile_id, band_id, city_id,
        source_type, source_event_id, source_completed_at, points
      ) values (
        v_obj.objective_id, v_actor.account_id, v_actor.profile_id,
        v_activity.band_id, v_activity.city_id,
        'completed_social_activity', p_activity_id::text,
        v_activity.completed_at, 1
      )
      on conflict (objective_id, source_type, source_event_id, account_id)
        do nothing;

      if found then
        v_credited := v_credited + 1;
      end if;
    end loop;
  end loop;
  return v_credited;
end;
$$;

revoke all on function private.ingest_scene_social_activity(uuid)
  from public, anon, authenticated;
grant execute on function private.ingest_scene_social_activity(uuid)
  to service_role;

commit;

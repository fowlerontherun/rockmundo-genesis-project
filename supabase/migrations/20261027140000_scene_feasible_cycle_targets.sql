-- Restore mathematically achievable city scene targets.
-- Prior monthly: 35 * active_accounts, while personal cap was 25 points per
-- monthly cycle. That made monthly completion impossible at every population.
-- New per-account goals: daily 3 / weekly 6 / monthly 12, below their
-- respective per-account caps (5 / 10 / 25). All sample values still require
-- player activity and economy balancing in staging before enabling templates.
-- This is an additive override; never silently edit completed historic cycles.
begin;

create or replace function private.reconcile_city_scene_cycles(
  p_at timestamptz default now(),
  p_city_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
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
  v_created integer := 0;
begin
  if p_at is null or p_at > now() + interval '1 day'
     or p_at < now() - interval '14 days' then
    raise exception 'Invalid reconciliation instant';
  end if;
  perform pg_advisory_xact_lock(hashtext('rockmundo:city-scene-reconcile'));

  update public.scene_challenge_cycles
     set status = 'expired'
   where status in ('scheduled', 'active') and ends_at <= p_at
     and (p_city_id is null or city_id = p_city_id);

  for v_city in select c.id from public.cities c
      where p_city_id is null or c.id = p_city_id
      order by c.id
  loop
    select count(distinct p.user_id)::int
      into v_snapshot from public.profiles p
      where p.current_city_id = v_city
        and p.last_login_at >= p_at - interval '14 days'
        and p.last_login_at <= p_at
        and p.deleted_at is null
        and p.is_active is true;

    for v_cadence in select unnest(array['daily','weekly','monthly']) loop
      v_needed := case v_cadence when 'monthly' then 1 else 3 end;
      if (select count(*) from public.scene_challenge_templates t
          where t.cadence = v_cadence and t.enabled) < v_needed then
        continue;
      end if;

      v_start := case v_cadence
        when 'daily' then date_trunc('day', p_at at time zone 'UTC') at time zone 'UTC'
        when 'weekly' then date_trunc('week', p_at at time zone 'UTC') at time zone 'UTC'
        else date_trunc('month', p_at at time zone 'UTC') at time zone 'UTC'
      end;
      v_end := case v_cadence
        when 'daily' then v_start + interval '1 day'
        when 'weekly' then v_start + interval '7 days'
        else (date_trunc('month', p_at at time zone 'UTC') + interval '1 month') at time zone 'UTC'
      end;
      v_target := case v_cadence
        when 'daily' then 3 * greatest(1, v_snapshot)
        when 'weekly' then 6 * greatest(1, v_snapshot)
        else 12 * greatest(1, v_snapshot)
      end;

      insert into public.scene_challenge_cycles
        (city_id, cadence, starts_at, ends_at, active_population_snapshot,
         theme_slug, target_total, status)
      values
        (v_city, v_cadence, v_start, v_end, v_snapshot, 'city-mural',
         v_target, 'active')
      on conflict (city_id, cadence, starts_at) do nothing
      returning id into v_cycle;

      if v_cycle is null then
        continue;
      end if;
      v_created := v_created + 1;

      insert into public.scene_challenge_objectives
        (cycle_id, template_id, target_points, source_health_snapshot)
      select v_cycle, template_id,
        (v_target / v_needed) +
          case when rn <= (v_target % v_needed) then 1 else 0 end,
        jsonb_build_object('adapter', 'pending', 'scoring_enabled', false)
      from (
        select t.id as template_id, row_number() over(order by t.slug) as rn
        from public.scene_challenge_templates t
        where t.cadence = v_cadence and t.enabled
        order by t.slug
        limit v_needed
      ) chosen;
    end loop;
  end loop;
  return v_created;
end;
$$;

revoke all on function private.reconcile_city_scene_cycles(timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function private.reconcile_city_scene_cycles(timestamptz, uuid)
  to service_role;
commit;

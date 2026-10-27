-- City Scene Challenges: read-side board + service-role-only cycle reconciliation.
-- Separate, additive migration. No server event adapters, payouts, or cron jobs.
begin;

insert into public.scene_challenge_templates
  (slug, cadence, title, description, action_type, target_weight, enabled, art_theme)
values
  ('daily-band-meeting', 'daily', 'Make Some Noise', 'Complete a verified band meeting with local musicians.', 'social:band_meeting', 1, false, 'gig-posters'),
  ('daily-afterparty', 'daily', 'Keep The Night Alive', 'Join a verified afterparty after a local gig.', 'social:gig_afterparty', 1, false, 'neon-nightlife'),
  ('daily-release-party', 'daily', 'Celebrate A Release', 'Celebrate a local artist through a verified release gathering.', 'social:release_celebration', 1, false, 'record-store'),
  ('weekly-scene-dinner', 'weekly', 'Bring The Scene Together', 'Complete verified community dinners with local musicians.', 'social:team_dinner', 1, false, 'gig-posters'),
  ('weekly-open-jam', 'weekly', 'Jam With The Locals', 'Complete verified collaborative sessions with local artists.', 'jam:verified_cross_band', 1, false, 'rehearsal'),
  ('weekly-gig-support', 'weekly', 'Back Local Gigs', 'Attend and support completed local gigs.', 'gig:verified_attendance', 1, false, 'stage-lights'),
  ('monthly-scene-revival', 'monthly', 'Live Music Revival', 'Build your city scene together through verified music activities.', 'scene:verified_community', 1, false, 'city-mural')
on conflict (slug) do nothing;

-- Never surface raw user_id, profile_id, source_event_id, financial or
-- relationship details from the private contribution ledger.
create or replace function public.get_city_scene_board(p_city_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'city_id', c.id,
    'city_name', c.name,
    'cycles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', cc.id,
          'cadence', cc.cadence,
          'starts_at', cc.starts_at,
          'ends_at', cc.ends_at,
          'target_total', cc.target_total,
          'earned_points', coalesce((
            select sum(sc.points) from public.scene_contributions sc
            join public.scene_challenge_objectives o on o.id = sc.objective_id
            where o.cycle_id = cc.id and sc.invalidated_at is null
          ), 0),
          'theme_slug', cc.theme_slug,
          'objectives', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', ob.id,
              'title', t.title,
              'description', t.description,
              'action_type', t.action_type,
              'target_points', ob.target_points,
              'earned_points', coalesce((
                select sum(sc2.points) from public.scene_contributions sc2
                where sc2.objective_id = ob.id and sc2.invalidated_at is null
              ), 0),
              'status', ob.status
            ) order by t.slug)
            from public.scene_challenge_objectives ob
            join public.scene_challenge_templates t on t.id = ob.template_id
            where ob.cycle_id = cc.id
          ), '[]'::jsonb)
        )
        order by case cc.cadence when 'daily' then 1 when 'weekly' then 2 else 3 end
      )
      from public.scene_challenge_cycles cc
      where cc.city_id = c.id
        and cc.starts_at <= now() and cc.ends_at > now()
        and cc.status in ('active', 'completed')
    ), '[]'::jsonb)
  )
  from public.cities c
  where c.id = p_city_id
    and (select auth.uid()) is not null;
$$;

revoke all on function public.get_city_scene_board(uuid) from public, anon;
grant execute on function public.get_city_scene_board(uuid) to authenticated, service_role;

-- Runs from a trusted server only. A future reconciler will call this, not
-- the browser. Disabled templates are never instantiated.
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
        when 'daily' then greatest(4, 3 * greatest(1, v_snapshot))
        when 'weekly' then greatest(12, 10 * greatest(1, v_snapshot))
        else greatest(40, 35 * greatest(1, v_snapshot))
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

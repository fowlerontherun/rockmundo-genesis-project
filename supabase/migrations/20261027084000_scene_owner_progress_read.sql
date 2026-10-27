-- Owner-scoped scene progress read model. No rewards or mutations.
begin;
create or replace function public.get_my_city_scene_progress(p_city_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'city_id', p_city_id,
    'cycles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'cycle_id', c.id,
        'cadence', c.cadence,
        'earned_points', coalesce((
          select sum(sc.points)
          from public.scene_contributions sc
          join public.scene_challenge_objectives ob
            on ob.id = sc.objective_id
          where ob.cycle_id = c.id
            and sc.account_id = (select auth.uid())
            and sc.invalidated_at is null
        ), 0),
        'verified_actions', coalesce((
          select count(distinct (sc.source_type, sc.source_event_id))::integer
          from public.scene_contributions sc
          join public.scene_challenge_objectives ob
            on ob.id = sc.objective_id
          where ob.cycle_id = c.id
            and sc.account_id = (select auth.uid())
            and sc.invalidated_at is null
        ), 0)
      ) order by case c.cadence when 'daily' then 1 when 'weekly' then 2 else 3 end)
      from public.scene_challenge_cycles c
      where c.city_id = p_city_id
        and c.starts_at <= now() and c.ends_at > now()
        and c.status in ('active','completed')
    ), '[]'::jsonb)
  )
  where (select auth.uid()) is not null;
$$;
revoke all on function public.get_my_city_scene_progress(uuid) from public, anon;
grant execute on function public.get_my_city_scene_progress(uuid) to authenticated, service_role;
commit;
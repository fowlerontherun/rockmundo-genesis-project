-- Applied directly to RockMundo production on 30 October 2026.
-- Server-only read-only per-city monthly launch preflight.
CREATE OR REPLACE FUNCTION private.scene_november_city_readiness()
 RETURNS TABLE(city_id uuid, city_name text, recently_active_accounts integer, projected_target_points integer, november_cycle_count integer, november_objective_count integer, readiness text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  with eligible as (
    select p.current_city_id as id,
           count(distinct p.user_id)::integer as accounts
    from public.profiles p
    where p.current_city_id is not null
      and p.user_id is not null
      and p.is_active is true
      and p.deleted_at is null
      and p.last_login_at >= now() - interval '14 days'
      and p.last_login_at <= now()
    group by p.current_city_id
  ), created as (
    select cc.city_id as id,
           count(distinct cc.id)::integer as cycles,
           count(ob.id)::integer as objectives
    from public.scene_challenge_cycles cc
    left join public.scene_challenge_objectives ob on ob.cycle_id = cc.id
    where cc.cadence = 'monthly'
      and cc.starts_at = timestamptz '2026-11-01 00:00:00+00'
    group by cc.city_id
  ), candidate_cities as (
    select id from eligible union select id from created
  )
  select c.id as city_id,
         c.name::text as city_name,
         coalesce(e.accounts, 0) as recently_active_accounts,
         case when e.accounts > 0
           then (3 * greatest(1, ceil(e.accounts::numeric / 4)::integer))
           else null end as projected_target_points,
         coalesce(cr.cycles, 0) as november_cycle_count,
         coalesce(cr.objectives, 0) as november_objective_count,
         case
           when cr.cycles > 1 then 'duplicate_cycles'
           when cr.cycles = 1 and cr.objectives <> 1 then 'bad_objective_count'
           when cr.cycles = 1 then 'created'
           when now() >= timestamptz '2026-11-02 00:00:00+00' then 'missing_after_grace'
           else 'awaiting_worker'
         end::text as readiness
  from candidate_cities candidates
  join public.cities c on c.id = candidates.id
  left join eligible e on e.id = c.id
  left join created cr on cr.id = c.id
  order by c.name, c.id;
$function$

revoke all on function private.scene_november_city_readiness() from public, anon, authenticated;
grant execute on function private.scene_november_city_readiness() to service_role;

-- Exposed-schema entry points for trusted service-role background jobs.
-- PostgREST does not expose the existing private schema. Public wrappers
-- are security-invoker and executable by service_role ONLY.
begin;
grant usage on schema private to service_role;

create or replace function public.scene_reconcile_cycles(
  p_at timestamptz default now(),
  p_city_id uuid default null
)
returns integer
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.reconcile_city_scene_cycles(p_at, p_city_id);
$$;

create or replace function public.scene_ingest_social_activity(p_activity_id uuid)
returns integer
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.ingest_scene_social_activity(p_activity_id);
$$;

revoke all on function public.scene_reconcile_cycles(timestamptz, uuid)
  from public, anon, authenticated;
revoke all on function public.scene_ingest_social_activity(uuid)
  from public, anon, authenticated;
grant execute on function public.scene_reconcile_cycles(timestamptz, uuid)
  to service_role;
grant execute on function public.scene_ingest_social_activity(uuid)
  to service_role;
commit;

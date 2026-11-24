-- Read-only catalogue evidence for FEST-001 / #4619.
-- Object presence and grants do not certify function-body authorisation.
WITH tables AS (
  SELECT c.relname AS name, c.relrowsecurity AS rls, pg_get_userbyid(c.relowner) AS owner
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN (
    'festival_companies','festival_editions','festival_editions_v2',
    'festival_edition_runtimes','festival_runtime_configuration_versions',
    'festival_runtime_evidence','festival_stages','festival_site_plan_stages',
    'festival_public_editions','festival_runtime_sessions','festival_runtime_days',
    'festival_stage_crowd_snapshots','festival_performance_sessions'
  )
), functions AS (
  SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS security_definer, p.proconfig AS configuration,
    pg_get_userbyid(p.proowner) AS owner,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN (
    'get_public_festival','get_public_festival_directory',
    'get_public_festival_edition_live_status','get_public_festival_live_status',
    'get_public_festival_live_experience','get_festival_edition_runtime_control_room',
    'festival_schedule_upsert_item','get_festival_edition_artist_programme',
    'save_festival_edition_artist_programme','get_festival_edition_site_plan',
    'get_festival_edition_ticket_plan','prepare_festival_edition_runtime',
    'transition_festival_edition_runtime'
  )
), relations AS (
  SELECT conrelid::regclass::text AS source_table, confrelid::regclass::text AS target_table,
    pg_get_constraintdef(oid) AS relation
  FROM pg_constraint WHERE contype='f' AND conrelid IN (
    to_regclass('public.festival_edition_runtimes'),
    to_regclass('public.festival_performance_sessions'),
    to_regclass('public.festival_stage_crowd_snapshots')
  )
)
SELECT jsonb_build_object(
  'checkedAt', clock_timestamp(),
  'tables', (SELECT jsonb_agg(to_jsonb(t) ORDER BY name) FROM tables t),
  'functions', (SELECT jsonb_agg(to_jsonb(f) ORDER BY name, arguments) FROM functions f),
  'relations', (SELECT jsonb_agg(to_jsonb(r) ORDER BY source_table,target_table) FROM relations r)
) AS festival_authority_audit;

-- Festival V2 production runtime architecture preflight.
-- READ ONLY: safe to run in the connected project's SQL editor.
-- The existing annual-edition runtime and older launch-scoped implementation
-- are different architectures. Do NOT infer missing launch-scoped tables mean
-- the canonical edition runtime must be installed again.
--
-- This produces a single JSON object suitable for an audit/release checklist.
-- Execute before deploying any public runtime projection or reconciliation.
WITH objects(object_name,kind) AS (
  VALUES
    ('festival_editions_v2','table'),
    ('festival_edition_runtimes','table'),
    ('festival_runtime_configuration_versions','table'),
    ('festival_runtime_evidence','table'),
    ('festival_runtime_ticks','table'),
    ('record_canonical_festival_stage_action(uuid,uuid,uuid,text,text,integer)','function'),
    ('festival_canonical_stage_audience_capture','trigger'),
    ('festival_stages','table'),
    ('festival_public_editions','table'),
    ('festival_runtime_sessions','table'),
    ('festival_runtime_days','table'),
    ('festival_runtime_stages','table'),
    ('festival_runtime_stage_crowds','table'),
    ('get_festival_edition_runtime_control_room(uuid,uuid)','function'),
    ('get_public_festival(text)','function'),
    ('get_public_festival_edition_live_status(text)','function'),
    ('get_public_festival_live_status(text)','function'),
    ('get_public_festival_live_experience(text)','function')
),
inventory AS (
  SELECT object_name, kind,
    CASE kind
      WHEN 'table' THEN to_regclass('public.' || object_name) IS NOT NULL
      WHEN 'trigger' THEN EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = to_regclass('public.festival_runtime_evidence')
          AND tgname = object_name AND NOT tgisinternal AND tgenabled IN ('O', 'A')
          AND tgfoid = to_regprocedure('private.capture_canonical_festival_stage_audience_allocation()')
      )
      ELSE to_regprocedure('public.' || object_name) IS NOT NULL
    END AS present
  FROM objects
),
missing_canonical_live_evidence AS (
  SELECT object_name FROM inventory WHERE NOT present AND object_name IN (
    'festival_runtime_ticks',
    'record_canonical_festival_stage_action(uuid,uuid,uuid,text,text,integer)',
    'festival_canonical_stage_audience_capture',
    'get_public_festival_edition_live_status(text)'
  )
),
assessment AS (
  SELECT
    bool_and(present) FILTER (WHERE object_name IN (
      'festival_editions_v2','festival_edition_runtimes',
      'festival_runtime_configuration_versions','festival_runtime_evidence',
      'festival_stages','get_festival_edition_runtime_control_room(uuid,uuid)'
    )) AS canonical_edition_runtime_ready,
    bool_and(present) FILTER (WHERE object_name = 'get_public_festival_edition_live_status(text)') AS canonical_public_projection_present,
    bool_and(present) FILTER (WHERE object_name IN (
      'festival_public_editions','festival_runtime_sessions',
      'festival_runtime_days','festival_runtime_stages',
      'festival_runtime_stage_crowds',
      'get_public_festival_live_status(text)',
      'get_public_festival_live_experience(text)'
    )) AS legacy_launch_runtime_ready,
    bool_and(present) FILTER (WHERE object_name IN (
      'festival_public_editions','festival_runtime_sessions',
      'festival_runtime_days','festival_runtime_stages',
      'festival_runtime_stage_crowds',
      'get_public_festival_live_status(text)',
      'get_public_festival_live_experience(text)'
    )) AS can_apply_launch_scoped_day_crowd_patch
  FROM inventory
)
SELECT jsonb_build_object(
  'checkedAt', clock_timestamp(),
  'catalogue', (SELECT jsonb_agg(jsonb_build_object('object',object_name,'kind',kind,'present',present) ORDER BY object_name) FROM inventory),
  'canonicalEditionRuntimeReady', a.canonical_edition_runtime_ready,
  'canonicalPublicProjectionPresent', a.canonical_public_projection_present,
  'canonicalLiveEvidencePrerequisitesPresent', a.canonical_edition_runtime_ready
    AND NOT EXISTS (SELECT 1 FROM missing_canonical_live_evidence),
  'missingCanonicalLiveEvidencePrerequisites', (
    SELECT coalesce(jsonb_agg(object_name ORDER BY object_name), '[]'::jsonb)
    FROM missing_canonical_live_evidence
  ),
  'launchScopedRuntimeReady', a.legacy_launch_runtime_ready,
  'launchScopedDayCrowdPatchPermitted', a.can_apply_launch_scoped_day_crowd_patch,
  'migrationHistoryCount', (SELECT count(*) FROM supabase_migrations.schema_migrations),
  'latestMigrationVersion', (SELECT max(version) FROM supabase_migrations.schema_migrations),
  'decision', CASE
    WHEN a.canonical_edition_runtime_ready AND NOT a.legacy_launch_runtime_ready
      THEN CASE WHEN a.canonical_public_projection_present
        THEN 'BLOCK launch-scoped patch. Reuse existing canonical annual-edition runtime and public projection; verify identity, privacy and freshness before extending it.'
        ELSE 'BLOCK launch-scoped patch. Reuse existing canonical annual-edition runtime and design a privacy-safe public projection.'
      END
    WHEN a.legacy_launch_runtime_ready
      THEN 'Launch-scoped objects present; require security/grant audit and disposable test harness before patch.'
    ELSE 'BLOCK deployment. Inspect schema/history drift and resolve prerequisites before applying changes.'
  END
) AS festival_runtime_preflight
FROM assessment a;

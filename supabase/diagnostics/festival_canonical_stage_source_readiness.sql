-- Read-only Festival V2 stage-source audit.
-- Stage crowd and performance tables may exist but be tied to the older
-- festival_editions model. Never join those rows to a canonical edition ID.
WITH stage_mapping AS (
  SELECT r.edition_id, stage->>'id' AS stage_id,
    EXISTS (
      SELECT 1 FROM public.festival_site_plan_stages s
      JOIN public.festival_site_plans p ON p.id = s.festival_site_plan_id
      WHERE p.festival_edition_id = r.edition_id
        AND s.id::text = stage->>'id'
    ) AS matches_public_stage
  FROM public.festival_edition_runtimes r
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(r.generated_schedule->'stages', '[]'::jsonb)) stage
),
legacy_fks AS (
  SELECT conrelid::regclass::text AS source_table,
    confrelid::regclass::text AS edition_table
  FROM pg_constraint
  WHERE contype = 'f'
    AND conrelid IN (
      'public.festival_performance_sessions'::regclass,
      'public.festival_stage_crowd_snapshots'::regclass
    )
    AND confrelid IN (
      'public.festival_editions'::regclass,
      'public.festival_editions_v2'::regclass
    )
)
SELECT jsonb_build_object(
  'canonicalRuntimeStages', (SELECT count(*) FROM stage_mapping),
  'matchedPublishedStageIds', (SELECT count(*) FROM stage_mapping WHERE matches_public_stage),
  'allRuntimeStageIdsMatchPublishedPlans',
    coalesce((SELECT bool_and(matches_public_stage) FROM stage_mapping), false),
  'editionForeignKeys', coalesce(
    (SELECT jsonb_agg(jsonb_build_object('table',source_table,'references',edition_table)
      ORDER BY source_table) FROM legacy_fks), '[]'::jsonb
  ),
  'legacyPerformanceSessions', (SELECT count(*) FROM public.festival_performance_sessions),
  'legacyCrowdSnapshots', (SELECT count(*) FROM public.festival_stage_crowd_snapshots),
  'canonicalRuntimeRecords', (SELECT count(*) FROM public.festival_edition_runtimes),
  'recommendation',
    'Do not use legacy performance/crowd tables as live annual-edition evidence. Implement verified edition-v2 stage event capture before publishing crowd or live artist status.'
) AS canonical_stage_source_audit;

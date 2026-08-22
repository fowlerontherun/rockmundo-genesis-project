-- Keep the one-action simplified Festival runtime, but normalise each generated
-- stage/day so NPC filler plays first and confirmed artists close in billing order.
-- This is a forward correction for the v1 generator; historical runtimes are untouched.

ALTER FUNCTION public.run_simplified_festival_edition(uuid, uuid, integer, uuid)
  RENAME TO _run_simplified_festival_edition_v1;

REVOKE ALL ON FUNCTION public._run_simplified_festival_edition_v1(uuid, uuid, integer, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._normalize_simplified_festival_running_order(
  p_runtime_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  runtime public.festival_edition_runtimes%ROWTYPE;
  config_row public.festival_runtime_configuration_versions%ROWTYPE;
  normalized_schedule jsonb;
  normalized_configuration jsonb;
  evidence_hash text;
  normalized_digest text;
BEGIN
  SELECT * INTO runtime
  FROM public.festival_edition_runtimes row
  WHERE row.id = p_runtime_id
  FOR UPDATE;

  IF NOT FOUND OR runtime.schedule_source <> 'simplified_generated' THEN
    RETURN;
  END IF;

  WITH parsed AS (
    SELECT
      item,
      ordinality,
      item->>'stageId' AS stage_id,
      item->>'festivalDate' AS festival_date,
      (item->>'startsAt')::timestamptz AS starts_at,
      greatest(10, coalesce((item->>'setMinutes')::integer, 45)) AS set_minutes,
      item->>'sourceBookingId' IS NOT NULL AS confirmed_artist,
      CASE item->>'billingPosition'
        WHEN 'emerging' THEN 1
        WHEN 'support' THEN 2
        WHEN 'special_guest' THEN 3
        WHEN 'featured' THEN 4
        WHEN 'sub_headliner' THEN 5
        WHEN 'headliner' THEN 6
        ELSE 0
      END AS billing_rank
    FROM jsonb_array_elements(coalesce(runtime.generated_schedule->'items', '[]'::jsonb))
      WITH ORDINALITY AS source(item, ordinality)
  ), slots AS (
    SELECT
      parsed.*,
      row_number() OVER (
        PARTITION BY stage_id, festival_date
        ORDER BY starts_at, ordinality
      ) AS position
    FROM parsed
  ), occupants AS (
    SELECT
      parsed.*,
      row_number() OVER (
        PARTITION BY stage_id, festival_date
        ORDER BY
          CASE WHEN confirmed_artist THEN 1 ELSE 0 END,
          CASE WHEN confirmed_artist THEN billing_rank ELSE 0 END,
          starts_at,
          ordinality
      ) AS position
    FROM parsed
  ), paired AS (
    SELECT
      occupant.item
        || jsonb_build_object(
          'stageId', slot.item->>'stageId',
          'stageName', slot.item->>'stageName',
          'festivalDate', slot.item->>'festivalDate',
          'startsAt', slot.starts_at,
          'endsAt', slot.starts_at + make_interval(mins => occupant.set_minutes)
        ) AS item,
      slot.festival_date,
      slot.starts_at,
      slot.stage_id,
      slot.position
    FROM slots slot
    JOIN occupants occupant
      ON occupant.stage_id = slot.stage_id
     AND occupant.festival_date = slot.festival_date
     AND occupant.position = slot.position
  ), rebuilt AS (
    SELECT coalesce(
      jsonb_agg(item ORDER BY festival_date, starts_at, stage_id, position),
      '[]'::jsonb
    ) AS items
    FROM paired
  )
  SELECT jsonb_set(
    runtime.generated_schedule,
    '{items}',
    rebuilt.items,
    true
  )
  INTO normalized_schedule
  FROM rebuilt;

  IF normalized_schedule IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.festival_edition_runtimes row
  SET generated_schedule = normalized_schedule,
      audit_metadata = coalesce(row.audit_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'runningOrderNormalised', true,
          'runningOrderRule', 'npc-first-confirmed-billing-order-v1'
        )
  WHERE row.id = runtime.id;

  SELECT * INTO config_row
  FROM public.festival_runtime_configuration_versions row
  WHERE row.runtime_id = runtime.id
    AND row.version = runtime.configuration_version
  FOR UPDATE;

  IF FOUND THEN
    normalized_configuration := jsonb_set(
      config_row.configuration,
      '{generatedSchedule}',
      normalized_schedule,
      true
    );
    normalized_configuration := jsonb_set(
      normalized_configuration,
      '{slots}',
      normalized_schedule->'items',
      true
    );

    UPDATE public.festival_runtime_configuration_versions row
    SET configuration = normalized_configuration,
        configuration_digest = encode(
          extensions.digest(normalized_configuration::text, 'sha256'),
          'hex'
        ),
        correction_reason = coalesce(
          row.correction_reason,
          'Simplified Festival billing-order normalisation'
        )
    WHERE row.id = config_row.id;
  ELSE
    normalized_configuration := jsonb_build_object(
      'generatedSchedule', normalized_schedule,
      'slots', normalized_schedule->'items'
    );
  END IF;

  SELECT encode(
    extensions.digest(
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'type', evidence.evidence_type,
            'entity', evidence.stable_entity_id,
            'digest', evidence.evidence_digest
          )
          ORDER BY evidence.evidence_type, evidence.stable_entity_id
        ),
        '[]'::jsonb
      )::text,
      'sha256'
    ),
    'hex'
  )
  INTO evidence_hash
  FROM public.festival_runtime_evidence evidence
  WHERE evidence.runtime_id = runtime.id;

  normalized_digest := encode(
    extensions.digest(
      runtime.id::text || ':' || runtime.runtime_seed || ':'
      || coalesce(evidence_hash, '') || ':' || normalized_configuration::text,
      'sha256'
    ),
    'hex'
  );

  UPDATE public.festival_runtime_completion_digests digest
  SET component_hashes = coalesce(digest.component_hashes, '{}'::jsonb)
        || jsonb_build_object(
          'schedule', encode(
            extensions.digest(normalized_schedule::text, 'sha256'),
            'hex'
          ),
          'configuration', encode(
            extensions.digest(normalized_configuration::text, 'sha256'),
            'hex'
          ),
          'evidence', evidence_hash
        ),
      runtime_digest = normalized_digest
  WHERE digest.runtime_id = runtime.id;
END;
$$;

REVOKE ALL ON FUNCTION public._normalize_simplified_festival_running_order(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_simplified_festival_edition(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_expected_edition_version integer,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
  runtime_id uuid;
  replayed boolean := false;
BEGIN
  result := public._run_simplified_festival_edition_v1(
    p_festival_company_id,
    p_festival_edition_id,
    p_expected_edition_version,
    p_idempotency_key
  );

  runtime_id := nullif(result->>'runtimeId', '')::uuid;
  replayed := coalesce((result->>'idempotent')::boolean, false);

  IF runtime_id IS NOT NULL THEN
    PERFORM public._normalize_simplified_festival_running_order(runtime_id);
  END IF;

  RETURN coalesce(
    public.get_festival_edition_runtime_control_room(
      p_festival_company_id,
      p_festival_edition_id
    ),
    result
  ) || jsonb_build_object('idempotent', replayed);
END;
$$;

REVOKE ALL ON FUNCTION public.run_simplified_festival_edition(uuid, uuid, integer, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_simplified_festival_edition(uuid, uuid, integer, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.run_simplified_festival_edition(uuid, uuid, integer, uuid) IS
  'Runs the simplified annual Festival once, then normalises each stage/day so NPC filler precedes confirmed artists ordered by billing importance.';

NOTIFY pgrst, 'reload schema';

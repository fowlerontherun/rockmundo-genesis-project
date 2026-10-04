-- Phase 4 authoritative Luthiery regression harness.
-- Run against a fully migrated disposable database with psql -X -v ON_ERROR_STOP=1.
-- Every fixture and crafted item is rolled back.

BEGIN;

DO $contract$
BEGIN
  IF to_regprocedure('public.create_custom_luthiery_instrument(uuid,jsonb,text)') IS NULL THEN
    RAISE EXCEPTION 'create_custom_luthiery_instrument RPC missing';
  END IF;
  IF NOT has_function_privilege(
    'authenticated',
    'public.create_custom_luthiery_instrument(uuid,jsonb,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated role cannot execute Luthiery craft RPC';
  END IF;
  IF has_function_privilege(
    'anon',
    'public.create_custom_luthiery_instrument(uuid,jsonb,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anonymous role must not execute Luthiery craft RPC';
  END IF;
  IF has_table_privilege('authenticated','public.luthiery_crafts','INSERT')
     OR has_table_privilege('authenticated','public.luthiery_crafts','UPDATE') THEN
    RAISE EXCEPTION 'clients can mutate immutable Luthiery provenance';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.luthiery_crafts'::regclass) THEN
    RAISE EXCEPTION 'Luthiery provenance RLS is disabled';
  END IF;
  IF (SELECT count(*) FROM private.luthiery_shape_options WHERE is_active) <> 9 THEN
    RAISE EXCEPTION 'authoritative Luthiery shape catalogue is incomplete';
  END IF;
  IF (SELECT count(*) FROM private.luthiery_component_options WHERE is_active) <> 32 THEN
    RAISE EXCEPTION 'authoritative Luthiery component catalogue is incomplete';
  END IF;
END
$contract$;

SET LOCAL session_replication_role = replica;

INSERT INTO auth.users (id,email,role)
VALUES (
  '9a000000-0000-4000-8000-000000000001',
  'luthiery-phase4@example.test',
  'authenticated'
);

INSERT INTO public.profiles (id,user_id,username,display_name,is_active)
VALUES (
  '9b000000-0000-4000-8000-000000000001',
  '9a000000-0000-4000-8000-000000000001',
  'luthiery_phase4_test',
  'Luthiery Phase 4 Test',
  true
);

WITH selected(option_id) AS (
  VALUES
    ('body-alder'),
    ('neck-maple'),
    ('fret-maple'),
    ('elec-single'),
    ('hw-standard'),
    ('finish-satin')
),
resolved AS (
  SELECT material.id AS material_id
  FROM selected
  JOIN private.luthiery_component_options option_row
    ON option_row.id=selected.option_id
  JOIN LATERAL (
    SELECT cm.id
    FROM unnest(option_row.catalog_names) WITH ORDINALITY candidate(material_name,ord)
    JOIN public.crafting_materials cm
      ON lower(cm.name)=lower(candidate.material_name)
    ORDER BY candidate.ord
    LIMIT 1
  ) material ON true
),
requirements AS (
  SELECT material_id,count(*)::integer AS quantity
  FROM resolved
  GROUP BY material_id
)
INSERT INTO public.player_crafting_materials (profile_id,material_id,quantity)
SELECT
  '9b000000-0000-4000-8000-000000000001',
  material_id,
  quantity
FROM requirements;

SET LOCAL session_replication_role = origin;
SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub',
  '9a000000-0000-4000-8000-000000000001',
  true
);
SELECT set_config('request.jwt.claim.role','authenticated',true);

DO $craft$
DECLARE
  v_design jsonb := '{
    "instrumentName":"Phase Four Test",
    "instrumentKind":"electric_guitar",
    "shapeId":"double-cut",
    "colour":"#141821",
    "finishId":"finish-satin",
    "decal":{"id":"none","x":50,"y":50,"scale":100,"rotation":0,"colour":"#f5f5f5"},
    "parts":{
      "body":"body-alder",
      "neck":"neck-maple",
      "fretboard":"fret-maple",
      "electronics":"elec-single",
      "hardware":"hw-standard"
    }
  }'::jsonb;
  v_first jsonb;
  v_retry jsonb;
  v_equipment_id uuid;
BEGIN
  v_first := public.create_custom_luthiery_instrument(
    '9b000000-0000-4000-8000-000000000001',
    v_design,
    'phase4-regression-key-001'
  );

  IF v_first->>'status' <> 'completed' THEN
    RAISE EXCEPTION 'first craft did not complete: %',v_first;
  END IF;
  IF (v_first->>'qualityRoll')::integer NOT BETWEEN -5 AND 5
     OR (v_first->>'finalQuality')::integer NOT BETWEEN 0 AND 100
     OR jsonb_typeof(v_first->'finalStats') <> 'object' THEN
    RAISE EXCEPTION 'server outcome is invalid: %',v_first;
  END IF;

  v_equipment_id := (v_first->>'equipmentId')::uuid;

  IF EXISTS (
    SELECT 1
    FROM public.player_crafting_materials
    WHERE profile_id='9b000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'craft did not consume the exact starter stock';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.equipment_items
    WHERE id=v_equipment_id
      AND is_crafted IS TRUE
      AND crafted_by_profile_id='9b000000-0000-4000-8000-000000000001'
      AND subcategory='custom_luthiery'
  ) THEN
    RAISE EXCEPTION 'crafted equipment item was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.player_equipment
    WHERE equipment_id=v_equipment_id
      AND profile_id='9b000000-0000-4000-8000-000000000001'
      AND user_id='9a000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'crafted equipment was not granted to the active character';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.luthiery_crafts
    WHERE equipment_id=v_equipment_id
      AND jsonb_array_length(material_snapshot)=6
  ) THEN
    RAISE EXCEPTION 'immutable six-material build provenance is missing';
  END IF;

  v_retry := public.create_custom_luthiery_instrument(
    '9b000000-0000-4000-8000-000000000001',
    v_design,
    'phase4-regression-key-001'
  );

  IF v_retry->>'status' <> 'already_completed'
     OR v_retry->>'equipmentId' <> v_first->>'equipmentId' THEN
    RAISE EXCEPTION 'idempotent retry did not return the original item';
  END IF;

  BEGIN
    PERFORM public.create_custom_luthiery_instrument(
      '9b000000-0000-4000-8000-000000000001',
      v_design || '{"projectedQuality":100}'::jsonb,
      'phase4-regression-key-002'
    );
    RAISE EXCEPTION 'client-supplied quality was accepted';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'luthiery_client_outcome_not_allowed' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM public.create_custom_luthiery_instrument(
      '9b000000-0000-4000-8000-000000000001',
      jsonb_set(v_design,'{instrumentName}','"Changed Name"'::jsonb),
      'phase4-regression-key-001'
    );
    RAISE EXCEPTION 'changed payload reused an idempotency key';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'luthiery_idempotency_key_conflict' THEN
        RAISE;
      END IF;
  END;
END
$craft$;

RESET ROLE;
ROLLBACK;

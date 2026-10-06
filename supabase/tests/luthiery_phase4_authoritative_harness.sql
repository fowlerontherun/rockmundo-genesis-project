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
  IF (SELECT count(*) FROM private.luthiery_shape_options WHERE is_active) <> 15 THEN
    RAISE EXCEPTION 'authoritative Luthiery shape catalogue is incomplete';
  END IF;
  IF (SELECT count(*) FROM private.luthiery_component_options WHERE is_active) <> 72 THEN
    RAISE EXCEPTION 'authoritative Luthiery component catalogue is incomplete';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM private.luthiery_component_options option_row
    WHERE option_row.is_active
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(option_row.catalog_names) candidate(material_name)
        JOIN public.crafting_materials material
          ON lower(material.name)=lower(candidate.material_name)
      )
  ) THEN
    RAISE EXCEPTION 'authoritative Luthiery component has no resolvable crafting material';
  END IF;
  IF to_regprocedure('private.award_luthiery_craft_xp(uuid,text,integer)') IS NULL THEN
    RAISE EXCEPTION 'private Luthiery craft XP helper missing';
  END IF;
  IF has_function_privilege(
       'authenticated',
       'private.award_luthiery_craft_xp(uuid,text,integer)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'anon',
       'private.award_luthiery_craft_xp(uuid,text,integer)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Luthiery craft XP helper must not be directly callable by clients';
  END IF;
END
$contract$;

SET LOCAL session_replication_role = replica;

INSERT INTO auth.users (id,email,role)
VALUES
  (
    '9a000000-0000-4000-8000-000000000001',
    'luthiery-phase4@example.test',
    'authenticated'
  ),
  (
    '9a000000-0000-4000-8000-000000000002',
    'luthiery-phase4-attacker@example.test',
    'authenticated'
  );

INSERT INTO public.profiles (id,user_id,username,display_name,is_active)
VALUES
  (
    '9b000000-0000-4000-8000-000000000001',
    '9a000000-0000-4000-8000-000000000001',
    'luthiery_phase4_test',
    'Luthiery Phase 4 Test',
    true
  ),
  (
    '9b000000-0000-4000-8000-000000000002',
    '9a000000-0000-4000-8000-000000000002',
    'luthiery_phase4_attacker',
    'Luthiery Phase 4 Attacker',
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
    "colour":"#12abef",
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
  IF (v_first->>'xpAwarded')::integer <> 10
     OR v_first->>'xpSkillSlug' <> 'luthiery_basic_technical'
     OR jsonb_typeof(v_first->'skillProgress') <> 'object' THEN
    RAISE EXCEPTION 'Luthiery craft XP result is invalid: %',v_first;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.skill_progress
    WHERE profile_id='9b000000-0000-4000-8000-000000000001'
      AND skill_slug='luthiery_basic_technical'
      AND current_level=0
      AND current_xp=10
  ) THEN
    RAISE EXCEPTION 'successful starter craft did not award Basic Luthiery XP';
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
      AND colour='#12abef'
      AND result->'buildSpec'->>'colour'='#12abef'
  ) THEN
    RAISE EXCEPTION 'immutable six-material build provenance or custom body colour is missing';
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
  IF (
    SELECT current_xp
    FROM public.skill_progress
    WHERE profile_id='9b000000-0000-4000-8000-000000000001'
      AND skill_slug='luthiery_basic_technical'
  ) <> 10 THEN
    RAISE EXCEPTION 'idempotent retry awarded Luthiery XP twice';
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

SELECT set_config(
  'request.jwt.claim.sub',
  '9a000000-0000-4000-8000-000000000002',
  true
);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;

DO $cross_character_retry$
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
BEGIN
  BEGIN
    PERFORM public.create_custom_luthiery_instrument(
      '9b000000-0000-4000-8000-000000000001',
      v_design,
      'phase4-regression-key-001'
    );
    RAISE EXCEPTION 'cross-character retry exposed another character craft';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'luthiery_active_profile_required' THEN
        RAISE;
      END IF;
  END;
END
$cross_character_retry$;

RESET ROLE;
ROLLBACK;

-- Verify that the highest tier actually used by a build receives XP.
BEGIN;
SET LOCAL session_replication_role = replica;

INSERT INTO auth.users(id,email,role) VALUES
  ('d5000000-0000-4000-8000-000000000001','phase4-pro@example.test','authenticated'),
  ('d5000000-0000-4000-8000-000000000002','phase4-master@example.test','authenticated');

INSERT INTO public.profiles(id,user_id,username,display_name,is_active) VALUES
  ('d5200000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','phase4_pro','Phase 4 Pro',true),
  ('d5200000-0000-4000-8000-000000000002','d5000000-0000-4000-8000-000000000002','phase4_master','Phase 4 Master',true);

INSERT INTO public.skill_progress(profile_id,skill_slug,current_level,current_xp,required_xp) VALUES
  ('d5200000-0000-4000-8000-000000000001','luthiery_basic_technical',20,0,0),
  ('d5200000-0000-4000-8000-000000000001','luthiery_professional_technical',12,0,465),
  ('d5200000-0000-4000-8000-000000000002','luthiery_basic_technical',20,0,0),
  ('d5200000-0000-4000-8000-000000000002','luthiery_professional_technical',20,0,0),
  ('d5200000-0000-4000-8000-000000000002','luthiery_mastery_technical',11,0,436);

WITH selected(profile_id,option_id) AS (
  VALUES
    ('d5200000-0000-4000-8000-000000000001'::uuid,'body-mahogany'),
    ('d5200000-0000-4000-8000-000000000001'::uuid,'neck-mahogany'),
    ('d5200000-0000-4000-8000-000000000001'::uuid,'fret-ebony'),
    ('d5200000-0000-4000-8000-000000000001'::uuid,'elec-paf'),
    ('d5200000-0000-4000-8000-000000000001'::uuid,'hw-trem'),
    ('d5200000-0000-4000-8000-000000000001'::uuid,'finish-burst'),
    ('d5200000-0000-4000-8000-000000000002'::uuid,'body-mahogany'),
    ('d5200000-0000-4000-8000-000000000002'::uuid,'neck-korina'),
    ('d5200000-0000-4000-8000-000000000002'::uuid,'fret-ebony'),
    ('d5200000-0000-4000-8000-000000000002'::uuid,'elec-boutique'),
    ('d5200000-0000-4000-8000-000000000002'::uuid,'hw-gold'),
    ('d5200000-0000-4000-8000-000000000002'::uuid,'finish-artwork')
),
resolved AS (
  SELECT selected.profile_id,material.id AS material_id
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
)
INSERT INTO public.player_crafting_materials(profile_id,material_id,quantity)
SELECT profile_id,material_id,count(*)::integer
FROM resolved
GROUP BY profile_id,material_id;

SET LOCAL session_replication_role = origin;

SELECT set_config('request.jwt.claim.sub','d5000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;

DO $professional_xp$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.create_custom_luthiery_instrument(
    'd5200000-0000-4000-8000-000000000001',
    '{
      "instrumentName":"Phase Four Pro",
      "instrumentKind":"electric_guitar",
      "shapeId":"angular",
      "colour":"#235f9f",
      "finishId":"finish-burst",
      "decal":{"id":"none","x":50,"y":50,"scale":100,"rotation":0,"colour":"#f5f5f5"},
      "parts":{
        "body":"body-mahogany",
        "neck":"neck-mahogany",
        "fretboard":"fret-ebony",
        "electronics":"elec-paf",
        "hardware":"hw-trem"
      }
    }'::jsonb,
    'phase4-pro-xp-001'
  );

  IF v_result->>'xpSkillSlug' <> 'luthiery_professional_technical'
     OR (v_result->>'xpAwarded')::integer <> 15 THEN
    RAISE EXCEPTION 'professional Luthiery XP routing failed: %',v_result;
  END IF;
  IF (
    SELECT current_xp
    FROM public.skill_progress
    WHERE profile_id='d5200000-0000-4000-8000-000000000001'
      AND skill_slug='luthiery_professional_technical'
  ) <> 15 THEN
    RAISE EXCEPTION 'professional Luthiery XP was not persisted';
  END IF;
END
$professional_xp$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub','d5000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;

DO $mastery_xp$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.create_custom_luthiery_instrument(
    'd5200000-0000-4000-8000-000000000002',
    '{
      "instrumentName":"Phase Four Master",
      "instrumentKind":"electric_guitar",
      "shapeId":"razor",
      "colour":"#6f42a8",
      "finishId":"finish-artwork",
      "decal":{"id":"star","x":50,"y":50,"scale":100,"rotation":0,"colour":"#f5f5f5"},
      "parts":{
        "body":"body-mahogany",
        "neck":"neck-korina",
        "fretboard":"fret-ebony",
        "electronics":"elec-boutique",
        "hardware":"hw-gold"
      }
    }'::jsonb,
    'phase4-master-xp-001'
  );

  IF v_result->>'xpSkillSlug' <> 'luthiery_mastery_technical'
     OR (v_result->>'xpAwarded')::integer <> 20 THEN
    RAISE EXCEPTION 'Master Luthier XP routing failed: %',v_result;
  END IF;
  IF (
    SELECT current_xp
    FROM public.skill_progress
    WHERE profile_id='d5200000-0000-4000-8000-000000000002'
      AND skill_slug='luthiery_mastery_technical'
  ) <> 20 THEN
    RAISE EXCEPTION 'Master Luthier XP was not persisted';
  END IF;
END
$mastery_xp$;

RESET ROLE;
ROLLBACK;

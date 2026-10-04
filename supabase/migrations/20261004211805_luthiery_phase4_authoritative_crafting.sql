CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.luthiery_shape_options (
  id text PRIMARY KEY,
  name text NOT NULL,
  instrument_kinds text[] NOT NULL,
  required_tier text NOT NULL CHECK (required_tier IN ('basic','professional','mastery')),
  required_level integer NOT NULL CHECK (required_level BETWEEN 0 AND 20),
  difficulty_penalty integer NOT NULL DEFAULT 0 CHECK (difficulty_penalty BETWEEN 0 AND 20),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS private.luthiery_component_options (
  id text PRIMARY KEY,
  label text NOT NULL,
  slot text NOT NULL CHECK (slot IN ('body','neck','fretboard','electronics','hardware','finish')),
  catalog_names text[] NOT NULL,
  required_tier text NOT NULL CHECK (required_tier IN ('basic','professional','mastery')),
  required_level integer NOT NULL CHECK (required_level BETWEEN 0 AND 20),
  traits jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true
);

REVOKE ALL ON private.luthiery_shape_options FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.luthiery_component_options FROM PUBLIC, anon, authenticated;

INSERT INTO private.luthiery_shape_options
  (id,name,instrument_kinds,required_tier,required_level,difficulty_penalty,is_active)
VALUES
  ('classic-bass','Classic Bass',ARRAY['electric_bass'],'basic',0,0,true),
  ('double-cut','Classic Double Cut',ARRAY['electric_guitar'],'basic',0,0,true),
  ('offset','Offset',ARRAY['electric_guitar','electric_bass'],'basic',6,1,true),
  ('single-cut','Single Cut',ARRAY['electric_guitar','electric_bass'],'basic',12,2,true),
  ('v-shape','V',ARRAY['electric_guitar'],'basic',18,4,true),
  ('angular','Angular',ARRAY['electric_guitar','electric_bass'],'professional',5,5,true),
  ('war-axe','War Axe',ARRAY['electric_guitar','electric_bass'],'professional',12,7,true),
  ('razor','Razor',ARRAY['electric_guitar'],'mastery',8,8,true),
  ('monolith-bass','Monolith Bass',ARRAY['electric_bass'],'mastery',15,8,true)
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name,
  instrument_kinds=EXCLUDED.instrument_kinds,
  required_tier=EXCLUDED.required_tier,
  required_level=EXCLUDED.required_level,
  difficulty_penalty=EXCLUDED.difficulty_penalty,
  is_active=EXCLUDED.is_active;

INSERT INTO private.luthiery_component_options
  (id,label,slot,catalog_names,required_tier,required_level,traits,is_active)
VALUES
  ('body-pine','Pine','body',ARRAY['Pine Body Blank'],'basic',0,'{"tone":-2,"sustain":-2,"stagePresence":1}'::jsonb,true),
  ('body-poplar','Poplar','body',ARRAY['Poplar Body Blank'],'basic',3,'{"stability":1}'::jsonb,true),
  ('body-alder','Alder','body',ARRAY['Alder Body Blank'],'basic',0,'{"tone":3,"sustain":1,"stability":2}'::jsonb,true),
  ('body-ash','Ash','body',ARRAY['Ash Body Blank'],'basic',13,'{"tone":4,"sustain":2,"stagePresence":1}'::jsonb,true),
  ('body-mahogany','Mahogany','body',ARRAY['Mahogany Body Blank'],'professional',2,'{"tone":5,"sustain":5,"stability":2}'::jsonb,true),
  ('body-korina','Korina','body',ARRAY['Korina Body Blank'],'professional',12,'{"tone":6,"sustain":5,"stagePresence":3}'::jsonb,true),
  ('neck-maple','Maple','neck',ARRAY['Maple Neck Blank'],'basic',0,'{"sustain":2,"stability":4}'::jsonb,true),
  ('neck-pine','Pine stock','neck',ARRAY['Pine Body Blank'],'basic',6,'{"stability":-2,"sustain":-1}'::jsonb,true),
  ('neck-alder','Alder stock','neck',ARRAY['Alder Body Blank'],'basic',12,'{"stability":1,"sustain":1}'::jsonb,true),
  ('neck-mahogany','Mahogany stock','neck',ARRAY['Mahogany Body Blank'],'professional',5,'{"tone":2,"sustain":4,"stability":2}'::jsonb,true),
  ('neck-korina','Korina stock','neck',ARRAY['Korina Body Blank'],'mastery',8,'{"tone":3,"sustain":4,"stability":4}'::jsonb,true),
  ('fret-maple','Maple','fretboard',ARRAY['Maple Neck Blank'],'basic',0,'{"tone":2,"stability":2}'::jsonb,true),
  ('fret-rosewood','Rosewood','fretboard',ARRAY['Rosewood Fretboard'],'basic',8,'{"tone":4,"sustain":2}'::jsonb,true),
  ('fret-ebony','Ebony','fretboard',ARRAY['Ebony Fretboard'],'professional',8,'{"tone":4,"sustain":4,"stability":4}'::jsonb,true),
  ('fret-brazilian','Brazilian Rosewood','fretboard',ARRAY['Brazilian Rosewood Set'],'mastery',15,'{"tone":7,"sustain":5,"stagePresence":2}'::jsonb,true),
  ('elec-single','Single Coil','electronics',ARRAY['Single-Coil Pickup Set','Single Coil Pickup'],'basic',0,'{"tone":2,"output":1}'::jsonb,true),
  ('elec-humbucker','Humbucker','electronics',ARRAY['Humbucker Pickup Set','Humbucker Pickup'],'basic',6,'{"tone":3,"output":4}'::jsonb,true),
  ('elec-alnico','Alnico V','electronics',ARRAY['Alnico V Pickup'],'basic',14,'{"tone":4,"output":4}'::jsonb,true),
  ('elec-paf','PAF-style','electronics',ARRAY['PAF Clone Pickup'],'professional',5,'{"tone":6,"output":4}'::jsonb,true),
  ('elec-active','Active High Output','electronics',ARRAY['Active EMG Pickup Set','Active EMG Pickup'],'professional',11,'{"tone":3,"output":8,"stagePresence":2}'::jsonb,true),
  ('elec-boutique','Hand-wound Boutique','electronics',ARRAY['Hand-Wound Boutique Pickup'],'mastery',11,'{"tone":8,"output":6,"stagePresence":2}'::jsonb,true),
  ('hw-standard','Standard Hardware','hardware',ARRAY['Bridge and Hardware Kit','Standard Tuners Set'],'basic',0,'{"stability":1,"sustain":1}'::jsonb,true),
  ('hw-locking','Locking Hardware','hardware',ARRAY['Locking Tuners Set'],'basic',8,'{"stability":4,"sustain":1}'::jsonb,true),
  ('hw-tom','Fixed Bridge','hardware',ARRAY['Tune-O-Matic Bridge','Bridge and Hardware Kit'],'basic',13,'{"stability":3,"sustain":4}'::jsonb,true),
  ('hw-trem','Tremolo','hardware',ARRAY['Tremolo Bridge'],'professional',3,'{"stability":1,"sustain":2,"stagePresence":3}'::jsonb,true),
  ('hw-floyd','Double-locking Tremolo','hardware',ARRAY['Floyd Rose Tremolo'],'professional',11,'{"stability":6,"sustain":2,"stagePresence":5}'::jsonb,true),
  ('hw-gold','Gold Hardware','hardware',ARRAY['Gold Hardware Set'],'mastery',8,'{"stability":4,"sustain":3,"stagePresence":8}'::jsonb,true),
  ('finish-satin','Satin Lacquer','finish',ARRAY['Satin Lacquer'],'basic',0,'{"stagePresence":0}'::jsonb,true),
  ('finish-gloss','Gloss Nitrocellulose','finish',ARRAY['Gloss Nitrocellulose'],'basic',8,'{"stagePresence":2}'::jsonb,true),
  ('finish-burst','Burst Sunburst','finish',ARRAY['Burst Sunburst Finish'],'professional',5,'{"stagePresence":4}'::jsonb,true),
  ('finish-metalflake','Metallic Flake','finish',ARRAY['Metallic Flake Finish'],'professional',9,'{"stagePresence":7}'::jsonb,true),
  ('finish-artwork','Custom Artwork','finish',ARRAY['Custom Artwork Finish'],'mastery',11,'{"stagePresence":10}'::jsonb,true)
ON CONFLICT (id) DO UPDATE SET
  label=EXCLUDED.label,
  slot=EXCLUDED.slot,
  catalog_names=EXCLUDED.catalog_names,
  required_tier=EXCLUDED.required_tier,
  required_level=EXCLUDED.required_level,
  traits=EXCLUDED.traits,
  is_active=EXCLUDED.is_active;

INSERT INTO public.skill_definitions (slug,display_name,description,tier_caps)
VALUES
  ('luthiery_basic_technical','Luthiery Basics','Learn fundamental instrument construction and build starter guitars and basses.','{"max_level":20}'::jsonb),
  ('luthiery_professional_technical','Professional Luthiery','Build advanced instruments with premium materials, shapes and finishes.','{"max_level":20}'::jsonb),
  ('luthiery_mastery_technical','Master Luthier','Create elite custom instruments using the rarest materials and advanced body designs.','{"max_level":20}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  display_name=EXCLUDED.display_name,
  description=EXCLUDED.description,
  tier_caps=COALESCE(public.skill_definitions.tier_caps,'{}'::jsonb) || EXCLUDED.tier_caps,
  updated_at=now();

INSERT INTO public.skill_parent_links (skill_id,parent_skill_id,unlock_threshold)
SELECT child.id,parent.id,20
FROM public.skill_definitions child
JOIN public.skill_definitions parent ON parent.slug='luthiery_basic_technical'
WHERE child.slug='luthiery_professional_technical'
  AND NOT EXISTS (
    SELECT 1 FROM public.skill_parent_links spl
    WHERE spl.skill_id=child.id AND spl.parent_skill_id=parent.id
  );

INSERT INTO public.skill_parent_links (skill_id,parent_skill_id,unlock_threshold)
SELECT child.id,parent.id,20
FROM public.skill_definitions child
JOIN public.skill_definitions parent ON parent.slug='luthiery_professional_technical'
WHERE child.slug='luthiery_mastery_technical'
  AND NOT EXISTS (
    SELECT 1 FROM public.skill_parent_links spl
    WHERE spl.skill_id=child.id AND spl.parent_skill_id=parent.id
  );

CREATE TABLE IF NOT EXISTS public.luthiery_crafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  equipment_id uuid NOT NULL UNIQUE REFERENCES public.equipment_items(id) ON DELETE RESTRICT,
  player_equipment_id uuid UNIQUE REFERENCES public.player_equipment(id) ON DELETE SET NULL,
  instrument_name text NOT NULL,
  instrument_kind text NOT NULL CHECK (instrument_kind IN ('electric_guitar','electric_bass')),
  shape_id text NOT NULL,
  colour text NOT NULL,
  finish_id text NOT NULL,
  decal jsonb NOT NULL,
  parts jsonb NOT NULL,
  material_snapshot jsonb NOT NULL,
  skill_snapshot jsonb NOT NULL,
  quality_roll integer NOT NULL CHECK (quality_roll BETWEEN -5 AND 5),
  final_quality integer NOT NULL CHECK (final_quality BETWEEN 0 AND 100),
  final_stats jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id,idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_luthiery_crafts_profile_created
ON public.luthiery_crafts(profile_id,created_at DESC);

ALTER TABLE public.luthiery_crafts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.luthiery_crafts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.luthiery_crafts TO authenticated;

DROP POLICY IF EXISTS "Active character can view own luthiery crafts" ON public.luthiery_crafts;
CREATE POLICY "Active character can view own luthiery crafts"
ON public.luthiery_crafts
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND profile_id = public.current_profile_id()
);

CREATE OR REPLACE FUNCTION public.create_custom_luthiery_instrument(
  p_profile_id uuid,
  p_design jsonb,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_existing public.luthiery_crafts%ROWTYPE;
  v_request_hash text;
  v_name text;
  v_kind text;
  v_colour text;
  v_shape private.luthiery_shape_options%ROWTYPE;
  v_finish private.luthiery_component_options%ROWTYPE;
  v_option private.luthiery_component_options%ROWTYPE;
  v_material public.crafting_materials%ROWTYPE;
  v_inventory public.player_crafting_materials%ROWTYPE;
  v_slot text;
  v_option_id text;
  v_finish_id text;
  v_parts jsonb;
  v_parts_spec jsonb := '{}'::jsonb;
  v_material_snapshot jsonb := '[]'::jsonb;
  v_requirements jsonb := '{}'::jsonb;
  v_requirement record;
  v_basic integer := 0;
  v_professional integer := 0;
  v_mastery integer := 0;
  v_actual_level integer;
  v_material_quality_sum numeric := 0;
  v_material_count integer := 0;
  v_material_quality integer;
  v_skill_score integer;
  v_quality_roll integer;
  v_final_quality integer;
  v_quality_lift integer;
  v_tone integer := 45;
  v_sustain integer := 45;
  v_stability integer := 45;
  v_output integer;
  v_stage_presence integer := 40;
  v_final_stats jsonb;
  v_equipment_stats jsonb;
  v_rarity text;
  v_equipment_id uuid;
  v_player_equipment_id uuid;
  v_craft_id uuid;
  v_result jsonb;
  v_build_spec jsonb;
  v_decal jsonb;
  v_decal_id text;
  v_decal_colour text;
  v_decal_x integer;
  v_decal_y integer;
  v_decal_scale integer;
  v_decal_rotation integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'luthiery_authentication_required' USING ERRCODE='P0001';
  END IF;
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'luthiery_profile_required' USING ERRCODE='P0001';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 OR length(btrim(p_idempotency_key)) > 120 THEN
    RAISE EXCEPTION 'luthiery_idempotency_key_invalid' USING ERRCODE='P0001';
  END IF;
  IF p_design IS NULL OR jsonb_typeof(p_design) <> 'object' THEN
    RAISE EXCEPTION 'luthiery_design_invalid' USING ERRCODE='P0001';
  END IF;
  IF p_design ?| ARRAY['quality','projectedQuality','finalQuality','qualityRoll','stats','projectedStats','finalStats','bonusStats'] THEN
    RAISE EXCEPTION 'luthiery_client_outcome_not_allowed' USING ERRCODE='P0001';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_profile_id::text || ':' || btrim(p_idempotency_key),0)
  );

  v_request_hash := pg_catalog.md5(p_design::text);

  SELECT *
  INTO v_existing
  FROM public.luthiery_crafts
  WHERE profile_id=p_profile_id
    AND idempotency_key=btrim(p_idempotency_key);

  IF FOUND THEN
    IF v_existing.request_hash <> v_request_hash THEN
      RAISE EXCEPTION 'luthiery_idempotency_key_conflict' USING ERRCODE='P0001';
    END IF;
    RETURN v_existing.result || jsonb_build_object('status','already_completed');
  END IF;

  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id=p_profile_id
    AND user_id=v_user_id
    AND is_active IS TRUE
    AND died_at IS NULL
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR public.current_profile_id() IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'luthiery_active_profile_required' USING ERRCODE='P0001';
  END IF;

  v_name := btrim(pg_catalog.regexp_replace(COALESCE(p_design->>'instrumentName',''),'[[:space:]]+',' ','g'));
  IF length(v_name) < 2 OR length(v_name) > 40 THEN
    RAISE EXCEPTION 'luthiery_instrument_name_invalid' USING ERRCODE='P0001';
  END IF;

  v_kind := p_design->>'instrumentKind';
  IF v_kind NOT IN ('electric_guitar','electric_bass') THEN
    RAISE EXCEPTION 'luthiery_instrument_kind_invalid' USING ERRCODE='P0001';
  END IF;

  v_colour := lower(COALESCE(p_design->>'colour',''));
  IF NOT (v_colour = ANY(ARRAY['#141821','#e7e0cf','#8f2435','#235f9f','#245b43','#b8892f','#6f42a8','#c8377d','#9b6a3d'])) THEN
    RAISE EXCEPTION 'luthiery_colour_invalid' USING ERRCODE='P0001';
  END IF;

  v_basic := public.skill_progress_level_for_slug(p_profile_id,'luthiery_basic_technical');
  v_professional := public.skill_progress_level_for_slug(p_profile_id,'luthiery_professional_technical');
  v_mastery := public.skill_progress_level_for_slug(p_profile_id,'luthiery_mastery_technical');

  SELECT *
  INTO v_shape
  FROM private.luthiery_shape_options
  WHERE id=p_design->>'shapeId' AND is_active IS TRUE;

  IF NOT FOUND OR NOT (v_kind = ANY(v_shape.instrument_kinds)) THEN
    RAISE EXCEPTION 'luthiery_shape_invalid' USING ERRCODE='P0001';
  END IF;

  v_actual_level := CASE v_shape.required_tier
    WHEN 'basic' THEN v_basic
    WHEN 'professional' THEN v_professional
    WHEN 'mastery' THEN v_mastery
    ELSE 0
  END;
  IF v_actual_level < v_shape.required_level THEN
    RAISE EXCEPTION 'luthiery_shape_locked' USING ERRCODE='P0001';
  END IF;

  v_parts := p_design->'parts';
  IF v_parts IS NULL
     OR jsonb_typeof(v_parts) <> 'object'
     OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(v_parts)) <> 5 THEN
    RAISE EXCEPTION 'luthiery_parts_invalid' USING ERRCODE='P0001';
  END IF;

  FOREACH v_slot IN ARRAY ARRAY['body','neck','fretboard','electronics','hardware'] LOOP
    v_option_id := v_parts->>v_slot;
    IF v_option_id IS NULL OR btrim(v_option_id)='' THEN
      RAISE EXCEPTION 'luthiery_part_missing:%',v_slot USING ERRCODE='P0001';
    END IF;

    SELECT *
    INTO v_option
    FROM private.luthiery_component_options
    WHERE id=v_option_id AND slot=v_slot AND is_active IS TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'luthiery_part_invalid:%',v_slot USING ERRCODE='P0001';
    END IF;

    v_actual_level := CASE v_option.required_tier
      WHEN 'basic' THEN v_basic
      WHEN 'professional' THEN v_professional
      WHEN 'mastery' THEN v_mastery
      ELSE 0
    END;
    IF v_actual_level < v_option.required_level THEN
      RAISE EXCEPTION 'luthiery_part_locked:%',v_slot USING ERRCODE='P0001';
    END IF;

    SELECT cm.*
    INTO v_material
    FROM unnest(v_option.catalog_names) WITH ORDINALITY candidate(material_name,ord)
    JOIN public.crafting_materials cm ON lower(cm.name)=lower(candidate.material_name)
    ORDER BY candidate.ord
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'luthiery_material_unavailable:%',v_option.id USING ERRCODE='P0001';
    END IF;

    v_requirements := jsonb_set(
      v_requirements,
      ARRAY[v_material.id::text],
      to_jsonb(COALESCE((v_requirements->>v_material.id::text)::integer,0)+1),
      true
    );

    v_material_quality_sum := v_material_quality_sum + (v_material.quality_tier * 20);
    v_material_count := v_material_count + 1;
    v_tone := v_tone + COALESCE((v_option.traits->>'tone')::integer,0);
    v_sustain := v_sustain + COALESCE((v_option.traits->>'sustain')::integer,0);
    v_stability := v_stability + COALESCE((v_option.traits->>'stability')::integer,0);
    v_stage_presence := v_stage_presence + COALESCE((v_option.traits->>'stagePresence')::integer,0);

    IF v_slot='electronics' THEN
      v_output := COALESCE(v_output,CASE WHEN v_kind='electric_bass' THEN 48 ELSE 45 END)
        + COALESCE((v_option.traits->>'output')::integer,0);
    END IF;

    v_parts_spec := v_parts_spec || jsonb_build_object(
      v_slot,
      jsonb_build_object(
        'optionId',v_option.id,
        'label',v_option.label,
        'materialId',v_material.id,
        'materialName',v_material.name
      )
    );
    v_material_snapshot := v_material_snapshot || jsonb_build_array(
      jsonb_build_object(
        'source',v_slot,
        'optionId',v_option.id,
        'materialId',v_material.id,
        'materialName',v_material.name,
        'qualityTier',v_material.quality_tier
      )
    );
  END LOOP;

  v_output := COALESCE(v_output,CASE WHEN v_kind='electric_bass' THEN 48 ELSE 45 END);

  v_finish_id := p_design->>'finishId';
  SELECT *
  INTO v_finish
  FROM private.luthiery_component_options
  WHERE id=v_finish_id AND slot='finish' AND is_active IS TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'luthiery_finish_invalid' USING ERRCODE='P0001';
  END IF;

  v_actual_level := CASE v_finish.required_tier
    WHEN 'basic' THEN v_basic
    WHEN 'professional' THEN v_professional
    WHEN 'mastery' THEN v_mastery
    ELSE 0
  END;
  IF v_actual_level < v_finish.required_level THEN
    RAISE EXCEPTION 'luthiery_finish_locked' USING ERRCODE='P0001';
  END IF;

  SELECT cm.*
  INTO v_material
  FROM unnest(v_finish.catalog_names) WITH ORDINALITY candidate(material_name,ord)
  JOIN public.crafting_materials cm ON lower(cm.name)=lower(candidate.material_name)
  ORDER BY candidate.ord
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'luthiery_material_unavailable:%',v_finish.id USING ERRCODE='P0001';
  END IF;

  v_requirements := jsonb_set(
    v_requirements,
    ARRAY[v_material.id::text],
    to_jsonb(COALESCE((v_requirements->>v_material.id::text)::integer,0)+1),
    true
  );
  v_material_quality_sum := v_material_quality_sum + (v_material.quality_tier * 20);
  v_material_count := v_material_count + 1;
  v_tone := v_tone + COALESCE((v_finish.traits->>'tone')::integer,0);
  v_sustain := v_sustain + COALESCE((v_finish.traits->>'sustain')::integer,0);
  v_stability := v_stability + COALESCE((v_finish.traits->>'stability')::integer,0);
  v_output := v_output + COALESCE((v_finish.traits->>'output')::integer,0);
  v_stage_presence := v_stage_presence + COALESCE((v_finish.traits->>'stagePresence')::integer,0);

  v_material_snapshot := v_material_snapshot || jsonb_build_array(
    jsonb_build_object(
      'source','finish',
      'optionId',v_finish.id,
      'materialId',v_material.id,
      'materialName',v_material.name,
      'qualityTier',v_material.quality_tier
    )
  );

  v_decal := p_design->'decal';
  IF v_decal IS NULL OR jsonb_typeof(v_decal) <> 'object' THEN
    RAISE EXCEPTION 'luthiery_decal_invalid' USING ERRCODE='P0001';
  END IF;

  v_decal_id := COALESCE(v_decal->>'id','none');
  IF v_decal_id NOT IN ('none','lightning','star','stripes','target') THEN
    RAISE EXCEPTION 'luthiery_decal_invalid' USING ERRCODE='P0001';
  END IF;
  IF v_decal_id <> 'none' AND v_finish.id <> 'finish-artwork' THEN
    RAISE EXCEPTION 'luthiery_decal_requires_artwork_finish' USING ERRCODE='P0001';
  END IF;

  IF COALESCE(v_decal->>'x','') !~ '^[0-9]+$'
     OR COALESCE(v_decal->>'y','') !~ '^[0-9]+$'
     OR COALESCE(v_decal->>'scale','') !~ '^[0-9]+$'
     OR COALESCE(v_decal->>'rotation','') !~ '^-?[0-9]+$' THEN
    RAISE EXCEPTION 'luthiery_decal_geometry_invalid' USING ERRCODE='P0001';
  END IF;

  v_decal_x := (v_decal->>'x')::integer;
  v_decal_y := (v_decal->>'y')::integer;
  v_decal_scale := (v_decal->>'scale')::integer;
  v_decal_rotation := (v_decal->>'rotation')::integer;
  v_decal_colour := lower(COALESCE(v_decal->>'colour',''));

  IF v_decal_x NOT BETWEEN 0 AND 100
     OR v_decal_y NOT BETWEEN 0 AND 100
     OR v_decal_scale NOT BETWEEN 50 AND 160
     OR v_decal_rotation NOT BETWEEN -180 AND 180
     OR NOT (v_decal_colour = ANY(ARRAY['#f5f5f5','#111827','#e11d48','#f59e0b','#38bdf8'])) THEN
    RAISE EXCEPTION 'luthiery_decal_geometry_invalid' USING ERRCODE='P0001';
  END IF;

  v_decal := jsonb_build_object(
    'id',v_decal_id,
    'x',v_decal_x,
    'y',v_decal_y,
    'scale',v_decal_scale,
    'rotation',v_decal_rotation,
    'colour',v_decal_colour
  );

  FOR v_requirement IN
    SELECT key::uuid AS material_id,value::integer AS quantity
    FROM jsonb_each_text(v_requirements)
    ORDER BY key
  LOOP
    SELECT *
    INTO v_inventory
    FROM public.player_crafting_materials
    WHERE profile_id=p_profile_id AND material_id=v_requirement.material_id
    FOR UPDATE;

    IF NOT FOUND OR v_inventory.quantity < v_requirement.quantity THEN
      RAISE EXCEPTION 'luthiery_material_stock_insufficient:%',v_requirement.material_id USING ERRCODE='P0001';
    END IF;
  END LOOP;

  v_material_quality := CASE WHEN v_material_count=0 THEN 20
    ELSE round(v_material_quality_sum / v_material_count)::integer END;

  v_skill_score := CASE
    WHEN v_mastery > 0 THEN least(100,round(80 + (least(v_mastery,20)/20.0)*20)::integer)
    WHEN v_professional > 0 THEN least(100,round(55 + (least(v_professional,20)/20.0)*25)::integer)
    ELSE least(100,round(10 + (least(v_basic,20)/20.0)*45)::integer)
  END;

  v_quality_roll :=
    (pg_catalog.get_byte(
      pg_catalog.decode(
        substring(pg_catalog.md5(p_profile_id::text || ':' || btrim(p_idempotency_key) || ':' || v_request_hash),1,2),
        'hex'
      ),
      0
    ) % 11) - 5;

  v_final_quality := least(100,greatest(0,
    round(v_material_quality*0.7 + v_skill_score*0.3 - v_shape.difficulty_penalty + v_quality_roll)::integer
  ));

  v_quality_lift := round((v_final_quality-50)/8.0)::integer;
  v_tone := least(100,greatest(0,v_tone+v_quality_lift));
  v_sustain := least(100,greatest(0,v_sustain+v_quality_lift));
  v_stability := least(100,greatest(0,v_stability+v_quality_lift));
  v_output := least(100,greatest(0,v_output+v_quality_lift));
  v_stage_presence := least(100,greatest(0,v_stage_presence+round(v_quality_lift/2.0)::integer));

  v_final_stats := jsonb_build_object(
    'tone',v_tone,
    'sustain',v_sustain,
    'stability',v_stability,
    'output',v_output,
    'stagePresence',v_stage_presence
  );

  v_equipment_stats := jsonb_build_object(
    'luthiery_tone',v_tone,
    'luthiery_sustain',v_sustain,
    'luthiery_stability',v_stability,
    'luthiery_output',v_output,
    'luthiery_stage_presence',v_stage_presence,
    'luthiery_quality',v_final_quality
  );

  v_rarity := CASE
    WHEN v_final_quality >= 95 THEN 'legendary'
    WHEN v_final_quality >= 80 THEN 'epic'
    WHEN v_final_quality >= 60 THEN 'rare'
    WHEN v_final_quality >= 40 THEN 'uncommon'
    ELSE 'common'
  END;

  v_build_spec := jsonb_build_object(
    'instrumentName',v_name,
    'instrumentKind',v_kind,
    'shapeId',v_shape.id,
    'shapeName',v_shape.name,
    'colour',v_colour,
    'finishId',v_finish.id,
    'finishName',v_finish.label,
    'decal',v_decal,
    'parts',v_parts_spec,
    'materialSnapshot',v_material_snapshot,
    'skillSnapshot',jsonb_build_object('basic',v_basic,'professional',v_professional,'mastery',v_mastery)
  );

  INSERT INTO public.equipment_items (
    name,category,subcategory,price,rarity,stat_boosts,description,stock,
    brand,color_options,is_crafted,crafted_by_profile_id,custom_name
  )
  VALUES (
    v_name,
    CASE WHEN v_kind='electric_bass' THEN 'bass' ELSE 'guitar' END,
    'custom_luthiery',
    0,
    v_rarity,
    v_equipment_stats,
    'Player-crafted custom instrument from the RockMundo Luthiery Workbench.',
    0,
    'Player Crafted',
    jsonb_build_array(v_colour),
    true,
    p_profile_id,
    v_name
  )
  RETURNING id INTO v_equipment_id;

  INSERT INTO public.player_equipment (user_id,profile_id,equipment_id,is_equipped,condition)
  VALUES (v_user_id,p_profile_id,v_equipment_id,false,100)
  RETURNING id INTO v_player_equipment_id;

  FOR v_requirement IN
    SELECT key::uuid AS material_id,value::integer AS quantity
    FROM jsonb_each_text(v_requirements)
  LOOP
    UPDATE public.player_crafting_materials
    SET quantity=quantity-v_requirement.quantity
    WHERE profile_id=p_profile_id AND material_id=v_requirement.material_id;

    DELETE FROM public.player_crafting_materials
    WHERE profile_id=p_profile_id
      AND material_id=v_requirement.material_id
      AND quantity=0;
  END LOOP;

  v_craft_id := gen_random_uuid();
  v_result := jsonb_build_object(
    'status','completed',
    'craftId',v_craft_id,
    'equipmentId',v_equipment_id,
    'playerEquipmentId',v_player_equipment_id,
    'instrumentName',v_name,
    'instrumentKind',v_kind,
    'rarity',v_rarity,
    'qualityRoll',v_quality_roll,
    'finalQuality',v_final_quality,
    'finalStats',v_final_stats,
    'buildSpec',v_build_spec
  );

  INSERT INTO public.luthiery_crafts (
    id,profile_id,user_id,idempotency_key,request_hash,equipment_id,player_equipment_id,
    instrument_name,instrument_kind,shape_id,colour,finish_id,decal,parts,
    material_snapshot,skill_snapshot,quality_roll,final_quality,final_stats,result
  )
  VALUES (
    v_craft_id,p_profile_id,v_user_id,btrim(p_idempotency_key),v_request_hash,
    v_equipment_id,v_player_equipment_id,v_name,v_kind,v_shape.id,v_colour,v_finish.id,
    v_decal,v_parts_spec,v_material_snapshot,
    jsonb_build_object('basic',v_basic,'professional',v_professional,'mastery',v_mastery),
    v_quality_roll,v_final_quality,v_final_stats,v_result
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_custom_luthiery_instrument(uuid,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_custom_luthiery_instrument(uuid,jsonb,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_custom_luthiery_instrument(uuid,jsonb,text) TO authenticated;

NOTIFY pgrst,'reload schema';

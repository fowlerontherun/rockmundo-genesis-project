CREATE OR REPLACE FUNCTION private.award_luthiery_craft_xp(
  p_profile_id uuid,
  p_skill_slug text,
  p_xp integer
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_progress public.skill_progress%ROWTYPE;
  v_max integer;
  v_level integer;
  v_xp integer;
  v_required integer;
  v_to_max integer := 0;
  v_applied integer := 0;
  v_levels integer := 0;
  i integer;
BEGIN
  IF p_skill_slug NOT IN (
    'luthiery_basic_technical',
    'luthiery_professional_technical',
    'luthiery_mastery_technical'
  ) THEN
    RAISE EXCEPTION 'luthiery_xp_skill_invalid' USING ERRCODE='P0001';
  END IF;
  IF p_xp IS NULL OR p_xp <= 0 THEN
    RAISE EXCEPTION 'luthiery_xp_amount_invalid' USING ERRCODE='P0001';
  END IF;
  IF NOT public.skill_tier_unlocked(p_profile_id,p_skill_slug) THEN
    RAISE EXCEPTION 'luthiery_xp_skill_locked' USING ERRCODE='P0001';
  END IF;

  v_max := public.progression_skill_max_level(p_skill_slug);

  SELECT *
  INTO v_progress
  FROM public.skill_progress
  WHERE profile_id=p_profile_id
    AND skill_slug=p_skill_slug
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.skill_progress(
      profile_id,skill_slug,current_level,current_xp,required_xp,metadata
    )
    VALUES (
      p_profile_id,p_skill_slug,0,0,public.progression_skill_required_xp(0),
      jsonb_build_object('unlocked_by','luthiery_crafting')
    )
    ON CONFLICT (profile_id,skill_slug) DO NOTHING;

    SELECT *
    INTO v_progress
    FROM public.skill_progress
    WHERE profile_id=p_profile_id
      AND skill_slug=p_skill_slug
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'luthiery_xp_progress_missing' USING ERRCODE='P0001';
  END IF;

  v_level := least(greatest(COALESCE(v_progress.current_level,0),0),v_max);
  v_xp := greatest(COALESCE(v_progress.current_xp,0),0);

  IF v_level >= v_max THEN
    RETURN jsonb_build_object(
      'xp_awarded',0,
      'levels_gained',0,
      'skill_progress',to_jsonb(v_progress)
    );
  END IF;

  v_required := COALESCE(
    NULLIF(v_progress.required_xp,0),
    public.progression_skill_required_xp(v_level)
  );

  v_to_max := greatest(v_required-least(v_xp,v_required),0);
  IF v_level+1 <= v_max-1 THEN
    FOR i IN (v_level+1)..(v_max-1) LOOP
      v_to_max := v_to_max+public.progression_skill_required_xp(i);
    END LOOP;
  END IF;

  v_applied := least(p_xp,v_to_max);
  IF v_applied <= 0 THEN
    RETURN jsonb_build_object(
      'xp_awarded',0,
      'levels_gained',0,
      'skill_progress',to_jsonb(v_progress)
    );
  END IF;

  v_xp := least(v_xp,v_required)+v_applied;
  WHILE v_level < v_max AND v_xp >= v_required LOOP
    v_xp := v_xp-v_required;
    v_level := v_level+1;
    v_levels := v_levels+1;
    IF v_level < v_max THEN
      v_required := public.progression_skill_required_xp(v_level);
    END IF;
  END LOOP;

  IF v_level >= v_max THEN
    v_level := v_max;
    v_xp := 0;
    v_required := 0;
  END IF;

  UPDATE public.skill_progress
  SET current_level=v_level,
      current_xp=v_xp,
      required_xp=v_required,
      updated_at=timezone('utc',now()),
      metadata=COALESCE(metadata,'{}'::jsonb)
        || jsonb_build_object(
          'last_update_source','luthiery_craft',
          'last_luthiery_craft_at',timezone('utc',now())
        )
  WHERE id=v_progress.id
  RETURNING * INTO v_progress;

  RETURN jsonb_build_object(
    'xp_awarded',v_applied,
    'levels_gained',v_levels,
    'skill_progress',to_jsonb(v_progress)
  );
END;
$$;

REVOKE ALL ON FUNCTION private.award_luthiery_craft_xp(uuid,text,integer)
FROM PUBLIC, anon, authenticated;

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
  v_craft_tier text := 'basic';
  v_craft_tier_rank integer := 1;
  v_option_tier_rank integer;
  v_xp_skill_slug text;
  v_xp_requested integer;
  v_xp_awarded integer := 0;
  v_xp_result jsonb;
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

  -- Authorise the active character before the privileged idempotency lookup.
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

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_profile_id::text || ':' || btrim(p_idempotency_key),0)
  );

  v_request_hash := pg_catalog.md5(p_design::text);

  SELECT *
  INTO v_existing
  FROM public.luthiery_crafts
  WHERE profile_id=p_profile_id
    AND user_id=v_user_id
    AND idempotency_key=btrim(p_idempotency_key);

  IF FOUND THEN
    IF v_existing.request_hash <> v_request_hash THEN
      RAISE EXCEPTION 'luthiery_idempotency_key_conflict' USING ERRCODE='P0001';
    END IF;
    RETURN v_existing.result || jsonb_build_object('status','already_completed');
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

  v_craft_tier := v_shape.required_tier;
  v_craft_tier_rank := CASE v_craft_tier
    WHEN 'mastery' THEN 3
    WHEN 'professional' THEN 2
    ELSE 1
  END;

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

    v_option_tier_rank := CASE v_option.required_tier
      WHEN 'mastery' THEN 3
      WHEN 'professional' THEN 2
      ELSE 1
    END;
    IF v_option_tier_rank > v_craft_tier_rank THEN
      v_craft_tier_rank := v_option_tier_rank;
      v_craft_tier := v_option.required_tier;
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

  v_option_tier_rank := CASE v_finish.required_tier
    WHEN 'mastery' THEN 3
    WHEN 'professional' THEN 2
    ELSE 1
  END;
  IF v_option_tier_rank > v_craft_tier_rank THEN
    v_craft_tier_rank := v_option_tier_rank;
    v_craft_tier := v_finish.required_tier;
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

  v_xp_skill_slug := CASE v_craft_tier
    WHEN 'mastery' THEN 'luthiery_mastery_technical'
    WHEN 'professional' THEN 'luthiery_professional_technical'
    ELSE 'luthiery_basic_technical'
  END;
  v_xp_requested := CASE v_craft_tier
    WHEN 'mastery' THEN 20
    WHEN 'professional' THEN 15
    ELSE 10
  END;

  v_xp_result := private.award_luthiery_craft_xp(
    p_profile_id,
    v_xp_skill_slug,
    v_xp_requested
  );
  v_xp_awarded := COALESCE((v_xp_result->>'xp_awarded')::integer,0);

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
    'xpAwarded',v_xp_awarded,
    'xpSkillSlug',v_xp_skill_slug,
    'skillProgress',v_xp_result->'skill_progress',
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

REVOKE ALL ON FUNCTION public.create_custom_luthiery_instrument(uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_custom_luthiery_instrument(uuid,jsonb,text) TO authenticated;
NOTIFY pgrst,'reload schema';

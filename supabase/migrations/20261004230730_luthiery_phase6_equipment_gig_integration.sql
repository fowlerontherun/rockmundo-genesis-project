ALTER TABLE public.gig_equipment_loadouts
  ADD COLUMN IF NOT EXISTS player_equipment_id uuid REFERENCES public.player_equipment(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quality_score integer,
  ADD COLUMN IF NOT EXISTS condition_score integer,
  ADD COLUMN IF NOT EXISTS reliability_score integer,
  ADD COLUMN IF NOT EXISTS stat_boost_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS luthiery_snapshot jsonb;

ALTER TABLE public.gig_equipment_loadouts DROP CONSTRAINT IF EXISTS gig_equipment_loadouts_quality_score_check;
ALTER TABLE public.gig_equipment_loadouts ADD CONSTRAINT gig_equipment_loadouts_quality_score_check CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 100);
ALTER TABLE public.gig_equipment_loadouts DROP CONSTRAINT IF EXISTS gig_equipment_loadouts_condition_score_check;
ALTER TABLE public.gig_equipment_loadouts ADD CONSTRAINT gig_equipment_loadouts_condition_score_check CHECK (condition_score IS NULL OR condition_score BETWEEN 0 AND 100);
ALTER TABLE public.gig_equipment_loadouts DROP CONSTRAINT IF EXISTS gig_equipment_loadouts_reliability_score_check;
ALTER TABLE public.gig_equipment_loadouts ADD CONSTRAINT gig_equipment_loadouts_reliability_score_check CHECK (reliability_score IS NULL OR reliability_score BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS idx_gig_equipment_loadouts_player_equipment ON public.gig_equipment_loadouts(player_equipment_id) WHERE player_equipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gig_equipment_loadouts_assigned_profile ON public.gig_equipment_loadouts(gig_id,assigned_profile_id) WHERE assigned_profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gig_equipment_member_primary_role
  ON public.gig_equipment_loadouts(gig_id,assigned_profile_id,equipment_role)
  WHERE source_type='member_owned' AND is_primary IS TRUE AND is_spare IS FALSE AND assigned_profile_id IS NOT NULL;

DROP POLICY IF EXISTS gig_equipment_loadouts_band_all ON public.gig_equipment_loadouts;
DROP POLICY IF EXISTS "Band members can view gig equipment loadouts" ON public.gig_equipment_loadouts;
CREATE POLICY "Band members can view gig equipment loadouts"
ON public.gig_equipment_loadouts FOR SELECT TO authenticated
USING (public.caller_in_gig_band(gig_id));

REVOKE INSERT,UPDATE,DELETE ON public.gig_equipment_loadouts FROM authenticated, anon;
GRANT SELECT ON public.gig_equipment_loadouts TO authenticated;

CREATE OR REPLACE FUNCTION public.get_owned_luthiery_equipment_details(p_profile_id uuid)
RETURNS TABLE(
  player_equipment_id uuid, equipment_id uuid, condition integer, is_equipped boolean, purchased_at timestamptz,
  instrument_name text, instrument_kind text, rarity text, category text, subcategory text, description text,
  stat_boosts jsonb, maker_name text, shape_id text, shape_name text, colour text, finish_id text, finish_name text,
  final_quality integer, material_snapshot jsonb, final_stats jsonb, build_spec jsonb, estimated_value bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'luthiery_equipment_authentication_required' USING ERRCODE='P0001'; END IF;
  IF public.current_profile_id() IS DISTINCT FROM p_profile_id
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id=p_profile_id AND p.user_id=v_user_id AND p.is_active IS TRUE
         AND p.died_at IS NULL AND p.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'luthiery_equipment_active_profile_required' USING ERRCODE='P0001';
  END IF;

  RETURN QUERY
  SELECT
    pe.id,item.id,COALESCE(pe.condition,100),COALESCE(pe.is_equipped,false) OR COALESCE(pe.equipped,false),pe.purchased_at,
    craft.instrument_name,craft.instrument_kind,COALESCE(item.rarity,'common'),item.category,item.subcategory,item.description,
    COALESCE(item.stat_boosts,'{}'::jsonb),COALESCE(maker.display_name,maker.username,'Unknown maker'),
    craft.shape_id,COALESCE(craft.result->'buildSpec'->>'shapeName',craft.shape_id),craft.colour,
    craft.finish_id,COALESCE(craft.result->'buildSpec'->>'finishName',craft.finish_id),craft.final_quality,
    craft.material_snapshot,craft.final_stats,COALESCE(craft.result->'buildSpec','{}'::jsonb),
    greatest(1000::bigint,round(COALESCE((
      SELECT sum(material.base_cost)
      FROM jsonb_array_elements(craft.material_snapshot) entry
      JOIN public.crafting_materials material ON material.id=(entry->>'materialId')::uuid
    ),0) * (1.25 + craft.final_quality/100.0))::bigint)
  FROM public.player_equipment pe
  JOIN public.equipment_items item ON item.id=pe.equipment_id
  JOIN public.luthiery_crafts craft ON craft.equipment_id=item.id
  JOIN public.profiles maker ON maker.id=item.crafted_by_profile_id
  WHERE pe.profile_id=p_profile_id AND pe.user_id=v_user_id
    AND item.is_crafted IS TRUE AND item.subcategory='custom_luthiery'
  ORDER BY pe.created_at DESC,pe.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_equipped_stage_luthiery_instruments(p_profile_ids uuid[])
RETURNS TABLE(profile_id uuid,instrument_name text,instrument_kind text,shape_id text,shape_name text,colour text,final_quality integer,build_spec jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'luthiery_equipment_authentication_required' USING ERRCODE='P0001'; END IF;
  IF COALESCE(array_length(p_profile_ids,1),0)=0 OR array_length(p_profile_ids,1)>64 THEN RETURN; END IF;
  RETURN QUERY
  SELECT DISTINCT ON (pe.profile_id)
    pe.profile_id,craft.instrument_name,craft.instrument_kind,craft.shape_id,
    COALESCE(craft.result->'buildSpec'->>'shapeName',craft.shape_id),craft.colour,craft.final_quality,
    COALESCE(craft.result->'buildSpec','{}'::jsonb)
  FROM public.player_equipment pe
  JOIN public.equipment_items item ON item.id=pe.equipment_id
  JOIN public.luthiery_crafts craft ON craft.equipment_id=item.id
  WHERE pe.profile_id=ANY(p_profile_ids)
    AND (COALESCE(pe.is_equipped,false) OR COALESCE(pe.equipped,false))
    AND item.is_crafted IS TRUE AND item.subcategory='custom_luthiery'
  ORDER BY pe.profile_id,pe.created_at DESC,pe.id DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_gig_member_luthiery_loadout(p_gig_id uuid,p_player_equipment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid := public.current_profile_id();
  v_gig public.gigs%ROWTYPE;
  v_owned public.player_equipment%ROWTYPE;
  v_item public.equipment_items%ROWTYPE;
  v_craft public.luthiery_crafts%ROWTYPE;
  v_role text; v_quality integer; v_condition integer; v_reliability integer;
  v_maker_name text; v_snapshot jsonb; v_id uuid; v_conflict integer;
BEGIN
  IF v_user_id IS NULL OR v_profile_id IS NULL THEN RAISE EXCEPTION 'gig_luthiery_authentication_required' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_gig FROM public.gigs WHERE id=p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_luthiery_gig_not_found' USING ERRCODE='P0001'; END IF;
  IF COALESCE(v_gig.status,'scheduled') IN ('completed','cancelled','failed') THEN RAISE EXCEPTION 'gig_luthiery_gig_locked' USING ERRCODE='P0001'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.band_members member
    WHERE member.band_id=v_gig.band_id AND member.profile_id=v_profile_id AND member.user_id=v_user_id
      AND COALESCE(member.member_status,'active')='active'
  ) THEN RAISE EXCEPTION 'gig_luthiery_band_membership_required' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_owned FROM public.player_equipment
  WHERE id=p_player_equipment_id AND profile_id=v_profile_id AND user_id=v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_luthiery_instrument_not_owned' USING ERRCODE='P0001'; END IF;
  IF NOT (COALESCE(v_owned.is_equipped,false) OR COALESCE(v_owned.equipped,false)) THEN
    RAISE EXCEPTION 'gig_luthiery_instrument_not_equipped' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_item FROM public.equipment_items WHERE id=v_owned.equipment_id;
  IF NOT FOUND OR v_item.is_crafted IS DISTINCT FROM true OR v_item.subcategory IS DISTINCT FROM 'custom_luthiery' THEN
    RAISE EXCEPTION 'gig_luthiery_custom_instrument_required' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_craft FROM public.luthiery_crafts WHERE equipment_id=v_item.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_luthiery_provenance_required' USING ERRCODE='P0001'; END IF;

  v_role := CASE v_craft.instrument_kind WHEN 'electric_bass' THEN 'bass_guitar' ELSE 'guitar' END;
  v_quality := least(100,greatest(0,COALESCE(v_craft.final_quality,0)));
  v_condition := least(100,greatest(0,COALESCE(v_owned.condition,100)));
  v_reliability := round(v_quality*0.45 + v_condition*0.55)::integer;
  SELECT COALESCE(display_name,username,'Unknown maker') INTO v_maker_name FROM public.profiles WHERE id=v_item.crafted_by_profile_id;

  v_snapshot := jsonb_build_object(
    'instrumentName',v_craft.instrument_name,'instrumentKind',v_craft.instrument_kind,'makerName',COALESCE(v_maker_name,'Unknown maker'),
    'shapeId',v_craft.shape_id,'shapeName',COALESCE(v_craft.result->'buildSpec'->>'shapeName',v_craft.shape_id),
    'colour',v_craft.colour,'finishId',v_craft.finish_id,'finishName',COALESCE(v_craft.result->'buildSpec'->>'finishName',v_craft.finish_id),
    'finalQuality',v_quality,'materialSnapshot',v_craft.material_snapshot,'finalStats',v_craft.final_stats,
    'buildSpec',COALESCE(v_craft.result->'buildSpec','{}'::jsonb)
  );

  SELECT count(*) INTO v_conflict
  FROM public.gig_equipment_loadouts loadout
  JOIN public.gigs other_gig ON other_gig.id=loadout.gig_id
  WHERE loadout.player_equipment_id=p_player_equipment_id AND loadout.gig_id<>p_gig_id
    AND COALESCE(other_gig.status,'scheduled') NOT IN ('completed','cancelled','failed')
    AND abs(extract(epoch FROM (other_gig.scheduled_date-v_gig.scheduled_date))) < 14400;
  IF v_conflict>0 THEN RAISE EXCEPTION 'gig_luthiery_instrument_schedule_conflict' USING ERRCODE='P0001'; END IF;

  DELETE FROM public.gig_equipment_loadouts
  WHERE gig_id=p_gig_id AND assigned_profile_id=v_profile_id AND source_type='member_owned' AND equipment_role=v_role;

  INSERT INTO public.gig_equipment_loadouts(
    gig_id,equipment_role,source_type,player_equipment_id,assigned_profile_id,is_primary,is_spare,rental_cost,
    quality_score,condition_score,reliability_score,stat_boost_snapshot,luthiery_snapshot
  ) VALUES(
    p_gig_id,v_role,'member_owned',p_player_equipment_id,v_profile_id,true,false,0,
    v_quality,v_condition,v_reliability,COALESCE(v_item.stat_boosts,'{}'::jsonb),v_snapshot
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',v_id,'gigId',p_gig_id,'profileId',v_profile_id,'playerEquipmentId',p_player_equipment_id,
    'equipmentRole',v_role,'qualityScore',v_quality,'conditionScore',v_condition,'reliabilityScore',v_reliability,
    'luthierySnapshot',v_snapshot
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_gig_member_luthiery_loadout(p_gig_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_user_id uuid:=auth.uid(); v_profile_id uuid:=public.current_profile_id(); v_deleted integer;
BEGIN
  IF v_user_id IS NULL OR v_profile_id IS NULL THEN RAISE EXCEPTION 'gig_luthiery_authentication_required' USING ERRCODE='P0001'; END IF;
  IF NOT public.caller_in_gig_band(p_gig_id) THEN RAISE EXCEPTION 'gig_luthiery_band_membership_required' USING ERRCODE='P0001'; END IF;
  DELETE FROM public.gig_equipment_loadouts
  WHERE gig_id=p_gig_id AND assigned_profile_id=v_profile_id AND source_type='member_owned' AND luthiery_snapshot IS NOT NULL;
  GET DIAGNOSTICS v_deleted=ROW_COUNT;
  RETURN v_deleted>0;
END;
$$;

REVOKE ALL ON FUNCTION public.get_owned_luthiery_equipment_details(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_equipped_stage_luthiery_instruments(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_gig_member_luthiery_loadout(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_gig_member_luthiery_loadout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_owned_luthiery_equipment_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_equipped_stage_luthiery_instruments(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_gig_member_luthiery_loadout(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_gig_member_luthiery_loadout(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';

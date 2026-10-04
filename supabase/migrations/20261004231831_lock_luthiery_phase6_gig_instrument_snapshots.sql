CREATE OR REPLACE FUNCTION public.save_gig_member_luthiery_loadout(p_gig_id uuid, p_player_equipment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  IF COALESCE(v_gig.status,'scheduled') IN ('completed','cancelled','failed','in_progress','ready_for_completion','processing_outcome','live') THEN RAISE EXCEPTION 'gig_luthiery_gig_locked' USING ERRCODE='P0001'; END IF;
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
$function$
;

CREATE OR REPLACE FUNCTION public.remove_gig_member_luthiery_loadout(p_gig_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid:=auth.uid();
  v_profile_id uuid:=public.current_profile_id();
  v_deleted integer;
  v_status text;
BEGIN
  IF v_user_id IS NULL OR v_profile_id IS NULL THEN RAISE EXCEPTION 'gig_luthiery_authentication_required' USING ERRCODE='P0001'; END IF;
  IF NOT public.caller_in_gig_band(p_gig_id) THEN RAISE EXCEPTION 'gig_luthiery_band_membership_required' USING ERRCODE='P0001'; END IF;
  SELECT status INTO v_status FROM public.gigs WHERE id=p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_luthiery_gig_not_found' USING ERRCODE='P0001'; END IF;
  IF COALESCE(v_status,'scheduled') IN ('completed','cancelled','failed','in_progress','ready_for_completion','processing_outcome','live') THEN
    RAISE EXCEPTION 'gig_luthiery_gig_locked' USING ERRCODE='P0001';
  END IF;
  DELETE FROM public.gig_equipment_loadouts
  WHERE gig_id=p_gig_id AND assigned_profile_id=v_profile_id AND source_type='member_owned' AND luthiery_snapshot IS NOT NULL;
  GET DIAGNOSTICS v_deleted=ROW_COUNT;
  RETURN v_deleted>0;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.prevent_active_gig_luthiery_equipment_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.gig_equipment_loadouts loadout
    JOIN public.gigs gig ON gig.id=loadout.gig_id
    WHERE loadout.player_equipment_id=OLD.id
      AND loadout.source_type='member_owned'
      AND loadout.luthiery_snapshot IS NOT NULL
      AND COALESCE(gig.status,'scheduled') NOT IN ('completed','cancelled','failed')
  ) THEN
    RAISE EXCEPTION 'gig_luthiery_assigned_instrument_locked' USING ERRCODE='P0001';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_active_gig_luthiery_equipment_mutation()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS luthiery_gig_lock_assigned_equipment ON public.player_equipment;
CREATE TRIGGER luthiery_gig_lock_assigned_equipment
BEFORE UPDATE OR DELETE ON public.player_equipment
FOR EACH ROW EXECUTE FUNCTION private.prevent_active_gig_luthiery_equipment_mutation();

REVOKE ALL ON FUNCTION public.save_gig_member_luthiery_loadout(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_gig_member_luthiery_loadout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_gig_member_luthiery_loadout(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_gig_member_luthiery_loadout(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';

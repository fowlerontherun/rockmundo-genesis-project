CREATE OR REPLACE FUNCTION public.get_owned_luthiery_equipment_details(p_profile_id uuid)
 RETURNS TABLE(player_equipment_id uuid, equipment_id uuid, condition integer, is_equipped boolean, purchased_at timestamp with time zone, instrument_name text, instrument_kind text, rarity text, category text, subcategory text, description text, stat_boosts jsonb, maker_name text, shape_id text, shape_name text, colour text, finish_id text, finish_name text, final_quality integer, material_snapshot jsonb, final_stats jsonb, build_spec jsonb, estimated_value bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    craft.instrument_name::text,craft.instrument_kind::text,COALESCE(item.rarity,'common')::text,item.category::text,item.subcategory::text,item.description::text,
    COALESCE(item.stat_boosts,'{}'::jsonb),COALESCE(maker.display_name,maker.username,'Unknown maker')::text,
    craft.shape_id::text,COALESCE(craft.result->'buildSpec'->>'shapeName',craft.shape_id)::text,craft.colour::text,
    craft.finish_id::text,COALESCE(craft.result->'buildSpec'->>'finishName',craft.finish_id)::text,craft.final_quality,
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
$function$
;

REVOKE ALL ON FUNCTION public.get_owned_luthiery_equipment_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_owned_luthiery_equipment_details(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';

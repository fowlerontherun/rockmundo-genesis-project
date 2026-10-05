CREATE OR REPLACE FUNCTION public.get_equipped_stage_luthiery_instruments(p_profile_ids uuid[])
 RETURNS TABLE(profile_id uuid, instrument_name text, instrument_kind text, shape_id text, shape_name text, colour text, final_quality integer, build_spec jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'luthiery_equipment_authentication_required' USING ERRCODE='P0001'; END IF;
  IF COALESCE(array_length(p_profile_ids,1),0)=0 OR array_length(p_profile_ids,1)>64 THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    pe.profile_id,craft.instrument_name,craft.instrument_kind,craft.shape_id,
    COALESCE(craft.result->'buildSpec'->>'shapeName',craft.shape_id),craft.colour,craft.final_quality,
    COALESCE(craft.result->'buildSpec','{}'::jsonb)
  FROM public.player_equipment pe
  JOIN public.equipment_items item ON item.id=pe.equipment_id
  JOIN public.luthiery_crafts craft ON craft.equipment_id=item.id
  WHERE pe.profile_id=ANY(p_profile_ids)
    AND (COALESCE(pe.is_equipped,false) OR COALESCE(pe.equipped,false))
    AND item.is_crafted IS TRUE AND item.subcategory='custom_luthiery'
  ORDER BY pe.profile_id,craft.instrument_kind,pe.created_at DESC,pe.id DESC;
END;
$function$
;
REVOKE ALL ON FUNCTION public.get_equipped_stage_luthiery_instruments(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_equipped_stage_luthiery_instruments(uuid[]) TO authenticated;
NOTIFY pgrst,'reload schema';

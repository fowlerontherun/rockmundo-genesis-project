-- Enchantments are applied with their funds, inventory, and stack count in one transaction.
CREATE OR REPLACE FUNCTION public.apply_equipment_enchantment_atomic(
 p_profile_id uuid,p_player_equipment_id uuid,p_enchantment_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.enchantment_catalog%rowtype;
 v_current public.equipment_enchantments%rowtype;
 v_other record;v_material record;v_qty integer;v_applied integer;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'enchant_profile_not_owned'; END IF;
 PERFORM 1 FROM public.player_equipment WHERE id=p_player_equipment_id
 AND profile_id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'enchant_equipment_not_owned'; END IF;
 SELECT * INTO e FROM public.enchantment_catalog WHERE id=p_enchantment_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'enchantment_not_found'; END IF;
 IF e.required_skill_slug IS NOT NULL AND e.min_skill_level>0 AND
 coalesce((SELECT max(current_level) FROM public.skill_progress
   WHERE profile_id=p_profile_id AND skill_slug=e.required_skill_slug),0)<e.min_skill_level
 THEN RAISE EXCEPTION 'enchantment_skill_requirement'; END IF;
 -- Equipment row is the serialisation lock for all enchantments on this item.
 SELECT * INTO v_current FROM public.equipment_enchantments
 WHERE player_equipment_id=p_player_equipment_id AND enchantment_id=p_enchantment_id
 AND profile_id=p_profile_id FOR UPDATE;
 IF coalesce(v_current.stack_count,0)>=e.max_stacks THEN RAISE EXCEPTION 'enchantment_max_stacks'; END IF;
 FOR v_other IN SELECT ee.enchantment_id,ec.incompatible_with
 FROM public.equipment_enchantments ee JOIN public.enchantment_catalog ec ON ec.id=ee.enchantment_id
 WHERE ee.player_equipment_id=p_player_equipment_id AND ee.profile_id=p_profile_id
 LOOP
  IF v_other.enchantment_id=ANY(coalesce(e.incompatible_with,'{}'::uuid[]))
  OR p_enchantment_id=ANY(coalesce(v_other.incompatible_with,'{}'::uuid[]))
  THEN RAISE EXCEPTION 'enchantment_incompatible'; END IF;
 END LOOP;
 IF e.cash_cost<0 THEN RAISE EXCEPTION 'invalid_enchantment_cost'; END IF;
 IF e.cash_cost>0 THEN
  UPDATE public.profiles SET cash=cash-e.cash_cost
  WHERE id=p_profile_id AND cash>=e.cash_cost;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_enchantment_cash'; END IF;
 END IF;
 IF jsonb_typeof(e.material_cost)<>'array' THEN RAISE EXCEPTION 'enchantment_material_cost_invalid'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(e.material_cost) entry
 WHERE (entry->>'material_id') IS NULL OR (entry->>'quantity') IS NULL
   OR (entry->>'quantity') !~ '^[0-9]+$' OR (entry->>'quantity')::integer<1)
 THEN RAISE EXCEPTION 'enchantment_material_cost_invalid'; END IF;
 FOR v_material IN
  SELECT (entry->>'material_id')::uuid AS id,sum((entry->>'quantity')::integer)::integer AS qty
  FROM jsonb_array_elements(e.material_cost) entry
  GROUP BY (entry->>'material_id')::uuid ORDER BY (entry->>'material_id')::uuid
 LOOP
  UPDATE public.player_crafting_materials SET quantity=quantity-v_material.qty
  WHERE profile_id=p_profile_id AND material_id=v_material.id AND quantity>=v_material.qty;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_enchantment_materials'; END IF;
 END LOOP;
 IF v_current.id IS NOT NULL THEN
  UPDATE public.equipment_enchantments SET stack_count=v_current.stack_count+1
  WHERE id=v_current.id RETURNING stack_count INTO v_applied;
 ELSE
  INSERT INTO public.equipment_enchantments(player_equipment_id,enchantment_id,profile_id,stack_count)
  VALUES(p_player_equipment_id,p_enchantment_id,p_profile_id,1)
  RETURNING stack_count INTO v_applied;
 END IF;
 RETURN jsonb_build_object('stackCount',v_applied,'cashCharged',e.cash_cost);
END $$;
REVOKE ALL ON FUNCTION public.apply_equipment_enchantment_atomic(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_equipment_enchantment_atomic(uuid,uuid,uuid) TO authenticated;

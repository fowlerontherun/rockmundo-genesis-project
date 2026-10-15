-- Live-schema-safe restoration of legacy atomic crafting operations.
-- Corrects the historic JSON qty/quantity mismatch and removes references
-- to absent gear_categories and equipment_items.gear_category_id.
-- Existing direct client writes remain revoked: all mutation paths are RPCs.
BEGIN;

CREATE OR REPLACE FUNCTION public.purchase_crafting_material_atomic(
 p_profile_id uuid,p_material_id uuid,p_quantity integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $rm$
DECLARE v_price integer;v_cost bigint;v_inventory_id uuid;
BEGIN
 IF auth.uid() IS NULL OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 999
 THEN RAISE EXCEPTION 'invalid_material_quantity' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM public.profiles p WHERE p.id=p_profile_id AND p.user_id=auth.uid()
  AND p.is_active IS TRUE AND p.deleted_at IS NULL AND p.died_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_character' USING ERRCODE='42501';END IF;
 SELECT base_cost INTO v_price FROM public.crafting_materials WHERE id=p_material_id;
 IF NOT FOUND OR v_price IS NULL OR v_price<=0 THEN
   RAISE EXCEPTION 'invalid_crafting_material' USING ERRCODE='22023';
 END IF;
 v_cost:=v_price::bigint*p_quantity::bigint;
 UPDATE public.profiles SET cash=cash-v_cost WHERE id=p_profile_id
  AND cash>=v_cost;
 IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_crafting_funds';END IF;
 INSERT INTO public.player_crafting_materials(profile_id,material_id,quantity)
 VALUES(p_profile_id,p_material_id,p_quantity)
 ON CONFLICT(profile_id,material_id)
 DO UPDATE SET quantity=public.player_crafting_materials.quantity+EXCLUDED.quantity
 WHERE public.player_crafting_materials.quantity <= 2147483647-EXCLUDED.quantity
 RETURNING id INTO v_inventory_id;
 IF v_inventory_id IS NULL THEN RAISE EXCEPTION 'crafting_inventory_limit';END IF;
 RETURN jsonb_build_object('quantity',p_quantity,'charged',v_cost);
END;
$rm$;

CREATE OR REPLACE FUNCTION public.start_crafting_session_atomic(
 p_profile_id uuid,p_recipe_id uuid
) RETURNS public.crafting_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $rm$
DECLARE v_recipe public.crafting_recipes%rowtype;
 v_req record;v_session public.crafting_sessions%rowtype;v_count integer:=0;
BEGIN
 PERFORM 1 FROM public.profiles p WHERE p.id=p_profile_id AND p.user_id=auth.uid()
  AND p.is_active IS TRUE AND p.deleted_at IS NULL AND p.died_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_character' USING ERRCODE='42501';END IF;
 SELECT * INTO v_recipe FROM public.crafting_recipes WHERE id=p_recipe_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'crafting_recipe_missing';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.crafting_blueprints b WHERE b.profile_id=p_profile_id
  AND b.recipe_id=p_recipe_id)
 THEN RAISE EXCEPTION 'crafting_blueprint_locked';END IF;
 IF coalesce(v_recipe.min_skill_level,0)>0 AND NOT EXISTS (
   SELECT 1 FROM public.skill_progress sp
   WHERE sp.profile_id=p_profile_id AND sp.skill_slug=v_recipe.required_skill_slug
     AND sp.current_level>=v_recipe.min_skill_level
 )
 THEN RAISE EXCEPTION 'crafting_skill_insufficient';END IF;
 IF jsonb_typeof(v_recipe.materials_required) IS DISTINCT FROM 'array'
  OR jsonb_array_length(v_recipe.materials_required)=0
  OR v_recipe.base_craft_time_minutes NOT BETWEEN 1 AND 10080
 THEN RAISE EXCEPTION 'crafting_recipe_materials_invalid';END IF;
 FOR v_req IN
  SELECT (e.value->>'material_id')::uuid AS material_id,
    sum((coalesce(e.value->>'quantity',e.value->>'qty'))::bigint) AS qty
  FROM jsonb_array_elements(v_recipe.materials_required) e(value)
  GROUP BY 1
 LOOP
   IF v_req.material_id IS NULL OR v_req.qty IS NULL
    OR v_req.qty NOT BETWEEN 1 AND 2147483647
   THEN RAISE EXCEPTION 'crafting_recipe_materials_invalid';END IF;
   UPDATE public.player_crafting_materials
   SET quantity=quantity-v_req.qty::integer
   WHERE profile_id=p_profile_id AND material_id=v_req.material_id
    AND quantity>=v_req.qty;
   IF NOT FOUND THEN RAISE EXCEPTION 'crafting_materials_missing';END IF;
   v_count:=v_count+1;
 END LOOP;
 IF v_count=0 THEN RAISE EXCEPTION 'crafting_recipe_materials_invalid';END IF;
 INSERT INTO public.crafting_sessions(profile_id,recipe_id,completes_at,status)
 VALUES(p_profile_id,p_recipe_id,now()+make_interval(mins=>v_recipe.base_craft_time_minutes),'in_progress')
 RETURNING * INTO v_session;
 RETURN v_session;
END;
$rm$;

CREATE OR REPLACE FUNCTION public.collect_crafting_session_atomic(
 p_profile_id uuid,p_session_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $rm$
DECLARE v_session public.crafting_sessions%rowtype;
 v_recipe public.crafting_recipes%rowtype;v_user uuid;
 v_equipment_id uuid;v_owned_id uuid;v_quality integer;v_bonus jsonb;
BEGIN
 SELECT p.user_id INTO v_user FROM public.profiles p
 WHERE p.id=p_profile_id AND p.user_id=auth.uid()
  AND p.is_active IS TRUE AND p.deleted_at IS NULL AND p.died_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_character' USING ERRCODE='42501';END IF;
 SELECT * INTO v_session FROM public.crafting_sessions
 WHERE id=p_session_id AND profile_id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'crafting_session_missing';END IF;
 IF v_session.status='collected' THEN
   IF v_session.result_equipment_id IS NULL OR NOT EXISTS (
     SELECT 1 FROM public.player_equipment pe
     WHERE pe.id=v_session.result_equipment_id AND pe.profile_id=p_profile_id
   ) THEN RAISE EXCEPTION 'crafting_reward_requires_reconciliation';END IF;
   RETURN jsonb_build_object('qualityRoll',v_session.quality_roll,
    'bonusStats',coalesce(v_session.bonus_stats,'{}'::jsonb),
    'equipmentId',v_session.result_equipment_id,'alreadyCollected',true);
 END IF;
 IF v_session.status NOT IN ('in_progress','completed')
  OR v_session.completes_at>now()
 THEN RAISE EXCEPTION 'crafting_session_not_ready';END IF;
 SELECT * INTO v_recipe FROM public.crafting_recipes WHERE id=v_session.recipe_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'crafting_recipe_missing';END IF;
 v_quality:=floor(random()*101)::integer;
 v_bonus:=CASE WHEN v_quality>=95 THEN '{"fame_bonus":15,"quality_bonus":20}'::jsonb
  WHEN v_quality>=80 THEN '{"fame_bonus":10,"quality_bonus":10}'::jsonb
  WHEN v_quality>=60 THEN '{"quality_bonus":5}'::jsonb
  WHEN v_quality<20 THEN '{"quality_penalty":-10}'::jsonb ELSE '{}'::jsonb END;
 INSERT INTO public.equipment_items(
   name,category,subcategory,rarity,price,price_cash,price_fame,
   stat_boosts,description,stock,is_crafted,crafted_by_profile_id,custom_name
 ) VALUES(
   left(v_recipe.name,180),left(v_recipe.result_category,100),
   left(v_recipe.result_subcategory,100),left(v_recipe.rarity_output,50),
   0,0,0,v_bonus,'Crafted by a RockMundo musician',0,true,p_profile_id,v_recipe.name
 ) RETURNING id INTO v_equipment_id;
 INSERT INTO public.player_equipment(
   user_id,profile_id,equipment_id,is_equipped,equipped
 ) VALUES(v_user,p_profile_id,v_equipment_id,false,false)
 RETURNING id INTO v_owned_id;
 UPDATE public.crafting_sessions SET
   status='collected',quality_roll=v_quality,bonus_stats=v_bonus,
   result_equipment_id=v_owned_id
 WHERE id=v_session.id;
 RETURN jsonb_build_object('qualityRoll',v_quality,'bonusStats',v_bonus,
  'equipmentId',v_owned_id,'alreadyCollected',false);
END;
$rm$;

CREATE OR REPLACE FUNCTION public.salvage_equipment_atomic(
 p_profile_id uuid,p_equipment_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $rm$
DECLARE v_item record;v_rarity text;v_picks integer;v_qty integer;
 v_material record;v_yields jsonb:='[]'::jsonb;v_count integer:=0;
BEGIN
 PERFORM 1 FROM public.profiles p WHERE p.id=p_profile_id AND p.user_id=auth.uid()
 AND p.is_active IS TRUE AND p.deleted_at IS NULL AND p.died_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_character' USING ERRCODE='42501';END IF;
 SELECT pe.id,pe.is_equipped,pe.equipped,pe.condition,
        ei.name,ei.category,ei.rarity
 INTO v_item FROM public.player_equipment pe
 JOIN public.equipment_items ei ON ei.id=pe.equipment_id
 WHERE pe.id=p_equipment_id AND pe.profile_id=p_profile_id
 FOR UPDATE OF pe;
 IF NOT FOUND THEN RAISE EXCEPTION 'salvage_equipment_not_owned';END IF;
 IF coalesce(v_item.is_equipped,false) OR coalesce(v_item.equipped,false)
 THEN RAISE EXCEPTION 'salvage_equipment_equipped';END IF;
 v_rarity:=coalesce(v_item.rarity,'common');
 v_picks:=CASE WHEN v_rarity='legendary' THEN 3
  WHEN v_rarity IN ('epic','rare') THEN 2 ELSE 1 END;
 v_qty:=greatest(1,round(
  (CASE WHEN v_rarity='legendary' THEN 3
    WHEN v_rarity IN ('epic','rare','uncommon') THEN 2 ELSE 1 END)
  *greatest(0.25,least(1,coalesce(v_item.condition,100)::numeric/100))
 )::integer);
 DELETE FROM public.player_equipment WHERE id=p_equipment_id
 AND profile_id=p_profile_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'salvage_already_processed';END IF;
 FOR v_material IN
  SELECT m.id,m.name FROM public.crafting_materials m
  ORDER BY CASE WHEN m.category=ANY(
   CASE WHEN v_item.category IN ('guitar','bass','drums') THEN ARRAY['wood','hardware']
    WHEN v_item.category IN ('keyboard','microphone','amplifier','amp','pedal','cable')
      THEN ARRAY['electronics','hardware']
    ELSE ARRAY['hardware','wood'] END) THEN 0 ELSE 1 END,
   CASE WHEN v_rarity IN ('rare','epic','legendary') THEN -m.quality_tier
    ELSE m.quality_tier END,m.id
  LIMIT v_picks
 LOOP
  INSERT INTO public.player_crafting_materials(profile_id,material_id,quantity)
  VALUES(p_profile_id,v_material.id,v_qty)
  ON CONFLICT(profile_id,material_id)
  DO UPDATE SET quantity=public.player_crafting_materials.quantity+EXCLUDED.quantity
  WHERE public.player_crafting_materials.quantity <= 2147483647-EXCLUDED.quantity;
  IF NOT FOUND THEN RAISE EXCEPTION 'crafting_inventory_limit';END IF;
  v_yields:=v_yields||jsonb_build_array(jsonb_build_object(
    'materialId',v_material.id,'quantity',v_qty,'name',v_material.name));
  v_count:=v_count+1;
 END LOOP;
 IF v_count=0 THEN RAISE EXCEPTION 'salvage_no_materials';END IF;
 RETURN jsonb_build_object('itemName',v_item.name,'yields',v_yields);
END;
$rm$;

REVOKE ALL ON FUNCTION
 public.purchase_crafting_material_atomic(uuid,uuid,integer),
 public.start_crafting_session_atomic(uuid,uuid),
 public.collect_crafting_session_atomic(uuid,uuid),
 public.salvage_equipment_atomic(uuid,uuid)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 public.purchase_crafting_material_atomic(uuid,uuid,integer),
 public.start_crafting_session_atomic(uuid,uuid),
 public.collect_crafting_session_atomic(uuid,uuid),
 public.salvage_equipment_atomic(uuid,uuid)
TO authenticated;
COMMIT;
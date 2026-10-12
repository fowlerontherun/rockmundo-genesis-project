-- Legacy crafting transaction boundary: do not debit/grant partial rewards.
-- Locks the owning character row to serialize same-character operations.
CREATE OR REPLACE FUNCTION public.purchase_crafting_material_atomic(
 p_profile_id uuid,p_material_id uuid,p_quantity integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_cost integer;v_price integer;
BEGIN
 IF p_quantity NOT BETWEEN 1 AND 999 THEN RAISE EXCEPTION 'invalid_material_quantity'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_character'; END IF;
 SELECT base_cost INTO v_price FROM public.crafting_materials WHERE id=p_material_id;
 IF NOT FOUND OR v_price<0 THEN RAISE EXCEPTION 'invalid_crafting_material'; END IF;
 v_cost:=v_price*p_quantity;
 UPDATE public.profiles SET cash=cash-v_cost WHERE id=p_profile_id AND cash>=v_cost;
 IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_crafting_funds'; END IF;
 INSERT INTO public.player_crafting_materials(profile_id,material_id,quantity)
 VALUES(p_profile_id,p_material_id,p_quantity)
 ON CONFLICT(profile_id,material_id)
 DO UPDATE SET quantity=public.player_crafting_materials.quantity+excluded.quantity;
 RETURN jsonb_build_object('quantity',p_quantity,'charged',v_cost);
END $$;

CREATE OR REPLACE FUNCTION public.start_crafting_session_atomic(
 p_profile_id uuid,p_recipe_id uuid
) RETURNS public.crafting_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_recipe public.crafting_recipes%rowtype;v_req record;v_session public.crafting_sessions%rowtype;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_character'; END IF;
 SELECT * INTO v_recipe FROM public.crafting_recipes WHERE id=p_recipe_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'crafting_recipe_missing'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.crafting_blueprints WHERE profile_id=p_profile_id AND recipe_id=p_recipe_id)
 THEN RAISE EXCEPTION 'crafting_blueprint_locked'; END IF;
 IF coalesce(v_recipe.min_skill_level,0)>0 AND NOT EXISTS (
   SELECT 1 FROM public.skill_progress WHERE profile_id=p_profile_id
    AND skill_slug=v_recipe.required_skill_slug
    AND current_level>=v_recipe.min_skill_level
 ) THEN RAISE EXCEPTION 'crafting_skill_insufficient'; END IF;
 IF jsonb_typeof(v_recipe.materials_required) <> 'array' THEN RAISE EXCEPTION 'crafting_recipe_materials_invalid'; END IF;
 FOR v_req IN
  SELECT (item->>'material_id')::uuid AS material_id,
         sum((item->>'quantity')::integer)::integer AS qty
  FROM jsonb_array_elements(v_recipe.materials_required) item GROUP BY 1
 LOOP
  IF v_req.qty<=0 THEN RAISE EXCEPTION 'crafting_recipe_materials_invalid'; END IF;
  UPDATE public.player_crafting_materials SET quantity=quantity-v_req.qty
   WHERE profile_id=p_profile_id AND material_id=v_req.material_id AND quantity>=v_req.qty;
  IF NOT FOUND THEN RAISE EXCEPTION 'crafting_materials_missing'; END IF;
 END LOOP;
 INSERT INTO public.crafting_sessions(profile_id,recipe_id,completes_at,status)
 VALUES(p_profile_id,p_recipe_id,now()+make_interval(mins=>greatest(1,v_recipe.base_craft_time_minutes)),'in_progress')
 RETURNING * INTO v_session;
 RETURN v_session;
END $$;

CREATE OR REPLACE FUNCTION public.collect_crafting_session_atomic(
 p_profile_id uuid,p_session_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_session public.crafting_sessions%rowtype;v_recipe public.crafting_recipes%rowtype;
 v_user uuid;v_equipment_id uuid;v_owned_id uuid;v_category uuid;v_quality numeric;v_bonus jsonb;
BEGIN
 SELECT user_id INTO v_user FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_character'; END IF;
 SELECT * INTO v_session FROM public.crafting_sessions
 WHERE id=p_session_id AND profile_id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'crafting_session_missing'; END IF;
 IF v_session.status='collected' THEN
  IF v_session.result_equipment_id IS NULL THEN RAISE EXCEPTION 'crafting_reward_requires_reconciliation'; END IF;
  RETURN jsonb_build_object('qualityRoll',v_session.quality_roll,
    'bonusStats',coalesce(v_session.bonus_stats,'{}'::jsonb),
    'equipmentId',v_session.result_equipment_id,'alreadyCollected',true);
 END IF;
 IF v_session.status NOT IN ('in_progress','completed') OR v_session.completes_at>now()
 THEN RAISE EXCEPTION 'crafting_session_not_ready'; END IF;
 SELECT * INTO v_recipe FROM public.crafting_recipes WHERE id=v_session.recipe_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'crafting_recipe_missing'; END IF;
 v_quality:=floor(random()*101);
 v_bonus:= CASE WHEN v_quality>=95 THEN '{"fame_bonus":15,"quality_bonus":20}'::jsonb
                WHEN v_quality>=80 THEN '{"fame_bonus":10,"quality_bonus":10}'::jsonb
                WHEN v_quality>=60 THEN '{"quality_bonus":5}'::jsonb
                WHEN v_quality<20 THEN '{"quality_penalty":-10}'::jsonb
                ELSE '{}'::jsonb END;
 INSERT INTO public.gear_categories(slug,label)
 VALUES(v_recipe.result_category,initcap(replace(v_recipe.result_category,'_',' ')))
 ON CONFLICT (slug) DO UPDATE SET slug=excluded.slug
 RETURNING id INTO v_category;
 INSERT INTO public.equipment_items(name,category,subcategory,rarity,price,price_cash,price_fame,
  stat_boosts,description,gear_category_id,is_stock_tracked)
 VALUES(v_recipe.name,v_recipe.result_category,v_recipe.result_subcategory,
  v_recipe.rarity_output,0,0,0,v_bonus,
  'Crafted by a RockMundo musician',v_category,false)
 RETURNING id INTO v_equipment_id;
 INSERT INTO public.player_equipment(user_id,profile_id,equipment_id,is_equipped)
 VALUES(v_user,p_profile_id,v_equipment_id,false) RETURNING id INTO v_owned_id;
 UPDATE public.crafting_sessions
 SET status='collected',quality_roll=v_quality,bonus_stats=v_bonus,result_equipment_id=v_owned_id
 WHERE id=v_session.id;
 RETURN jsonb_build_object('qualityRoll',v_quality,'bonusStats',v_bonus,
  'equipmentId',v_owned_id,'alreadyCollected',false);
END $$;

CREATE OR REPLACE FUNCTION public.salvage_equipment_atomic(
 p_profile_id uuid,p_equipment_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_item record;v_user uuid;v_rarity text;v_picks integer;v_qty integer;
 v_material record;v_yields jsonb:='[]'::jsonb;v_count integer:=0;
BEGIN
 SELECT user_id INTO v_user FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_character'; END IF;
 SELECT pe.id,pe.is_equipped,pe.condition,ei.name,ei.category,ei.rarity
 INTO v_item FROM public.player_equipment pe
 JOIN public.equipment_items ei ON ei.id=pe.equipment_id
 WHERE pe.id=p_equipment_id AND pe.profile_id=p_profile_id FOR UPDATE OF pe;
 IF NOT FOUND THEN RAISE EXCEPTION 'salvage_equipment_not_owned'; END IF;
 IF coalesce(v_item.is_equipped,false) THEN RAISE EXCEPTION 'salvage_equipment_equipped'; END IF;
 v_rarity:=coalesce(v_item.rarity,'common');
 v_picks:= CASE WHEN v_rarity='legendary' THEN 3
                WHEN v_rarity IN ('epic','rare') THEN 2 ELSE 1 END;
 v_qty:=greatest(1,round((CASE WHEN v_rarity='legendary' THEN 3
                WHEN v_rarity IN ('epic','rare','uncommon') THEN 2 ELSE 1 END)
                *greatest(0.25,least(1,coalesce(v_item.condition,100)::numeric/100)))::integer);
 -- The deletion and every yield grant take place in this one transaction.
 DELETE FROM public.player_equipment WHERE id=p_equipment_id AND profile_id=p_profile_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'salvage_already_processed'; END IF;
 FOR v_material IN
  SELECT id,name FROM public.crafting_materials
  ORDER BY CASE WHEN category = ANY(
   CASE WHEN v_item.category IN ('guitar','bass','drums') THEN ARRAY['wood','hardware']
        WHEN v_item.category IN ('keyboard','microphone','amplifier','amp','pedal','cable') THEN ARRAY['electronics','hardware']
        ELSE ARRAY['hardware','wood'] END) THEN 0 ELSE 1 END,
   CASE WHEN v_rarity IN ('rare','epic','legendary') THEN -quality_tier ELSE quality_tier END,id
  LIMIT v_picks
 LOOP
  INSERT INTO public.player_crafting_materials(profile_id,material_id,quantity)
  VALUES(p_profile_id,v_material.id,v_qty)
  ON CONFLICT(profile_id,material_id)
  DO UPDATE SET quantity=public.player_crafting_materials.quantity+excluded.quantity;
  v_yields:=v_yields||jsonb_build_array(jsonb_build_object(
   'materialId',v_material.id,'quantity',v_qty,'name',v_material.name));
  v_count:=v_count+1;
 END LOOP;
 IF v_count=0 THEN RAISE EXCEPTION 'salvage_no_materials'; END IF;
 RETURN jsonb_build_object('itemName',v_item.name,'yields',v_yields);
END $$;

REVOKE ALL ON FUNCTION public.purchase_crafting_material_atomic(uuid,uuid,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.start_crafting_session_atomic(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.collect_crafting_session_atomic(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.salvage_equipment_atomic(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purchase_crafting_material_atomic(uuid,uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_crafting_session_atomic(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.collect_crafting_session_atomic(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvage_equipment_atomic(uuid,uuid) TO authenticated;

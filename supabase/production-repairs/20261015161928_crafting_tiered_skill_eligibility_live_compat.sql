BEGIN;
CREATE OR REPLACE FUNCTION public.rockmundo_crafting_effective_skill_level(
 p_profile_id uuid,p_skill_slug text
) RETURNS integer LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $f$
DECLARE v_basic integer:=0;v_pro integer:=0;v_master integer:=0;
BEGIN
  IF p_skill_slug='luthiery' THEN
    SELECT greatest(0,least(20,coalesce(max(current_level),0))) INTO v_basic
    FROM public.skill_progress WHERE profile_id=p_profile_id
      AND skill_slug='luthiery_basic_technical';
    IF v_basic>=20 THEN
      SELECT greatest(0,least(20,coalesce(max(current_level),0))) INTO v_pro
      FROM public.skill_progress WHERE profile_id=p_profile_id
        AND skill_slug='luthiery_professional_technical';
    END IF;
    IF v_pro>=20 THEN
      SELECT greatest(0,least(20,coalesce(max(current_level),0))) INTO v_master
      FROM public.skill_progress WHERE profile_id=p_profile_id
        AND skill_slug='luthiery_mastery_technical';
    END IF;
    RETURN v_basic+v_pro+v_master;
  ELSIF p_skill_slug='percussion' THEN
    SELECT greatest(0,least(20,coalesce(max(current_level),0))) INTO v_basic
    FROM public.skill_progress WHERE profile_id=p_profile_id
      AND skill_slug='basic_percussions';
    IF v_basic>=20 THEN
      SELECT greatest(0,least(20,coalesce(max(current_level),0))) INTO v_pro
      FROM public.skill_progress WHERE profile_id=p_profile_id
        AND skill_slug='professional_percussions';
    END IF;
    RETURN v_basic+v_pro;
  END IF;
  SELECT greatest(0,coalesce(max(current_level),0)) INTO v_basic
  FROM public.skill_progress WHERE profile_id=p_profile_id
    AND skill_slug=p_skill_slug;
  RETURN v_basic;
END;
$f$;
REVOKE ALL ON FUNCTION public.rockmundo_crafting_effective_skill_level(uuid,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.start_crafting_session_atomic(p_profile_id uuid, p_recipe_id uuid)
 RETURNS crafting_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 IF coalesce(v_recipe.min_skill_level,0)>0
  AND public.rockmundo_crafting_effective_skill_level(
    p_profile_id,v_recipe.required_skill_slug) < v_recipe.min_skill_level
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
$function$
;
COMMIT;
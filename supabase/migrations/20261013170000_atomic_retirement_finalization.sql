-- Retirement must commit its Hall of Fame record, generation, character reset,
-- and inherited skills in one transaction. A failure rolls all of them back.
CREATE OR REPLACE FUNCTION public.finalize_character_retirement(
 p_profile_id uuid,p_type text,p_stats jsonb,p_skills jsonb,p_attributes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_profile public.profiles%ROWTYPE;v_hof uuid;v_generation integer;
 v_cash bigint;v_inherited jsonb;v_skill record;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE='42501'; END IF;
 IF p_type NOT IN ('voluntary','mandatory') OR jsonb_typeof(p_stats) IS DISTINCT FROM 'object'
 OR jsonb_typeof(p_skills) IS DISTINCT FROM 'object'
 OR jsonb_typeof(p_attributes) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'INVALID_RETIREMENT_INPUT';
 END IF;
 SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid()
 AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_OWNED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(max(generation_number),1) INTO v_generation FROM public.character_generations
 WHERE user_id=auth.uid();
 v_cash:=floor(greatest(coalesce(v_profile.cash,0),0)*0.5);
 SELECT coalesce(jsonb_object_agg(skill_slug,floor(greatest(coalesce(current_level,0),0)*0.1)::integer),'{}'::jsonb)
 INTO v_inherited FROM public.skill_progress WHERE profile_id=p_profile_id;
 INSERT INTO public.hall_of_fame(user_id,character_name,avatar_url,final_age,years_active,
 total_fame,total_cash_earned,total_songs,total_gigs,total_albums,peak_chart_position,
 notable_achievements,final_skills,final_attributes,retirement_type,generation_number)
 VALUES(auth.uid(),coalesce(v_profile.display_name,v_profile.username,'Unknown Artist'),
 v_profile.avatar_url,coalesce(v_profile.age,80),greatest(coalesce(v_profile.age,80)-16,0),
 coalesce(v_profile.fame,0),coalesce(v_profile.cash,0),
 greatest(0,coalesce((p_stats->>'total_songs')::integer,0)),
 greatest(0,coalesce((p_stats->>'total_gigs')::integer,0)),
 greatest(0,coalesce((p_stats->>'total_albums')::integer,0)),
 (p_stats->>'peak_chart_position')::integer,'[]'::jsonb,p_skills,p_attributes,p_type,v_generation)
 RETURNING id INTO v_hof;
 INSERT INTO public.character_generations(user_id,generation_number,parent_character_id,inherited_cash,inherited_skills)
 VALUES(auth.uid(),v_generation+1,v_hof,v_cash,v_inherited);
 UPDATE public.profiles SET display_name=NULL,avatar_url=NULL,bio=NULL,age=16,fame=0,
 cash=v_cash,experience=0,level=1,health=100,energy=100,
 last_retirement_prompt_age=0,character_birth_date=NULL WHERE id=p_profile_id;
 DELETE FROM public.skill_progress WHERE profile_id=p_profile_id;
 FOR v_skill IN SELECT key,value FROM jsonb_each_text(v_inherited) LOOP
  IF v_skill.value::integer>0 THEN
   INSERT INTO public.skill_progress(profile_id,skill_slug,current_level,current_xp,required_xp)
   VALUES(p_profile_id,v_skill.key,v_skill.value::integer,0,100);
  END IF;
 END LOOP;
 RETURN jsonb_build_object('hall_of_fame_id',v_hof,'inherited_cash',v_cash,
 'inherited_skills',v_inherited,'generation_number',v_generation+1);
END $$;
REVOKE ALL ON FUNCTION public.finalize_character_retirement(uuid,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finalize_character_retirement(uuid,text,jsonb,jsonb,jsonb) TO authenticated;

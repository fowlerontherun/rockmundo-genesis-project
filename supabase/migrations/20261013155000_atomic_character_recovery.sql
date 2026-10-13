-- Recover a dead character's account in one transaction.
CREATE OR REPLACE FUNCTION public.create_recovery_character_atomic(
 p_parent_profile_id uuid DEFAULT NULL,p_username text DEFAULT NULL,p_display_name text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user uuid:=auth.uid();v_max integer;v_used integer;v_slot integer;
 v_parent public.profiles%ROWTYPE;v_skills jsonb:='{}'::jsonb;v_cash integer:=10000;
 v_generation integer:=1;v_new uuid;v_name text;v_skill record;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
 -- Serialize all recovery attempts from the same owner across tabs.
 PERFORM 1 FROM auth.users WHERE id=v_user FOR UPDATE;
 SELECT least(5,2+greatest(0,coalesce(extra_slots_purchased,0))) INTO v_max
 FROM public.character_slots WHERE user_id=v_user;
 v_max:=coalesce(v_max,2);
 SELECT count(*) INTO v_used FROM public.profiles
 WHERE user_id=v_user AND deleted_at IS NULL AND died_at IS NULL;
 IF v_used>=v_max THEN RAISE EXCEPTION 'NO_CHARACTER_SLOTS_AVAILABLE';END IF;
 IF p_parent_profile_id IS NULL AND v_used>0 THEN
  RAISE EXCEPTION 'LIVING_CHARACTER_EXISTS';
 END IF;
 IF p_parent_profile_id IS NOT NULL THEN
  SELECT * INTO v_parent FROM public.profiles
  WHERE id=p_parent_profile_id AND user_id=v_user AND died_at IS NOT NULL
  AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_DEAD_PARENT';END IF;
  SELECT coalesce(final_skills,'{}'::jsonb),coalesce(total_cash_at_death,0)
  INTO v_skills,v_cash FROM public.hall_of_immortals
  WHERE profile_id=p_parent_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PARENT_MEMORIAL_REQUIRED_FOR_INHERITANCE'; END IF;
  v_cash:=floor(v_cash*0.5);
  v_generation:=coalesce(v_parent.generation_number,1)+1;
 END IF;
 SELECT coalesce(max(slot_number),0)+1 INTO v_slot FROM public.profiles WHERE user_id=v_user;
 v_name:=coalesce(nullif(btrim(p_username),''),'player-'||left(v_user::text,8)||'-'||v_slot::text);
 INSERT INTO public.profiles(user_id,username,display_name,avatar_url,bio,cash,fame,level,
 health,energy,experience,age,is_active,slot_number,generation_number,parent_profile_id)
 VALUES(v_user,v_name,nullif(btrim(p_display_name),''),NULL,NULL,v_cash,0,1,
 100,100,0,16,false,v_slot,v_generation,p_parent_profile_id)
 RETURNING id INTO v_new;
 IF p_parent_profile_id IS NOT NULL THEN
  INSERT INTO public.skill_progress(profile_id,skill_slug,current_level,current_xp,required_xp)
  SELECT v_new,key,floor((value::numeric)*0.1)::integer,0,100
  FROM jsonb_each_text(v_skills) WHERE value ~ '^[0-9]+
  AND floor((value::numeric)*0.1)>0;
 END IF;
 UPDATE public.profiles SET is_active=false WHERE user_id=v_user AND id<>v_new AND is_active;
 UPDATE public.profiles SET is_active=true WHERE id=v_new;
 RETURN v_new;
END $$;
REVOKE ALL ON FUNCTION public.create_recovery_character_atomic(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_recovery_character_atomic(uuid,text,text) TO authenticated;

  AND floor((value::numeric)*0.1)>0;
 END IF;
 UPDATE public.profiles SET is_active=false WHERE user_id=v_user AND id<>v_new AND is_active;
 UPDATE public.profiles SET is_active=true WHERE id=v_new;
 RETURN v_new;
END $$;
REVOKE ALL ON FUNCTION public.create_recovery_character_atomic(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_recovery_character_atomic(uuid,text,text) TO authenticated;

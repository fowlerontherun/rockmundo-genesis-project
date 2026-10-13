-- Restrict player resurrection to a genuine inactivity coma, never to a
-- permanently dead or deleted character. Preserve the existing life balance.
CREATE OR REPLACE FUNCTION public.resurrect_character(p_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_profile public.profiles%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_profile FROM public.profiles
 WHERE id=p_profile_id FOR UPDATE;
 IF NOT FOUND OR v_profile.user_id IS DISTINCT FROM auth.uid() THEN
   RAISE EXCEPTION 'Profile not found or not owned by caller' USING ERRCODE='42501';
 END IF;
 IF v_profile.deleted_at IS NOT NULL THEN
   RAISE EXCEPTION 'Deleted characters cannot be resurrected';
 END IF;
 IF v_profile.died_at IS NULL THEN
   RAISE EXCEPTION 'Character is already alive';
 END IF;
 IF v_profile.coma_started_at IS NULL OR NOT (
   coalesce(v_profile.death_cause,'') ILIKE '%inactivity%'
   OR v_profile.death_cause='neglect'
 ) THEN
   RAISE EXCEPTION 'Only characters in an inactivity coma can be revived';
 END IF;
 IF coalesce(v_profile.resurrection_lives,0)<=0 THEN
   RAISE EXCEPTION 'No resurrection lives remaining';
 END IF;
 UPDATE public.profiles SET is_active=false,updated_at=now()
 WHERE user_id=v_profile.user_id AND id<>p_profile_id AND is_active=true;
 INSERT INTO public.character_coma_events(
   profile_id,user_id,event_type,cause,source,coma_started_at,
   account_last_activity_at,actor_id,metadata)
 VALUES(p_profile_id,v_profile.user_id,'revived',v_profile.death_cause,
   'player_revival',v_profile.coma_started_at,
   v_profile.coma_last_account_activity_at,auth.uid(),
   jsonb_build_object('health_restored',100,'energy_restored',100));
 UPDATE public.profiles SET died_at=NULL,death_cause=NULL,is_active=true,
   health=100,energy=100,rest_required_until=NULL,
   resurrection_lives=greatest(coalesce(resurrection_lives,0)-1,0),
   last_login_at=now(),coma_started_at=NULL,
   coma_last_account_activity_at=NULL,updated_at=now()
 WHERE id=p_profile_id;
 DELETE FROM public.hall_of_immortals WHERE profile_id=p_profile_id;
END $$;
REVOKE ALL ON FUNCTION public.resurrect_character(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resurrect_character(uuid) TO authenticated;

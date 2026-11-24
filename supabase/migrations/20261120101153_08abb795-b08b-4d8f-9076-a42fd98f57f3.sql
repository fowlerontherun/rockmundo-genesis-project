CREATE OR REPLACE FUNCTION public.social_active_room_access(p_room text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_profile uuid := public.current_profile_id(); v_kind text; v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR v_profile IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=v_profile AND user_id=auth.uid() AND died_at IS NULL) THEN RETURN false; END IF;
 IF p_room !~ '^(city|club|scene):[0-9a-f-]{36}$' THEN RETURN false; END IF;
 v_kind:=split_part(p_room,':',1);
 BEGIN v_id:=split_part(p_room,':',2)::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
 IF v_kind='city' THEN RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id=v_profile AND current_city_id=v_id);
 ELSIF v_kind='club' THEN RETURN EXISTS (SELECT 1 FROM public.club_presence WHERE profile_id=v_profile AND club_id=v_id AND (expires_at IS NULL OR expires_at>now()));
 ELSE RETURN EXISTS (SELECT 1 FROM public.roleplay_scene_members WHERE profile_id=v_profile AND scene_id=v_id); END IF;
END $$;
REVOKE ALL ON FUNCTION public.social_active_room_access(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.social_active_room_access(text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.guard_social_room_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid;
BEGIN
 v_actor:=CASE WHEN TG_TABLE_NAME='social_interactions' THEN NEW.actor_profile_id ELSE NEW.profile_id END;
 IF auth.uid() IS NOT NULL THEN
  IF v_actor IS DISTINCT FROM public.current_profile_id() THEN RAISE EXCEPTION 'character_not_owned'; END IF;
  IF TG_TABLE_NAME='social_room_messages' AND NOT public.social_active_room_access(NEW.room_key) THEN RAISE EXCEPTION 'not_in_room'; END IF;
  IF TG_TABLE_NAME='social_interactions' AND NEW.room_key IS NOT NULL AND NOT public.social_active_room_access(NEW.room_key) THEN RAISE EXCEPTION 'not_in_room'; END IF;
 END IF;
 IF NEW.room_key LIKE 'scene:%' THEN
  PERFORM 1 FROM public.roleplay_scenes WHERE id=split_part(NEW.room_key,':',2)::uuid AND status='open' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'scene_ended'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_social_room_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_social_room_write BEFORE INSERT ON public.social_room_messages FOR EACH ROW EXECUTE FUNCTION public.guard_social_room_write();
CREATE TRIGGER guard_social_interaction_room BEFORE INSERT ON public.social_interactions FOR EACH ROW EXECUTE FUNCTION public.guard_social_room_write();
ALTER POLICY room_messages_read ON public.social_room_messages USING (
 (room_key LIKE 'scene:%' OR created_at>now()-interval '24 hours')
 AND public.social_active_room_access(room_key)
 AND NOT EXISTS (SELECT 1 FROM public.player_blocks b WHERE b.removed_at IS NULL AND b.blocker_id=public.current_profile_id() AND b.blocked_id=social_room_messages.profile_id)
);
ALTER POLICY scenes_member_read ON public.roleplay_scenes USING (public.social_active_room_access('scene:'||id));
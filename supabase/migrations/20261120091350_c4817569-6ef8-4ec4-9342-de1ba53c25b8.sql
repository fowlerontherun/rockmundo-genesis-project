ALTER FUNCTION public._my_profile_ids() SET SCHEMA private;
ALTER FUNCTION public._is_scene_member(uuid) SET SCHEMA private;
ALTER FUNCTION public.can_access_social_room(text) SET SCHEMA private;
ALTER FUNCTION public._assert_owned_active_profile(uuid) SET SCHEMA private;
ALTER FUNCTION public.post_social_room_message(uuid,text,text,text) SET SCHEMA private;
ALTER FUNCTION public.report_social_room_message(uuid,uuid,text) SET SCHEMA private;
ALTER FUNCTION public.create_roleplay_scene(uuid,text,text,uuid[]) SET SCHEMA private;
ALTER FUNCTION public.end_roleplay_scene(uuid,uuid) SET SCHEMA private;
ALTER FUNCTION public.perform_social_interaction(uuid,uuid,text,text) SET SCHEMA private;

DO $$
DECLARE r record; v_def text;
BEGIN
 FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='private' AND p.proname IN ('_is_scene_member','can_access_social_room','post_social_room_message','report_social_room_message','create_roleplay_scene','end_roleplay_scene','perform_social_interaction')
 LOOP
  v_def := pg_get_functiondef(r.oid);
  v_def := replace(v_def,'public._is_scene_member','private._is_scene_member');
  v_def := replace(v_def,'public.can_access_social_room','private.can_access_social_room');
  v_def := replace(v_def,'public._assert_owned_active_profile','private._assert_owned_active_profile');
  v_def := replace(v_def,'public._my_profile_ids','private._my_profile_ids');
  EXECUTE v_def;
 END LOOP;
END $$;

REVOKE ALL ON FUNCTION private._assert_owned_active_profile(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private._my_profile_ids(), private._is_scene_member(uuid), private.can_access_social_room(text),
 private.post_social_room_message(uuid,text,text,text), private.report_social_room_message(uuid,uuid,text),
 private.create_roleplay_scene(uuid,text,text,uuid[]), private.end_roleplay_scene(uuid,uuid),
 private.perform_social_interaction(uuid,uuid,text,text) TO authenticated;

CREATE FUNCTION public.post_social_room_message(p_profile uuid, p_room text, p_kind text, p_body text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$ SELECT private.post_social_room_message(p_profile,p_room,p_kind,p_body) $$;
CREATE FUNCTION public.report_social_room_message(p_profile uuid, p_message uuid, p_reason text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$ SELECT private.report_social_room_message(p_profile,p_message,p_reason) $$;
CREATE FUNCTION public.create_roleplay_scene(p_profile uuid, p_title text, p_setting text, p_invitees uuid[]) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$ SELECT private.create_roleplay_scene(p_profile,p_title,p_setting,p_invitees) $$;
CREATE FUNCTION public.end_roleplay_scene(p_profile uuid, p_scene uuid) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$ SELECT private.end_roleplay_scene(p_profile,p_scene) $$;
CREATE FUNCTION public.perform_social_interaction(p_actor uuid, p_target uuid, p_kind text, p_room text DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$ SELECT private.perform_social_interaction(p_actor,p_target,p_kind,p_room) $$;
REVOKE ALL ON FUNCTION public.post_social_room_message(uuid,text,text,text), public.report_social_room_message(uuid,uuid,text),
 public.create_roleplay_scene(uuid,text,text,uuid[]), public.end_roleplay_scene(uuid,uuid), public.perform_social_interaction(uuid,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_social_room_message(uuid,text,text,text), public.report_social_room_message(uuid,uuid,text),
 public.create_roleplay_scene(uuid,text,text,uuid[]), public.end_roleplay_scene(uuid,uuid), public.perform_social_interaction(uuid,uuid,text,text) TO authenticated;
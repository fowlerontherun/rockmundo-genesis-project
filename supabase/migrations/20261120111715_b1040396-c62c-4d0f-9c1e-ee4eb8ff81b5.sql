CREATE OR REPLACE FUNCTION public.rockmundo_can_view_social_profile(p_viewer uuid, p_target uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT EXISTS(
   SELECT 1 FROM public.profiles p
   LEFT JOIN public.player_profiles social ON social.profile_id=p.id
   LEFT JOIN public.profile_privacy_settings privacy ON privacy.profile_id=p.id
   WHERE p.id=p_target AND p.deleted_at IS NULL AND p.died_at IS NULL
   AND (
     (p.user_id=auth.uid() AND auth.uid() IS NOT NULL)
      OR (NOT public._social_blocked(p_viewer,p.id)
          AND coalesce(social.visibility::text, privacy.profile_visibility::text, 'public') <> 'private'
          AND coalesce(privacy.profile_visibility::text,'public') <> 'private')
   )
 );
$function$;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_profile_id uuid, p_category text, p_type text, p_title text, p_message text, p_action_path text, p_metadata jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_id uuid; v_key text; v_user uuid:=p_user_id; v_owner uuid;
  v_metadata jsonb:=coalesce(p_metadata,'{}'::jsonb);
  v_trusted boolean:= coalesce(current_setting('request.jwt.claim.role',true),'')='service_role' OR pg_trigger_depth()>0;
BEGIN
  IF v_user IS NULL THEN RETURN NULL; END IF;
  IF NOT v_trusted AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM v_user) THEN
    RAISE EXCEPTION 'NOTIFICATION_RECIPIENT_NOT_AUTHORISED' USING ERRCODE='42501';
  END IF;
  IF p_profile_id IS NOT NULL THEN
    SELECT p.user_id INTO v_owner FROM public.profiles p WHERE p.id=p_profile_id AND p.deleted_at IS NULL;
    IF v_owner IS DISTINCT FROM v_user THEN
      -- Trusted trigger paths with stale account ids: deliver to the character owner, or skip silently.
      IF v_trusted THEN
        IF v_owner IS NULL THEN RETURN NULL; END IF;
        v_user:=v_owner;
      ELSE
        RAISE EXCEPTION 'NOTIFICATION_PROFILE_NOT_AUTHORISED' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  IF jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'NOTIFICATION_METADATA_INVALID' USING ERRCODE='22023';
  END IF;
  v_key:=nullif(v_metadata->>'event_key','');
  IF v_key IS NOT NULL AND (length(v_key)>190 OR (NOT v_trusted AND v_key LIKE 'server:%')) THEN
    RAISE EXCEPTION 'NOTIFICATION_EVENT_KEY_INVALID' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata)
  VALUES(v_user,p_profile_id,coalesce(p_category,'system'),coalesce(p_type,'info'),
    left(coalesce(p_title,''),240),left(coalesce(p_message,''),2000),p_action_path,v_metadata)
  ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL AND v_key IS NOT NULL THEN
    SELECT n.id INTO v_id FROM public.notifications n
     WHERE n.user_id=v_user AND n.profile_id IS NOT DISTINCT FROM p_profile_id AND n.metadata->>'event_key'=v_key LIMIT 1;
  END IF;
  RETURN v_id;
END
$function$;
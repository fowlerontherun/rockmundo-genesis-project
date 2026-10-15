-- Opt-in-only friend suggestions: results come solely from owners who
-- explicitly publish their new private-by-default social profile.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_safe_friend_suggestions(
 p_profile_id uuid,p_limit integer DEFAULT 6
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $rm$
DECLARE v_user uuid:=auth.uid();v_result jsonb;
BEGIN
 IF v_user IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id=p_profile_id
    AND p.user_id=v_user AND p.deleted_at IS NULL AND p.died_at IS NULL
 ) THEN RAISE EXCEPTION 'FRIEND_SUGGESTIONS_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'username',c.username,'display_name',c.display_name,
    'avatar_url',c.avatar_url,'city_name',c.city_name)
    ORDER BY c.created_at DESC,c.id DESC),'[]'::jsonb)
 INTO v_result
 FROM (
   SELECT p.id,p.username,p.display_name,p.avatar_url,p.created_at,
     CASE WHEN social.show_city THEN p.city_name ELSE NULL END AS city_name
   FROM public.profiles p
   JOIN public.player_profiles social ON social.profile_id=p.id
   LEFT JOIN public.profile_privacy_settings privacy ON privacy.profile_id=p.id
   WHERE p.id<>p_profile_id AND p.user_id<>v_user
     AND p.deleted_at IS NULL AND p.died_at IS NULL AND p.is_active IS TRUE
     AND social.visibility='public'::public.profile_visibility_scope
     AND (privacy.profile_id IS NULL OR privacy.profile_visibility='public'::public.profile_visibility_scope)
     AND NOT public._social_blocked(p_profile_id,p.id)
     AND NOT EXISTS (
       SELECT 1 FROM public.friendships f
       WHERE f.status IN ('accepted','pending')
         AND ((f.requestor_id=p_profile_id AND f.addressee_id=p.id)
           OR (f.requestor_id=p.id AND f.addressee_id=p_profile_id)))
   ORDER BY p.created_at DESC,p.id DESC
   LIMIT least(greatest(coalesce(p_limit,6),1),20)
 ) c;
 RETURN v_result;
END;
$rm$;
REVOKE ALL ON FUNCTION public.get_safe_friend_suggestions(uuid,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_safe_friend_suggestions(uuid,integer)
 TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
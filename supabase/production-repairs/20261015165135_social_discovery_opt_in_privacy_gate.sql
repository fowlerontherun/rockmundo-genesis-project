BEGIN;
CREATE OR REPLACE FUNCTION public.rockmundo_authorized_social_viewer(p_viewer_profile_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_id uuid:=coalesce(p_viewer_profile_id,public.current_profile_id());
BEGIN
 IF auth.uid() IS NULL OR v_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profiles p WHERE p.id=v_id AND p.user_id=auth.uid()
  AND p.died_at IS NULL AND p.deleted_at IS NULL)
 THEN RAISE EXCEPTION 'SOCIAL_VIEWER_NOT_AUTHORIZED' USING ERRCODE='42501';END IF;
 RETURN v_id;
END;
$f$;

CREATE OR REPLACE FUNCTION public.rockmundo_can_view_social_profile(
 p_viewer uuid,p_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $f$
 SELECT EXISTS(
   SELECT 1 FROM public.profiles p
   LEFT JOIN public.player_profiles social ON social.profile_id=p.id
   LEFT JOIN public.profile_privacy_settings privacy ON privacy.profile_id=p.id
   WHERE p.id=p_target AND p.deleted_at IS NULL AND p.died_at IS NULL
   AND (
     (p.user_id=auth.uid() AND auth.uid() IS NOT NULL)
      OR (p.is_active IS TRUE
          AND social.visibility='public'::public.profile_visibility_scope
          AND (privacy.profile_id IS NULL
            OR privacy.profile_visibility='public'::public.profile_visibility_scope)
          AND NOT public._social_blocked(p_viewer,p.id))
   )
 );
$f$;
CREATE OR REPLACE FUNCTION public.get_public_profile_detail(
 target_profile_id uuid,viewer_profile_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_viewer uuid;v_target public.profiles%ROWTYPE;v_social public.player_profiles%ROWTYPE;
 v_owner boolean;v_city text;v_bands jsonb:='[]'::jsonb;
BEGIN
 v_viewer:=public.rockmundo_authorized_social_viewer(viewer_profile_id);
 IF NOT public.rockmundo_can_view_social_profile(v_viewer,target_profile_id)
 THEN RAISE EXCEPTION 'PROFILE_NOT_PUBLIC' USING ERRCODE='42501';END IF;
 SELECT * INTO v_target FROM public.profiles WHERE id=target_profile_id;
 v_owner:=v_target.user_id=auth.uid();
 SELECT * INTO v_social FROM public.player_profiles WHERE profile_id=target_profile_id;
 IF v_owner OR coalesce(v_social.show_city,false) THEN
 SELECT c.name::text INTO v_city FROM public.cities c WHERE c.id=v_target.current_city_id;
 END IF;
 IF v_owner OR coalesce(v_social.show_career_history,false) THEN
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,
  'genre',coalesce(b.primary_genre,b.genre),'fame',coalesce(b.fame,0),
  'chemistry_level',coalesce(b.chemistry_level,0),
  'role',bm.role,'instrument_role',bm.instrument_role,'vocal_role',bm.vocal_role,
  'joined_at',bm.joined_at) ORDER BY bm.joined_at NULLS LAST),'[]'::jsonb)
 INTO v_bands FROM public.band_members bm JOIN public.bands b ON b.id=bm.band_id
 WHERE bm.profile_id=target_profile_id;
 END IF;
 RETURN jsonb_build_object(
  'profile_id',v_target.id,'user_id',v_target.user_id,'username',v_target.username,
  'display_name',v_target.display_name,'avatar_url',v_target.avatar_url,
  'bio',CASE WHEN v_owner OR coalesce(v_social.show_activity,false) THEN v_target.bio ELSE NULL END,
  'fame',coalesce(v_target.fame,0),'fans',coalesce(v_target.fans,0),
  'level',coalesce(v_target.level,1),'city_name',v_city,
  'created_at',v_target.created_at,'bands',v_bands,
  'social_profile',CASE WHEN v_social.profile_id IS NULL THEN NULL ELSE
    jsonb_build_object('biography',v_social.biography,
    'status_message',v_social.status_message,
    'preferred_genres',v_social.preferred_genres,'preferred_roles',v_social.preferred_roles,
    'primary_instrument',CASE WHEN v_owner OR v_social.show_skills THEN v_social.primary_instrument ELSE NULL END,
    'secondary_instruments',CASE WHEN v_owner OR v_social.show_skills THEN v_social.secondary_instruments ELSE '{}'::text[] END,
    'show_skills',v_owner OR v_social.show_skills) END,
  'badges','[]'::jsonb,'public_activity','[]'::jsonb,
  'career_summary',CASE WHEN v_owner OR coalesce(v_social.show_career_history,false)
    THEN jsonb_build_object('level',coalesce(v_target.level,1),
         'fame',coalesce(v_target.fame,0),'fans',coalesce(v_target.fans,0)) ELSE NULL END);
END;
$f$;
CREATE OR REPLACE FUNCTION public.search_public_profiles(
 search_term text,viewer_profile_id uuid DEFAULT NULL,result_limit integer DEFAULT 20)
RETURNS TABLE(profile_id uuid,user_id uuid,username text,display_name text,avatar_url text,
 bio text,fame integer,fans integer,level integer,city_name text,bands jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_viewer uuid;
BEGIN
 v_viewer:=public.rockmundo_authorized_social_viewer(viewer_profile_id);
 RETURN QUERY SELECT p.id,p.user_id,p.username::text,p.display_name::text,p.avatar_url,
  CASE WHEN p.user_id=auth.uid() OR coalesce(social.show_activity,false) THEN p.bio ELSE NULL END,
  coalesce(p.fame,0),coalesce(p.fans,0),coalesce(p.level,1),
  CASE WHEN p.user_id=auth.uid() OR coalesce(social.show_city,false) THEN c.name::text ELSE NULL END,
  CASE WHEN p.user_id=auth.uid() OR coalesce(social.show_career_history,false)
   THEN coalesce((SELECT jsonb_agg(jsonb_build_object('name',b.name,
     'genre',coalesce(b.primary_genre,b.genre)) ORDER BY b.name)
     FROM public.band_members bm JOIN public.bands b ON b.id=bm.band_id
     WHERE bm.profile_id=p.id AND coalesce(bm.member_status,'active')='active'),'[]'::jsonb)
   ELSE '[]'::jsonb END
 FROM public.profiles p LEFT JOIN public.player_profiles social ON social.profile_id=p.id
 LEFT JOIN public.cities c ON c.id=p.current_city_id
 WHERE p.id<>v_viewer AND public.rockmundo_can_view_social_profile(v_viewer,p.id)
 AND (nullif(btrim(search_term),'') IS NULL OR
   p.username ILIKE '%'||left(btrim(search_term),100)||'%'
   OR coalesce(p.display_name,'') ILIKE '%'||left(btrim(search_term),100)||'%')
 ORDER BY CASE WHEN p.user_id=auth.uid() THEN 0 ELSE 1 END,
 coalesce(p.fame,0) DESC,p.username,p.id
 LIMIT greatest(1,least(coalesce(result_limit,20),50));
END;
$f$;
CREATE OR REPLACE FUNCTION public.search_player_discovery(query jsonb, viewer_profile_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_search text := coalesce(nullif(btrim(query->>'search'), ''), NULL);
  v_page integer := greatest(1, coalesce((query->>'page')::int, 1));
  v_page_size integer := least(48, greatest(1, coalesce((query->>'pageSize')::int, 18)));
  v_sort text := coalesce(query->>'sort', 'recently-active');
  v_filters jsonb := coalesce(query->'filters', '{}'::jsonb);
  v_city text := nullif(v_filters->>'city', '');
  v_genre text := nullif(v_filters->>'genre', '');
  v_fame_min integer := coalesce((v_filters->>'fameMin')::int, 0);
  v_rows jsonb;
  v_count integer;
  v_viewer uuid;
BEGIN
  v_viewer := public.rockmundo_authorized_social_viewer(viewer_profile_id);
  WITH base AS (
    SELECT p.id, p.user_id, p.username, p.display_name, p.avatar_url, CASE WHEN p.user_id=auth.uid() OR coalesce(social.show_activity,false) THEN p.bio ELSE NULL END AS bio,
           coalesce(p.fame, 0) AS fame, coalesce(p.level, 1) AS level, CASE WHEN p.user_id=auth.uid() OR coalesce(social.show_online_status,false)
             THEN p.last_login_at ELSE NULL END AS last_login_at,
           CASE WHEN p.user_id=auth.uid() OR coalesce(social.show_city,false)
             THEN c.name ELSE NULL END AS city_name,
           (SELECT b.name FROM public.band_members bm JOIN public.bands b ON b.id = bm.band_id
             WHERE bm.profile_id = p.id AND coalesce(bm.member_status,'active') = 'active'
             AND (p.user_id=auth.uid() OR coalesce(social.show_career_history,false))
             ORDER BY bm.joined_at NULLS LAST LIMIT 1) AS current_band,
           (SELECT bm.instrument_role FROM public.band_members bm
             WHERE bm.profile_id = p.id AND (p.user_id=auth.uid() OR coalesce(social.show_skills,false)) ORDER BY bm.joined_at NULLS LAST LIMIT 1) AS primary_instrument,
           (SELECT bm.role FROM public.band_members bm
             WHERE bm.profile_id = p.id AND (p.user_id=auth.uid() OR coalesce(social.show_skills,false)) ORDER BY bm.joined_at NULLS LAST LIMIT 1) AS primary_role
      FROM public.profiles p
      LEFT JOIN public.cities c ON c.id = p.current_city_id
      LEFT JOIN public.player_profiles social ON social.profile_id=p.id
     WHERE p.deleted_at IS NULL
       AND public.rockmundo_can_view_social_profile(v_viewer,p.id)
       AND p.died_at IS NULL
       AND p.id <> v_viewer
       AND (p.user_id = auth.uid() OR coalesce(p.is_active, true))
       AND (p.user_id = auth.uid() OR NOT public._social_blocked(v_viewer, p.id))
       AND (v_search IS NULL OR p.username ILIKE '%'||v_search||'%' OR coalesce(p.display_name,'') ILIKE '%'||v_search||'%')
       AND (v_city IS NULL OR (p.user_id=auth.uid() OR coalesce(social.show_city,false)) AND c.name=v_city)
       AND coalesce(p.fame, 0) >= v_fame_min
       AND (v_genre IS NULL OR EXISTS (
             SELECT 1 FROM public.band_members bm JOIN public.bands b ON b.id = bm.band_id
              WHERE bm.profile_id = p.id AND coalesce(b.primary_genre, b.genre) = v_genre))
  ), counted AS (
    SELECT count(*)::int AS total FROM base
  ), ordered AS (
    SELECT * FROM base
     ORDER BY
       CASE WHEN user_id = auth.uid() THEN 0 ELSE 1 END,
       CASE WHEN v_sort = 'highest-fame' THEN fame END DESC NULLS LAST,
       CASE WHEN v_sort = 'career-level' THEN level END DESC NULLS LAST,
       CASE WHEN v_sort = 'name' THEN username END ASC NULLS LAST,
       last_login_at DESC NULLS LAST,
       fame DESC
     LIMIT v_page_size OFFSET (v_page - 1) * v_page_size
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'profile_id', o.id,
           'user_id', o.user_id,
           'character_name', coalesce(o.display_name, o.username),
           'avatar_url', o.avatar_url,
           'city_name', o.city_name,
           'activity_state', CASE
              WHEN o.last_login_at > now() - interval '15 minutes' THEN 'online'
              WHEN o.last_login_at > now() - interval '1 day' THEN 'today'
              WHEN o.last_login_at > now() - interval '14 days' THEN 'recent'
              ELSE 'inactive' END,
           'current_band', o.current_band,
           'primary_role', o.primary_role,
           'primary_instrument', o.primary_instrument,
           'preferred_genres', '[]'::jsonb,
           'fame', o.fame,
           'career_level', 'Level ' || o.level,
           'availability', '[]'::jsonb,
           'status_message', o.bio,
           'badges', '[]'::jsonb,
           'match', jsonb_build_object('percentage', 50, 'category', 'Potential match', 'reasons', '[]'::jsonb)
         )), '[]'::jsonb),
         (SELECT total FROM counted)
    INTO v_rows, v_count
    FROM ordered o;

  RETURN jsonb_build_object(
    'results', v_rows,
    'page', v_page,
    'page_size', v_page_size,
    'has_more', (v_page * v_page_size) < coalesce(v_count, 0),
    'approximate_total', coalesce(v_count, 0)
  );
END $function$
;
REVOKE ALL ON FUNCTION public.rockmundo_authorized_social_viewer(uuid),public.rockmundo_can_view_social_profile(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_public_profile_detail(uuid,uuid),public.search_public_profiles(text,uuid,integer),public.search_player_discovery(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_detail(uuid,uuid),public.search_public_profiles(text,uuid,integer),public.search_player_discovery(jsonb,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
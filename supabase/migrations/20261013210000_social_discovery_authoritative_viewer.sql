-- Correction for public profile detail and all discovery surfaces.
-- Precondition: 20260713120000_player_profiles_social_identity.sql
-- and 20261013195000_public_profile_visibility_and_badges.sql.
-- Runtime is intentionally fail closed for missing or private profile settings.
DO $preflight$
BEGIN
 IF to_regclass('public.player_profiles') IS NULL
 OR to_regclass('public.profile_badges') IS NULL THEN
  RAISE EXCEPTION 'SOCIAL_DISCOVERY_PRIVACY_DEPENDENCIES_MISSING';
 END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.resolve_authorized_social_viewer(
 p_viewer_profile_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_viewer uuid;
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Social profiles require sign-in' USING ERRCODE='42501';
 END IF;
 IF p_viewer_profile_id IS NOT NULL THEN
   -- A user can own more than one character. Accept their explicitly
   -- selected living character, but never someone else's ID.
   SELECT p.id INTO v_viewer FROM public.profiles p
   WHERE p.id=p_viewer_profile_id AND p.user_id=auth.uid()
     AND p.deleted_at IS NULL AND p.died_at IS NULL;
 ELSE
   v_viewer:=public._caller_profile_id();
 END IF;
 IF v_viewer IS NULL THEN
   RAISE EXCEPTION 'Viewer character not authorised' USING ERRCODE='42501';
 END IF;
 RETURN v_viewer;
END $$;
REVOKE ALL ON FUNCTION public.resolve_authorized_social_viewer(uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_authorized_social_viewer(uuid)
 TO authenticated;

-- Reapply the character-safe public-detail projection, this time accepting
-- *only* an owned requested character rather than the caller's oldest one.
CREATE OR REPLACE FUNCTION public.get_public_profile_detail(
  target_profile_id uuid, viewer_profile_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_viewer uuid;
  v_target public.profiles%ROWTYPE;
  v_settings public.player_profiles%ROWTYPE;
  v_city text;
  v_owner boolean;
BEGIN
  -- Do not let the caller choose a different viewer to bypass social blocks.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to view player profiles' USING ERRCODE='42501';
  END IF;
  v_viewer := public.resolve_authorized_social_viewer(viewer_profile_id);

  SELECT * INTO v_target FROM public.profiles
  WHERE id=target_profile_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player profile not found' USING ERRCODE='P0002'; END IF;
  v_owner := v_target.user_id=auth.uid();
  IF public._social_blocked(v_viewer,target_profile_id) THEN
    RAISE EXCEPTION 'This player profile is not available to this account' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_settings FROM public.player_profiles WHERE profile_id=target_profile_id;
  -- A character with no social sharing preferences has not consented to a
  -- publicly discoverable detailed profile. The owner can still preview it.
  IF NOT v_owner AND v_settings.profile_id IS NULL THEN
    RAISE EXCEPTION 'This player profile has not been published' USING ERRCODE='42501';
  END IF;
  -- Private, friends and band-only scopes require dedicated authenticated
  -- relationship proofs. Never treat them as public just because the caller
  -- supplies a profile ID.
  IF NOT v_owner AND v_settings.profile_id IS NOT NULL
     AND v_settings.visibility::text IS DISTINCT FROM 'public' THEN
    RAISE EXCEPTION 'This player profile is not public' USING ERRCODE='42501';
  END IF;

  IF v_owner OR coalesce(v_settings.show_city,true) THEN
    SELECT c.name::text INTO v_city
    FROM public.cities c WHERE c.id=v_target.current_city_id;
  END IF;

  RETURN jsonb_build_object(
    'profile_id',v_target.id,
    'user_id',v_target.user_id,
    'username',v_target.username,
    'display_name',v_target.display_name,
    'avatar_url',v_target.avatar_url,
    'bio',v_target.bio,
    'fame',coalesce(v_target.fame,0),
    'fans',coalesce(v_target.fans,0),
    'level',coalesce(v_target.level,1),
    'city_name',v_city,
    'created_at',v_target.created_at,
    'bands',CASE WHEN v_owner OR coalesce(v_settings.show_career_history,true)
      THEN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id',b.id,'name',b.name,'genre',coalesce(b.primary_genre,b.genre),
          'fame',coalesce(b.fame,0),'chemistry_level',coalesce(b.chemistry_level,0),
          'role',bm.role,'instrument_role',bm.instrument_role,'vocal_role',bm.vocal_role,
          'joined_at',bm.joined_at) ORDER BY bm.joined_at NULLS LAST)
        FROM public.band_members bm
        JOIN public.bands b ON b.id=bm.band_id
        WHERE bm.profile_id=target_profile_id
      ),'[]'::jsonb) ELSE '[]'::jsonb END,
    'social_profile',CASE WHEN v_settings.profile_id IS NULL THEN NULL ELSE
      jsonb_build_object(
        'biography',v_settings.biography,
        'status_message',v_settings.status_message,
        'preferred_genres',v_settings.preferred_genres,
        'preferred_roles',v_settings.preferred_roles,
        'looking_for_band',v_settings.looking_for_band,
        'looking_for_members',v_settings.looking_for_members,
        'available_for_session_work',v_settings.available_for_session_work,
        'available_for_collaboration',v_settings.available_for_collaboration,
        'available_for_gigs',v_settings.available_for_gigs,
        'available_for_employment',v_settings.available_for_employment,
        'available_for_teaching',v_settings.available_for_teaching,
        'available_for_social',v_settings.available_for_social,
        'primary_instrument',CASE WHEN v_owner OR v_settings.show_skills
          THEN v_settings.primary_instrument ELSE NULL END,
        'secondary_instruments',CASE WHEN v_owner OR v_settings.show_skills
          THEN v_settings.secondary_instruments ELSE '{}'::text[] END,
        'vocal_capability',CASE WHEN v_owner OR v_settings.show_skills
          THEN v_settings.vocal_capability ELSE NULL END,
        'songwriting_specialisms',CASE WHEN v_owner OR v_settings.show_skills
          THEN v_settings.songwriting_specialisms ELSE '{}'::text[] END,
        'show_skills',v_owner OR v_settings.show_skills)
      END,
    'badges',CASE WHEN v_owner OR coalesce(v_settings.show_achievements,true)
      THEN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'badge_key',b.badge_key,'label',b.label,'description',b.description,
          'awarded_at',b.awarded_at) ORDER BY b.awarded_at DESC)
        FROM (
          SELECT DISTINCT ON (all_badges.badge_key) all_badges.*
          FROM (
            SELECT pb.badge_key,pb.label,pb.description,pb.awarded_at,0 AS priority
            FROM public.player_profile_badges pb WHERE pb.profile_id=target_profile_id
            UNION ALL
            SELECT cb.badge_key,coalesce(a.name,cb.badge_key),
              a.description,cb.earned_at,1 AS priority
            FROM public.profile_badges cb
            LEFT JOIN public.achievements a ON a.id=cb.achievement_id
            WHERE cb.profile_id=target_profile_id
          ) all_badges
          ORDER BY all_badges.badge_key,all_badges.priority,all_badges.awarded_at DESC
        ) b
      ),'[]'::jsonb) ELSE '[]'::jsonb END,
    'public_activity',CASE WHEN v_owner OR coalesce(v_settings.show_activity,true)
      THEN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id',a.id,'activity_type',a.activity_type,'summary',a.summary,
          'occurred_at',a.occurred_at) ORDER BY a.occurred_at DESC)
        FROM (
          SELECT id,activity_type,summary,occurred_at FROM public.player_profile_activity
          WHERE profile_id=target_profile_id AND (is_public OR v_owner)
          ORDER BY occurred_at DESC LIMIT 5
        ) a
      ),'[]'::jsonb) ELSE '[]'::jsonb END,
    'career_summary',CASE WHEN v_owner OR coalesce(v_settings.show_career_history,true)
      THEN jsonb_build_object(
        'level',coalesce(v_target.level,1),
        'fame',coalesce(v_target.fame,0),
        'fans',coalesce(v_target.fans,0),
        'bands_joined',(SELECT count(DISTINCT bm.band_id)
          FROM public.band_members bm WHERE bm.profile_id=target_profile_id),
        'milestones',coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'milestone_type',m.milestone_type,
            'summary',m.summary,'achieved_at',m.achieved_at)
            ORDER BY m.achieved_at DESC)
          FROM (SELECT milestone_type,summary,achieved_at
            FROM public.player_career_milestones
            WHERE profile_id=target_profile_id AND (is_public OR v_owner)
            ORDER BY achieved_at DESC LIMIT 5) m
        ),'[]'::jsonb))
      ELSE NULL END
  );
END $$;
REVOKE ALL ON FUNCTION public.get_public_profile_detail(uuid,uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile_detail(uuid,uuid)
 TO authenticated;

-- Legacy search used by older player browser surfaces.
CREATE OR REPLACE FUNCTION public.search_public_profiles(
 search_term text,viewer_profile_id uuid DEFAULT NULL,result_limit integer DEFAULT 20)
RETURNS TABLE(
 profile_id uuid,user_id uuid,username text,display_name text,avatar_url text,
 bio text,fame integer,fans integer,level integer,city_name text,bands jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_viewer uuid;
BEGIN
 v_viewer:=public.resolve_authorized_social_viewer(viewer_profile_id);
 RETURN QUERY
 SELECT p.id,p.user_id,p.username::text,p.display_name::text,p.avatar_url,
   p.bio,coalesce(p.fame,0),coalesce(p.fans,0),coalesce(p.level,1),
   CASE WHEN p.user_id=auth.uid() OR social.show_city
      THEN c.name::text ELSE NULL END,
   CASE WHEN p.user_id=auth.uid() OR social.show_career_history
      THEN coalesce((
       SELECT jsonb_agg(jsonb_build_object('name',b.name,
          'genre',coalesce(b.primary_genre,b.genre)) ORDER BY b.name)
       FROM public.band_members bm JOIN public.bands b ON b.id=bm.band_id
       WHERE bm.profile_id=p.id AND coalesce(bm.member_status,'active')='active'
      ),'[]'::jsonb) ELSE '[]'::jsonb END
 FROM public.profiles p
 JOIN public.player_profiles social ON social.profile_id=p.id
 LEFT JOIN public.cities c ON c.id=p.current_city_id
 WHERE p.deleted_at IS NULL AND p.died_at IS NULL
   AND p.is_active IS TRUE
   AND p.id<>v_viewer
   AND (p.user_id=auth.uid() OR social.visibility::text='public')
   AND NOT public._social_blocked(v_viewer,p.id)
   AND (nullif(btrim(search_term),'') IS NULL
     OR p.username ILIKE '%'||left(btrim(search_term),100)||'%'
     OR coalesce(p.display_name,'') ILIKE '%'||left(btrim(search_term),100)||'%'
     OR coalesce(p.bio,'') ILIKE '%'||left(btrim(search_term),100)||'%')
 ORDER BY CASE WHEN p.user_id=auth.uid() THEN 0 ELSE 1 END,
          coalesce(p.fame,0) DESC,p.username,p.id
 LIMIT least(greatest(coalesce(result_limit,20),1),50);
END $$;
REVOKE ALL ON FUNCTION public.search_public_profiles(text,uuid,integer)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text,uuid,integer)
 TO authenticated;

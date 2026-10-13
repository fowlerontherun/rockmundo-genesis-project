-- Main player-discovery RPC. Required migration:
-- 20261013210000_social_discovery_authoritative_viewer.sql
-- Visibility filtering runs *before* pagination, sorting or counts.
CREATE OR REPLACE FUNCTION public.search_player_discovery(
 query jsonb, viewer_profile_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
 v_viewer uuid;
 v_viewer_city uuid;
 v_query jsonb:=coalesce(query,'{}'::jsonb);
 v_filters jsonb;
 v_mode text;
 v_sort text;
 v_search text;
 v_page integer;
 v_page_size integer;
 v_city text;
 v_region text;
 v_genre text;
 v_secondary_instrument text;
 v_employment text;
 v_band_status text;
 v_career_level text;
 v_role text;
 v_instrument text;
 v_fame_min integer;
 v_fame_max integer;
 v_rows jsonb;
 v_count integer;
 v_bad_filter text;
BEGIN
 v_viewer:=public.resolve_authorized_social_viewer(viewer_profile_id);
 SELECT p.current_city_id INTO v_viewer_city FROM public.profiles p WHERE p.id=v_viewer;
 IF jsonb_typeof(v_query)<>'object' THEN RAISE EXCEPTION 'INVALID_DISCOVERY_QUERY' USING ERRCODE='22023'; END IF;
 v_filters:=coalesce(v_query->'filters','{}'::jsonb);
 IF jsonb_typeof(v_filters)<>'object' THEN RAISE EXCEPTION 'INVALID_DISCOVERY_FILTERS' USING ERRCODE='22023'; END IF;
 v_mode:=coalesce(nullif(v_query->>'mode',''),'all');
 v_sort:=coalesce(nullif(v_query->>'sort',''),'recently-active');
 v_search:=nullif(left(btrim(v_query->>'search'),100),'');
 v_page:=least(greatest(
   CASE WHEN (v_query->>'page')~'^[0-9]{1,6}$' THEN (v_query->>'page')::integer ELSE 1 END,1),100000);
 v_page_size:=least(greatest(
   CASE WHEN (v_query->>'pageSize')~'^[0-9]{1,3}$' THEN (v_query->>'pageSize')::integer ELSE 18 END,1),48);
 v_city:=nullif(btrim(v_filters->>'city'),'');
 v_region:=nullif(btrim(v_filters->>'region'),'');
 v_secondary_instrument:=nullif(btrim(v_filters->>'secondaryInstrument'),'');
 v_employment:=nullif(btrim(v_filters->>'employmentStatus'),'');
 v_band_status:=nullif(btrim(v_filters->>'bandStatus'),'');
 v_career_level:=nullif(btrim(v_filters->>'careerLevel'),'');
 v_genre:=nullif(btrim(v_filters->>'genre'),'');
 v_role:=nullif(btrim(v_filters->>'role'),'');
 v_instrument:=nullif(btrim(v_filters->>'instrument'),'');
 v_fame_min:=CASE WHEN (v_filters->>'fameMin')~'^[0-9]{1,9}$' THEN (v_filters->>'fameMin')::integer ELSE 0 END;
 v_fame_max:=CASE WHEN (v_filters->>'fameMax')~'^[0-9]{1,9}$' THEN (v_filters->>'fameMax')::integer ELSE NULL END;

 -- Previously ignored selectors must not silently return unfiltered profiles.
 -- Unsupported filters are explicit until authoritative data is available.
 SELECT key INTO v_bad_filter
 FROM jsonb_object_keys(v_filters) key
 WHERE key IN ('skillBand')
   AND nullif(btrim(coalesce(v_filters->>key,'')),'') IS NOT NULL
   AND v_filters->>key NOT IN ('any','all')
 LIMIT 1;
 IF v_bad_filter IS NOT NULL THEN
    RAISE EXCEPTION 'DISCOVERY_FILTER_NOT_SUPPORTED: %',v_bad_filter USING ERRCODE='22023';
 END IF;
 IF nullif(v_filters->>'travel','') NOT IN ('any','same-city','nearby')
    AND v_filters ? 'travel' THEN
    RAISE EXCEPTION 'DISCOVERY_TRAVEL_FILTER_NOT_SUPPORTED' USING ERRCODE='22023';
 END IF;

 WITH base AS (
  SELECT p.id,p.user_id,p.username,p.display_name,p.avatar_url,p.created_at,
   coalesce(p.fame,0) AS fame,coalesce(p.level,1) AS level,
   social.status_message,
   social.preferred_genres,
   social.primary_instrument,
   social.preferred_roles,
   social.show_city,social.show_online_status,social.show_last_active,
   social.show_skills,social.show_career_history,
   social.looking_for_band,social.looking_for_members,
   social.available_for_session_work,social.available_for_collaboration,
   social.available_for_gigs,social.available_for_employment,
   social.available_for_teaching,social.available_for_social,
   CASE WHEN social.show_city THEN c.name ELSE NULL END AS city_name,
   CASE WHEN social.show_city THEN p.current_city_id ELSE NULL END AS visible_city_id,
   CASE WHEN social.show_last_active THEN p.last_login_at ELSE NULL END AS safe_last_active,
   CASE WHEN social.show_online_status AND p.last_login_at>now()-interval '15 minutes'
      THEN true ELSE false END AS publicly_online,
   CASE WHEN social.show_online_status AND p.last_login_at>now()-interval '15 minutes'
     THEN 'online'
     WHEN social.show_last_active AND p.last_login_at>now()-interval '1 day'
     THEN 'today'
     WHEN social.show_last_active AND p.last_login_at>now()-interval '14 days'
     THEN 'recent'
     ELSE 'hidden' END AS activity_state,
   CASE WHEN social.show_career_history THEN (
     SELECT b.name FROM public.band_members bm
     JOIN public.bands b ON b.id=bm.band_id
     WHERE bm.profile_id=p.id AND coalesce(bm.member_status,'active')='active'
     ORDER BY bm.joined_at NULLS LAST,bm.band_id LIMIT 1
   ) ELSE NULL END AS current_band,
   CASE WHEN social.show_skills THEN social.primary_instrument ELSE NULL END AS shown_instrument,
   CASE WHEN social.show_skills THEN (
     SELECT bm.role FROM public.band_members bm
     WHERE bm.profile_id=p.id AND coalesce(bm.member_status,'active')='active'
     ORDER BY bm.joined_at NULLS LAST LIMIT 1
   ) ELSE NULL END AS primary_role,
   (social.available_for_session_work::integer+
    social.available_for_collaboration::integer+
    social.available_for_gigs::integer+
    social.available_for_employment::integer+
    social.available_for_teaching::integer+
    social.available_for_social::integer) AS availability_score,
   to_jsonb(array_remove(ARRAY[
      CASE WHEN social.looking_for_band THEN 'Looking for a band' END,
      CASE WHEN social.looking_for_members THEN 'Looking for members' END,
      CASE WHEN social.available_for_session_work THEN 'Session work' END,
      CASE WHEN social.available_for_collaboration THEN 'Collaboration' END,
      CASE WHEN social.available_for_gigs THEN 'Gigs' END,
      CASE WHEN social.available_for_employment THEN 'Employment' END,
      CASE WHEN social.available_for_teaching THEN 'Teaching' END,
      CASE WHEN social.available_for_social THEN 'Social' END
   ]::text[],NULL)) AS availability
  FROM public.profiles p
  JOIN public.player_profiles social ON social.profile_id=p.id
  LEFT JOIN public.cities c ON c.id=p.current_city_id
  WHERE p.id<>v_viewer
    AND p.deleted_at IS NULL AND p.died_at IS NULL AND p.is_active IS TRUE
    AND (p.user_id=auth.uid() OR social.visibility::text='public')
    AND NOT public._social_blocked(v_viewer,p.id)
    AND (v_search IS NULL OR p.username ILIKE '%'||v_search||'%'
      OR coalesce(p.display_name,'') ILIKE '%'||v_search||'%')
    AND (v_city IS NULL OR (social.show_city AND c.name=v_city))
    AND (v_region IS NULL OR (social.show_city AND c.region=v_region))
    AND (v_career_level IS NULL OR v_career_level=p.level::text
      OR v_career_level='Level '||p.level::text)
    AND (v_employment IS NULL OR social.open_to_work_status=v_employment
      OR (v_employment='available' AND social.available_for_employment))
    AND (v_band_status IS NULL OR
      (v_band_status IN ('in-band','has-band') AND EXISTS(
       SELECT 1 FROM public.band_members bm WHERE bm.profile_id=p.id
        AND coalesce(bm.member_status,'active')='active' AND social.show_career_history))
      OR (v_band_status IN ('solo','no-band') AND NOT EXISTS(
       SELECT 1 FROM public.band_members bm WHERE bm.profile_id=p.id
        AND coalesce(bm.member_status,'active')='active')))
    AND (v_fame_max IS NULL OR coalesce(p.fame,0)<=v_fame_max)
    AND coalesce(p.fame,0)>=v_fame_min
    AND (v_genre IS NULL OR v_genre=ANY(social.preferred_genres)
      OR EXISTS (SELECT 1 FROM public.band_members bm
        JOIN public.bands b ON b.id=bm.band_id
        WHERE bm.profile_id=p.id AND coalesce(b.primary_genre,b.genre)=v_genre
          AND social.show_career_history))
    AND (v_instrument IS NULL OR (social.show_skills AND (
       lower(social.primary_instrument)=lower(v_instrument)
       OR EXISTS (SELECT 1 FROM unnest(social.secondary_instruments) s
           WHERE lower(s)=lower(v_instrument))
    )))
    AND (v_secondary_instrument IS NULL OR (social.show_skills
       AND EXISTS (SELECT 1 FROM unnest(social.secondary_instruments) s
        WHERE lower(s)=lower(v_secondary_instrument))))
    AND (coalesce((v_filters->>'vocalCapability')::boolean,false)=false OR
      (social.show_skills AND social.vocal_capability IS NOT NULL))
    AND (v_role IS NULL OR (
       (v_role='musician' AND social.show_skills AND
        (social.primary_instrument IS NOT NULL OR cardinality(social.secondary_instruments)>0))
       OR (social.show_skills AND EXISTS (
        SELECT 1 FROM unnest(social.preferred_roles) r WHERE lower(r)=lower(v_role)))
    ))
    AND (coalesce((v_filters->>'lookingForBand')::boolean,false)=false OR social.looking_for_band)
    AND (coalesce((v_filters->>'lookingForMembers')::boolean,false)=false OR social.looking_for_members)
    AND (coalesce((v_filters->>'sessionAvailable')::boolean,false)=false OR social.available_for_session_work)
    AND (coalesce((v_filters->>'collaborationAvailable')::boolean,false)=false OR social.available_for_collaboration)
    AND (coalesce((v_filters->>'gigAvailable')::boolean,false)=false OR social.available_for_gigs)
    AND (coalesce((v_filters->>'employmentAvailable')::boolean,false)=false OR social.available_for_employment)
    AND (coalesce((v_filters->>'teachingAvailable')::boolean,false)=false OR social.available_for_teaching)
    AND (coalesce((v_filters->>'socialAvailable')::boolean,false)=false OR social.available_for_social)
    AND (coalesce((v_filters->>'onlineNow')::boolean,false)=false OR
      (social.show_online_status AND p.last_login_at>now()-interval '15 minutes'))
    AND (coalesce(v_filters->>'activity','') NOT IN ('online','today','week','recent')
       OR (v_filters->>'activity'='online' AND social.show_online_status
          AND p.last_login_at>now()-interval '15 minutes')
       OR (v_filters->>'activity'='today' AND social.show_last_active
          AND p.last_login_at>now()-interval '1 day')
       OR (v_filters->>'activity'='week' AND social.show_last_active
          AND p.last_login_at>now()-interval '7 days')
       OR (v_filters->>'activity'='recent' AND social.show_last_active
          AND p.last_login_at>now()-interval '14 days'))
    AND (v_mode<>'band-recruitment' OR social.looking_for_band)
    AND (v_mode<>'collaboration' OR social.available_for_collaboration)
    AND (v_mode<>'session-work' OR social.available_for_session_work)
    AND (v_mode<>'employment' OR social.available_for_employment)
    AND (v_mode<>'teaching' OR social.available_for_teaching)
    AND (v_mode<>'social' OR social.available_for_social)
    AND (v_mode<>'musicians' OR (social.show_skills AND
         (social.primary_instrument IS NOT NULL OR cardinality(social.secondary_instruments)>0)))
    AND (v_mode<>'nearby' OR (social.show_city AND p.current_city_id=v_viewer_city))
    AND (coalesce(v_filters->>'travel','any') NOT IN ('same-city','nearby')
         OR (social.show_city AND p.current_city_id=v_viewer_city))
  ),
  counted AS (SELECT count(*)::integer total FROM base),
  ordered AS (
   SELECT base.*,
     row_number() OVER (ORDER BY
       CASE WHEN v_sort='online-now' AND publicly_online THEN 0
            WHEN v_sort='online-now' THEN 1 ELSE 0 END,
       CASE WHEN v_sort='highest-fame' THEN fame END DESC NULLS LAST,
       CASE WHEN v_sort='career-level' THEN level END DESC NULLS LAST,
       CASE WHEN v_sort='name' THEN username END ASC NULLS LAST,
       CASE WHEN v_sort='newest' THEN created_at END DESC NULLS LAST,
       CASE WHEN v_sort='availability' THEN availability_score END DESC NULLS LAST,
       CASE WHEN v_sort='closest-city' AND visible_city_id=v_viewer_city THEN 0
            WHEN v_sort='closest-city' THEN 1 ELSE 0 END,
       CASE WHEN v_sort IN ('recently-active','online-now') THEN safe_last_active END DESC NULLS LAST,
       fame DESC,id ASC
     ) AS display_rank
   FROM base
   ORDER BY
       CASE WHEN v_sort='online-now' AND publicly_online THEN 0
            WHEN v_sort='online-now' THEN 1 ELSE 0 END,
       CASE WHEN v_sort='highest-fame' THEN fame END DESC NULLS LAST,
       CASE WHEN v_sort='career-level' THEN level END DESC NULLS LAST,
       CASE WHEN v_sort='name' THEN username END ASC NULLS LAST,
       CASE WHEN v_sort='newest' THEN created_at END DESC NULLS LAST,
       CASE WHEN v_sort='availability' THEN availability_score END DESC NULLS LAST,
       CASE WHEN v_sort='closest-city' AND visible_city_id=v_viewer_city THEN 0
            WHEN v_sort='closest-city' THEN 1 ELSE 0 END,
       CASE WHEN v_sort IN ('recently-active','online-now') THEN safe_last_active END DESC NULLS LAST,
       fame DESC,id ASC
   LIMIT v_page_size OFFSET (v_page-1)*v_page_size
  )
 SELECT (SELECT coalesce(jsonb_agg(
   jsonb_build_object(
      'profile_id',o.id,'user_id',o.user_id,
      'character_name',coalesce(o.display_name,o.username),
      'avatar_url',o.avatar_url,
      'city_name',o.city_name,
      'activity_state',o.activity_state,
      'current_band',o.current_band,
      'primary_role',o.primary_role,
      'primary_instrument',o.shown_instrument,
      'preferred_genres',to_jsonb(o.preferred_genres),
      'fame',o.fame,'career_level','Level '||o.level,
      'availability',o.availability,
      'status_message',o.status_message,
      'badges','[]'::jsonb,
      'match',jsonb_build_object('percentage',50,'category','Potential match',
        'reasons','[]'::jsonb)
   ) ORDER BY o.display_rank),'[]'::jsonb) FROM ordered o),
   (SELECT total FROM counted) INTO v_rows,v_count;
 RETURN jsonb_build_object(
   'results',v_rows,
   'page',v_page,'page_size',v_page_size,
   'has_more',(v_page*v_page_size)<coalesce(v_count,0),
   'approximate_total',coalesce(v_count,0)
 );
END $$;

REVOKE ALL ON FUNCTION public.search_player_discovery(jsonb,uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_player_discovery(jsonb,uuid)
 TO authenticated;

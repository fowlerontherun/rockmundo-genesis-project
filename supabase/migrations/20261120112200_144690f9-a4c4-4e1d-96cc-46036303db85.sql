CREATE OR REPLACE FUNCTION public.get_public_profile_detail(target_profile_id uuid, viewer_profile_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_viewer uuid;v_target public.profiles%ROWTYPE;v_social public.player_profiles%ROWTYPE;
 v_owner boolean;v_has_social boolean;v_city text;v_bands jsonb:='[]'::jsonb;
 v_show_city boolean;v_show_career boolean;v_show_activity boolean;v_show_skills boolean;
 v_band_ids uuid[];v_gigs int;v_songs int;v_releases int;v_awards int;v_achievements int;
BEGIN
 v_viewer:=public.rockmundo_authorized_social_viewer(viewer_profile_id);
 IF NOT public.rockmundo_can_view_social_profile(v_viewer,target_profile_id)
 THEN RAISE EXCEPTION 'PROFILE_NOT_PUBLIC' USING ERRCODE='42501';END IF;
 SELECT * INTO v_target FROM public.profiles WHERE id=target_profile_id;
 v_owner:=v_target.user_id=auth.uid();
 SELECT * INTO v_social FROM public.player_profiles WHERE profile_id=target_profile_id;
 v_has_social:=v_social.profile_id IS NOT NULL;
 -- Characters without saved privacy settings share their public career by default.
 v_show_city:=v_owner OR CASE WHEN v_has_social THEN coalesce(v_social.show_city,false) ELSE true END;
 v_show_career:=v_owner OR CASE WHEN v_has_social THEN coalesce(v_social.show_career_history,false) ELSE true END;
 v_show_activity:=v_owner OR CASE WHEN v_has_social THEN coalesce(v_social.show_activity,false) ELSE true END;
 v_show_skills:=v_owner OR CASE WHEN v_has_social THEN coalesce(v_social.show_skills,false) ELSE true END;
 IF v_show_city THEN
  SELECT c.name::text INTO v_city FROM public.cities c WHERE c.id=v_target.current_city_id;
 END IF;
 IF v_show_career THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,
   'genre',coalesce(b.primary_genre,b.genre),'fame',coalesce(b.fame,0),
   'chemistry_level',coalesce(b.chemistry_level,0),
   'role',bm.role,'instrument_role',bm.instrument_role,'vocal_role',bm.vocal_role,
   'joined_at',bm.joined_at) ORDER BY bm.joined_at NULLS LAST),'[]'::jsonb), array_agg(b.id)
  INTO v_bands, v_band_ids FROM public.band_members bm JOIN public.bands b ON b.id=bm.band_id
  WHERE bm.profile_id=target_profile_id;
  SELECT count(*) INTO v_gigs FROM public.gigs g WHERE g.band_id=ANY(coalesce(v_band_ids,'{}')) AND g.status='completed';
  SELECT count(*) INTO v_songs FROM public.songs s WHERE s.profile_id=target_profile_id;
  SELECT count(*) INTO v_releases FROM public.releases r WHERE r.band_id=ANY(coalesce(v_band_ids,'{}'));
  SELECT count(*) INTO v_awards FROM public.award_wins a WHERE a.band_id=ANY(coalesce(v_band_ids,'{}'));
  SELECT count(*) INTO v_achievements FROM public.player_achievements pa WHERE pa.profile_id=target_profile_id;
 END IF;
 RETURN jsonb_build_object(
  'profile_id',v_target.id,'user_id',v_target.user_id,'username',v_target.username,
  'display_name',v_target.display_name,'avatar_url',v_target.avatar_url,
  'bio',CASE WHEN v_show_activity THEN v_target.bio ELSE NULL END,
  'fame',coalesce(v_target.fame,0),'fans',coalesce(v_target.fans,0),
  'level',coalesce(v_target.level,1),'city_name',v_city,
  'created_at',v_target.created_at,'bands',v_bands,
  'social_profile',CASE WHEN NOT v_has_social THEN NULL ELSE
    jsonb_build_object('biography',v_social.biography,
    'status_message',v_social.status_message,
    'preferred_genres',v_social.preferred_genres,'preferred_roles',v_social.preferred_roles,
    'primary_instrument',CASE WHEN v_show_skills THEN v_social.primary_instrument ELSE NULL END,
    'secondary_instruments',CASE WHEN v_show_skills THEN v_social.secondary_instruments ELSE '{}'::text[] END,
    'show_skills',v_show_skills) END,
  'badges','[]'::jsonb,'public_activity','[]'::jsonb,
  'career_summary',CASE WHEN v_show_career THEN jsonb_build_object(
    'level',coalesce(v_target.level,1),'fame',coalesce(v_target.fame,0),'fans',coalesce(v_target.fans,0),
    'experience',coalesce(v_target.experience,0),'age',v_target.age,
    'bands_joined',jsonb_array_length(v_bands),'gigs_performed',v_gigs,'songs_written',v_songs,
    'recordings_released',v_releases,'awards',v_awards,'achievements',v_achievements) ELSE NULL END);
END;
$function$;
-- Safe compatibility for historical completed projects with low recorded progress AND existing character-owned songs.
CREATE OR REPLACE FUNCTION public.start_songwriting_polish_session(p_profile_id uuid, p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE v_p public.songwriting_projects%ROWTYPE;v_user uuid:=auth.uid();
 v_begin timestamptz:=now();v_end timestamptz:=now()+interval '1 hour';
 v_id uuid;v_quality integer;v_chance integer;
BEGIN
 IF v_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_profile_id AND user_id=v_user AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'PROFILE_NOT_OWNED' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_p FROM public.songwriting_projects
 WHERE id=p_project_id AND profile_id=p_profile_id AND user_id=v_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SONGWRITING_PROJECT_NOT_FOUND'; END IF;
 IF v_p.status<>'completed' OR
 (LEAST(coalesce(v_p.music_progress,0),coalesce(v_p.lyrics_progress,0))<2000
 AND NOT EXISTS(SELECT 1 FROM public.songs existing_song
 WHERE existing_song.songwriting_project_id=p_project_id
 AND existing_song.profile_id=p_profile_id
 AND existing_song.user_id=v_user))
 THEN RAISE EXCEPTION 'SONGWRITING_NOT_COMPLETE'; END IF;
 IF v_p.song_id IS NOT NULL OR v_p.polish_resolved_at IS NOT NULL OR v_p.polish_attempted
 THEN RAISE EXCEPTION 'FINAL_POLISH_ALREADY_RESOLVED'; END IF;
 IF coalesce(v_p.is_locked,false) AND v_p.locked_until>v_begin
 THEN RAISE EXCEPTION 'SONGWRITING_PROJECT_LOCKED'; END IF;
 IF EXISTS(SELECT 1 FROM public.player_scheduled_activities a WHERE a.profile_id=p_profile_id
   AND a.status IN ('scheduled','in_progress')
   AND tstzrange(a.scheduled_start,a.scheduled_end,'[)') && tstzrange(v_begin,v_end,'[)'))
 THEN RAISE EXCEPTION 'FINAL_POLISH_OVERLAPS_ACTIVITY'; END IF;
 SELECT coalesce(v_p.writing_quality_score,s.quality_score,v_p.quality_score,50)
 INTO v_quality FROM (SELECT 1) dummy
 LEFT JOIN LATERAL(SELECT quality_score FROM public.songs
   WHERE songwriting_project_id=p_project_id AND user_id=v_user
   ORDER BY created_at,id LIMIT 1) s ON true;
 v_quality:=least(1000,greatest(0,v_quality));
 v_chance:=coalesce(v_p.polish_success_chance,25+(abs(hashtext(p_project_id::text)::bigint)%51)::integer);
 INSERT INTO public.songwriting_polish_sessions(project_id,profile_id,user_id,started_at,scheduled_end,success_chance,quality_before)
 VALUES(p_project_id,p_profile_id,v_user,v_begin,v_end,v_chance,v_quality) RETURNING id INTO v_id;
 UPDATE public.songwriting_projects
 SET polish_attempted=true,polish_session_id=v_id,polish_success_chance=v_chance,
     writing_completed_at=coalesce(writing_completed_at,updated_at,v_begin),
     writing_quality_score=v_quality,is_locked=true,locked_until=v_end,updated_at=now()
 WHERE id=p_project_id;
 INSERT INTO public.player_scheduled_activities(user_id,profile_id,activity_type,scheduled_start,scheduled_end,status,title,description,metadata)
 VALUES(v_user,p_profile_id,'songwriting',v_begin,v_end,'in_progress',
  'Final polish: '||coalesce(v_p.title,'Untitled'),
  'One final songwriting session to polish a completed song',
  jsonb_build_object('project_id',p_project_id,'polish_session_id',v_id,'session_type','polish','success_chance',v_chance));
 RETURN jsonb_build_object('session_id',v_id,'scheduled_end',v_end,'success_chance',v_chance,'quality_before',v_quality);
END $function$;

CREATE OR REPLACE FUNCTION public.skip_songwriting_polish(p_profile_id uuid, p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE v_p public.songwriting_projects%ROWTYPE;v_quality integer;v_user uuid:=auth.uid();
BEGIN
 IF v_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_profile_id AND user_id=v_user AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'PROFILE_NOT_OWNED' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_p FROM public.songwriting_projects WHERE id=p_project_id AND profile_id=p_profile_id AND user_id=v_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SONGWRITING_PROJECT_NOT_FOUND';END IF;
 IF v_p.song_id IS NOT NULL THEN RETURN jsonb_build_object('duplicate',true,'song_id',v_p.song_id);END IF;
 IF v_p.status<>'completed' OR
 (LEAST(coalesce(v_p.music_progress,0),coalesce(v_p.lyrics_progress,0))<2000
 AND NOT EXISTS(SELECT 1 FROM public.songs existing_song
 WHERE existing_song.songwriting_project_id=p_project_id
 AND existing_song.profile_id=p_profile_id
 AND existing_song.user_id=v_user))
 THEN RAISE EXCEPTION 'SONGWRITING_NOT_COMPLETE';END IF;
 IF v_p.polish_attempted AND v_p.polish_resolved_at IS NULL
 THEN RAISE EXCEPTION 'POLISH_SESSION_ALREADY_STARTED';END IF;
 IF v_p.polish_resolved_at IS NOT NULL THEN
  RETURN jsonb_build_object('duplicate',true,'skipped',v_p.polish_skipped,'quality_score',v_p.writing_quality_score);
 END IF;
 SELECT coalesce(v_p.writing_quality_score,s.quality_score,v_p.quality_score,50)
 INTO v_quality FROM (SELECT 1) dummy
 LEFT JOIN LATERAL(SELECT quality_score FROM public.songs
  WHERE songwriting_project_id=p_project_id AND user_id=v_user ORDER BY created_at,id LIMIT 1) s ON true;
 v_quality:=least(1000,greatest(0,v_quality));
 UPDATE public.songwriting_projects SET polish_skipped=true,polish_resolved_at=now(),
   writing_completed_at=coalesce(writing_completed_at,updated_at,now()),
   writing_quality_score=v_quality,polish_success_chance=coalesce(polish_success_chance,25+(abs(hashtext(id::text)::bigint)%51)::integer),
   is_locked=false,locked_until=NULL,updated_at=now() WHERE id=p_project_id;
 RETURN jsonb_build_object('skipped',true,'quality_score',v_quality);
END $function$;

CREATE OR REPLACE FUNCTION public.complete_songwriting_project(p_profile_id uuid, p_project_id uuid, p_catalog_status text DEFAULT 'private'::text, p_band_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE v_p public.songwriting_projects%ROWTYPE;v_song public.songs%ROWTYPE;
 v_user uuid:=auth.uid();v_new boolean:=false;v_final integer;
BEGIN
 IF v_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_profile_id AND user_id=v_user AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'PROFILE_NOT_OWNED' USING ERRCODE='42501';END IF;
 IF p_catalog_status NOT IN ('private','public','unlisted') OR p_catalog_status IS NULL
 THEN RAISE EXCEPTION 'INVALID_CATALOG_STATUS';END IF;
 SELECT * INTO v_p FROM public.songwriting_projects
 WHERE id=p_project_id AND profile_id=p_profile_id AND user_id=v_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SONGWRITING_PROJECT_NOT_FOUND';END IF;
 IF v_p.song_id IS NOT NULL THEN
  SELECT * INTO v_song FROM public.songs WHERE id=v_p.song_id AND user_id=v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_SONG_LINK_INVALID';END IF;
  RETURN jsonb_build_object('duplicate',true,'song_id',v_song.id,'final_score',v_song.quality_score);
 END IF;
 IF v_p.status<>'completed' OR
 (LEAST(coalesce(v_p.music_progress,0),coalesce(v_p.lyrics_progress,0))<2000
 AND NOT EXISTS(SELECT 1 FROM public.songs existing_song
 WHERE existing_song.songwriting_project_id=p_project_id
 AND existing_song.profile_id=p_profile_id
 AND existing_song.user_id=v_user))
 THEN RAISE EXCEPTION 'SONGWRITING_NOT_COMPLETE';END IF;
 IF v_p.polish_resolved_at IS NULL THEN
  RAISE EXCEPTION 'Choose the final polish session or keep the song as-is first';
 END IF;
 SELECT * INTO v_song FROM public.songs
 WHERE songwriting_project_id=p_project_id AND user_id=v_user
 ORDER BY created_at,id LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN
   IF p_band_id IS NOT NULL THEN RAISE EXCEPTION 'BAND_REQUIRES_VERIFIED_PROJECT_SONG';END IF;
   INSERT INTO public.songs(user_id,profile_id,songwriting_project_id,title,genre,lyrics,status,catalog_status,quality_score,ownership_type)
   VALUES(v_user,p_profile_id,p_project_id,v_p.title,
      coalesce(nullif(v_p.creative_brief->>'genre',''),v_p.genres[1],'Rock'),
      coalesce(v_p.lyrics,v_p.initial_lyrics),'draft',p_catalog_status,
      least(1000,greatest(0,coalesce(v_p.writing_quality_score,v_p.quality_score,50))),'personal')
   RETURNING * INTO v_song;
   v_new:=true;
 END IF;
 IF p_band_id IS NOT NULL AND v_song.band_id IS DISTINCT FROM p_band_id
 THEN RAISE EXCEPTION 'BAND_PROJECT_OWNERSHIP_MISMATCH';END IF;
 v_final:=least(1000,greatest(0,coalesce(v_p.writing_quality_score,v_song.quality_score,50)));
 IF coalesce(v_p.polish_succeeded,false) AND v_final>v_song.quality_score THEN
   UPDATE public.songs SET quality_score=v_final,song_rating=v_final,updated_at=now()
   WHERE id=v_song.id RETURNING * INTO v_song;
 END IF;
 UPDATE public.songwriting_projects SET song_id=v_song.id,status='converted',
    song_rating=v_song.quality_score,quality_score=v_song.quality_score,
    is_locked=false,locked_until=NULL,updated_at=now() WHERE id=p_project_id;
 RETURN jsonb_build_object('duplicate',false,'song_id',v_song.id,'final_score',v_song.quality_score,
   'breakdown',jsonb_build_object('source','existing_canonical_song','new_song_created',v_new),
   'created',v_new);
END $function$;
NOTIFY pgrst,'reload schema';
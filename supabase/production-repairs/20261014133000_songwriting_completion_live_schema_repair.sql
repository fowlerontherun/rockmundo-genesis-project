-- RockMundo production-compatible songwriting completion repair (2026-10-14).
-- This intentionally does not backfill or delete existing songs and does not pay XP.
-- Historical completed projects can have multiple songs; select canonical by age/UUID.
ALTER TABLE public.songwriting_projects
 ADD COLUMN IF NOT EXISTS writing_completed_at timestamptz,
 ADD COLUMN IF NOT EXISTS writing_quality_score integer CHECK (writing_quality_score BETWEEN 0 AND 1000),
 ADD COLUMN IF NOT EXISTS completion_quality_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS completion_notified_at timestamptz,
 ADD COLUMN IF NOT EXISTS polish_success_chance integer CHECK (polish_success_chance BETWEEN 0 AND 100),
 ADD COLUMN IF NOT EXISTS polish_attempted boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS polish_skipped boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS polish_succeeded boolean,
 ADD COLUMN IF NOT EXISTS polish_resolved_at timestamptz,
 ADD COLUMN IF NOT EXISTS polish_session_id uuid;

CREATE TABLE IF NOT EXISTS public.songwriting_polish_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL UNIQUE REFERENCES public.songwriting_projects(id) ON DELETE CASCADE,
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL DEFAULT now(),
 scheduled_end timestamptz NOT NULL,
 completed_at timestamptz,
 success_chance integer NOT NULL CHECK (success_chance BETWEEN 0 AND 100),
 success_roll integer CHECK (success_roll BETWEEN 1 AND 100),
 succeeded boolean,
 polish_gain integer NOT NULL DEFAULT 0,
 quality_before integer CHECK (quality_before BETWEEN 0 AND 1000),
 quality_after integer CHECK (quality_after BETWEEN 0 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS songwriting_polish_due_pending_idx
 ON public.songwriting_polish_sessions(scheduled_end) WHERE completed_at IS NULL;
ALTER TABLE public.songwriting_polish_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.songwriting_polish_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.songwriting_polish_sessions TO authenticated;
GRANT ALL ON public.songwriting_polish_sessions TO service_role;
DROP POLICY IF EXISTS songwriting_polish_owner_read ON public.songwriting_polish_sessions;
CREATE POLICY songwriting_polish_owner_read ON public.songwriting_polish_sessions
 FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);

-- New writing completions get a persisted snapshot, without mutating any existing song.
CREATE OR REPLACE FUNCTION private.rockmundo_songwriting_completion_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
   NEW.writing_completed_at:=coalesce(NEW.writing_completed_at,now());
   NEW.writing_quality_score:=coalesce(NEW.writing_quality_score,
     least(1000,greatest(0,coalesce(NEW.quality_score,50))));
   NEW.polish_success_chance:=coalesce(NEW.polish_success_chance,
     25+(abs(hashtext(NEW.id::text)::bigint)%51)::integer);
   NEW.completion_quality_breakdown:=coalesce(NEW.completion_quality_breakdown,'{}'::jsonb)
     ||jsonb_build_object('source','live_songwriting_quality','final_score',NEW.writing_quality_score);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rockmundo_songwriting_completion_snapshot ON public.songwriting_projects;
CREATE TRIGGER rockmundo_songwriting_completion_snapshot
 BEFORE UPDATE OF status ON public.songwriting_projects FOR EACH ROW
 EXECUTE FUNCTION private.rockmundo_songwriting_completion_snapshot();
REVOKE ALL ON FUNCTION private.rockmundo_songwriting_completion_snapshot() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.start_songwriting_polish_session(p_profile_id uuid,p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_p public.songwriting_projects%ROWTYPE;v_user uuid:=auth.uid();
 v_begin timestamptz:=now();v_end timestamptz:=now()+interval '1 hour';
 v_id uuid;v_quality integer;v_chance integer;
BEGIN
 IF v_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_profile_id AND user_id=v_user AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'PROFILE_NOT_OWNED' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_p FROM public.songwriting_projects
 WHERE id=p_project_id AND profile_id=p_profile_id AND user_id=v_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SONGWRITING_PROJECT_NOT_FOUND'; END IF;
 IF v_p.status<>'completed' OR LEAST(coalesce(v_p.music_progress,0),coalesce(v_p.lyrics_progress,0))<2000
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
END $$;

CREATE OR REPLACE FUNCTION private.rockmundo_resolve_songwriting_polish(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_s public.songwriting_polish_sessions%ROWTYPE;v_p public.songwriting_projects%ROWTYPE;
 v_roll integer;v_win boolean;v_gain integer:=0;v_before integer;v_after integer;
BEGIN
 SELECT * INTO v_s FROM public.songwriting_polish_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'POLISH_SESSION_NOT_FOUND'; END IF;
 IF v_s.completed_at IS NOT NULL THEN
  RETURN jsonb_build_object('duplicate',true,'session_id',v_s.id,'succeeded',v_s.succeeded,
   'quality_after',v_s.quality_after,'quality_before',v_s.quality_before);
 END IF;
 IF v_s.scheduled_end>now() THEN RAISE EXCEPTION 'POLISH_SESSION_STILL_IN_PROGRESS'; END IF;
 SELECT * INTO v_p FROM public.songwriting_projects WHERE id=v_s.project_id FOR UPDATE;
 IF NOT FOUND OR v_p.song_id IS NOT NULL THEN RAISE EXCEPTION 'POLISH_PROJECT_UNAVAILABLE'; END IF;
 v_before:=least(1000,greatest(0,coalesce(v_p.writing_quality_score,v_s.quality_before,v_p.quality_score,50)));
 v_roll:=(abs(hashtext(v_s.id::text)::bigint)%100+1)::integer;
 v_win:=v_roll<=v_s.success_chance;
 IF v_win THEN v_gain:=(80+abs(hashtext('gain:'||v_s.id::text)::bigint)%121)::integer; END IF;
 v_after:=least(1000,v_before+v_gain);
 UPDATE public.songwriting_polish_sessions SET completed_at=now(),success_roll=v_roll,
    succeeded=v_win,polish_gain=v_gain,quality_before=v_before,quality_after=v_after WHERE id=v_s.id;
 UPDATE public.songwriting_projects SET polish_succeeded=v_win,polish_resolved_at=now(),
  writing_quality_score=v_after,is_locked=false,locked_until=NULL,updated_at=now(),
  completion_quality_breakdown=coalesce(completion_quality_breakdown,'{}'::jsonb)
    ||jsonb_build_object('polish_gain',v_gain,'polish_roll',v_roll,'final_score',v_after)
 WHERE id=v_p.id;
 UPDATE public.player_scheduled_activities SET status='completed',completed_at=now(),
   metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('polish_succeeded',v_win,'quality_after',v_after)
 WHERE metadata->>'polish_session_id'=v_s.id::text AND status IN ('scheduled','in_progress');
 RETURN jsonb_build_object('session_id',v_s.id,'succeeded',v_win,'success_chance',v_s.success_chance,
   'success_roll',v_roll,'polish_gain',v_gain,'quality_before',v_before,'quality_after',v_after);
END $$;
REVOKE ALL ON FUNCTION private.rockmundo_resolve_songwriting_polish(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.complete_songwriting_polish_session(p_profile_id uuid,p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_s public.songwriting_polish_sessions%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'PROFILE_NOT_OWNED' USING ERRCODE='42501';END IF;
 SELECT * INTO v_s FROM public.songwriting_polish_sessions WHERE id=p_session_id;
 IF NOT FOUND OR v_s.profile_id IS DISTINCT FROM p_profile_id OR v_s.user_id IS DISTINCT FROM auth.uid()
 THEN RAISE EXCEPTION 'POLISH_SESSION_NOT_FOUND';END IF;
 RETURN private.rockmundo_resolve_songwriting_polish(p_session_id);
END $$;

CREATE OR REPLACE FUNCTION public.auto_complete_songwriting_polish_sessions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_row record;v_done integer:=0;
BEGIN
 FOR v_row IN SELECT id FROM public.songwriting_polish_sessions
  WHERE completed_at IS NULL AND scheduled_end<=now()
  ORDER BY scheduled_end,id FOR UPDATE SKIP LOCKED
 LOOP
  PERFORM private.rockmundo_resolve_songwriting_polish(v_row.id);
  v_done:=v_done+1;
 END LOOP;
 RETURN v_done;
END $$;

CREATE OR REPLACE FUNCTION public.skip_songwriting_polish(p_profile_id uuid,p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_p public.songwriting_projects%ROWTYPE;v_quality integer;v_user uuid:=auth.uid();
BEGIN
 IF v_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_profile_id AND user_id=v_user AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'PROFILE_NOT_OWNED' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_p FROM public.songwriting_projects WHERE id=p_project_id AND profile_id=p_profile_id AND user_id=v_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SONGWRITING_PROJECT_NOT_FOUND';END IF;
 IF v_p.song_id IS NOT NULL THEN RETURN jsonb_build_object('duplicate',true,'song_id',v_p.song_id);END IF;
 IF v_p.status<>'completed' OR LEAST(coalesce(v_p.music_progress,0),coalesce(v_p.lyrics_progress,0))<2000
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
END $$;

-- Link an existing generated song instead of duplicating the older AFTER UPDATE trigger.
-- This intentionally does not delete/retune any of the 7 ambiguous historical song sets.
CREATE OR REPLACE FUNCTION public.complete_songwriting_project(
 p_profile_id uuid,p_project_id uuid,p_catalog_status text DEFAULT 'private',p_band_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
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
 IF v_p.status<>'completed' OR LEAST(coalesce(v_p.music_progress,0),coalesce(v_p.lyrics_progress,0))<2000
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
END $$;

CREATE OR REPLACE FUNCTION public.complete_songwriting_project_with_instruments(
 p_profile_id uuid,p_project_id uuid,p_catalog_status text DEFAULT 'private',p_band_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
BEGIN
 -- Existing songs must retain their pre-migration quality and receive no duplicate bonuses.
 RETURN public.complete_songwriting_project(p_profile_id,p_project_id,p_catalog_status,p_band_id);
END $$;

CREATE OR REPLACE FUNCTION public.skip_and_complete_songwriting_project_with_instruments(
 p_profile_id uuid,p_project_id uuid,p_catalog_status text DEFAULT 'private',p_band_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_skip jsonb;v_result jsonb;
BEGIN
 v_skip:=public.skip_songwriting_polish(p_profile_id,p_project_id);
 v_result:=public.complete_songwriting_project_with_instruments(p_profile_id,p_project_id,p_catalog_status,p_band_id);
 RETURN v_result||jsonb_build_object('polishSkipped',true);
END $$;

REVOKE ALL ON FUNCTION public.start_songwriting_polish_session(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.complete_songwriting_polish_session(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.skip_songwriting_polish(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.complete_songwriting_project(uuid,uuid,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.complete_songwriting_project_with_instruments(uuid,uuid,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.skip_and_complete_songwriting_project_with_instruments(uuid,uuid,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.auto_complete_songwriting_polish_sessions() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_songwriting_polish_session(uuid,uuid),
 public.complete_songwriting_polish_session(uuid,uuid),
 public.skip_songwriting_polish(uuid,uuid),
 public.complete_songwriting_project(uuid,uuid,text,uuid),
 public.complete_songwriting_project_with_instruments(uuid,uuid,text,uuid),
 public.skip_and_complete_songwriting_project_with_instruments(uuid,uuid,text,uuid)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_complete_songwriting_polish_sessions() TO service_role;
NOTIFY pgrst,'reload schema';
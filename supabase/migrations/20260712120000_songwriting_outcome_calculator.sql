-- Server-authoritative songwriting progression and final outcome calculator.
ALTER TABLE public.songwriting_projects
  ADD COLUMN IF NOT EXISTS arrangement_progress integer NOT NULL DEFAULT 0 CHECK (arrangement_progress BETWEEN 0 AND 2000),
  ADD COLUMN IF NOT EXISTS polish_progress integer NOT NULL DEFAULT 0 CHECK (polish_progress BETWEEN 0 AND 500),
  ADD COLUMN IF NOT EXISTS consistency_score integer NOT NULL DEFAULT 0 CHECK (consistency_score BETWEEN 0 AND 500),
  ADD COLUMN IF NOT EXISTS project_insight integer NOT NULL DEFAULT 0 CHECK (project_insight BETWEEN 0 AND 500),
  ADD COLUMN IF NOT EXISTS songwriting_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS songwriting_input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS calculation_version text,
  ADD COLUMN IF NOT EXISTS random_seed text,
  ADD COLUMN IF NOT EXISTS variance_applied numeric(8,5),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.songwriting_sessions
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS effort_hours integer NOT NULL DEFAULT 1 CHECK (effort_hours IN (1,2,4)),
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'balanced' CHECK (session_type IN ('balanced','music','lyrics','arrangement','polish')),
  ADD COLUMN IF NOT EXISTS arrangement_progress_gained integer NOT NULL DEFAULT 0 CHECK (arrangement_progress_gained >= 0),
  ADD COLUMN IF NOT EXISTS polish_gained integer NOT NULL DEFAULT 0 CHECK (polish_gained >= 0),
  ADD COLUMN IF NOT EXISTS consistency_gained integer NOT NULL DEFAULT 0 CHECK (consistency_gained >= 0),
  ADD COLUMN IF NOT EXISTS progress_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS xp_awards jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS legacy_calculation boolean NOT NULL DEFAULT false;

UPDATE public.songwriting_sessions ss
SET profile_id = sp.profile_id
FROM public.songwriting_projects sp
WHERE ss.project_id = sp.id AND ss.profile_id IS NULL;


ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS songwriting_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS calculation_version text;

CREATE UNIQUE INDEX IF NOT EXISTS songwriting_sessions_idempotency_idx
  ON public.songwriting_sessions(project_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.songwriting_skill_level(p_profile_id uuid, p_slug text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(psp.current_level), 0)::numeric
  FROM public.profile_skill_progress psp
  JOIN public.skill_definitions sd ON sd.id = psp.skill_id
  WHERE psp.profile_id = p_profile_id AND sd.slug = p_slug;
$$;

CREATE OR REPLACE FUNCTION public.songwriting_attribute_value(p_profile_id uuid, p_key text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(COALESCE(pa.stars, 0)), 0)::numeric * 20
  FROM public.player_attributes pa
  WHERE pa.profile_id = p_profile_id AND pa.attribute_key = p_key;
$$;

CREATE OR REPLACE FUNCTION public.songwriting_genre_slug(p_genre text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN NULLIF(trim(p_genre), '') IS NULL THEN NULL ELSE 'genres_basic_' || regexp_replace(lower(trim(p_genre)), '[^a-z0-9]+', '_', 'g') END;
$$;

CREATE OR REPLACE FUNCTION public.songwriting_seeded_variance(p_seed text, p_width numeric)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_hash bigint := 2166136261; v_i int; v_unit numeric;
BEGIN
  FOR v_i IN 1..length(COALESCE(p_seed,'')) LOOP
    v_hash := ((v_hash # ascii(substr(p_seed, v_i, 1))) * 16777619) % 1000000007;
  END LOOP;
  v_unit := (abs(v_hash) % 10000)::numeric / 10000;
  RETURN ((v_unit * 2) - 1) * p_width;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_songwriting_session(
  p_profile_id uuid,
  p_project_id uuid,
  p_effort_hours integer DEFAULT 1,
  p_session_type text DEFAULT 'balanced',
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_project public.songwriting_projects%ROWTYPE; v_start timestamptz := timezone('utc', now()); v_end timestamptz; v_session_id uuid; v_existing uuid; v_title text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_effort_hours NOT IN (1,2,4) THEN RAISE EXCEPTION 'Unsupported songwriting duration'; END IF;
  IF p_session_type NOT IN ('balanced','music','lyrics','arrangement','polish') THEN RAISE EXCEPTION 'Unsupported songwriting session type'; END IF;
  SELECT * INTO v_project FROM public.songwriting_projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND OR v_project.profile_id <> p_profile_id THEN RAISE EXCEPTION 'Songwriting project not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id AND user_id = v_user) THEN RAISE EXCEPTION 'Profile ownership validation failed'; END IF;
  IF v_project.status IN ('completed','converted') THEN RAISE EXCEPTION 'Project is already complete'; END IF;
  IF v_project.is_locked AND v_project.locked_until > v_start THEN RAISE EXCEPTION 'Project is already locked by an active session'; END IF;
  v_end := v_start + make_interval(hours => p_effort_hours);
  IF EXISTS (SELECT 1 FROM public.player_scheduled_activities WHERE profile_id = p_profile_id AND status IN ('scheduled','in_progress') AND tstzrange(scheduled_start, scheduled_end, '[)') && tstzrange(v_start, v_end, '[)')) THEN
    RAISE EXCEPTION 'Songwriting session overlaps an existing activity';
  END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.songwriting_sessions WHERE project_id = p_project_id AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('session_id', v_existing, 'duplicate', true, 'balance_version', 'songwriting_progression_v2'); END IF;
  END IF;
  INSERT INTO public.songwriting_sessions(project_id, profile_id, user_id, session_start, locked_until, effort_hours, session_type, idempotency_key)
  VALUES (p_project_id, p_profile_id, v_user, v_start, v_end, p_effort_hours, p_session_type, p_idempotency_key) RETURNING id INTO v_session_id;
  UPDATE public.songwriting_projects SET is_locked = true, locked_until = v_end, status = 'writing' WHERE id = p_project_id;
  v_title := COALESCE(v_project.title, 'Untitled');
  INSERT INTO public.player_scheduled_activities(user_id, profile_id, activity_type, scheduled_start, scheduled_end, status, title, description, metadata)
  VALUES (v_user, p_profile_id, 'songwriting', v_start, v_end, 'in_progress', 'Songwriting: ' || v_title, 'Working on song composition', jsonb_build_object('project_id', p_project_id, 'session_id', v_session_id, 'balance_version', 'songwriting_progression_v2'));
  RETURN jsonb_build_object('session_id', v_session_id, 'locked_until', v_end, 'effort_hours', p_effort_hours, 'balance_version', 'songwriting_progression_v2');
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_songwriting_session(p_profile_id uuid, p_session_id uuid, p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_session public.songwriting_sessions%ROWTYPE; v_project public.songwriting_projects%ROWTYPE; v_duration numeric; v_craft numeric; v_attrs numeric; v_genre numeric := 0; v_genre_count int := 0; v_skill_eff numeric; v_attr_eff numeric; v_wellness numeric := 1; v_difficulty numeric; v_repetition numeric; v_base numeric; v_music int; v_lyrics int; v_arr int; v_polish int; v_consistency int; v_completed boolean; v_xp int; v_breakdown jsonb; v_genre_text text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_session FROM public.songwriting_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.profile_id <> p_profile_id THEN RAISE EXCEPTION 'Songwriting session not found'; END IF;
  IF v_session.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('duplicate', true, 'music_progress_gained', v_session.music_progress_gained, 'lyrics_progress_gained', v_session.lyrics_progress_gained, 'xp_earned', v_session.xp_earned, 'breakdown', v_session.progress_breakdown);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id AND user_id = v_user) THEN RAISE EXCEPTION 'Profile ownership validation failed'; END IF;
  SELECT * INTO v_project FROM public.songwriting_projects WHERE id = v_session.project_id FOR UPDATE;
  IF v_project.status IN ('completed','converted') THEN RAISE EXCEPTION 'Project is already complete'; END IF;
  v_duration := CASE v_session.effort_hours WHEN 1 THEN 1 WHEN 2 THEN 1.9 ELSE 3.4 END;
  IF v_project.genres IS NOT NULL THEN
    FOREACH v_genre_text IN ARRAY v_project.genres LOOP
      v_genre := v_genre + public.songwriting_skill_level(p_profile_id, public.songwriting_genre_slug(v_genre_text)); v_genre_count := v_genre_count + 1;
    END LOOP;
  END IF;
  IF v_genre_count > 0 THEN v_genre := v_genre / v_genre_count; END IF;
  v_craft := LEAST(100, public.songwriting_skill_level(p_profile_id,'songwriting')*.34 + public.songwriting_skill_level(p_profile_id,'composition')*.24 + public.songwriting_skill_level(p_profile_id,'technical')*.10 + v_genre*.17 + GREATEST(public.songwriting_skill_level(p_profile_id,'guitar'), public.songwriting_skill_level(p_profile_id,'bass'), public.songwriting_skill_level(p_profile_id,'drums'), public.songwriting_skill_level(p_profile_id,'vocals'))*.15);
  v_attrs := LEAST(100, public.songwriting_attribute_value(p_profile_id,'creative_insight')*.22 + public.songwriting_attribute_value(p_profile_id,'musical_ability')*.20 + public.songwriting_attribute_value(p_profile_id,'musicality')*.18 + public.songwriting_attribute_value(p_profile_id,'mental_focus')*.16 + public.songwriting_attribute_value(p_profile_id,'rhythm_sense')*.08 + public.songwriting_attribute_value(p_profile_id,'vocal_talent')*.03 + public.songwriting_attribute_value(p_profile_id,'technical_mastery')*.05);
  v_skill_eff := .72 + v_craft / 250; v_attr_eff := .94 + v_attrs / 600;
  v_difficulty := GREATEST(.82, LEAST(1.12, 1.08 - (COALESCE((SELECT difficulty FROM public.chord_progressions WHERE id = v_project.chord_progression_id), 3) - 3) * .055));
  v_repetition := GREATEST(.62, 1 - COALESCE(v_project.sessions_completed,0) * .08);
  v_base := 170 * v_duration * v_skill_eff * v_attr_eff * v_wellness * v_difficulty * v_repetition;
  IF LEAST(v_project.music_progress, v_project.lyrics_progress) >= 2000 THEN
    v_music := 0; v_lyrics := 0; v_arr := round(v_base*.10); v_polish := round(v_base*.45*GREATEST(.2, 1 - GREATEST(0, v_project.sessions_completed - 3)*.12));
  ELSE
    v_music := round(v_base * CASE WHEN v_session.session_type = 'lyrics' THEN .35 ELSE .58 END);
    v_lyrics := round(v_base * CASE WHEN v_session.session_type = 'music' THEN .35 WHEN v_project.mode = 'instrumental' THEN .18 ELSE .58 END);
    v_arr := round(v_base * CASE WHEN v_session.session_type = 'arrangement' THEN .55 ELSE .18 END);
    v_polish := round(v_base * .06);
  END IF;
  v_consistency := round((v_craft*.45 + v_attrs*.25) * v_duration / 10);
  v_xp := GREATEST(8, round(v_session.effort_hours * (8 + COALESCE((SELECT difficulty FROM public.chord_progressions WHERE id = v_project.chord_progression_id), 3)*1.5) * v_repetition));
  v_breakdown := jsonb_build_object('balanceVersion','songwriting_progression_v2','craft',round(v_craft),'attributes',round(v_attrs),'genreKnowledge',round(v_genre),'durationModifier',v_duration,'wellnessModifier',v_wellness,'projectDifficultyModifier',v_difficulty,'repetitionModifier',v_repetition,'skillShare','~50%','attributeShare','~20%');
  UPDATE public.songwriting_sessions SET session_end = timezone('utc', now()), completed_at = timezone('utc', now()), notes = p_notes, music_progress_gained = v_music, lyrics_progress_gained = v_lyrics, arrangement_progress_gained = v_arr, polish_gained = v_polish, consistency_gained = v_consistency, xp_earned = v_xp, xp_awards = jsonb_build_object('songwriting',v_xp,'composition',round(v_xp*.55)), progress_breakdown = v_breakdown WHERE id = p_session_id;
  UPDATE public.songwriting_projects SET music_progress = LEAST(2000, music_progress + v_music), lyrics_progress = LEAST(2000, lyrics_progress + v_lyrics), arrangement_progress = LEAST(2000, arrangement_progress + v_arr), polish_progress = LEAST(500, polish_progress + v_polish), consistency_score = LEAST(500, consistency_score + v_consistency), total_sessions = total_sessions + 1, sessions_completed = sessions_completed + 1, is_locked = false, locked_until = NULL, status = CASE WHEN LEAST(2000, music_progress + v_music) >= 2000 AND LEAST(2000, lyrics_progress + v_lyrics) >= 2000 THEN 'completed' ELSE 'writing' END, calculation_version = 'songwriting_progression_v2', songwriting_breakdown = v_breakdown, updated_at = timezone('utc', now()) WHERE id = v_project.id RETURNING status = 'completed' INTO v_completed;
  UPDATE public.player_scheduled_activities SET status = 'completed', metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('completed_at', timezone('utc', now()), 'progress_breakdown', v_breakdown) WHERE metadata->>'session_id' = p_session_id::text;
  RETURN jsonb_build_object('music_progress_gained', v_music, 'lyrics_progress_gained', v_lyrics, 'arrangement_progress_gained', v_arr, 'polish_gained', v_polish, 'consistency_gained', v_consistency, 'xp_earned', v_xp, 'xp_awards', jsonb_build_object('songwriting',v_xp,'composition',round(v_xp*.55)), 'breakdown', v_breakdown, 'project_completed', v_completed);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_songwriting_project(p_profile_id uuid, p_project_id uuid, p_catalog_status text DEFAULT 'private', p_band_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_project public.songwriting_projects%ROWTYPE; v_song_id uuid; v_seed text; v_variance numeric; v_genre numeric := 0; v_genre_count int := 0; v_genre_text text; v_craft numeric; v_attrs numeric; v_genre_score numeric; v_choice numeric; v_potential numeric; v_completion numeric; v_polish numeric; v_consistency numeric; v_final int; v_breakdown jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_project FROM public.songwriting_projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND OR v_project.profile_id <> p_profile_id THEN RAISE EXCEPTION 'Songwriting project not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id AND user_id = v_user) THEN RAISE EXCEPTION 'Profile ownership validation failed'; END IF;
  IF v_project.song_id IS NOT NULL THEN RETURN jsonb_build_object('duplicate', true, 'song_id', v_project.song_id, 'final_score', COALESCE(v_project.song_rating, v_project.quality_score), 'breakdown', v_project.songwriting_breakdown); END IF;
  IF LEAST(v_project.music_progress, v_project.lyrics_progress) < 2000 THEN RAISE EXCEPTION 'Project is incomplete'; END IF;
  IF v_project.genres IS NOT NULL THEN FOREACH v_genre_text IN ARRAY v_project.genres LOOP v_genre := v_genre + public.songwriting_skill_level(p_profile_id, public.songwriting_genre_slug(v_genre_text)); v_genre_count := v_genre_count + 1; END LOOP; END IF;
  IF v_genre_count > 0 THEN v_genre := v_genre / v_genre_count; END IF;
  v_craft := (public.songwriting_skill_level(p_profile_id,'songwriting')*.34 + public.songwriting_skill_level(p_profile_id,'composition')*.24 + public.songwriting_skill_level(p_profile_id,'technical')*.10 + v_genre*.17 + GREATEST(public.songwriting_skill_level(p_profile_id,'guitar'), public.songwriting_skill_level(p_profile_id,'bass'), public.songwriting_skill_level(p_profile_id,'drums'), public.songwriting_skill_level(p_profile_id,'vocals'))*.15) * 4.8;
  v_attrs := (public.songwriting_attribute_value(p_profile_id,'creative_insight')*.22 + public.songwriting_attribute_value(p_profile_id,'musical_ability')*.20 + public.songwriting_attribute_value(p_profile_id,'musicality')*.18 + public.songwriting_attribute_value(p_profile_id,'mental_focus')*.16 + public.songwriting_attribute_value(p_profile_id,'rhythm_sense')*.08 + public.songwriting_attribute_value(p_profile_id,'vocal_talent')*.03 + public.songwriting_attribute_value(p_profile_id,'technical_mastery')*.05) * 2.0;
  v_genre_score := GREATEST(40, LEAST(150, (v_genre - 20) * 1.25 + 75));
  v_choice := CASE WHEN v_project.mode = 'experimental' THEN 95 WHEN v_project.mode = 'commercial' THEN 80 ELSE 70 END + (COALESCE((SELECT difficulty FROM public.chord_progressions WHERE id = v_project.chord_progression_id),3)-3)*10;
  v_seed := COALESCE(v_project.random_seed, encode(gen_random_bytes(12), 'hex'));
  v_variance := public.songwriting_seeded_variance(v_seed, CASE WHEN v_project.mode = 'experimental' THEN .07 WHEN v_project.mode = 'commercial' THEN .03 ELSE .045 END * (1 - LEAST(.35, v_project.consistency_score::numeric / 2000)));
  v_potential := GREATEST(0, LEAST(1000, (v_craft + v_attrs + v_genre_score + v_choice + 45) * (1 + v_variance)));
  v_completion := LEAST(v_project.music_progress, v_project.lyrics_progress)::numeric / 2000;
  v_polish := GREATEST(.88, LEAST(1.10, .88 + v_project.polish_progress::numeric / 2500));
  v_consistency := GREATEST(.90, LEAST(1.08, .90 + v_project.consistency_score::numeric / 3000));
  v_final := round(GREATEST(0, LEAST(1000, v_potential * (.35 + v_completion*.65) * v_polish * v_consistency)));
  v_breakdown := jsonb_build_object('balance_version','songwriting_progression_v2','craft',round(v_craft),'attributes',round(v_attrs),'genre',round(v_genre_score),'project_choices',round(v_choice),'collaboration',45,'variance',v_variance,'raw_score',round(v_craft+v_attrs+v_genre_score+v_choice+45),'potential',round(v_potential),'completion_factor',v_completion,'polish_factor',v_polish,'consistency_factor',v_consistency,'final_score',v_final,'strengths',jsonb_build_array('Server-authoritative songwriting craft and project execution calculated.'),'weaknesses',jsonb_build_array('Improve the lowest relevant skill group or genre familiarity for stronger future songs.'));
  INSERT INTO public.songs(user_id, original_writer_id, title, genre, lyrics, quality_score, song_rating, ownership_type, catalog_status, band_id, songwriting_project_id, music_progress, lyrics_progress, total_sessions, songwriting_breakdown, calculation_version)
  VALUES (p_profile_id, p_profile_id, v_project.title, COALESCE(v_project.genres[1], NULL), COALESCE(v_project.lyrics, v_project.initial_lyrics), v_final, v_final, CASE WHEN p_band_id IS NULL THEN 'personal' ELSE 'band' END, p_catalog_status, p_band_id, p_project_id, v_project.music_progress, v_project.lyrics_progress, v_project.total_sessions, v_breakdown, 'songwriting_progression_v2') RETURNING id INTO v_song_id;
  UPDATE public.songwriting_projects SET song_id = v_song_id, status = 'converted', song_rating = v_final, quality_score = LEAST(100, round(v_final/10.0)), songwriting_breakdown = v_breakdown, songwriting_input_snapshot = jsonb_build_object('profile_id',p_profile_id,'project_id',p_project_id,'genres',v_project.genres,'mode',v_project.mode,'purpose',v_project.purpose,'sessions_completed',v_project.sessions_completed), calculation_version = 'songwriting_progression_v2', random_seed = v_seed, variance_applied = v_variance, completed_at = COALESCE(completed_at, timezone('utc', now())), updated_at = timezone('utc', now()) WHERE id = p_project_id;
  RETURN jsonb_build_object('song_id', v_song_id, 'final_score', v_final, 'breakdown', v_breakdown);
END;
$$;

NOTIFY pgrst, 'reload schema';

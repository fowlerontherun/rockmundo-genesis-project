-- Re-apply songwriting session RPCs which are missing from schema cache
CREATE OR REPLACE FUNCTION public.start_songwriting_session(
  p_profile_id uuid,
  p_project_id uuid,
  p_effort_hours integer DEFAULT 1,
  p_session_type text DEFAULT 'balanced',
  p_idempotency_key text DEFAULT NULL,
  p_activity_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_project public.songwriting_projects%ROWTYPE;
  v_start timestamptz := timezone('utc', now());
  v_end timestamptz;
  v_session_id uuid;
  v_activity_id uuid;
  v_existing public.songwriting_sessions%ROWTYPE;
  v_conflict uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='P0001'; END IF;
  IF p_effort_hours NOT IN (1,2,4) THEN RAISE EXCEPTION 'Only 1, 2 or 4-hour songwriting sessions are supported.' USING ERRCODE='P0001'; END IF;
  IF p_session_type NOT IN ('balanced','music','lyrics','arrangement','polish') THEN RAISE EXCEPTION 'Unsupported songwriting session type.' USING ERRCODE='P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id AND user_id = v_user) THEN RAISE EXCEPTION 'This project belongs to another character.' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_project FROM public.songwriting_projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The selected project is no longer available.' USING ERRCODE='P0001'; END IF;
  IF v_project.profile_id IS NULL AND v_project.user_id = v_user THEN
    UPDATE public.songwriting_projects SET profile_id = p_profile_id WHERE id = p_project_id RETURNING * INTO v_project;
  END IF;
  IF v_project.profile_id <> p_profile_id THEN RAISE EXCEPTION 'This project belongs to another character.' USING ERRCODE='P0001'; END IF;
  IF v_project.status IN ('completed','converted') OR v_project.completed_at IS NOT NULL OR v_project.song_id IS NOT NULL THEN RAISE EXCEPTION 'This songwriting project is already complete.' USING ERRCODE='P0001'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.songwriting_sessions WHERE project_id = p_project_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('session_id', v_existing.id, 'activity_id', v_existing.progress_breakdown->>'activity_id', 'duplicate', true, 'locked_until', v_existing.locked_until, 'project_id', p_project_id); END IF;
  END IF;

  IF p_activity_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.songwriting_sessions WHERE progress_breakdown->>'activity_id' = p_activity_id::text FOR UPDATE;
    IF FOUND AND v_existing.status = 'in_progress' THEN RAISE EXCEPTION 'This project already has an active session.' USING ERRCODE='P0001'; END IF;
    IF FOUND AND v_existing.status <> 'scheduled' THEN RAISE EXCEPTION 'This scheduled songwriting session can no longer be started.' USING ERRCODE='P0001'; END IF;
    IF FOUND THEN p_effort_hours := v_existing.effort_hours; p_session_type := v_existing.session_type; v_session_id := v_existing.id; END IF;
  END IF;

  v_end := v_start + make_interval(hours => p_effort_hours);
  SELECT id INTO v_conflict FROM public.player_scheduled_activities
  WHERE profile_id = p_profile_id AND status = 'in_progress' AND (p_activity_id IS NULL OR id <> p_activity_id) LIMIT 1;
  IF v_conflict IS NOT NULL THEN RAISE EXCEPTION 'You already have an activity in progress.' USING ERRCODE='P0001'; END IF;
  SELECT id INTO v_conflict FROM public.player_scheduled_activities
  WHERE profile_id = p_profile_id AND status IN ('scheduled','in_progress') AND (p_activity_id IS NULL OR id <> p_activity_id)
    AND tstzrange(scheduled_start, scheduled_end, '[)') && tstzrange(v_start, v_end, '[)') LIMIT 1;
  IF v_conflict IS NOT NULL THEN RAISE EXCEPTION 'This overlaps with another scheduled activity.' USING ERRCODE='P0001'; END IF;
  IF v_project.is_locked AND v_project.locked_until > v_start THEN RAISE EXCEPTION 'This project already has an active session.' USING ERRCODE='P0001'; END IF;

  IF v_session_id IS NULL THEN
    INSERT INTO public.songwriting_sessions(project_id, profile_id, user_id, session_start, session_end, locked_until, effort_hours, session_type, status, idempotency_key)
    VALUES (p_project_id, p_profile_id, v_user, v_start, NULL, v_end, p_effort_hours, p_session_type, 'in_progress', p_idempotency_key) RETURNING id INTO v_session_id;
  ELSE
    UPDATE public.songwriting_sessions SET session_start = v_start, session_end = NULL, locked_until = v_end, status = 'in_progress', idempotency_key = COALESCE(p_idempotency_key, idempotency_key) WHERE id = v_session_id;
  END IF;

  IF p_activity_id IS NULL THEN
    INSERT INTO public.player_scheduled_activities(user_id, profile_id, activity_type, scheduled_start, scheduled_end, duration_minutes, status, title, description, metadata)
    VALUES (v_user, p_profile_id, 'songwriting', v_start, v_end, p_effort_hours*60, 'in_progress', 'Songwriting: ' || COALESCE(v_project.title,'Untitled'), 'Working on song composition', jsonb_build_object('project_id', p_project_id, 'session_id', v_session_id, 'duration_hours', p_effort_hours, 'session_type', p_session_type)) RETURNING id INTO v_activity_id;
  ELSE
    v_activity_id := p_activity_id;
    UPDATE public.player_scheduled_activities SET status='in_progress', scheduled_start=v_start, scheduled_end=v_end, duration_minutes=p_effort_hours*60, metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('project_id', p_project_id, 'session_id', v_session_id, 'duration_hours', p_effort_hours, 'session_type', p_session_type) WHERE id=p_activity_id AND profile_id=p_profile_id AND status='scheduled';
    IF NOT FOUND THEN RAISE EXCEPTION 'This scheduled songwriting session can no longer be started.' USING ERRCODE='P0001'; END IF;
  END IF;

  UPDATE public.songwriting_sessions SET progress_breakdown = COALESCE(progress_breakdown,'{}'::jsonb) || jsonb_build_object('activity_id', v_activity_id) WHERE id = v_session_id;
  UPDATE public.songwriting_projects SET is_locked=true, locked_until=v_end, status='writing' WHERE id=p_project_id;
  RETURN jsonb_build_object('session_id', v_session_id, 'activity_id', v_activity_id, 'locked_until', v_end, 'effort_hours', p_effort_hours, 'project_id', p_project_id, 'status', 'in_progress');
EXCEPTION WHEN others THEN
  RAISE LOG 'songwriting_rpc_failure action=% profile_id=% project_id=% user_id=% duration=% activity_id=% sqlstate=% error=%', 'start_songwriting_session', p_profile_id, p_project_id, v_user, p_effort_hours, p_activity_id, SQLSTATE, SQLERRM;
  RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_songwriting_session(
  p_profile_id uuid,
  p_project_id uuid,
  p_scheduled_start timestamptz,
  p_effort_hours integer,
  p_session_type text DEFAULT 'balanced',
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_project public.songwriting_projects%ROWTYPE;
  v_end timestamptz;
  v_session_id uuid;
  v_activity_id uuid;
  v_existing public.songwriting_sessions%ROWTYPE;
  v_conflict uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='P0001'; END IF;
  IF p_effort_hours NOT IN (1,2,4) THEN RAISE EXCEPTION 'Only 1, 2 or 4-hour songwriting sessions are supported.' USING ERRCODE='P0001'; END IF;
  IF p_session_type NOT IN ('balanced','music','lyrics','arrangement','polish') THEN RAISE EXCEPTION 'Unsupported songwriting session type.' USING ERRCODE='P0001'; END IF;
  IF p_scheduled_start <= timezone('utc', now()) THEN RAISE EXCEPTION 'That time is in the past.' USING ERRCODE='P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id AND user_id = v_user) THEN RAISE EXCEPTION 'This project belongs to another character.' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_project FROM public.songwriting_projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The selected project is no longer available.' USING ERRCODE='P0001'; END IF;
  IF v_project.profile_id IS NULL AND v_project.user_id = v_user THEN UPDATE public.songwriting_projects SET profile_id=p_profile_id WHERE id=p_project_id RETURNING * INTO v_project; END IF;
  IF v_project.profile_id <> p_profile_id THEN RAISE EXCEPTION 'This project belongs to another character.' USING ERRCODE='P0001'; END IF;
  IF v_project.status IN ('completed','converted') OR v_project.completed_at IS NOT NULL OR v_project.song_id IS NOT NULL THEN RAISE EXCEPTION 'The selected project is no longer available.' USING ERRCODE='P0001'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.songwriting_sessions WHERE project_id=p_project_id AND idempotency_key=p_idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('session_id', v_existing.id, 'activity_id', v_existing.progress_breakdown->>'activity_id', 'duplicate', true, 'scheduled_start', v_existing.session_start, 'scheduled_end', v_existing.locked_until, 'project_id', p_project_id); END IF;
  END IF;

  v_end := p_scheduled_start + make_interval(hours => p_effort_hours);
  SELECT id INTO v_conflict FROM public.player_scheduled_activities
  WHERE profile_id=p_profile_id AND status IN ('scheduled','in_progress') AND tstzrange(scheduled_start, scheduled_end, '[)') && tstzrange(p_scheduled_start, v_end, '[)') LIMIT 1;
  IF v_conflict IS NOT NULL THEN RAISE EXCEPTION 'This overlaps with another scheduled activity.' USING ERRCODE='P0001'; END IF;

  SELECT id INTO v_conflict FROM public.songwriting_sessions
  WHERE project_id=p_project_id AND status IN ('scheduled','in_progress') AND tstzrange(session_start, COALESCE(locked_until, session_end), '[)') && tstzrange(p_scheduled_start, v_end, '[)') LIMIT 1;
  IF v_conflict IS NOT NULL THEN RAISE EXCEPTION 'This project already has a session planned at that time.' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.songwriting_sessions(project_id, profile_id, user_id, session_start, session_end, locked_until, effort_hours, session_type, status, idempotency_key)
  VALUES (p_project_id, p_profile_id, v_user, p_scheduled_start, NULL, v_end, p_effort_hours, p_session_type, 'scheduled', p_idempotency_key) RETURNING id INTO v_session_id;
  INSERT INTO public.player_scheduled_activities(user_id, profile_id, activity_type, scheduled_start, scheduled_end, duration_minutes, status, title, description, metadata)
  VALUES (v_user, p_profile_id, 'songwriting', p_scheduled_start, v_end, p_effort_hours*60, 'scheduled', 'Songwriting: ' || COALESCE(v_project.title,'Untitled'), 'Planned songwriting session', jsonb_build_object('project_id', p_project_id, 'session_id', v_session_id, 'duration_hours', p_effort_hours, 'session_type', p_session_type, 'lifecycle', 'scheduled_in_progress_completed')) RETURNING id INTO v_activity_id;
  UPDATE public.songwriting_sessions SET progress_breakdown = COALESCE(progress_breakdown,'{}'::jsonb) || jsonb_build_object('activity_id', v_activity_id) WHERE id=v_session_id;
  RETURN jsonb_build_object('activity_id', v_activity_id, 'session_id', v_session_id, 'scheduled_start', p_scheduled_start, 'scheduled_end', v_end, 'project_id', p_project_id, 'status', 'scheduled');
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_songwriting_session(uuid, uuid, integer, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_songwriting_session(uuid, uuid, timestamptz, integer, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
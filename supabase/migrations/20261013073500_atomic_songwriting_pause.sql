-- An active songwriting session may only be paused by its owning character.
-- End the session, release the project lock, and reconcile the linked activity together.
CREATE OR REPLACE FUNCTION public.pause_songwriting_session_atomic(
  p_profile_id uuid, p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_session public.songwriting_sessions%ROWTYPE;
  v_project public.songwriting_projects%ROWTYPE;
  v_activity uuid;
BEGIN
  IF auth.uid() IS NULL OR p_profile_id IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'Authentication and session are required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid()
  ) THEN
    RAISE EXCEPTION 'This character does not belong to the account';
  END IF;
  SELECT * INTO v_session FROM public.songwriting_sessions
    WHERE id=p_session_id AND profile_id=p_profile_id FOR UPDATE;
  IF NOT FOUND OR v_session.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Only an active songwriting session can be paused';
  END IF;
  SELECT * INTO v_project FROM public.songwriting_projects
    WHERE id=v_session.project_id AND profile_id=p_profile_id FOR UPDATE;
  IF NOT FOUND OR v_project.status IN ('completed','converted')
      OR v_project.song_id IS NOT NULL THEN
    RAISE EXCEPTION 'Songwriting project is not available';
  END IF;
  v_activity := NULLIF(v_session.progress_breakdown->>'activity_id','')::uuid;
  IF v_activity IS NOT NULL THEN
    UPDATE public.player_scheduled_activities
      SET status='cancelled',completed_at=now(),
        metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('paused_session_id',p_session_id)
      WHERE id=v_activity AND profile_id=p_profile_id AND activity_type='songwriting'
        AND status IN ('scheduled','in_progress');
  END IF;
  UPDATE public.songwriting_sessions
    SET status='paused',session_end=now(),locked_until=now(),
      notes='Session paused by user'
    WHERE id=p_session_id;
  UPDATE public.songwriting_projects
    SET is_locked=false,locked_until=NULL
    WHERE id=v_session.project_id;
  RETURN jsonb_build_object('session_id',p_session_id,'project_id',v_session.project_id,'status','paused');
END $$;
REVOKE ALL ON FUNCTION public.pause_songwriting_session_atomic(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_songwriting_session_atomic(uuid,uuid) TO authenticated;

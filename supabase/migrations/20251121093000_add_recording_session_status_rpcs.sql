-- RPC helpers for managing recording session workflow status
CREATE OR REPLACE FUNCTION public.update_recording_session_status(
  p_session_id uuid,
  p_status text
)
RETURNS public.recording_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.recording_sessions;
BEGIN
  SELECT *
    INTO v_session
    FROM public.recording_sessions
   WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recording session % was not found.', p_session_id;
  END IF;

  IF v_session.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You are not authorized to update this recording session.';
  END IF;

  IF p_status NOT IN ('scheduled', 'in_progress', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid recording session status: %', p_status;
  END IF;

  IF v_session.status = p_status THEN
    RETURN v_session;
  END IF;

  IF NOT (
    (v_session.status = 'scheduled' AND p_status IN ('in_progress', 'cancelled')) OR
    (v_session.status = 'in_progress' AND p_status IN ('completed', 'cancelled')) OR
    (v_session.status = 'completed' AND p_status = 'completed') OR
    (v_session.status = 'cancelled' AND p_status = 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Status transition from % to % is not allowed.', v_session.status, p_status;
  END IF;

  UPDATE public.recording_sessions
     SET status = p_status,
         started_at = CASE
           WHEN p_status = 'in_progress' AND v_session.started_at IS NULL THEN now()
           ELSE v_session.started_at
         END,
         completed_at = CASE
           WHEN p_status = 'completed' THEN now()
           WHEN p_status = 'cancelled' THEN v_session.completed_at
           ELSE NULL
         END,
         updated_at = now()
   WHERE id = p_session_id
   RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_recording_session_stage(
  p_session_id uuid
)
RETURNS public.recording_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.recording_sessions;
  v_next_stage text;
BEGIN
  SELECT *
    INTO v_session
    FROM public.recording_sessions
   WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recording session % was not found.', p_session_id;
  END IF;

  IF v_session.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You are not authorized to modify this recording session.';
  END IF;

  IF v_session.stage IS NULL THEN
    v_session.stage := 'recording';
  END IF;

  IF v_session.stage NOT IN ('recording', 'mixing', 'mastering') THEN
    RAISE EXCEPTION 'Unknown recording session stage: %', v_session.stage;
  END IF;

  IF v_session.stage = 'mastering' THEN
    RAISE EXCEPTION 'Recording session is already at the final mastering stage.';
  END IF;

  v_next_stage := CASE v_session.stage
    WHEN 'recording' THEN 'mixing'
    WHEN 'mixing' THEN 'mastering'
    ELSE NULL
  END;

  UPDATE public.recording_sessions
     SET stage = v_next_stage,
         status = CASE
           WHEN v_session.status IN ('completed', 'cancelled') THEN v_session.status
           ELSE 'scheduled'
         END,
         completed_at = CASE
           WHEN v_session.status = 'completed' THEN v_session.completed_at
           ELSE NULL
         END,
         updated_at = now()
   WHERE id = p_session_id
   RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

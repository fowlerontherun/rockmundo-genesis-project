ALTER TABLE public.bug_report_responses
  ADD COLUMN IF NOT EXISTS responder_type TEXT NOT NULL DEFAULT 'admin';

UPDATE public.bug_report_responses
SET responder_type = 'admin'
WHERE responder_type IS NULL OR responder_type NOT IN ('admin', 'player');

ALTER TABLE public.bug_report_responses
  DROP CONSTRAINT IF EXISTS bug_report_responses_responder_type_check;
ALTER TABLE public.bug_report_responses
  ADD CONSTRAINT bug_report_responses_responder_type_check
  CHECK (responder_type IN ('admin', 'player'));

CREATE OR REPLACE FUNCTION public.respond_to_bug_report(
  p_report_id UUID,
  p_message TEXT,
  p_status TEXT DEFAULT NULL
)
RETURNS public.bug_report_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_report public.bug_reports;
  v_response public.bug_report_responses;
  v_message TEXT := btrim(coalesce(p_message, ''));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can respond to bug reports';
  END IF;

  IF v_message = '' THEN
    RAISE EXCEPTION 'Response message cannot be empty';
  END IF;

  SELECT * INTO v_report FROM public.bug_reports WHERE id = p_report_id;
  IF v_report.id IS NULL THEN
    RAISE EXCEPTION 'Bug report not found';
  END IF;

  IF p_status IS NOT NULL AND p_status <> v_report.status THEN
    UPDATE public.bug_reports
    SET status = p_status
    WHERE id = p_report_id
    RETURNING * INTO v_report;
  END IF;

  INSERT INTO public.bug_report_responses (
    bug_report_id,
    responder_user_id,
    responder_type,
    message,
    status_at_response
  ) VALUES (
    p_report_id,
    auth.uid(),
    'admin',
    v_message,
    v_report.status
  )
  RETURNING * INTO v_response;

  IF v_report.user_id IS NOT NULL THEN
    INSERT INTO public.player_inbox (
      user_id, category, priority, title, message, metadata,
      action_type, action_data, related_entity_type, related_entity_id
    ) VALUES (
      v_report.user_id,
      'system'::public.inbox_category,
      'normal'::public.inbox_priority,
      'Bug report update: ' || left(v_report.title, 100),
      v_message || E'\n\nCurrent status: ' || v_report.status,
      jsonb_build_object(
        'bug_report_id', v_report.id,
        'status', v_report.status,
        'response_id', v_response.id
      ),
      'navigate',
      jsonb_build_object('route', '/my-bug-reports'),
      'bug_report_response',
      v_response.id
    );
  END IF;

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_bug_report(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_bug_report(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.reply_to_bug_report(
  p_report_id UUID,
  p_message TEXT,
  p_confirm_fixed BOOLEAN DEFAULT false
)
RETURNS public.bug_report_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_report public.bug_reports;
  v_response public.bug_report_responses;
  v_message TEXT := btrim(coalesce(p_message, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_report
  FROM public.bug_reports
  WHERE id = p_report_id
    AND user_id = auth.uid();

  IF v_report.id IS NULL THEN
    RAISE EXCEPTION 'Bug report not found';
  END IF;

  IF v_message = '' AND NOT p_confirm_fixed THEN
    RAISE EXCEPTION 'Reply message cannot be empty';
  END IF;

  IF p_confirm_fixed THEN
    UPDATE public.bug_reports
    SET status = 'closed'
    WHERE id = p_report_id
    RETURNING * INTO v_report;

    IF v_message = '' THEN
      v_message := 'Confirmed by player: the reported issue is fixed.';
    END IF;
  END IF;

  INSERT INTO public.bug_report_responses (
    bug_report_id,
    responder_user_id,
    responder_type,
    message,
    status_at_response
  ) VALUES (
    p_report_id,
    auth.uid(),
    'player',
    v_message,
    v_report.status
  )
  RETURNING * INTO v_response;

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.reply_to_bug_report(UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reply_to_bug_report(UUID, TEXT, BOOLEAN) TO authenticated;

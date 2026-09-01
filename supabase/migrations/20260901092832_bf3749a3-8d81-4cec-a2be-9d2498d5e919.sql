CREATE TABLE IF NOT EXISTS public.bug_report_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bug_report_id UUID NOT NULL REFERENCES public.bug_reports(id) ON DELETE CASCADE,
  responder_user_id UUID,
  message TEXT NOT NULL,
  status_at_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bug_report_responses TO authenticated;
GRANT ALL ON public.bug_report_responses TO service_role;

ALTER TABLE public.bug_report_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage bug report responses" ON public.bug_report_responses;
CREATE POLICY "Admins manage bug report responses"
  ON public.bug_report_responses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Reporters can view responses to their reports" ON public.bug_report_responses;
CREATE POLICY "Reporters can view responses to their reports"
  ON public.bug_report_responses FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bug_reports br
    WHERE br.id = bug_report_responses.bug_report_id
      AND br.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_bug_report_responses_report ON public.bug_report_responses(bug_report_id, created_at DESC);

DROP TRIGGER IF EXISTS update_bug_report_responses_updated_at ON public.bug_report_responses;
CREATE TRIGGER update_bug_report_responses_updated_at
  BEFORE UPDATE ON public.bug_report_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
    UPDATE public.bug_reports SET status = p_status WHERE id = p_report_id
    RETURNING * INTO v_report;
  END IF;

  INSERT INTO public.bug_report_responses (bug_report_id, responder_user_id, message, status_at_response)
  VALUES (p_report_id, auth.uid(), v_message, v_report.status)
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
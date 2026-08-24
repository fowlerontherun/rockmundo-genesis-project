-- Close the B3 performance-resolution boundary. Outcomes are produced once by a
-- trusted worker from persisted session/audience facts and become immutable.

ALTER FUNCTION public.calculate_festival_performance_outcome(uuid, text)
  RENAME TO _calculate_festival_performance_outcome;

CREATE TABLE public.festival_performance_resolution_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.festival_performance_sessions(id) ON DELETE RESTRICT,
  outcome_id uuid NOT NULL UNIQUE REFERENCES public.festival_performance_outcomes(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  model_version text NOT NULL,
  source_session_version integer NOT NULL,
  authoritative_inputs jsonb NOT NULL,
  input_digest text NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, idempotency_key)
);

ALTER TABLE public.festival_performance_resolution_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_performance_resolution_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.festival_performance_resolution_receipts TO authenticated;
GRANT ALL ON public.festival_performance_resolution_receipts TO service_role;
CREATE POLICY festival_performance_resolution_receipt_read
  ON public.festival_performance_resolution_receipts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.festival_performance_sessions session
    WHERE session.id = session_id
      AND (public.is_active_band_member(session.band_id)
        OR public.can_manage_festival_brand(session.festival_id))
  ));

CREATE OR REPLACE FUNCTION public.prevent_festival_resolution_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Festival performance resolution receipts are immutable';
END;
$$;
CREATE TRIGGER tg_festival_resolution_receipt_immutable
  BEFORE UPDATE OR DELETE ON public.festival_performance_resolution_receipts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_festival_resolution_receipt_mutation();

CREATE OR REPLACE FUNCTION public.resolve_festival_performance(
  p_session_id uuid,
  p_idempotency_key text
)
RETURNS public.festival_performance_outcomes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_row public.festival_performance_sessions%ROWTYPE;
  outcome_row public.festival_performance_outcomes%ROWTYPE;
  receipt_row public.festival_performance_resolution_receipts%ROWTYPE;
  inputs jsonb;
  input_digest text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Festival outcomes are resolved by the trusted worker only'
      USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Idempotency key required';
  END IF;

  SELECT * INTO session_row FROM public.festival_performance_sessions
    WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival performance session not found' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO receipt_row FROM public.festival_performance_resolution_receipts
    WHERE session_id = session_row.id;
  IF FOUND THEN
    SELECT * INTO outcome_row FROM public.festival_performance_outcomes WHERE id = receipt_row.outcome_id;
    RETURN outcome_row;
  END IF;
  IF session_row.status NOT IN ('completed', 'partially_completed', 'abandoned', 'cancelled', 'no_show') THEN
    RAISE EXCEPTION 'Session is not in an outcome-eligible terminal state';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.festival_performance_audience_snapshots audience
    WHERE audience.session_id = session_row.id) THEN
    RAISE EXCEPTION 'Canonical performance audience snapshot required';
  END IF;

  -- Only persisted authority enters the receipt. Client presentation metadata is
  -- deliberately absent; set progression is represented by canonical events.
  inputs := jsonb_build_object(
    'session', jsonb_build_object('id', session_row.id, 'status', session_row.status,
      'version', session_row.session_version, 'band_id', session_row.band_id,
      'setlist', session_row.setlist_snapshot, 'readiness', session_row.readiness_snapshot,
      'started_at', session_row.actual_start_at, 'ended_at', session_row.actual_end_at,
      'completed_position', session_row.current_setlist_position),
    'audience', (SELECT to_jsonb(audience) FROM public.festival_performance_audience_snapshots audience
      WHERE audience.session_id = session_row.id),
    'requirements', (SELECT COALESCE(jsonb_agg(to_jsonb(requirement) ORDER BY requirement.requirement_code), '[]')
      FROM public.festival_performance_requirements requirement WHERE requirement.session_id = session_row.id),
    'attendance', (SELECT COALESCE(jsonb_agg(to_jsonb(attendance) ORDER BY attendance.id), '[]')
      FROM public.festival_performance_attendance attendance WHERE attendance.session_id = session_row.id),
    'incidents', (SELECT COALESCE(jsonb_agg(to_jsonb(incident) ORDER BY incident.opened_at, incident.id), '[]')
      FROM public.festival_performance_incidents incident WHERE incident.session_id = session_row.id),
    'progression_events', (SELECT COALESCE(jsonb_agg(to_jsonb(event) ORDER BY event.event_time, event.id), '[]')
      FROM public.festival_performance_session_events event WHERE event.session_id = session_row.id
        AND event.event_type IN ('performance_started', 'setlist_advanced', 'performance_completed'))
  );
  input_digest := public.festival_outcome_hash(inputs);
  outcome_row := public._calculate_festival_performance_outcome(session_row.id, p_idempotency_key);

  UPDATE public.festival_performance_outcomes
    SET status = 'finalised', finalised_at = now(),
      metadata = metadata || jsonb_build_object('authority', 'canonical-performance-worker',
        'authoritative_input_digest', input_digest)
    WHERE id = outcome_row.id RETURNING * INTO outcome_row;
  INSERT INTO public.festival_performance_resolution_receipts
    (session_id, outcome_id, idempotency_key, model_version, source_session_version,
      authoritative_inputs, input_digest)
    VALUES (session_row.id, outcome_row.id, p_idempotency_key, outcome_row.model_version,
      session_row.session_version, inputs, input_digest);
  UPDATE public.festival_performance_sessions SET outcome_status = 'outcome_finalised', updated_at = now()
    WHERE id = session_row.id;
  INSERT INTO public.festival_performance_session_events(session_id, event_type, idempotency_key, metadata)
    VALUES (session_row.id, 'performance_outcome_finalised', p_idempotency_key,
      jsonb_build_object('outcome_id', outcome_row.id, 'input_digest', input_digest))
    ON CONFLICT DO NOTHING;
  RETURN outcome_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_final_festival_outcome_child_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE parent_id uuid; parent_status public.festival_outcome_status;
BEGIN
  parent_id := COALESCE((to_jsonb(OLD)->>'outcome_id')::uuid, (to_jsonb(NEW)->>'outcome_id')::uuid);
  SELECT status INTO parent_status FROM public.festival_performance_outcomes WHERE id = parent_id;
  IF parent_status IN ('finalised', 'invalidated') THEN
    RAISE EXCEPTION 'Finalised festival outcome evidence is immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['festival_song_performance_outcomes', 'festival_fan_conversion_outcomes',
    'festival_performance_effects', 'festival_media_outcomes', 'festival_sponsor_outcomes',
    'festival_performance_highlights', 'festival_outcome_publications']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tg_final_outcome_child_immutable ON public.%I', table_name);
    EXECUTE format('CREATE TRIGGER tg_final_outcome_child_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_final_festival_outcome_child_mutation()', table_name);
  END LOOP;
END;
$$;

-- Browser code may observe results, but cannot calculate, replay or mutate them.
REVOKE ALL ON FUNCTION public._calculate_festival_performance_outcome(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._calculate_festival_performance_outcome(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.resolve_festival_performance(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_festival_performance(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.prevent_festival_resolution_receipt_mutation(),
  public.prevent_final_festival_outcome_child_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_festival_performance(uuid, integer, text, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_festival_performance(uuid, integer, text, jsonb, text) TO service_role;

COMMENT ON FUNCTION public.resolve_festival_performance(uuid, text) IS
  'B3 worker-only, one-shot festival resolution from canonical audience, readiness, attendance, incident and setlist facts.';

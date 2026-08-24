-- Backlog B3: make canonical festival outcome resolution a single, audited,
-- server-authoritative operation. The v1 calculator remains the deterministic
-- implementation, but is no longer a browser-callable mutation boundary.

ALTER FUNCTION public.calculate_festival_performance_outcome(uuid, text)
  RENAME TO _calculate_festival_performance_outcome;

REVOKE ALL ON FUNCTION public._calculate_festival_performance_outcome(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._calculate_festival_performance_outcome(uuid, text)
  TO service_role;

CREATE TABLE public.festival_performance_resolution_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE
    REFERENCES public.festival_performance_sessions(id) ON DELETE RESTRICT,
  audience_snapshot_id uuid
    REFERENCES public.festival_performance_audience_snapshots(id) ON DELETE RESTRICT,
  session_version integer NOT NULL,
  model_version text NOT NULL,
  input_hash text NOT NULL,
  authoritative_facts jsonb NOT NULL,
  modifier_evidence jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  captured_by_profile_id uuid REFERENCES public.profiles(id),
  CHECK (jsonb_typeof(authoritative_facts) = 'object'),
  CHECK (jsonb_typeof(modifier_evidence) = 'object')
);

ALTER TABLE public.festival_performance_resolution_inputs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_performance_resolution_inputs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.festival_performance_resolution_inputs TO authenticated;

CREATE POLICY festival_resolution_inputs_read
  ON public.festival_performance_resolution_inputs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.festival_performance_sessions session
    WHERE session.id = session_id
      AND (public.is_active_band_member(session.band_id)
        OR public.can_manage_festival_brand(session.festival_id))
  ));

-- Resolution source records are evidence, not player-editable game state.
CREATE OR REPLACE FUNCTION public.prevent_festival_resolution_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Festival performance resolution evidence is immutable';
END;
$$;

CREATE TRIGGER festival_resolution_inputs_immutable
  BEFORE UPDATE OR DELETE ON public.festival_performance_resolution_inputs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_festival_resolution_evidence_mutation();
CREATE TRIGGER festival_audience_snapshot_immutable
  BEFORE UPDATE OR DELETE ON public.festival_performance_audience_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.prevent_festival_resolution_evidence_mutation();
CREATE TRIGGER festival_song_outcome_immutable
  BEFORE UPDATE OR DELETE ON public.festival_song_performance_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_festival_resolution_evidence_mutation();

-- There may be historical invalidated versions, but never more than one live
-- outcome for a session. This makes multi-tab and worker retries converge.
CREATE UNIQUE INDEX uq_festival_performance_outcomes_one_live_session
  ON public.festival_performance_outcomes(session_id)
  WHERE status NOT IN ('invalidated', 'superseded');

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
  audience_row public.festival_performance_audience_snapshots%ROWTYPE;
  existing public.festival_performance_outcomes%ROWTYPE;
  outcome_row public.festival_performance_outcomes%ROWTYPE;
  facts jsonb;
  modifiers jsonb;
  source_hash text;
BEGIN
  IF nullif(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Idempotency key required';
  END IF;

  SELECT * INTO session_row FROM public.festival_performance_sessions
    WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Festival performance session not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (public.can_manage_festival_brand(session_row.festival_id)
    OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only the festival operator or outcome worker may resolve a performance'
      USING ERRCODE = '42501';
  END IF;
  IF session_row.status NOT IN
    ('completed', 'partially_completed', 'abandoned', 'cancelled', 'no_show') THEN
    RAISE EXCEPTION 'Performance is not in an outcome-eligible terminal state';
  END IF;

  SELECT * INTO existing FROM public.festival_performance_outcomes
    WHERE session_id = session_row.id
      AND status NOT IN ('invalidated', 'superseded')
    ORDER BY calculated_at DESC LIMIT 1;
  IF FOUND THEN RETURN existing; END IF;

  SELECT * INTO audience_row FROM public.festival_performance_audience_snapshots
    WHERE session_id = session_row.id FOR SHARE;

  facts := jsonb_build_object(
    'session', to_jsonb(session_row),
    'audience', CASE WHEN audience_row.id IS NULL THEN NULL ELSE to_jsonb(audience_row) END,
    'requirements', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.requirement_code), '[]')
      FROM public.festival_performance_requirements r WHERE r.session_id = session_row.id),
    'equipment', (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id), '[]')
      FROM public.festival_session_equipment e WHERE e.session_id = session_row.id),
    'crew', (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id), '[]')
      FROM public.festival_session_crew c WHERE c.session_id = session_row.id),
    'incidents', (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.opened_at, i.id), '[]')
      FROM public.festival_performance_incidents i WHERE i.session_id = session_row.id)
  );
  -- Unsupported domains are explicitly neutral. No score can be smuggled in
  -- from presentation metadata or a browser mini-game.
  modifiers := jsonb_build_object(
    'readiness', coalesce(session_row.readiness_snapshot, '{}'::jsonb),
    'setlist', coalesce(session_row.setlist_snapshot, '{}'::jsonb),
    'rivalry', jsonb_build_object('value', 0, 'reason', 'no authoritative rivalry fact'),
    'sponsor', jsonb_build_object('value', 0, 'reason', 'settlement-only downstream effect'),
    'media', jsonb_build_object('value', 0, 'reason', 'outcome-derived downstream effect'),
    'presentation_input', jsonb_build_object('value', 0, 'reason', 'cosmetic only')
  );
  source_hash := public.festival_outcome_hash(
    jsonb_build_object('facts', facts, 'modifiers', modifiers,
      'model_version', 'festival_performance_outcome_v1'));

  INSERT INTO public.festival_performance_resolution_inputs(
    session_id, audience_snapshot_id, session_version, model_version,
    input_hash, authoritative_facts, modifier_evidence, captured_by_profile_id
  ) VALUES (
    session_row.id, audience_row.id, session_row.session_version,
    'festival_performance_outcome_v1', source_hash, facts, modifiers,
    public.current_profile_id_safe()
  );

  outcome_row := public._calculate_festival_performance_outcome(
    session_row.id, p_idempotency_key);
  UPDATE public.festival_performance_outcomes
    SET status = 'finalised', finalised_at = coalesce(finalised_at, now()),
      metadata = metadata || jsonb_build_object(
        'resolution_input_hash', source_hash,
        'authority', 'server',
        'presentation_input_applied', false)
    WHERE id = outcome_row.id
    RETURNING * INTO outcome_row;

  INSERT INTO public.festival_performance_session_events(
    session_id, actor_profile_id, event_type, idempotency_key, metadata
  ) VALUES (
    session_row.id, public.current_profile_id_safe(), 'performance_resolved',
    p_idempotency_key, jsonb_build_object(
      'outcome_id', outcome_row.id, 'input_hash', source_hash,
      'model_version', outcome_row.model_version)
  ) ON CONFLICT DO NOTHING;
  RETURN outcome_row;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_festival_performance(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_festival_performance(uuid, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.resolve_festival_performance(uuid, text) IS
  'B3 single-resolution authority. Locks the session, freezes canonical inputs, ignores client scoring, and finalises an immutable outcome.';

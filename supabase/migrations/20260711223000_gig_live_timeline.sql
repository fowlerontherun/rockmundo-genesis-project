-- Gig Preparation Phase 6: server-driven live gig timeline and tactical decisions.
CREATE TABLE IF NOT EXISTS public.gig_live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','preshow','ready_to_start','live','paused_for_decision','resolving','completed','cancelled','failed')),
  started_at timestamptz,
  expected_end_at timestamptz,
  completed_at timestamptz,
  current_segment_index integer NOT NULL DEFAULT 0 CHECK (current_segment_index >= 0),
  current_song_item_id uuid REFERENCES public.gig_setlist_items(id) ON DELETE SET NULL,
  crowd_energy integer NOT NULL DEFAULT 50 CHECK (crowd_energy BETWEEN 0 AND 100),
  fan_satisfaction integer NOT NULL DEFAULT 50 CHECK (fan_satisfaction BETWEEN 0 AND 100),
  performance_quality integer NOT NULL DEFAULT 0 CHECK (performance_quality BETWEEN 0 AND 100),
  band_stamina integer NOT NULL DEFAULT 85 CHECK (band_stamina BETWEEN 0 AND 100),
  momentum integer NOT NULL DEFAULT 0 CHECK (momentum BETWEEN -25 AND 25),
  incident_risk integer NOT NULL DEFAULT 0 CHECK (incident_risk BETWEEN 0 AND 100),
  simulation_version integer NOT NULL DEFAULT 1,
  last_processed_at timestamptz,
  completion_idempotency_key text,
  finance_idempotency_key text,
  final_result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  projection_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  config_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gig_id),
  UNIQUE(completion_idempotency_key),
  UNIQUE(finance_idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.gig_live_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.gig_live_sessions(id) ON DELETE CASCADE,
  segment_index integer NOT NULL CHECK (segment_index >= 0),
  segment_type text NOT NULL CHECK (segment_type IN ('intro','song','transition','crowd_interaction','incident','decision','encore_break','encore_song','outro')),
  setlist_item_id uuid REFERENCES public.gig_setlist_items(id) ON DELETE SET NULL,
  song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  planned_start_at timestamptz NOT NULL,
  planned_duration_seconds integer NOT NULL CHECK (planned_duration_seconds > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','resolved','skipped','blocked')),
  started_at timestamptz,
  resolved_at timestamptz,
  result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, segment_index)
);

CREATE TABLE IF NOT EXISTS public.gig_live_song_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.gig_live_sessions(id) ON DELETE CASCADE,
  segment_id uuid NOT NULL REFERENCES public.gig_live_segments(id) ON DELETE CASCADE,
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  setlist_item_id uuid REFERENCES public.gig_setlist_items(id) ON DELETE SET NULL,
  song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  position integer NOT NULL CHECK (position > 0),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  rating text NOT NULL CHECK (rating IN ('disaster','poor','average','good','great','outstanding')),
  technical_score integer NOT NULL CHECK (technical_score BETWEEN 0 AND 100),
  performance_score integer NOT NULL CHECK (performance_score BETWEEN 0 AND 100),
  audience_response integer NOT NULL CHECK (audience_response BETWEEN 0 AND 100),
  energy_before integer NOT NULL CHECK (energy_before BETWEEN 0 AND 100),
  energy_after integer NOT NULL CHECK (energy_after BETWEEN 0 AND 100),
  satisfaction_before integer NOT NULL CHECK (satisfaction_before BETWEEN 0 AND 100),
  satisfaction_after integer NOT NULL CHECK (satisfaction_after BETWEEN 0 AND 100),
  stamina_before integer NOT NULL CHECK (stamina_before BETWEEN 0 AND 100),
  stamina_after integer NOT NULL CHECK (stamina_after BETWEEN 0 AND 100),
  momentum_before integer NOT NULL CHECK (momentum_before BETWEEN -25 AND 25),
  momentum_after integer NOT NULL CHECK (momentum_after BETWEEN -25 AND 25),
  breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  incidents jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(segment_id),
  UNIQUE(session_id, position)
);

CREATE TABLE IF NOT EXISTS public.gig_live_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.gig_live_sessions(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES public.gig_live_segments(id) ON DELETE SET NULL,
  incident_type text NOT NULL,
  category text NOT NULL CHECK (category IN ('performance','equipment','production','crowd','venue','positive')),
  severity text NOT NULL CHECK (severity IN ('minor','moderate','major','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','awaiting_decision','resolved','expired','automatic','cancelled')),
  decision_deadline timestamptz,
  generation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, segment_id, incident_type)
);

CREATE TABLE IF NOT EXISTS public.gig_live_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.gig_live_sessions(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES public.gig_live_incidents(id) ON DELETE SET NULL,
  decision_type text NOT NULL,
  selected_option text NOT NULL,
  decided_by_player_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  decision_source text NOT NULL CHECK (decision_source IN ('player','delegated_staff','automatic_fallback','system')),
  requirements_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(incident_id),
  UNIQUE(session_id, decision_type, decided_at)
);

CREATE TABLE IF NOT EXISTS public.gig_live_setlist_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.gig_live_sessions(id) ON DELETE CASCADE,
  change_type text NOT NULL CHECK (change_type IN ('skip','swap','replace','move_favourite','add_encore','remove_encore','shorten_set')),
  requested_by_player_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  change_source text NOT NULL CHECK (change_source IN ('player','automatic_fallback','system')),
  before_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gig_live_sessions_band_status ON public.gig_live_sessions(band_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_gig_live_segments_due ON public.gig_live_segments(status, planned_start_at, segment_index);
CREATE INDEX IF NOT EXISTS idx_gig_live_song_results_gig ON public.gig_live_song_results(gig_id, position);
CREATE INDEX IF NOT EXISTS idx_gig_live_incidents_session_status ON public.gig_live_incidents(session_id, status, decision_deadline);
CREATE INDEX IF NOT EXISTS idx_gig_live_decisions_session ON public.gig_live_decisions(session_id, decided_at DESC);

ALTER TABLE public.gig_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_live_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_live_song_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_live_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_live_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_live_setlist_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members can view live sessions" ON public.gig_live_sessions FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = gig_live_sessions.band_id AND bm.user_id = auth.uid()));
CREATE POLICY "Band managers can manage live sessions" ON public.gig_live_sessions FOR ALL USING (public.is_band_leader_or_manager(band_id, auth.uid())) WITH CHECK (public.is_band_leader_or_manager(band_id, auth.uid()));
CREATE POLICY "Band members can view live segments" ON public.gig_live_segments FOR SELECT USING (EXISTS (SELECT 1 FROM public.gig_live_sessions s JOIN public.band_members bm ON bm.band_id = s.band_id WHERE s.id = gig_live_segments.session_id AND bm.user_id = auth.uid()));
CREATE POLICY "Band members can view live song results" ON public.gig_live_song_results FOR SELECT USING (EXISTS (SELECT 1 FROM public.gig_live_sessions s JOIN public.band_members bm ON bm.band_id = s.band_id WHERE s.id = gig_live_song_results.session_id AND bm.user_id = auth.uid()));
CREATE POLICY "Band members can view live incidents" ON public.gig_live_incidents FOR SELECT USING (EXISTS (SELECT 1 FROM public.gig_live_sessions s JOIN public.band_members bm ON bm.band_id = s.band_id WHERE s.id = gig_live_incidents.session_id AND bm.user_id = auth.uid()));
CREATE POLICY "Band members can view live decisions" ON public.gig_live_decisions FOR SELECT USING (EXISTS (SELECT 1 FROM public.gig_live_sessions s JOIN public.band_members bm ON bm.band_id = s.band_id WHERE s.id = gig_live_decisions.session_id AND bm.user_id = auth.uid()));
CREATE POLICY "Band managers can insert live decisions" ON public.gig_live_decisions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.gig_live_sessions s LEFT JOIN public.gig_live_incidents i ON i.id = gig_live_decisions.incident_id WHERE s.id = gig_live_decisions.session_id AND public.is_band_leader_or_manager(s.band_id, auth.uid()) AND (i.id IS NULL OR (i.status = 'awaiting_decision' AND i.decision_deadline > now()))));
CREATE POLICY "Band members can view live setlist changes" ON public.gig_live_setlist_changes FOR SELECT USING (EXISTS (SELECT 1 FROM public.gig_live_sessions s JOIN public.band_members bm ON bm.band_id = s.band_id WHERE s.id = gig_live_setlist_changes.session_id AND bm.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.start_gig_live_session(p_gig_id uuid, p_initial_state jsonb, p_segments jsonb)
RETURNS public.gig_live_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gig record; v_session public.gig_live_sessions; v_segment jsonb;
BEGIN
  SELECT id, band_id, status, scheduled_date INTO v_gig FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gig not found'; END IF;
  IF v_gig.status IN ('completed','cancelled','failed') THEN RAISE EXCEPTION 'Gig cannot start live session from terminal state'; END IF;
  INSERT INTO public.gig_live_sessions(gig_id, band_id, status, started_at, expected_end_at, current_segment_index, crowd_energy, fan_satisfaction, performance_quality, band_stamina, momentum, incident_risk, simulation_version, last_processed_at, config_snapshot)
  VALUES (p_gig_id, v_gig.band_id, COALESCE(p_initial_state->>'status','live'), COALESCE((p_initial_state->>'startedAt')::timestamptz, now()), (p_initial_state->>'expectedEndAt')::timestamptz, COALESCE((p_initial_state->>'currentSegmentIndex')::integer,0), COALESCE((p_initial_state->>'crowdEnergy')::integer,50), COALESCE((p_initial_state->>'fanSatisfaction')::integer,50), COALESCE((p_initial_state->>'performanceQuality')::integer,0), COALESCE((p_initial_state->>'bandStamina')::integer,85), COALESCE((p_initial_state->>'momentum')::integer,0), COALESCE((p_initial_state->>'incidentRisk')::integer,0), COALESCE((p_initial_state->>'simulationVersion')::integer,1), now(), COALESCE(p_initial_state->'configSnapshot','{}'::jsonb))
  ON CONFLICT (gig_id) DO UPDATE SET gig_id = EXCLUDED.gig_id
  RETURNING * INTO v_session;

  IF NOT EXISTS (SELECT 1 FROM public.gig_live_segments WHERE session_id = v_session.id) THEN
    FOR v_segment IN SELECT * FROM jsonb_array_elements(p_segments) LOOP
      INSERT INTO public.gig_live_segments(session_id, segment_index, segment_type, setlist_item_id, song_id, planned_start_at, planned_duration_seconds, status, result_snapshot)
      VALUES (v_session.id, (v_segment->>'segmentIndex')::integer, v_segment->>'segmentType', NULLIF(v_segment->>'setlistItemId','')::uuid, NULLIF(v_segment->>'songId','')::uuid, (v_segment->>'plannedStartAt')::timestamptz, (v_segment->>'plannedDurationSeconds')::integer, COALESCE(v_segment->>'status','pending'), COALESCE(v_segment->'resultSnapshot','{}'::jsonb))
      ON CONFLICT (session_id, segment_index) DO NOTHING;
    END LOOP;
  END IF;
  RETURN v_session;
END; $$;

CREATE OR REPLACE FUNCTION public.commit_gig_live_decision(p_incident_id uuid, p_option_key text, p_outcome jsonb DEFAULT '{}'::jsonb)
RETURNS public.gig_live_decisions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_incident public.gig_live_incidents; v_session public.gig_live_sessions; v_decision public.gig_live_decisions;
BEGIN
  SELECT * INTO v_incident FROM public.gig_live_incidents WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Live incident not found'; END IF;
  SELECT * INTO v_session FROM public.gig_live_sessions WHERE id = v_incident.session_id FOR UPDATE;
  IF NOT public.is_band_leader_or_manager(v_session.band_id, auth.uid()) THEN RAISE EXCEPTION 'Not authorised to decide this live incident'; END IF;
  IF v_incident.status <> 'awaiting_decision' OR v_incident.decision_deadline <= now() THEN RAISE EXCEPTION 'Live decision window is closed'; END IF;
  INSERT INTO public.gig_live_decisions(session_id, incident_id, decision_type, selected_option, decided_by_player_id, decision_source, requirements_snapshot, outcome_snapshot)
  VALUES (v_session.id, p_incident_id, COALESCE(v_incident.generation_snapshot->>'decisionType','incident_response'), p_option_key, auth.uid(), 'player', COALESCE(v_incident.generation_snapshot->'requirements','{}'::jsonb), p_outcome)
  ON CONFLICT (incident_id) DO UPDATE SET incident_id = EXCLUDED.incident_id
  RETURNING * INTO v_decision;
  UPDATE public.gig_live_incidents SET status = 'resolved', result_snapshot = result_snapshot || p_outcome, updated_at = now() WHERE id = p_incident_id;
  UPDATE public.gig_live_sessions SET status = 'live', updated_at = now() WHERE id = v_session.id AND status = 'paused_for_decision';
  RETURN v_decision;
END; $$;

CREATE OR REPLACE FUNCTION public.expire_gig_live_decisions(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.gig_live_incidents SET status = 'expired', updated_at = now()
    WHERE status = 'awaiting_decision' AND decision_deadline <= p_now
    RETURNING *
  ), inserted AS (
    INSERT INTO public.gig_live_decisions(session_id, incident_id, decision_type, selected_option, decision_source, requirements_snapshot, outcome_snapshot)
    SELECT session_id, id, COALESCE(generation_snapshot->>'decisionType','incident_response'), COALESCE(generation_snapshot->>'recommendedFallback','automatic_fallback'), 'automatic_fallback', COALESCE(generation_snapshot->'requirements','{}'::jsonb), jsonb_build_object('fallbackAppliedAt', p_now, 'reason', 'Live decision deadline expired') FROM expired
    ON CONFLICT (incident_id) DO NOTHING RETURNING id
  ) SELECT count(*) INTO v_count FROM inserted;
  UPDATE public.gig_live_sessions s SET status = 'live', updated_at = now() WHERE status = 'paused_for_decision' AND NOT EXISTS (SELECT 1 FROM public.gig_live_incidents i WHERE i.session_id = s.id AND i.status = 'awaiting_decision');
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_gig_live_segment_resolved(p_segment_id uuid, p_result jsonb DEFAULT '{}'::jsonb)
RETURNS public.gig_live_segments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_segment public.gig_live_segments;
BEGIN
  UPDATE public.gig_live_segments SET status = 'resolved', started_at = COALESCE(started_at, now()), resolved_at = COALESCE(resolved_at, now()), result_snapshot = CASE WHEN status = 'resolved' THEN result_snapshot ELSE p_result END, updated_at = now()
  WHERE id = p_segment_id AND status IN ('pending','active')
  RETURNING * INTO v_segment;
  IF NOT FOUND THEN SELECT * INTO v_segment FROM public.gig_live_segments WHERE id = p_segment_id; END IF;
  RETURN v_segment;
END; $$;

REVOKE ALL ON FUNCTION public.start_gig_live_session(uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_gig_live_session(uuid,jsonb,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.commit_gig_live_decision(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_gig_live_decision(uuid,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.expire_gig_live_decisions(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_gig_live_decisions(timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.mark_gig_live_segment_resolved(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_gig_live_segment_resolved(uuid,jsonb) TO service_role;

ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS live_session_id uuid REFERENCES public.gig_live_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS live_result_snapshot jsonb;
ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS live_simulation_version integer;

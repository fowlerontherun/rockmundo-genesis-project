-- Gig Preparation Phase 5: pre-show sessions, incidents, options and decisions.
CREATE TABLE IF NOT EXISTS public.gig_preshow_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','open','awaiting_decision','resolved','expired','skipped','locked')),
  opens_at timestamptz NOT NULL,
  locks_at timestamptz NOT NULL,
  generated_at timestamptz,
  resolved_at timestamptz,
  generation_version integer NOT NULL DEFAULT 1,
  config_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  audit_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gig_id)
);

CREATE TABLE IF NOT EXISTS public.gig_preshow_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.gig_preshow_sessions(id) ON DELETE CASCADE,
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  incident_type text NOT NULL,
  category text NOT NULL CHECK (category IN ('equipment','crew','performer','production','venue','commercial','media_social','crowd_safety')),
  severity text NOT NULL CHECK (severity IN ('minor','moderate','major','critical')),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_decision' CHECK (status IN ('open','awaiting_decision','resolved','expired','carried_to_performance')),
  decision_deadline timestamptz NOT NULL,
  affected_systems text[] NOT NULL DEFAULT ARRAY[]::text[],
  eligibility_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  generation_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  consequence_applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, incident_type)
);

CREATE TABLE IF NOT EXISTS public.gig_preshow_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.gig_preshow_incidents(id) ON DELETE CASCADE,
  option_key text NOT NULL,
  label text NOT NULL,
  description text NOT NULL,
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost_preview numeric NOT NULL DEFAULT 0,
  effect_preview jsonb NOT NULL DEFAULT '{}'::jsonb,
  unavailable_reason text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(incident_id, option_key)
);

CREATE TABLE IF NOT EXISTS public.gig_preshow_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.gig_preshow_incidents(id) ON DELETE CASCADE,
  selected_option_key text NOT NULL,
  decided_by_player_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  decision_source text NOT NULL CHECK (decision_source IN ('player','delegated_staff','automatic_fallback','system')),
  decision_status text NOT NULL DEFAULT 'committed' CHECK (decision_status IN ('committed','automatic','rejected','superseded')),
  skill_check_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  transaction_reference text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(incident_id),
  UNIQUE(transaction_reference)
);

CREATE INDEX IF NOT EXISTS idx_gig_preshow_sessions_band_status ON public.gig_preshow_sessions(band_id, status, opens_at);
CREATE INDEX IF NOT EXISTS idx_gig_preshow_sessions_deadlines ON public.gig_preshow_sessions(status, opens_at, locks_at);
CREATE INDEX IF NOT EXISTS idx_gig_preshow_incidents_gig_status ON public.gig_preshow_incidents(gig_id, status, decision_deadline);
CREATE INDEX IF NOT EXISTS idx_gig_preshow_incidents_session_status ON public.gig_preshow_incidents(session_id, status);
CREATE INDEX IF NOT EXISTS idx_gig_preshow_decisions_incident ON public.gig_preshow_decisions(incident_id, decided_at);

ALTER TABLE public.gig_preshow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_preshow_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_preshow_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_preshow_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can view preshow sessions" ON public.gig_preshow_sessions;
CREATE POLICY "Band members can view preshow sessions" ON public.gig_preshow_sessions FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = gig_preshow_sessions.band_id AND bm.user_id = auth.uid()));
DROP POLICY IF EXISTS "Band managers can manage preshow sessions" ON public.gig_preshow_sessions;
CREATE POLICY "Band managers can manage preshow sessions" ON public.gig_preshow_sessions FOR ALL USING (public.is_band_leader_or_manager(band_id, auth.uid())) WITH CHECK (public.is_band_leader_or_manager(band_id, auth.uid()));

DROP POLICY IF EXISTS "Band members can view preshow incidents" ON public.gig_preshow_incidents;
CREATE POLICY "Band members can view preshow incidents" ON public.gig_preshow_incidents FOR SELECT USING (EXISTS (SELECT 1 FROM public.gig_preshow_sessions s JOIN public.band_members bm ON bm.band_id = s.band_id WHERE s.id = gig_preshow_incidents.session_id AND bm.user_id = auth.uid()));
DROP POLICY IF EXISTS "Band managers can manage preshow incidents" ON public.gig_preshow_incidents;
CREATE POLICY "Band managers can manage preshow incidents" ON public.gig_preshow_incidents FOR ALL USING (EXISTS (SELECT 1 FROM public.gig_preshow_sessions s WHERE s.id = gig_preshow_incidents.session_id AND public.is_band_leader_or_manager(s.band_id, auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.gig_preshow_sessions s WHERE s.id = gig_preshow_incidents.session_id AND public.is_band_leader_or_manager(s.band_id, auth.uid())));

DROP POLICY IF EXISTS "Band members can view preshow options" ON public.gig_preshow_options;
CREATE POLICY "Band members can view preshow options" ON public.gig_preshow_options FOR SELECT USING (EXISTS (SELECT 1 FROM public.gig_preshow_incidents i JOIN public.gig_preshow_sessions s ON s.id = i.session_id JOIN public.band_members bm ON bm.band_id = s.band_id WHERE i.id = gig_preshow_options.incident_id AND bm.user_id = auth.uid()));
DROP POLICY IF EXISTS "Band managers can manage preshow options" ON public.gig_preshow_options;
CREATE POLICY "Band managers can manage preshow options" ON public.gig_preshow_options FOR ALL USING (EXISTS (SELECT 1 FROM public.gig_preshow_incidents i JOIN public.gig_preshow_sessions s ON s.id = i.session_id WHERE i.id = gig_preshow_options.incident_id AND public.is_band_leader_or_manager(s.band_id, auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.gig_preshow_incidents i JOIN public.gig_preshow_sessions s ON s.id = i.session_id WHERE i.id = gig_preshow_options.incident_id AND public.is_band_leader_or_manager(s.band_id, auth.uid())));

DROP POLICY IF EXISTS "Band members can view preshow decisions" ON public.gig_preshow_decisions;
CREATE POLICY "Band members can view preshow decisions" ON public.gig_preshow_decisions FOR SELECT USING (EXISTS (SELECT 1 FROM public.gig_preshow_incidents i JOIN public.gig_preshow_sessions s ON s.id = i.session_id JOIN public.band_members bm ON bm.band_id = s.band_id WHERE i.id = gig_preshow_decisions.incident_id AND bm.user_id = auth.uid()));
DROP POLICY IF EXISTS "Band managers can insert preshow decisions" ON public.gig_preshow_decisions;
CREATE POLICY "Band managers can insert preshow decisions" ON public.gig_preshow_decisions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.gig_preshow_incidents i JOIN public.gig_preshow_sessions s ON s.id = i.session_id WHERE i.id = gig_preshow_decisions.incident_id AND i.status = 'awaiting_decision' AND i.decision_deadline > now() AND s.locks_at > now() AND public.is_band_leader_or_manager(s.band_id, auth.uid())));

CREATE OR REPLACE FUNCTION public.commit_gig_preshow_decision(p_incident_id uuid, p_option_key text, p_outcome jsonb DEFAULT '{}'::jsonb, p_skill_check jsonb DEFAULT '{}'::jsonb)
RETURNS public.gig_preshow_decisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_incident public.gig_preshow_incidents; v_session public.gig_preshow_sessions; v_decision public.gig_preshow_decisions;
BEGIN
  SELECT * INTO v_incident FROM public.gig_preshow_incidents WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found'; END IF;
  SELECT * INTO v_session FROM public.gig_preshow_sessions WHERE id = v_incident.session_id FOR UPDATE;
  IF NOT public.is_band_leader_or_manager(v_session.band_id, auth.uid()) THEN RAISE EXCEPTION 'Not authorised to decide this incident'; END IF;
  IF v_incident.status <> 'awaiting_decision' OR v_incident.decision_deadline <= now() OR v_session.locks_at <= now() THEN RAISE EXCEPTION 'Incident decision window is closed'; END IF;
  INSERT INTO public.gig_preshow_decisions(incident_id, selected_option_key, decided_by_player_id, decision_source, decision_status, skill_check_snapshot, outcome_snapshot, transaction_reference)
  VALUES (p_incident_id, p_option_key, auth.uid(), 'player', 'committed', p_skill_check, p_outcome, NULLIF(p_outcome->>'transactionReference',''))
  ON CONFLICT (incident_id) DO UPDATE SET incident_id = EXCLUDED.incident_id
  RETURNING * INTO v_decision;
  UPDATE public.gig_preshow_incidents SET status = 'resolved', updated_at = now() WHERE id = p_incident_id;
  UPDATE public.gig_preshow_sessions SET status = CASE WHEN EXISTS (SELECT 1 FROM public.gig_preshow_incidents WHERE session_id = v_session.id AND status = 'awaiting_decision') THEN 'awaiting_decision' ELSE 'resolved' END, resolved_at = CASE WHEN NOT EXISTS (SELECT 1 FROM public.gig_preshow_incidents WHERE session_id = v_session.id AND status = 'awaiting_decision') THEN now() ELSE resolved_at END, updated_at = now() WHERE id = v_session.id;
  RETURN v_decision;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_gig_preshow_incidents(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.gig_preshow_incidents i
    SET status = 'expired', updated_at = now()
    FROM public.gig_preshow_sessions s
    WHERE s.id = i.session_id AND i.status = 'awaiting_decision' AND (i.decision_deadline <= p_now OR s.locks_at <= p_now)
    RETURNING i.id
  ), inserted AS (
    INSERT INTO public.gig_preshow_decisions(incident_id, selected_option_key, decision_source, decision_status, outcome_snapshot)
    SELECT id, 'automatic_fallback', 'automatic_fallback', 'automatic', jsonb_build_object('fallbackAppliedAt', p_now, 'reason', 'Decision deadline expired') FROM expired
    ON CONFLICT (incident_id) DO NOTHING
    RETURNING incident_id
  ) SELECT count(*) INTO v_count FROM inserted;
  UPDATE public.gig_preshow_sessions s SET status = 'expired', resolved_at = now(), updated_at = now() WHERE NOT EXISTS (SELECT 1 FROM public.gig_preshow_incidents i WHERE i.session_id = s.id AND i.status = 'awaiting_decision') AND EXISTS (SELECT 1 FROM public.gig_preshow_incidents i WHERE i.session_id = s.id AND i.status = 'expired');
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.commit_gig_preshow_decision(uuid,text,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_gig_preshow_decision(uuid,text,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.expire_gig_preshow_incidents(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_gig_preshow_incidents(timestamptz) TO service_role;

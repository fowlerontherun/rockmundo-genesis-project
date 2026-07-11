-- Phase 5 PR 05: Typed gig viewer replay storage

CREATE TABLE IF NOT EXISTS public.gig_viewer_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE RESTRICT,
  gig_outcome_id uuid NOT NULL REFERENCES public.gig_outcomes(id) ON DELETE RESTRICT,
  viewer_version integer NOT NULL,
  event_schema_version integer NOT NULL,
  simulation_seed text NOT NULL,
  duration_ms integer NOT NULL,
  event_payload jsonb NOT NULL DEFAULT jsonb_build_object('events', jsonb_build_array()),
  event_count integer NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generation_status text NOT NULL DEFAULT 'generating',
  generation_error_code text,
  checksum text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gig_viewer_replays_duration_positive CHECK (duration_ms > 0),
  CONSTRAINT gig_viewer_replays_event_count_nonnegative CHECK (event_count >= 0),
  CONSTRAINT gig_viewer_replays_status_valid CHECK (generation_status IN ('generating','ready','failed','legacy_unavailable')),
  CONSTRAINT gig_viewer_replays_version_positive CHECK (viewer_version > 0 AND event_schema_version > 0),
  CONSTRAINT gig_viewer_replays_payload_object CHECK (jsonb_typeof(event_payload) = 'object' AND jsonb_typeof(event_payload->'events') = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS gig_viewer_replays_one_ready_per_gig_viewer
  ON public.gig_viewer_replays(gig_id, viewer_version)
  WHERE generation_status = 'ready';
CREATE UNIQUE INDEX IF NOT EXISTS gig_viewer_replays_one_generating_per_gig_viewer
  ON public.gig_viewer_replays(gig_id, viewer_version)
  WHERE generation_status = 'generating';
CREATE INDEX IF NOT EXISTS gig_viewer_replays_gig_idx ON public.gig_viewer_replays(gig_id, viewer_version, generation_status);
CREATE INDEX IF NOT EXISTS gig_viewer_replays_outcome_idx ON public.gig_viewer_replays(gig_outcome_id);

ALTER TABLE public.gig_viewer_replays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gig_viewer_replays_select_matches_outcome_visibility ON public.gig_viewer_replays;
CREATE POLICY gig_viewer_replays_select_matches_outcome_visibility
ON public.gig_viewer_replays FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.gig_outcomes go
    WHERE go.id = gig_viewer_replays.gig_outcome_id
  )
);

DROP POLICY IF EXISTS gig_viewer_replays_deny_insert ON public.gig_viewer_replays;
CREATE POLICY gig_viewer_replays_deny_insert ON public.gig_viewer_replays FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS gig_viewer_replays_deny_update ON public.gig_viewer_replays;
CREATE POLICY gig_viewer_replays_deny_update ON public.gig_viewer_replays FOR UPDATE USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS gig_viewer_replays_deny_delete ON public.gig_viewer_replays;
CREATE POLICY gig_viewer_replays_deny_delete ON public.gig_viewer_replays FOR DELETE USING (false);

CREATE OR REPLACE FUNCTION public.set_gig_viewer_replay_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_gig_viewer_replay_updated_at ON public.gig_viewer_replays;
CREATE TRIGGER set_gig_viewer_replay_updated_at
BEFORE UPDATE ON public.gig_viewer_replays
FOR EACH ROW EXECUTE FUNCTION public.set_gig_viewer_replay_updated_at();

CREATE OR REPLACE FUNCTION public.claim_gig_viewer_replay_generation(p_gig_id uuid, p_gig_outcome_id uuid, p_viewer_version integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.gig_viewer_replays%ROWTYPE;
  v_replay_id uuid;
BEGIN
  PERFORM 1 FROM public.gigs g
  WHERE g.id = p_gig_id AND g.status = 'completed' AND g.result_ready_at IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig is not completed or result_ready_at is missing' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing
  FROM public.gig_viewer_replays
  WHERE gig_id = p_gig_id AND viewer_version = p_viewer_version AND generation_status IN ('ready','generating')
  ORDER BY CASE generation_status WHEN 'ready' THEN 0 ELSE 1 END, generated_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('claimed', false, 'alreadyReady', v_existing.generation_status = 'ready', 'alreadyGenerating', v_existing.generation_status = 'generating', 'replayId', v_existing.id);
  END IF;

  INSERT INTO public.gig_viewer_replays (gig_id, gig_outcome_id, viewer_version, event_schema_version, simulation_seed, duration_ms, event_payload, event_count, generation_status)
  VALUES (p_gig_id, p_gig_outcome_id, p_viewer_version, 1, 'pending', 1, jsonb_build_object('events', jsonb_build_array()), 0, 'generating')
  RETURNING id INTO v_replay_id;

  RAISE LOG '[gig-viewer-replay] generation claimed gig_id=% outcome_id=% viewer_version=% replay_id=%', p_gig_id, p_gig_outcome_id, p_viewer_version, v_replay_id;
  RETURN jsonb_build_object('claimed', true, 'replayId', v_replay_id);
END;
$$;

REVOKE ALL ON TABLE public.gig_viewer_replays FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.gig_viewer_replays TO authenticated;
GRANT ALL ON TABLE public.gig_viewer_replays TO service_role;
REVOKE ALL ON FUNCTION public.claim_gig_viewer_replay_generation(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gig_viewer_replay_generation(uuid, uuid, integer) TO service_role;

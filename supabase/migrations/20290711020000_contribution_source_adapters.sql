-- Phase 4 PR 02: contribution-source adapter helpers and verified recording participants.

ALTER TABLE public.band_contribution_events
  DROP CONSTRAINT IF EXISTS band_contribution_events_contribution_type_check,
  DROP CONSTRAINT IF EXISTS band_contribution_events_source_entity_type_check;

ALTER TABLE public.band_contribution_events
  ADD CONSTRAINT band_contribution_events_contribution_type_check
    CHECK (contribution_type IN ('rehearsal_attendance', 'recording_participation', 'gig_performance')),
  ADD CONSTRAINT band_contribution_events_source_entity_type_check
    CHECK (source_entity_type IN ('band_rehearsal', 'recording_session', 'gig_outcome'));

CREATE INDEX IF NOT EXISTS band_contribution_events_source_idx
  ON public.band_contribution_events (source_entity_type, source_entity_id, contribution_type);

CREATE OR REPLACE FUNCTION public.is_band_member_at_time(
  target_band_id uuid,
  target_profile_id uuid,
  target_occurred_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_band_id IS NOT NULL
    AND target_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id = target_band_id
        AND bm.profile_id = target_profile_id
        AND COALESCE(bm.member_status, 'active') = 'active'
        AND (bm.joined_at IS NULL OR bm.joined_at <= COALESCE(target_occurred_at, now()))
    );
$$;

REVOKE ALL ON FUNCTION public.is_band_member_at_time(uuid, uuid, timestamptz) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.insert_band_contribution_event(
  p_band_id uuid,
  p_profile_id uuid,
  p_contribution_type text,
  p_source_entity_type text,
  p_source_entity_id uuid,
  p_occurred_at timestamptz,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  IF p_band_id IS NULL OR p_profile_id IS NULL OR p_source_entity_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT public.is_band_member_at_time(p_band_id, p_profile_id, COALESCE(p_occurred_at, now())) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.band_contribution_events (
    band_id, profile_id, contribution_type, source_entity_type, source_entity_id, occurred_at, metadata
  ) VALUES (
    p_band_id,
    p_profile_id,
    p_contribution_type,
    p_source_entity_type,
    p_source_entity_id,
    COALESCE(p_occurred_at, now()),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT ON CONSTRAINT band_contribution_events_idempotency DO NOTHING
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_band_contribution_event(uuid, uuid, text, text, uuid, timestamptz, jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.capture_contributions_for_recording_session(p_recording_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_participant record;
  v_inserted integer := 0;
  v_event_id uuid;
BEGIN
  SELECT rs.id, rs.band_id, rs.profile_id, rs.user_id, rs.completed_at, rs.status
  INTO v_session
  FROM public.recording_sessions rs
  WHERE rs.id = p_recording_session_id;

  IF NOT FOUND OR v_session.band_id IS NULL OR v_session.status <> 'completed' THEN
    RETURN 0;
  END IF;

  FOR v_participant IN
    SELECT DISTINCT participant_profile_id AS profile_id
    FROM (
      SELECT p.id AS participant_profile_id
      FROM public.production_tracks pt
      JOIN public.profiles p ON p.user_id = pt.user_id
      WHERE pt.session_id = v_session.id
      UNION
      SELECT v_session.profile_id AS participant_profile_id
      UNION
      SELECT p.id AS participant_profile_id
      FROM public.profiles p
      WHERE p.user_id = v_session.user_id AND v_session.profile_id IS NULL
    ) participants
    WHERE participant_profile_id IS NOT NULL
  LOOP
    v_event_id := public.insert_band_contribution_event(
      v_session.band_id,
      v_participant.profile_id,
      'recording_participation',
      'recording_session',
      v_session.id,
      COALESCE(v_session.completed_at, now()),
      jsonb_build_object(
        'label', 'Completed band recording',
        'accuracy', 'verified_participant',
        'source_detail', 'recording session owner or uploaded production track'
      )
    );

    IF v_event_id IS NOT NULL THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_contributions_for_recording_session(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.capture_completed_recording_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.band_id IS NULL OR NEW.status <> 'completed' OR (TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') = 'completed') THEN
    RETURN NEW;
  END IF;

  PERFORM public.capture_contributions_for_recording_session(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'capture_completed_recording_contribution failed for recording_session %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.capture_contributions_for_recording_session(uuid)
  IS 'Contribution-source adapter for completed band recording sessions. Resolves authoritative band from recording_sessions and participants from session owner plus production_tracks uploads; insert helper enforces idempotency and active membership at occurred_at.';

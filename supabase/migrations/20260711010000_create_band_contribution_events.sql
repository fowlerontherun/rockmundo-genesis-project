-- Phase 4 PR 01: immutable, member-visible band contribution event log MVP.

CREATE TABLE IF NOT EXISTS public.band_contribution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  contribution_type text NOT NULL CHECK (contribution_type IN ('rehearsal_attendance', 'recording_participation', 'gig_performance')),
  source_entity_type text NOT NULL CHECK (source_entity_type IN ('band_rehearsal', 'recording_session', 'gig_outcome')),
  source_entity_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT band_contribution_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT band_contribution_events_idempotency UNIQUE (band_id, profile_id, contribution_type, source_entity_type, source_entity_id)
);

CREATE INDEX IF NOT EXISTS band_contribution_events_band_occurred_idx
  ON public.band_contribution_events (band_id, occurred_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS band_contribution_events_profile_occurred_idx
  ON public.band_contribution_events (profile_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS band_contribution_events_type_occurred_idx
  ON public.band_contribution_events (band_id, contribution_type, occurred_at DESC);

ALTER TABLE public.band_contribution_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_band_member(target_band_id uuid, actor_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_band_id IS NOT NULL
    AND actor_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id = target_band_id
        AND bm.user_id = actor_user_id
        AND COALESCE(bm.member_status, 'active') = 'active'
    );
$$;

CREATE POLICY "Active band members can view contribution events"
ON public.band_contribution_events
FOR SELECT
TO authenticated
USING (public.is_active_band_member(band_id, auth.uid()));

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.band_members bm
    WHERE bm.band_id = p_band_id
      AND bm.profile_id = p_profile_id
      AND COALESCE(bm.member_status, 'active') = 'active'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.band_contribution_events (
    band_id,
    profile_id,
    contribution_type,
    source_entity_type,
    source_entity_id,
    occurred_at,
    metadata
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

CREATE OR REPLACE FUNCTION public.capture_completed_rehearsal_contributions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member record;
BEGIN
  IF NEW.status <> 'completed' OR (TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') = 'completed') THEN
    RETURN NEW;
  END IF;

  FOR v_member IN
    SELECT bm.profile_id
    FROM public.band_members bm
    WHERE bm.band_id = NEW.band_id
      AND bm.profile_id IS NOT NULL
      AND COALESCE(bm.member_status, 'active') = 'active'
  LOOP
    PERFORM public.insert_band_contribution_event(
      NEW.band_id,
      v_member.profile_id,
      'rehearsal_attendance',
      'band_rehearsal',
      NEW.id,
      COALESCE(NEW.completed_at, NEW.scheduled_end, now()),
      jsonb_build_object('label', 'Completed band rehearsal')
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_completed_rehearsal_contributions ON public.band_rehearsals;
CREATE TRIGGER capture_completed_rehearsal_contributions
AFTER INSERT OR UPDATE OF status ON public.band_rehearsals
FOR EACH ROW
EXECUTE FUNCTION public.capture_completed_rehearsal_contributions();

CREATE OR REPLACE FUNCTION public.capture_completed_recording_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  IF NEW.band_id IS NULL OR NEW.status <> 'completed' OR (TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') = 'completed') THEN
    RETURN NEW;
  END IF;

  v_profile_id := NEW.profile_id;
  IF v_profile_id IS NULL THEN
    SELECT p.id INTO v_profile_id FROM public.profiles p WHERE p.user_id = NEW.user_id LIMIT 1;
  END IF;

  PERFORM public.insert_band_contribution_event(
    NEW.band_id,
    v_profile_id,
    'recording_participation',
    'recording_session',
    NEW.id,
    COALESCE(NEW.completed_at, now()),
    jsonb_build_object('label', 'Completed band recording')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_completed_recording_contribution ON public.recording_sessions;
CREATE TRIGGER capture_completed_recording_contribution
AFTER INSERT OR UPDATE OF status ON public.recording_sessions
FOR EACH ROW
EXECUTE FUNCTION public.capture_completed_recording_contribution();

CREATE OR REPLACE FUNCTION public.capture_completed_gig_contributions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band_id uuid;
  v_occurred_at timestamptz;
  v_member record;
BEGIN
  v_band_id := NEW.band_id;
  IF v_band_id IS NULL THEN
    SELECT g.band_id, g.scheduled_date INTO v_band_id, v_occurred_at FROM public.gigs g WHERE g.id = NEW.gig_id;
  ELSE
    SELECT g.scheduled_date INTO v_occurred_at FROM public.gigs g WHERE g.id = NEW.gig_id;
  END IF;

  IF v_band_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_member IN
    SELECT bm.profile_id
    FROM public.band_members bm
    WHERE bm.band_id = v_band_id
      AND bm.profile_id IS NOT NULL
      AND COALESCE(bm.member_status, 'active') = 'active'
  LOOP
    PERFORM public.insert_band_contribution_event(
      v_band_id,
      v_member.profile_id,
      'gig_performance',
      'gig_outcome',
      NEW.id,
      COALESCE(v_occurred_at, NEW.created_at, now()),
      jsonb_build_object('label', 'Completed band gig')
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_completed_gig_contributions ON public.gig_outcomes;
CREATE TRIGGER capture_completed_gig_contributions
AFTER INSERT ON public.gig_outcomes
FOR EACH ROW
EXECUTE FUNCTION public.capture_completed_gig_contributions();

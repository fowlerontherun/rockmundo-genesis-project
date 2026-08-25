-- Backlog B7 closure: canonical guest/featured obligations, rivalry objectives,
-- organiser-gated fan voting, and festival performance notifications.
--
-- Authority rules:
--   * accepted festival contracts remain the booking authority;
--   * collaborators must explicitly accept a frozen obligations snapshot;
--   * rivalry results derive only from final canonical performance outcomes;
--   * fan voting is advisory and can never assign a stage slot or create a contract;
--   * browser clients use narrow RPCs rather than direct authoritative writes.

CREATE TABLE IF NOT EXISTS public.festival_performance_collaborations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.festival_contracts(id) ON DELETE CASCADE,
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('guest','featured')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','accepted','declined','cancelled')),
  obligations jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_obligations jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  invited_by_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  responded_at timestamptz,
  accepted_at timestamptz,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contract_id, profile_id),
  UNIQUE(invited_by_profile_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_performance_collaboration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id uuid NOT NULL REFERENCES public.festival_performance_collaborations(id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles(id),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(collaboration_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_rivalry_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  challenger_contract_id uuid NOT NULL REFERENCES public.festival_contracts(id) ON DELETE CASCADE,
  rival_contract_id uuid NOT NULL REFERENCES public.festival_contracts(id) ON DELETE CASCADE,
  challenger_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  rival_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  objective_type text NOT NULL DEFAULT 'outperform_overall_score' CHECK (objective_type = 'outperform_overall_score'),
  status text NOT NULL DEFAULT 'pending_rival' CHECK (status IN ('pending_rival','active','declined','cancelled','resolved')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  accepted_by_profile_id uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  resolution_result text CHECK (resolution_result IS NULL OR resolution_result IN ('challenger_win','rival_win','tie')),
  resolution_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (challenger_contract_id <> rival_contract_id),
  CHECK (challenger_band_id <> rival_band_id),
  UNIQUE(challenger_contract_id, rival_contract_id),
  UNIQUE(created_by_profile_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_rivalry_objective_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rivalry_id uuid NOT NULL REFERENCES public.festival_rivalry_objectives(id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles(id),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rivalry_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_fan_vote_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  stage_slot_id uuid NOT NULL REFERENCES public.festival_stage_slots(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','open','closed','cancelled')),
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_at > opens_at),
  UNIQUE(stage_slot_id),
  UNIQUE(created_by_profile_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_fan_vote_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_id uuid NOT NULL REFERENCES public.festival_fan_vote_windows(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.festival_applications(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'eligible' CHECK (status IN ('eligible','withdrawn','disqualified')),
  eligibility_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_by_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(window_id, application_id),
  UNIQUE(window_id, band_id)
);

CREATE TABLE IF NOT EXISTS public.festival_fan_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_id uuid NOT NULL REFERENCES public.festival_fan_vote_windows(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.festival_fan_vote_candidates(id) ON DELETE CASCADE,
  voter_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weight numeric(6,2) NOT NULL DEFAULT 1 CHECK (weight = 1),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(window_id, voter_profile_id),
  UNIQUE(voter_profile_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_fan_vote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_id uuid NOT NULL REFERENCES public.festival_fan_vote_windows(id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles(id),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(window_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_booking_notification_receipts (
  dedupe_key text PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_festival_collaboration_contract_status
  ON public.festival_performance_collaborations(contract_id, status);
CREATE INDEX IF NOT EXISTS idx_festival_collaboration_profile_status
  ON public.festival_performance_collaborations(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_festival_rivalry_edition_status
  ON public.festival_rivalry_objectives(edition_id, status);
CREATE INDEX IF NOT EXISTS idx_festival_vote_window_edition_status
  ON public.festival_fan_vote_windows(edition_id, status, opens_at, closes_at);
CREATE INDEX IF NOT EXISTS idx_festival_vote_candidate_window
  ON public.festival_fan_vote_candidates(window_id, status);
CREATE INDEX IF NOT EXISTS idx_festival_vote_window_candidate
  ON public.festival_fan_votes(window_id, candidate_id);

ALTER TABLE public.festival_performance_collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_performance_collaboration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_rivalry_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_rivalry_objective_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_fan_vote_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_fan_vote_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_fan_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_fan_vote_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_booking_notification_receipts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.festival_performance_collaborations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.festival_performance_collaboration_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.festival_rivalry_objectives FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.festival_rivalry_objective_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.festival_fan_vote_windows FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.festival_fan_vote_candidates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.festival_fan_votes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.festival_fan_vote_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.festival_booking_notification_receipts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._festival_b7_can_manage_contract(
  p_contract_id uuid,
  p_actor uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.festival_contracts c
    WHERE c.id = p_contract_id
      AND (
        public._festival_artist_authorised(p_actor, 'band', NULL, c.band_id)
        OR public.can_manage_festival_brand(c.festival_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public._festival_b7_can_manage_contract(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._festival_b7_notify_profile(
  p_profile_id uuid,
  p_event_type text,
  p_entity_id uuid,
  p_dedupe_key text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_key text;
BEGIN
  INSERT INTO public.festival_booking_notification_receipts(
    dedupe_key, profile_id, event_type, entity_id
  )
  VALUES (p_dedupe_key, p_profile_id, p_event_type, p_entity_id)
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING dedupe_key INTO inserted_key;

  IF inserted_key IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications(user_id, type, message)
  SELECT p.user_id, 'system', p_message
  FROM public.profiles p
  WHERE p.id = p_profile_id
    AND p.user_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._festival_b7_notify_profile(uuid, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.festival_collaboration_candidates(
  p_contract_id uuid,
  p_search text DEFAULT NULL
)
RETURNS TABLE(
  profile_id uuid,
  display_name text,
  username text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  contract_row public.festival_contracts%ROWTYPE;
BEGIN
  SELECT * INTO contract_row
  FROM public.festival_contracts
  WHERE id = p_contract_id;

  IF NOT FOUND
    OR NOT public._festival_b7_can_manage_contract(p_contract_id, actor)
  THEN
    RAISE EXCEPTION 'festival_collaboration_forbidden' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    coalesce(nullif(p.display_name, ''), p.username, 'Player')::text,
    p.username::text
  FROM public.profiles p
  WHERE p.id <> actor
    AND NOT EXISTS (
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id = contract_row.band_id
        AND bm.profile_id = p.id
        AND coalesce(bm.member_status, 'active') = 'active'
    )
    AND (
      p_search IS NULL
      OR btrim(p_search) = ''
      OR p.display_name ILIKE '%' || p_search || '%'
      OR p.username ILIKE '%' || p_search || '%'
    )
  ORDER BY lower(coalesce(nullif(p.display_name, ''), p.username, 'Player')), p.id
  LIMIT 25;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_festival_contract_collaborators(
  p_contract_id uuid
)
RETURNS TABLE(
  collaboration_id uuid,
  contract_id uuid,
  profile_id uuid,
  display_name text,
  username text,
  role text,
  status text,
  obligations jsonb,
  accepted_obligations jsonb,
  version integer,
  invited_at timestamptz,
  responded_at timestamptz,
  can_respond boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  manager boolean;
BEGIN
  manager := public._festival_b7_can_manage_contract(p_contract_id, actor);

  IF NOT manager AND NOT EXISTS (
    SELECT 1
    FROM public.festival_performance_collaborations c
    WHERE c.contract_id = p_contract_id
      AND c.profile_id = actor
  ) THEN
    RAISE EXCEPTION 'festival_collaboration_forbidden' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.contract_id,
    c.profile_id,
    coalesce(nullif(p.display_name, ''), p.username, 'Player')::text,
    p.username::text,
    c.role,
    c.status,
    c.obligations,
    c.accepted_obligations,
    c.version,
    c.created_at,
    c.responded_at,
    c.profile_id = actor AND c.status = 'invited'
  FROM public.festival_performance_collaborations c
  JOIN public.profiles p ON p.id = c.profile_id
  WHERE c.contract_id = p_contract_id
    AND (manager OR c.profile_id = actor)
  ORDER BY c.created_at, c.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_festival_collaboration_obligations()
RETURNS TABLE(
  collaboration_id uuid,
  contract_id uuid,
  edition_id uuid,
  band_id uuid,
  band_name text,
  role text,
  status text,
  obligations jsonb,
  accepted_obligations jsonb,
  version integer,
  invited_at timestamptz,
  responded_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'festival_collaboration_forbidden' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.contract_id,
    c.edition_id,
    c.band_id,
    b.name::text,
    c.role,
    c.status,
    c.obligations,
    c.accepted_obligations,
    c.version,
    c.created_at,
    c.responded_at
  FROM public.festival_performance_collaborations c
  JOIN public.bands b ON b.id = c.band_id
  WHERE c.profile_id = actor
  ORDER BY c.created_at DESC, c.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_festival_performance_collaborator(
  p_contract_id uuid,
  p_profile_id uuid,
  p_role text,
  p_obligations jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS public.festival_performance_collaborations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  contract_row public.festival_contracts%ROWTYPE;
  collaboration public.festival_performance_collaborations%ROWTYPE;
  request_hash text;
BEGIN
  IF actor IS NULL OR nullif(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'festival_collaboration_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO contract_row
  FROM public.festival_contracts
  WHERE id = p_contract_id
  FOR UPDATE;

  IF NOT FOUND
    OR contract_row.status <> 'active'
    OR NOT public._festival_b7_can_manage_contract(p_contract_id, actor)
  THEN
    RAISE EXCEPTION 'festival_collaboration_forbidden' USING ERRCODE = 'P0001';
  END IF;

  IF p_role NOT IN ('guest','featured')
    OR jsonb_typeof(coalesce(p_obligations, '{}'::jsonb)) <> 'object'
    OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_profile_id)
  THEN
    RAISE EXCEPTION 'festival_collaboration_invalid' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.band_members bm
    WHERE bm.band_id = contract_row.band_id
      AND bm.profile_id = p_profile_id
      AND coalesce(bm.member_status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'festival_collaboration_already_band_member' USING ERRCODE = 'P0001';
  END IF;

  request_hash := public.festival_terms_hash(
    jsonb_build_object(
      'contract_id', p_contract_id,
      'profile_id', p_profile_id,
      'role', p_role,
      'obligations', coalesce(p_obligations, '{}'::jsonb)
    )
  );

  SELECT * INTO collaboration
  FROM public.festival_performance_collaborations
  WHERE invited_by_profile_id = actor
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF collaboration.request_hash <> request_hash THEN
      RAISE EXCEPTION 'festival_collaboration_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN collaboration;
  END IF;

  SELECT * INTO collaboration
  FROM public.festival_performance_collaborations
  WHERE contract_id = p_contract_id
    AND profile_id = p_profile_id
  FOR UPDATE;

  IF FOUND THEN
    IF collaboration.status NOT IN ('declined','cancelled') THEN
      RAISE EXCEPTION 'festival_collaboration_duplicate' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.festival_performance_collaborations
    SET role = p_role,
        status = 'invited',
        obligations = coalesce(p_obligations, '{}'::jsonb),
        accepted_obligations = NULL,
        version = version + 1,
        invited_by_profile_id = actor,
        responded_at = NULL,
        accepted_at = NULL,
        idempotency_key = p_idempotency_key,
        request_hash = request_hash,
        updated_at = now()
    WHERE id = collaboration.id
    RETURNING * INTO collaboration;
  ELSE
    INSERT INTO public.festival_performance_collaborations(
      contract_id,
      edition_id,
      band_id,
      profile_id,
      role,
      obligations,
      invited_by_profile_id,
      idempotency_key,
      request_hash
    )
    VALUES (
      contract_row.id,
      contract_row.edition_id,
      contract_row.band_id,
      p_profile_id,
      p_role,
      coalesce(p_obligations, '{}'::jsonb),
      actor,
      p_idempotency_key,
      request_hash
    )
    RETURNING * INTO collaboration;
  END IF;

  INSERT INTO public.festival_performance_collaboration_events(
    collaboration_id, actor_profile_id, event_type, payload, idempotency_key
  )
  VALUES (
    collaboration.id,
    actor,
    'invited',
    jsonb_build_object('role', collaboration.role, 'obligations', collaboration.obligations),
    p_idempotency_key
  )
  ON CONFLICT DO NOTHING;

  PERFORM public._festival_b7_notify_profile(
    p_profile_id,
    'festival_collaboration_invited',
    collaboration.id,
    'festival-collaboration-invite:' || collaboration.id::text || ':' || collaboration.version::text,
    'Festival collaboration invitation: review and accept the guest/featured performance obligations in Festivals.'
  );

  RETURN collaboration;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_festival_performance_collaborator(
  p_collaboration_id uuid,
  p_expected_version integer,
  p_response text,
  p_idempotency_key text
)
RETURNS public.festival_performance_collaborations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  collaboration public.festival_performance_collaborations%ROWTYPE;
  existing_event public.festival_performance_collaboration_events%ROWTYPE;
  session_row public.festival_performance_sessions%ROWTYPE;
BEGIN
  SELECT * INTO collaboration
  FROM public.festival_performance_collaborations
  WHERE id = p_collaboration_id
  FOR UPDATE;

  IF NOT FOUND OR actor IS NULL OR collaboration.profile_id <> actor THEN
    RAISE EXCEPTION 'festival_collaboration_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO existing_event
  FROM public.festival_performance_collaboration_events
  WHERE collaboration_id = collaboration.id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF existing_event.event_type <> p_response THEN
      RAISE EXCEPTION 'festival_collaboration_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN collaboration;
  END IF;

  IF collaboration.version <> p_expected_version THEN
    RAISE EXCEPTION 'festival_collaboration_stale' USING ERRCODE = 'P0001';
  END IF;

  IF collaboration.status <> 'invited' OR p_response NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'festival_collaboration_invalid_transition' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.festival_performance_collaborations
  SET status = p_response,
      accepted_obligations = CASE WHEN p_response = 'accepted' THEN obligations ELSE NULL END,
      accepted_at = CASE WHEN p_response = 'accepted' THEN now() ELSE NULL END,
      responded_at = now(),
      version = version + 1,
      updated_at = now()
  WHERE id = collaboration.id
  RETURNING * INTO collaboration;

  INSERT INTO public.festival_performance_collaboration_events(
    collaboration_id, actor_profile_id, event_type, payload, idempotency_key
  )
  VALUES (
    collaboration.id,
    actor,
    p_response,
    jsonb_build_object(
      'accepted_obligations', collaboration.accepted_obligations,
      'version', collaboration.version
    ),
    p_idempotency_key
  );

  IF collaboration.status = 'accepted' THEN
    SELECT * INTO session_row
    FROM public.festival_performance_sessions
    WHERE contract_id = collaboration.contract_id;

    IF FOUND THEN
      INSERT INTO public.festival_performance_attendance(
        session_id,
        profile_id,
        guest_profile_id,
        expected_role,
        required_attendance,
        metadata
      )
      VALUES (
        session_row.id,
        collaboration.profile_id,
        collaboration.profile_id,
        collaboration.role,
        true,
        jsonb_build_object(
          'snapshot_source', 'festival_performance_collaborations',
          'collaboration_id', collaboration.id,
          'obligations', collaboration.accepted_obligations
        )
      )
      ON CONFLICT (session_id, profile_id) DO UPDATE
      SET guest_profile_id = excluded.guest_profile_id,
          expected_role = excluded.expected_role,
          required_attendance = excluded.required_attendance,
          metadata = excluded.metadata,
          updated_at = now();
    END IF;
  END IF;

  RETURN collaboration;
END;
$$;

CREATE OR REPLACE FUNCTION public.festival_snapshot_expected_performers(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  session_row public.festival_performance_sessions%ROWTYPE;
  inserted integer := 0;
  affected integer := 0;
BEGIN
  SELECT * INTO session_row
  FROM public.festival_performance_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  INSERT INTO public.festival_performance_attendance(
    session_id,
    profile_id,
    band_member_id,
    expected_role,
    required_attendance,
    metadata
  )
  SELECT
    session_row.id,
    coalesce(
      bm.profile_id,
      (SELECT p.id FROM public.profiles p WHERE p.user_id = bm.user_id LIMIT 1)
    ),
    bm.id,
    coalesce(bm.role, 'performer'),
    true,
    jsonb_build_object('snapshot_source', 'band_members')
  FROM public.band_members bm
  WHERE bm.band_id = session_row.band_id
    AND coalesce(bm.member_status, 'active') = 'active'
  ON CONFLICT (session_id, profile_id) DO NOTHING;
  GET DIAGNOSTICS affected = ROW_COUNT;
  inserted := inserted + affected;

  INSERT INTO public.festival_performance_attendance(
    session_id,
    profile_id,
    guest_profile_id,
    expected_role,
    required_attendance,
    metadata
  )
  SELECT
    session_row.id,
    c.profile_id,
    c.profile_id,
    c.role,
    true,
    jsonb_build_object(
      'snapshot_source', 'festival_performance_collaborations',
      'collaboration_id', c.id,
      'obligations', c.accepted_obligations
    )
  FROM public.festival_performance_collaborations c
  WHERE c.contract_id = session_row.contract_id
    AND c.status = 'accepted'
  ON CONFLICT (session_id, profile_id) DO UPDATE
  SET guest_profile_id = excluded.guest_profile_id,
      expected_role = excluded.expected_role,
      required_attendance = excluded.required_attendance,
      metadata = excluded.metadata,
      updated_at = now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  inserted := inserted + affected;

  RETURN inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_festival_guest_obligation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  contract_id_value uuid;
  collaboration public.festival_performance_collaborations%ROWTYPE;
  song_scope jsonb;
BEGIN
  IF NEW.guest_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sl.contract_id INTO contract_id_value
  FROM public.festival_contract_setlists sl
  WHERE sl.id = NEW.setlist_id;

  SELECT * INTO collaboration
  FROM public.festival_performance_collaborations c
  WHERE c.contract_id = contract_id_value
    AND c.profile_id = NEW.guest_profile_id
    AND c.status = 'accepted';

  IF NOT FOUND OR collaboration.accepted_obligations IS NULL THEN
    RAISE EXCEPTION 'festival_guest_obligation_not_accepted' USING ERRCODE = 'P0001';
  END IF;

  song_scope := coalesce(collaboration.accepted_obligations->'song_ids', '[]'::jsonb);
  IF jsonb_typeof(song_scope) = 'array'
    AND jsonb_array_length(song_scope) > 0
    AND (NEW.song_id IS NULL OR NOT (song_scope ? NEW.song_id::text))
  THEN
    RAISE EXCEPTION 'festival_guest_song_not_authorised' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_festival_guest_obligation
  ON public.festival_contract_setlist_items;
CREATE TRIGGER trg_enforce_festival_guest_obligation
BEFORE INSERT OR UPDATE OF guest_profile_id, song_id, setlist_id
ON public.festival_contract_setlist_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_festival_guest_obligation();

CREATE OR REPLACE FUNCTION public.festival_setlist_preflight(
  p_contract_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c public.festival_contracts%ROWTYPE;
  total integer := 0;
  maxsec integer := 0;
  minsec integer := 60;
  invalid text[] := '{}';
  duplicates text[] := '{}';
  unavailable text[] := '{}';
  guest_issues text[] := '{}';
  warnings text[] := '{}';
  blockers text[] := '{}';
  seen uuid[] := '{}';
  item jsonb;
  sid uuid;
  guest_id uuid;
  collaboration public.festival_performance_collaborations%ROWTYPE;
  song_scope jsonb;
BEGIN
  SELECT * INTO c FROM public.festival_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN
    blockers := array_append(blockers, 'Contract not found');
  END IF;

  maxsec := coalesce((c.terms_snapshot->>'set_duration_minutes')::int, 60) * 60;
  IF jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' THEN
    blockers := array_append(blockers, 'Setlist items must be an array');
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) LOOP
    total := total + coalesce((item->>'planned_duration_seconds')::int, 0);
    BEGIN sid := (item->>'song_id')::uuid; EXCEPTION WHEN others THEN sid := NULL; END;
    BEGIN guest_id := nullif(item->>'guest_profile_id', '')::uuid; EXCEPTION WHEN others THEN guest_id := NULL; END;

    IF sid IS NULL THEN
      invalid := array_append(invalid, coalesce(item->>'song_id', ''));
      CONTINUE;
    END IF;

    IF sid = ANY(seen) THEN
      duplicates := array_append(duplicates, sid::text);
    END IF;
    seen := array_append(seen, sid);

    IF c.id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.songs s WHERE s.id = sid AND s.band_id = c.band_id
      )
    THEN
      unavailable := array_append(unavailable, sid::text);
    END IF;

    IF item ? 'guest_profile_id' AND nullif(item->>'guest_profile_id', '') IS NOT NULL THEN
      IF guest_id IS NULL THEN
        guest_issues := array_append(guest_issues, 'A guest performer identifier is invalid.');
      ELSE
        SELECT * INTO collaboration
        FROM public.festival_performance_collaborations pc
        WHERE pc.contract_id = p_contract_id
          AND pc.profile_id = guest_id
          AND pc.status = 'accepted';

        IF NOT FOUND OR collaboration.accepted_obligations IS NULL THEN
          guest_issues := array_append(
            guest_issues,
            'A guest performer has not accepted their festival obligations.'
          );
        ELSE
          song_scope := coalesce(collaboration.accepted_obligations->'song_ids', '[]'::jsonb);
          IF jsonb_typeof(song_scope) = 'array'
            AND jsonb_array_length(song_scope) > 0
            AND NOT (song_scope ? sid::text)
          THEN
            guest_issues := array_append(
              guest_issues,
              'A guest performer is not authorised for one of the selected songs.'
            );
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF total > maxsec THEN
    blockers := array_append(blockers, 'Setlist exceeds contracted maximum duration');
  END IF;
  IF total < minsec THEN
    warnings := array_append(warnings, 'Setlist is shorter than the recommended minimum duration');
  END IF;
  IF array_length(invalid, 1) IS NOT NULL THEN
    blockers := array_append(blockers, 'Setlist contains invalid song identifiers');
  END IF;
  IF array_length(unavailable, 1) IS NOT NULL THEN
    blockers := array_append(blockers, 'Setlist contains songs outside authorised repertoire');
  END IF;
  IF array_length(guest_issues, 1) IS NOT NULL THEN
    blockers := array_append(blockers, 'Setlist contains unresolved guest performer obligations');
  END IF;

  RETURN jsonb_build_object(
    'total_duration_seconds', total,
    'contracted_maximum_seconds', maxsec,
    'minimum_recommended_seconds', minsec,
    'invalid_songs', invalid,
    'duplicate_songs', duplicates,
    'unavailable_songs', unavailable,
    'guest_performer_issues', guest_issues,
    'readiness_warnings', ARRAY[]::text[],
    'version_conflict', jsonb_build_object(
      'current_version', (SELECT max(version) FROM public.festival_contract_setlists WHERE contract_id = p_contract_id),
      'conflict', false
    ),
    'outcome', CASE
      WHEN array_length(blockers, 1) IS NOT NULL THEN 'blocked'
      WHEN array_length(warnings, 1) IS NOT NULL OR array_length(duplicates, 1) IS NOT NULL THEN 'warning'
      ELSE 'allowed'
    END,
    'blocking_reasons', blockers,
    'warnings', warnings
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.festival_rivalry_candidates(p_contract_id uuid)
RETURNS TABLE(
  rival_contract_id uuid,
  rival_band_id uuid,
  rival_band_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  contract_row public.festival_contracts%ROWTYPE;
BEGIN
  SELECT * INTO contract_row
  FROM public.festival_contracts
  WHERE id = p_contract_id;

  IF NOT FOUND
    OR contract_row.status <> 'active'
    OR NOT public._festival_b7_can_manage_contract(p_contract_id, actor)
  THEN
    RAISE EXCEPTION 'festival_rivalry_forbidden' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT rival.id, rival.band_id, b.name::text
  FROM public.festival_contracts rival
  JOIN public.bands b ON b.id = rival.band_id
  WHERE rival.edition_id = contract_row.edition_id
    AND rival.status = 'active'
    AND rival.id <> contract_row.id
    AND NOT EXISTS (
      SELECT 1
      FROM public.festival_rivalry_objectives objective
      WHERE objective.challenger_contract_id = contract_row.id
        AND objective.rival_contract_id = rival.id
        AND objective.status IN ('pending_rival','active','resolved')
    )
  ORDER BY lower(b.name), rival.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_festival_rivalry_objectives(p_contract_id uuid)
RETURNS TABLE(
  rivalry_id uuid,
  edition_id uuid,
  challenger_contract_id uuid,
  challenger_band_id uuid,
  challenger_band_name text,
  rival_contract_id uuid,
  rival_band_id uuid,
  rival_band_name text,
  status text,
  version integer,
  resolution_result text,
  resolution_evidence jsonb,
  can_respond boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
BEGIN
  IF actor IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.festival_rivalry_objectives objective
    JOIN public.festival_contracts cc ON cc.id = objective.challenger_contract_id
    JOIN public.festival_contracts rc ON rc.id = objective.rival_contract_id
    WHERE (objective.challenger_contract_id = p_contract_id OR objective.rival_contract_id = p_contract_id)
      AND (
        public._festival_artist_authorised(actor, 'band', NULL, cc.band_id)
        OR public._festival_artist_authorised(actor, 'band', NULL, rc.band_id)
        OR public.can_manage_festival_brand(cc.festival_id)
      )
  ) AND NOT public._festival_b7_can_manage_contract(p_contract_id, actor) THEN
    RAISE EXCEPTION 'festival_rivalry_forbidden' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    objective.id,
    objective.edition_id,
    objective.challenger_contract_id,
    objective.challenger_band_id,
    challenger.name::text,
    objective.rival_contract_id,
    objective.rival_band_id,
    rival.name::text,
    objective.status,
    objective.version,
    objective.resolution_result,
    objective.resolution_evidence,
    objective.status = 'pending_rival'
      AND public._festival_artist_authorised(actor, 'band', NULL, objective.rival_band_id)
  FROM public.festival_rivalry_objectives objective
  JOIN public.bands challenger ON challenger.id = objective.challenger_band_id
  JOIN public.bands rival ON rival.id = objective.rival_band_id
  WHERE objective.challenger_contract_id = p_contract_id
     OR objective.rival_contract_id = p_contract_id
  ORDER BY objective.created_at DESC, objective.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_festival_rivalry_objective(
  p_challenger_contract_id uuid,
  p_rival_contract_id uuid,
  p_idempotency_key text
)
RETURNS public.festival_rivalry_objectives
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  challenger public.festival_contracts%ROWTYPE;
  rival public.festival_contracts%ROWTYPE;
  objective public.festival_rivalry_objectives%ROWTYPE;
  request_hash text;
BEGIN
  SELECT * INTO challenger
  FROM public.festival_contracts
  WHERE id = p_challenger_contract_id
  FOR UPDATE;
  SELECT * INTO rival
  FROM public.festival_contracts
  WHERE id = p_rival_contract_id
  FOR UPDATE;

  IF actor IS NULL
    OR nullif(btrim(p_idempotency_key), '') IS NULL
    OR challenger.id IS NULL
    OR rival.id IS NULL
    OR challenger.status <> 'active'
    OR rival.status <> 'active'
    OR challenger.edition_id <> rival.edition_id
    OR challenger.band_id = rival.band_id
    OR NOT public._festival_artist_authorised(actor, 'band', NULL, challenger.band_id)
  THEN
    RAISE EXCEPTION 'festival_rivalry_forbidden' USING ERRCODE = 'P0001';
  END IF;

  request_hash := public.festival_terms_hash(
    jsonb_build_object(
      'challenger_contract_id', challenger.id,
      'rival_contract_id', rival.id,
      'objective_type', 'outperform_overall_score'
    )
  );

  SELECT * INTO objective
  FROM public.festival_rivalry_objectives
  WHERE created_by_profile_id = actor
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF objective.request_hash <> request_hash THEN
      RAISE EXCEPTION 'festival_rivalry_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN objective;
  END IF;

  INSERT INTO public.festival_rivalry_objectives(
    edition_id,
    challenger_contract_id,
    rival_contract_id,
    challenger_band_id,
    rival_band_id,
    created_by_profile_id,
    idempotency_key,
    request_hash
  )
  VALUES (
    challenger.edition_id,
    challenger.id,
    rival.id,
    challenger.band_id,
    rival.band_id,
    actor,
    p_idempotency_key,
    request_hash
  )
  RETURNING * INTO objective;

  INSERT INTO public.festival_rivalry_objective_events(
    rivalry_id, actor_profile_id, event_type, payload, idempotency_key
  )
  VALUES (
    objective.id,
    actor,
    'created',
    jsonb_build_object('objective_type', objective.objective_type),
    p_idempotency_key
  );

  RETURN objective;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_festival_rivalry_objective(
  p_rivalry_id uuid,
  p_expected_version integer,
  p_response text,
  p_idempotency_key text
)
RETURNS public.festival_rivalry_objectives
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  objective public.festival_rivalry_objectives%ROWTYPE;
  existing_event public.festival_rivalry_objective_events%ROWTYPE;
BEGIN
  SELECT * INTO objective
  FROM public.festival_rivalry_objectives
  WHERE id = p_rivalry_id
  FOR UPDATE;

  IF NOT FOUND
    OR actor IS NULL
    OR NOT public._festival_artist_authorised(actor, 'band', NULL, objective.rival_band_id)
  THEN
    RAISE EXCEPTION 'festival_rivalry_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO existing_event
  FROM public.festival_rivalry_objective_events
  WHERE rivalry_id = objective.id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF existing_event.event_type <> p_response THEN
      RAISE EXCEPTION 'festival_rivalry_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN objective;
  END IF;

  IF objective.version <> p_expected_version THEN
    RAISE EXCEPTION 'festival_rivalry_stale' USING ERRCODE = 'P0001';
  END IF;

  IF objective.status <> 'pending_rival' OR p_response NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'festival_rivalry_invalid_transition' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.festival_rivalry_objectives
  SET status = CASE WHEN p_response = 'accepted' THEN 'active' ELSE 'declined' END,
      accepted_by_profile_id = CASE WHEN p_response = 'accepted' THEN actor ELSE NULL END,
      version = version + 1,
      updated_at = now()
  WHERE id = objective.id
  RETURNING * INTO objective;

  INSERT INTO public.festival_rivalry_objective_events(
    rivalry_id, actor_profile_id, event_type, payload, idempotency_key
  )
  VALUES (
    objective.id,
    actor,
    p_response,
    jsonb_build_object('status', objective.status, 'version', objective.version),
    p_idempotency_key
  );

  RETURN objective;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_festival_rivalry_objectives()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  objective public.festival_rivalry_objectives%ROWTYPE;
  challenger_outcome public.festival_performance_outcomes%ROWTYPE;
  rival_outcome public.festival_performance_outcomes%ROWTYPE;
  resolved_count integer := 0;
  result_value text;
BEGIN
  FOR objective IN
    SELECT *
    FROM public.festival_rivalry_objectives
    WHERE status = 'active'
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT outcome.* INTO challenger_outcome
    FROM public.festival_performance_outcomes outcome
    JOIN public.festival_performance_sessions session_row
      ON session_row.id = outcome.session_id
    WHERE session_row.contract_id = objective.challenger_contract_id
      AND outcome.status::text IN ('finalised','applied')
    ORDER BY outcome.finalised_at DESC NULLS LAST, outcome.calculated_at DESC
    LIMIT 1;

    SELECT outcome.* INTO rival_outcome
    FROM public.festival_performance_outcomes outcome
    JOIN public.festival_performance_sessions session_row
      ON session_row.id = outcome.session_id
    WHERE session_row.contract_id = objective.rival_contract_id
      AND outcome.status::text IN ('finalised','applied')
    ORDER BY outcome.finalised_at DESC NULLS LAST, outcome.calculated_at DESC
    LIMIT 1;

    IF challenger_outcome.id IS NULL OR rival_outcome.id IS NULL THEN
      CONTINUE;
    END IF;

    result_value := CASE
      WHEN challenger_outcome.overall_score > rival_outcome.overall_score THEN 'challenger_win'
      WHEN challenger_outcome.overall_score < rival_outcome.overall_score THEN 'rival_win'
      ELSE 'tie'
    END;

    UPDATE public.festival_rivalry_objectives
    SET status = 'resolved',
        resolution_result = result_value,
        resolution_evidence = jsonb_build_object(
          'authority', 'festival_performance_outcomes',
          'objective_type', 'outperform_overall_score',
          'challenger_outcome_id', challenger_outcome.id,
          'challenger_overall_score', challenger_outcome.overall_score,
          'rival_outcome_id', rival_outcome.id,
          'rival_overall_score', rival_outcome.overall_score
        ),
        resolved_at = now(),
        version = version + 1,
        updated_at = now()
    WHERE id = objective.id;

    INSERT INTO public.festival_rivalry_objective_events(
      rivalry_id, event_type, payload, idempotency_key
    )
    VALUES (
      objective.id,
      'resolved',
      jsonb_build_object(
        'result', result_value,
        'challenger_outcome_id', challenger_outcome.id,
        'rival_outcome_id', rival_outcome.id
      ),
      'resolve:' || challenger_outcome.id::text || ':' || rival_outcome.id::text
    )
    ON CONFLICT DO NOTHING;

    resolved_count := resolved_count + 1;
  END LOOP;

  RETURN resolved_count;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_festival_rivalry_objectives()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_festival_rivalry_objectives()
  TO service_role;

CREATE OR REPLACE FUNCTION public._festival_b7_vote_candidate_eligibility(
  p_window_id uuid,
  p_application_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  vote_window public.festival_fan_vote_windows%ROWTYPE;
  application_row public.festival_applications%ROWTYPE;
  slot_row public.festival_stage_slots%ROWTYPE;
  reasons text[] := '{}';
BEGIN
  SELECT * INTO vote_window
  FROM public.festival_fan_vote_windows
  WHERE id = p_window_id;
  SELECT * INTO application_row
  FROM public.festival_applications
  WHERE id = p_application_id;
  SELECT * INTO slot_row
  FROM public.festival_stage_slots
  WHERE id = vote_window.stage_slot_id;

  IF vote_window.id IS NULL OR application_row.id IS NULL THEN
    reasons := array_append(reasons, 'Vote window or application not found');
  ELSE
    IF application_row.edition_id <> vote_window.edition_id THEN
      reasons := array_append(reasons, 'Application belongs to a different festival edition');
    END IF;
    IF application_row.status::text NOT IN ('submitted','under_review','waitlisted','shortlisted') THEN
      reasons := array_append(reasons, 'Application is no longer eligible for fan voting');
    END IF;
    IF coalesce(application_row.eligibility_snapshot->>'outcome', 'allowed') = 'blocked' THEN
      reasons := array_append(reasons, 'Application failed canonical eligibility checks');
    END IF;
    IF slot_row.id IS NULL
      OR slot_row.status <> 'open'
      OR slot_row.band_id IS NOT NULL
      OR slot_row.canonical_contract_id IS NOT NULL
    THEN
      reasons := array_append(reasons, 'The fan-vote slot is no longer open');
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.festival_contracts contract_row
      WHERE contract_row.edition_id = vote_window.edition_id
        AND contract_row.band_id = application_row.band_id
        AND contract_row.status IN (
          'awaiting_band_signature',
          'awaiting_organiser_signature',
          'awaiting_signatures',
          'active',
          'amendment_required'
        )
    ) THEN
      reasons := array_append(reasons, 'Band already has an active festival booking');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'outcome', CASE WHEN array_length(reasons, 1) IS NULL THEN 'allowed' ELSE 'blocked' END,
    'eligible', array_length(reasons, 1) IS NULL,
    'reasons', reasons,
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public._festival_b7_vote_candidate_eligibility(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_festival_fan_vote_window(
  p_edition_id uuid,
  p_stage_slot_id uuid,
  p_title text,
  p_opens_at timestamptz,
  p_closes_at timestamptz,
  p_idempotency_key text
)
RETURNS public.festival_fan_vote_windows
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  edition_row public.festival_editions%ROWTYPE;
  slot_row public.festival_stage_slots%ROWTYPE;
  vote_window public.festival_fan_vote_windows%ROWTYPE;
  request_hash text;
BEGIN
  SELECT * INTO edition_row
  FROM public.festival_editions
  WHERE id = p_edition_id;
  SELECT * INTO slot_row
  FROM public.festival_stage_slots
  WHERE id = p_stage_slot_id
  FOR UPDATE;

  IF actor IS NULL
    OR nullif(btrim(p_idempotency_key), '') IS NULL
    OR edition_row.id IS NULL
    OR NOT public.can_manage_festival_brand(edition_row.festival_id)
    OR slot_row.id IS NULL
    OR slot_row.festival_id <> edition_row.festival_id
    OR slot_row.status <> 'open'
    OR slot_row.band_id IS NOT NULL
    OR slot_row.canonical_contract_id IS NOT NULL
    OR nullif(btrim(p_title), '') IS NULL
    OR p_closes_at <= p_opens_at
    OR p_closes_at <= now()
    OR (slot_row.start_time IS NOT NULL AND p_closes_at > slot_row.start_time)
  THEN
    RAISE EXCEPTION 'festival_fan_vote_window_invalid' USING ERRCODE = 'P0001';
  END IF;

  request_hash := public.festival_terms_hash(
    jsonb_build_object(
      'edition_id', p_edition_id,
      'stage_slot_id', p_stage_slot_id,
      'title', btrim(p_title),
      'opens_at', p_opens_at,
      'closes_at', p_closes_at
    )
  );

  SELECT * INTO vote_window
  FROM public.festival_fan_vote_windows
  WHERE created_by_profile_id = actor
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF vote_window.request_hash <> request_hash THEN
      RAISE EXCEPTION 'festival_fan_vote_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN vote_window;
  END IF;

  INSERT INTO public.festival_fan_vote_windows(
    edition_id,
    stage_slot_id,
    title,
    status,
    opens_at,
    closes_at,
    created_by_profile_id,
    idempotency_key,
    request_hash
  )
  VALUES (
    p_edition_id,
    p_stage_slot_id,
    btrim(p_title),
    CASE WHEN p_opens_at <= now() THEN 'open' ELSE 'scheduled' END,
    p_opens_at,
    p_closes_at,
    actor,
    p_idempotency_key,
    request_hash
  )
  RETURNING * INTO vote_window;

  INSERT INTO public.festival_fan_vote_events(
    window_id, actor_profile_id, event_type, payload, idempotency_key
  )
  VALUES (
    vote_window.id,
    actor,
    'window_created',
    jsonb_build_object(
      'stage_slot_id', vote_window.stage_slot_id,
      'opens_at', vote_window.opens_at,
      'closes_at', vote_window.closes_at
    ),
    p_idempotency_key
  );

  RETURN vote_window;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_festival_fan_vote_candidate(
  p_window_id uuid,
  p_application_id uuid,
  p_idempotency_key text
)
RETURNS public.festival_fan_vote_candidates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  vote_window public.festival_fan_vote_windows%ROWTYPE;
  application_row public.festival_applications%ROWTYPE;
  eligibility jsonb;
  candidate public.festival_fan_vote_candidates%ROWTYPE;
BEGIN
  SELECT * INTO vote_window
  FROM public.festival_fan_vote_windows
  WHERE id = p_window_id
  FOR UPDATE;
  SELECT * INTO application_row
  FROM public.festival_applications
  WHERE id = p_application_id;

  IF actor IS NULL
    OR vote_window.id IS NULL
    OR application_row.id IS NULL
    OR vote_window.status NOT IN ('scheduled','open')
    OR vote_window.closes_at <= now()
    OR NOT EXISTS (
      SELECT 1
      FROM public.festival_editions edition_row
      WHERE edition_row.id = vote_window.edition_id
        AND public.can_manage_festival_brand(edition_row.festival_id)
    )
  THEN
    RAISE EXCEPTION 'festival_fan_vote_candidate_forbidden' USING ERRCODE = 'P0001';
  END IF;

  eligibility := public._festival_b7_vote_candidate_eligibility(p_window_id, p_application_id);
  IF coalesce((eligibility->>'eligible')::boolean, false) = false THEN
    RAISE EXCEPTION 'festival_fan_vote_candidate_ineligible: %', eligibility->'reasons' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.festival_fan_vote_candidates(
    window_id,
    application_id,
    band_id,
    eligibility_snapshot,
    approved_by_profile_id
  )
  VALUES (
    vote_window.id,
    application_row.id,
    application_row.band_id,
    eligibility,
    actor
  )
  ON CONFLICT (window_id, application_id) DO UPDATE
  SET eligibility_snapshot = excluded.eligibility_snapshot,
      status = 'eligible',
      approved_by_profile_id = excluded.approved_by_profile_id
  RETURNING * INTO candidate;

  INSERT INTO public.festival_fan_vote_events(
    window_id, actor_profile_id, event_type, payload, idempotency_key
  )
  VALUES (
    vote_window.id,
    actor,
    'candidate_approved',
    jsonb_build_object(
      'candidate_id', candidate.id,
      'application_id', candidate.application_id,
      'band_id', candidate.band_id,
      'eligibility', eligibility
    ),
    p_idempotency_key
  )
  ON CONFLICT DO NOTHING;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.cast_festival_fan_vote(
  p_window_id uuid,
  p_candidate_id uuid,
  p_idempotency_key text
)
RETURNS public.festival_fan_votes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  vote_window public.festival_fan_vote_windows%ROWTYPE;
  candidate public.festival_fan_vote_candidates%ROWTYPE;
  existing_vote public.festival_fan_votes%ROWTYPE;
  eligibility jsonb;
BEGIN
  SELECT * INTO vote_window
  FROM public.festival_fan_vote_windows
  WHERE id = p_window_id
  FOR UPDATE;
  SELECT * INTO candidate
  FROM public.festival_fan_vote_candidates
  WHERE id = p_candidate_id
    AND window_id = p_window_id;

  IF actor IS NULL
    OR nullif(btrim(p_idempotency_key), '') IS NULL
    OR vote_window.id IS NULL
    OR candidate.id IS NULL
    OR candidate.status <> 'eligible'
    OR vote_window.status NOT IN ('scheduled','open')
    OR now() < vote_window.opens_at
    OR now() >= vote_window.closes_at
  THEN
    RAISE EXCEPTION 'festival_fan_vote_unavailable' USING ERRCODE = 'P0001';
  END IF;

  eligibility := public._festival_b7_vote_candidate_eligibility(
    vote_window.id,
    candidate.application_id
  );
  IF coalesce((eligibility->>'eligible')::boolean, false) = false THEN
    RAISE EXCEPTION 'festival_fan_vote_candidate_ineligible' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO existing_vote
  FROM public.festival_fan_votes
  WHERE window_id = vote_window.id
    AND voter_profile_id = actor;

  IF FOUND THEN
    IF existing_vote.candidate_id <> candidate.id THEN
      RAISE EXCEPTION 'festival_fan_vote_already_cast' USING ERRCODE = 'P0001';
    END IF;
    RETURN existing_vote;
  END IF;

  INSERT INTO public.festival_fan_votes(
    window_id,
    candidate_id,
    voter_profile_id,
    weight,
    idempotency_key
  )
  VALUES (
    vote_window.id,
    candidate.id,
    actor,
    1,
    p_idempotency_key
  )
  RETURNING * INTO existing_vote;

  RETURN existing_vote;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_open_festival_fan_vote_windows(
  p_edition_id uuid DEFAULT NULL
)
RETURNS TABLE(
  window_id uuid,
  edition_id uuid,
  stage_slot_id uuid,
  title text,
  opens_at timestamptz,
  closes_at timestamptz,
  candidates jsonb,
  voter_candidate_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'festival_fan_vote_forbidden' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    vote_window.id,
    vote_window.edition_id,
    vote_window.stage_slot_id,
    vote_window.title,
    vote_window.opens_at,
    vote_window.closes_at,
    coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'candidate_id', candidate.id,
          'application_id', candidate.application_id,
          'band_id', candidate.band_id,
          'band_name', band.name,
          'vote_count', (
            SELECT count(*)
            FROM public.festival_fan_votes vote
            WHERE vote.candidate_id = candidate.id
          )
        )
        ORDER BY lower(band.name), candidate.id
      )
      FROM public.festival_fan_vote_candidates candidate
      JOIN public.bands band ON band.id = candidate.band_id
      WHERE candidate.window_id = vote_window.id
        AND candidate.status = 'eligible'
        AND coalesce((public._festival_b7_vote_candidate_eligibility(vote_window.id, candidate.application_id)->>'eligible')::boolean, false)
    ), '[]'::jsonb),
    (
      SELECT vote.candidate_id
      FROM public.festival_fan_votes vote
      WHERE vote.window_id = vote_window.id
        AND vote.voter_profile_id = actor
      LIMIT 1
    )
  FROM public.festival_fan_vote_windows vote_window
  WHERE (p_edition_id IS NULL OR vote_window.edition_id = p_edition_id)
    AND vote_window.status IN ('scheduled','open')
    AND now() >= vote_window.opens_at
    AND now() < vote_window.closes_at
  ORDER BY vote_window.closes_at, vote_window.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_organiser_festival_fan_vote_windows(
  p_edition_id uuid
)
RETURNS TABLE(
  window_id uuid,
  edition_id uuid,
  stage_slot_id uuid,
  title text,
  status text,
  opens_at timestamptz,
  closes_at timestamptz,
  candidates jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.festival_editions edition_row
    WHERE edition_row.id = p_edition_id
      AND public.can_manage_festival_brand(edition_row.festival_id)
  ) THEN
    RAISE EXCEPTION 'festival_fan_vote_forbidden' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    vote_window.id,
    vote_window.edition_id,
    vote_window.stage_slot_id,
    vote_window.title,
    vote_window.status,
    vote_window.opens_at,
    vote_window.closes_at,
    coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'candidate_id', candidate.id,
          'application_id', candidate.application_id,
          'band_id', candidate.band_id,
          'band_name', band.name,
          'status', candidate.status,
          'vote_count', (
            SELECT count(*)
            FROM public.festival_fan_votes vote
            WHERE vote.candidate_id = candidate.id
          ),
          'eligibility', public._festival_b7_vote_candidate_eligibility(
            vote_window.id,
            candidate.application_id
          )
        )
        ORDER BY lower(band.name), candidate.id
      )
      FROM public.festival_fan_vote_candidates candidate
      JOIN public.bands band ON band.id = candidate.band_id
      WHERE candidate.window_id = vote_window.id
    ), '[]'::jsonb)
  FROM public.festival_fan_vote_windows vote_window
  WHERE vote_window.edition_id = p_edition_id
  ORDER BY vote_window.created_at DESC, vote_window.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_festival_fan_vote_window(
  p_window_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  vote_window public.festival_fan_vote_windows%ROWTYPE;
  result_payload jsonb;
BEGIN
  SELECT * INTO vote_window
  FROM public.festival_fan_vote_windows
  WHERE id = p_window_id
  FOR UPDATE;

  IF actor IS NULL
    OR vote_window.id IS NULL
    OR vote_window.version <> p_expected_version
    OR vote_window.status NOT IN ('scheduled','open')
    OR NOT EXISTS (
      SELECT 1
      FROM public.festival_editions edition_row
      WHERE edition_row.id = vote_window.edition_id
        AND public.can_manage_festival_brand(edition_row.festival_id)
    )
  THEN
    RAISE EXCEPTION 'festival_fan_vote_close_forbidden' USING ERRCODE = 'P0001';
  END IF;

  result_payload := coalesce((
    SELECT jsonb_agg(
      jsonb_build_object(
        'candidate_id', candidate.id,
        'application_id', candidate.application_id,
        'band_id', candidate.band_id,
        'band_name', band.name,
        'votes', (
          SELECT count(*)
          FROM public.festival_fan_votes vote
          WHERE vote.candidate_id = candidate.id
        )
      )
      ORDER BY (
        SELECT count(*)
        FROM public.festival_fan_votes vote
        WHERE vote.candidate_id = candidate.id
      ) DESC, lower(band.name), candidate.id
    )
    FROM public.festival_fan_vote_candidates candidate
    JOIN public.bands band ON band.id = candidate.band_id
    WHERE candidate.window_id = vote_window.id
      AND candidate.status = 'eligible'
  ), '[]'::jsonb);

  UPDATE public.festival_fan_vote_windows
  SET status = 'closed',
      version = version + 1,
      updated_at = now()
  WHERE id = vote_window.id
  RETURNING * INTO vote_window;

  INSERT INTO public.festival_fan_vote_events(
    window_id, actor_profile_id, event_type, payload, idempotency_key
  )
  VALUES (
    vote_window.id,
    actor,
    'window_closed',
    jsonb_build_object(
      'results', result_payload,
      'booking_authority', 'none',
      'next_step', 'organiser_must_issue_canonical_offer'
    ),
    p_idempotency_key
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'window_id', vote_window.id,
    'status', vote_window.status,
    'version', vote_window.version,
    'results', result_payload,
    'booking_authority', 'none',
    'next_step', 'organiser_must_issue_canonical_offer'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_festival_lineup_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipient uuid;
  change_hash text;
BEGIN
  IF NOT (
    OLD.stage_slot_id IS DISTINCT FROM NEW.stage_slot_id
    OR (OLD.terms_snapshot->>'proposed_start_at') IS DISTINCT FROM (NEW.terms_snapshot->>'proposed_start_at')
    OR (OLD.terms_snapshot->>'proposed_stage_name') IS DISTINCT FROM (NEW.terms_snapshot->>'proposed_stage_name')
    OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'amendment_required')
  ) THEN
    RETURN NEW;
  END IF;

  change_hash := public.festival_terms_hash(
    jsonb_build_object(
      'stage_slot_id', NEW.stage_slot_id,
      'proposed_start_at', NEW.terms_snapshot->>'proposed_start_at',
      'proposed_stage_name', NEW.terms_snapshot->>'proposed_stage_name',
      'status', NEW.status::text
    )
  );

  FOR recipient IN
    SELECT DISTINCT recipient_rows.profile_id
    FROM (
      SELECT coalesce(
        bm.profile_id,
        (SELECT p.id FROM public.profiles p WHERE p.user_id = bm.user_id LIMIT 1)
      ) AS profile_id
      FROM public.band_members bm
      WHERE bm.band_id = NEW.band_id
        AND coalesce(bm.member_status, 'active') = 'active'
      UNION
      SELECT collaboration.profile_id
      FROM public.festival_performance_collaborations collaboration
      WHERE collaboration.contract_id = NEW.id
        AND collaboration.status = 'accepted'
    ) recipient_rows
    WHERE recipient_rows.profile_id IS NOT NULL
  LOOP
    PERFORM public._festival_b7_notify_profile(
      recipient,
      'festival_lineup_changed',
      NEW.id,
      'festival-lineup-change:' || NEW.id::text || ':' || change_hash || ':' || recipient::text,
      'Festival lineup update: your stage, time, or booking status changed. Check Festivals for the latest performance details.'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_festival_lineup_change ON public.festival_contracts;
CREATE TRIGGER trg_notify_festival_lineup_change
AFTER UPDATE OF stage_slot_id, terms_snapshot, status
ON public.festival_contracts
FOR EACH ROW
EXECUTE FUNCTION public.notify_festival_lineup_change();

CREATE OR REPLACE FUNCTION public.process_festival_performance_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reminder_row record;
  sent_count integer := 0;
  reminder_band text;
  dedupe text;
BEGIN
  FOR reminder_row IN
    WITH recipients AS (
      SELECT
        session_row.id AS session_id,
        session_row.scheduled_start_at,
        coalesce(
          bm.profile_id,
          (SELECT p.id FROM public.profiles p WHERE p.user_id = bm.user_id LIMIT 1)
        ) AS profile_id
      FROM public.festival_performance_sessions session_row
      JOIN public.band_members bm ON bm.band_id = session_row.band_id
      WHERE session_row.status::text NOT IN ('completed','partially_completed','cancelled','no_show','abandoned')
        AND coalesce(bm.member_status, 'active') = 'active'
        AND session_row.scheduled_start_at > now()
        AND session_row.scheduled_start_at <= now() + interval '24 hours'
      UNION
      SELECT
        session_row.id,
        session_row.scheduled_start_at,
        collaboration.profile_id
      FROM public.festival_performance_sessions session_row
      JOIN public.festival_performance_collaborations collaboration
        ON collaboration.contract_id = session_row.contract_id
       AND collaboration.status = 'accepted'
      WHERE session_row.status::text NOT IN ('completed','partially_completed','cancelled','no_show','abandoned')
        AND session_row.scheduled_start_at > now()
        AND session_row.scheduled_start_at <= now() + interval '24 hours'
    )
    SELECT DISTINCT session_id, scheduled_start_at, profile_id
    FROM recipients
    WHERE profile_id IS NOT NULL
  LOOP
    reminder_band := CASE
      WHEN reminder_row.scheduled_start_at <= now() + interval '2 hours' THEN '2h'
      ELSE '24h'
    END;
    dedupe := 'festival-performance-reminder:' || reminder_row.session_id::text || ':' || reminder_band || ':' || reminder_row.profile_id::text;

    IF NOT EXISTS (
      SELECT 1
      FROM public.festival_booking_notification_receipts receipt
      WHERE receipt.dedupe_key = dedupe
    ) THEN
      PERFORM public._festival_b7_notify_profile(
        reminder_row.profile_id,
        'festival_performance_reminder',
        reminder_row.session_id,
        dedupe,
        CASE
          WHEN reminder_band = '2h' THEN 'Festival performance reminder: your stage time is within 2 hours. Check arrival, soundcheck, gear, and guest obligations now.'
          ELSE 'Festival performance reminder: your stage time is within 24 hours. Review your setlist, arrival window, soundcheck, gear, and collaborators.'
        END
      );
      sent_count := sent_count + 1;
    END IF;
  END LOOP;

  RETURN sent_count;
END;
$$;

REVOKE ALL ON FUNCTION public.process_festival_performance_reminders()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_festival_performance_reminders()
  TO service_role;

CREATE OR REPLACE FUNCTION public.process_festival_b7_runtime()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rivalries integer;
  reminders integer;
BEGIN
  rivalries := public.resolve_festival_rivalry_objectives();
  reminders := public.process_festival_performance_reminders();
  RETURN jsonb_build_object('resolved_rivalries', rivalries, 'sent_reminders', reminders);
END;
$$;

REVOKE ALL ON FUNCTION public.process_festival_b7_runtime()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_festival_b7_runtime()
  TO service_role;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO existing_job_id
    FROM cron.job
    WHERE jobname = 'festival_b7_runtime_job';

    IF existing_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job_id);
    END IF;

    PERFORM cron.schedule(
      'festival_b7_runtime_job',
      '*/15 * * * *',
      'SELECT public.process_festival_b7_runtime();'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.festival_collaboration_candidates(uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_festival_contract_collaborators(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_festival_collaboration_obligations()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invite_festival_performance_collaborator(uuid, uuid, text, jsonb, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_festival_performance_collaborator(uuid, integer, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.festival_rivalry_candidates(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_festival_rivalry_objectives(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_festival_rivalry_objective(uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_festival_rivalry_objective(uuid, integer, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_festival_fan_vote_window(uuid, uuid, text, timestamptz, timestamptz, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_festival_fan_vote_candidate(uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cast_festival_fan_vote(uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_open_festival_fan_vote_windows(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_organiser_festival_fan_vote_windows(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_festival_fan_vote_window(uuid, integer, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.festival_collaboration_candidates(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_festival_contract_collaborators(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_festival_collaboration_obligations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_festival_performance_collaborator(uuid, uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_festival_performance_collaborator(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_rivalry_candidates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_festival_rivalry_objectives(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_festival_rivalry_objective(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_festival_rivalry_objective(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_festival_fan_vote_window(uuid, uuid, text, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_festival_fan_vote_candidate(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cast_festival_fan_vote(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_open_festival_fan_vote_windows(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_organiser_festival_fan_vote_windows(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_festival_fan_vote_window(uuid, integer, text) TO authenticated;

COMMENT ON TABLE public.festival_performance_collaborations IS
  'B7 canonical accepted obligations for guest and featured performers on a festival contract.';
COMMENT ON TABLE public.festival_rivalry_objectives IS
  'B7 rivalry objectives resolved only from canonical final festival performance outcomes.';
COMMENT ON TABLE public.festival_fan_vote_windows IS
  'B7 organiser-approved advisory fan voting. Voting never creates contracts or reserves stage slots.';
COMMENT ON FUNCTION public.close_festival_fan_vote_window(uuid, integer, text) IS
  'Closes a B7 fan vote and returns ranked advisory results; booking authority remains with canonical organiser offer/contract flow.';

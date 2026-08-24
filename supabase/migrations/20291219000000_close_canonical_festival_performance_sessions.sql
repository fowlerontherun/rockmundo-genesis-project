-- Close the canonical festival performance-session boundary (backlog B1).
-- Session creation remains rooted exclusively in canonical contracts and slots.

-- A slot is physical schedule authority and may never acquire two sessions, even
-- if corrupt or superseded contract data reaches the creation API.
CREATE UNIQUE INDEX IF NOT EXISTS uq_festival_performance_sessions_stage_slot
  ON public.festival_performance_sessions(stage_slot_id)
  WHERE stage_slot_id IS NOT NULL;

-- Preserve the original, lock-based constructor as an implementation detail and
-- wrap it so the authoritative lineup snapshot is part of every successful call.
ALTER FUNCTION public.ensure_festival_performance_session(uuid, text)
  RENAME TO _ensure_festival_performance_session;

CREATE OR REPLACE FUNCTION public.ensure_festival_performance_session(
  p_contract_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS public.festival_performance_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_row public.festival_performance_sessions%ROWTYPE;
BEGIN
  session_row := public._ensure_festival_performance_session(
    p_contract_id,
    p_idempotency_key
  );

  -- This reads only canonical band_members. Legacy festival participant tables
  -- are deliberately not accepted as lineup authority.
  PERFORM public.festival_snapshot_expected_performers(session_row.id);

  SELECT * INTO session_row
  FROM public.festival_performance_sessions
  WHERE id = session_row.id;

  RETURN session_row;
END;
$$;

-- A single permission-checked read contract for performers and organisers.
-- It exposes session linkage and authoritative participants, but excludes private
-- health/equipment/crew snapshots and contract economics.
CREATE OR REPLACE FUNCTION public.get_festival_performance_session(
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_row public.festival_performance_sessions%ROWTYPE;
  participants jsonb;
BEGIN
  SELECT * INTO session_row
  FROM public.festival_performance_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Festival performance session not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.is_active_band_member(session_row.band_id)
    OR public.can_manage_festival_brand(session_row.festival_id)
  ) THEN
    RAISE EXCEPTION 'Not authorised to view festival performance session'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'profile_id', attendance.profile_id,
        'band_member_id', attendance.band_member_id,
        'expected_role', attendance.expected_role,
        'required_attendance', attendance.required_attendance,
        'participation_status', attendance.participation_status
      ) ORDER BY attendance.expected_role, attendance.band_member_id
    ),
    '[]'::jsonb
  ) INTO participants
  FROM public.festival_performance_attendance attendance
  WHERE attendance.session_id = session_row.id;

  RETURN jsonb_build_object(
    'id', session_row.id,
    'status', session_row.status,
    'festival_id', session_row.festival_id,
    'edition_id', session_row.edition_id,
    'contract_id', session_row.contract_id,
    'band_id', session_row.band_id,
    'stage_id', session_row.stage_id,
    'stage_slot_id', session_row.stage_slot_id,
    'setlist_id', session_row.setlist_id,
    'scheduled_start_at', session_row.scheduled_start_at,
    'scheduled_end_at', session_row.scheduled_end_at,
    'actual_start_at', session_row.actual_start_at,
    'actual_end_at', session_row.actual_end_at,
    'participants', participants,
    'session_version', session_row.session_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public._ensure_festival_performance_session(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._ensure_festival_performance_session(uuid, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.ensure_festival_performance_session(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_festival_performance_session(uuid, text)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_festival_performance_session(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_festival_performance_session(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_festival_performance_session(uuid) IS
  'Permission-checked B1 session projection for the booked band and festival organiser.';

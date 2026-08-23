-- Finance A1 hardening: do not let SECURITY DEFINER recording authority
-- bypass the repertoire/ownership rules enforced by the recording UI.

BEGIN;

ALTER FUNCTION public.confirm_recording_session_atomic(
  uuid, uuid, text, uuid, integer, text, text, text, integer,
  timestamptz, timestamptz, text, text
) RENAME TO _confirm_recording_session_atomic_unchecked;

REVOKE ALL ON FUNCTION public._confirm_recording_session_atomic_unchecked(
  uuid, uuid, text, uuid, integer, text, text, text, integer,
  timestamptz, timestamptz, text, text
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.confirm_recording_session_atomic(
  p_band_id uuid,
  p_studio_id uuid,
  p_producer_id text,
  p_song_id uuid,
  p_duration_hours integer,
  p_orchestra_size text,
  p_recording_version text,
  p_recording_type text,
  p_rehearsal_bonus integer,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz,
  p_payment_source text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid;
  v_song public.songs;
  v_has_repertoire_access boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_profile_id := public._caller_profile_id();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required';
  END IF;

  SELECT s.*
    INTO v_song
    FROM public.songs s
   WHERE s.id = p_song_id;

  IF v_song.id IS NULL THEN
    RAISE EXCEPTION 'song_not_found';
  END IF;

  IF COALESCE(v_song.archived, false)
     OR COALESCE(v_song.status, '') NOT IN ('draft', 'completed', 'written', 'recorded') THEN
    RAISE EXCEPTION 'song_not_recordable';
  END IF;

  IF p_band_id IS NULL THEN
    v_has_repertoire_access :=
      v_song.profile_id = v_profile_id
      OR v_song.user_id = auth.uid();
  ELSE
    -- The underlying authority repeats this membership check before payment.
    -- Keep it here as well so repertoire existence never leaks to outsiders.
    IF NOT public._band_active_member(p_band_id, v_profile_id) THEN
      RAISE EXCEPTION 'not_band_member';
    END IF;

    v_has_repertoire_access :=
      v_song.band_id = p_band_id
      OR v_song.profile_id = v_profile_id
      OR v_song.user_id = auth.uid()
      OR EXISTS (
        SELECT 1
          FROM public.band_song_ownership bso
         WHERE bso.band_id = p_band_id
           AND bso.song_id = p_song_id
      );
  END IF;

  IF NOT v_has_repertoire_access THEN
    RAISE EXCEPTION 'song_not_recordable_by_caller';
  END IF;

  RETURN public._confirm_recording_session_atomic_unchecked(
    p_band_id,
    p_studio_id,
    p_producer_id,
    p_song_id,
    p_duration_hours,
    p_orchestra_size,
    p_recording_version,
    p_recording_type,
    p_rehearsal_bonus,
    p_scheduled_start,
    p_scheduled_end,
    p_payment_source,
    p_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_recording_session_atomic(
  uuid, uuid, text, uuid, integer, text, text, text, integer,
  timestamptz, timestamptz, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_recording_session_atomic(
  uuid, uuid, text, uuid, integer, text, text, text, integer,
  timestamptz, timestamptz, text, text
) TO authenticated;

COMMIT;

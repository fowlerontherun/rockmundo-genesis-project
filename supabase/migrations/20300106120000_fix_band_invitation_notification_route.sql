-- Align new and legacy invitation notifications with the mounted Band Members route.
-- Preserve the existing guarded send function; only its notification destination changes.
BEGIN;

CREATE OR REPLACE FUNCTION public.send_band_invitation(target_profile_id uuid, target_band_id uuid, requested_instrument_role text DEFAULT 'Electric Guitar'::text, requested_vocal_role text DEFAULT NULL::text, invite_message text DEFAULT NULL::text)
 RETURNS band_invitations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_inviter_profile_id uuid := public.current_profile_id();
  v_target_profile_id uuid := target_profile_id;
  v_target_band_id uuid := target_band_id;
  v_instrument text := NULLIF(btrim(COALESCE(requested_instrument_role, '')), '');
  v_vocal text := NULLIF(btrim(COALESCE(requested_vocal_role, '')), '');
  v_message text := NULLIF(btrim(COALESCE(invite_message, '')), '');
  v_band public.bands%ROWTYPE;
  v_target public.profiles%ROWTYPE;
  v_existing public.band_invitations%ROWTYPE;
  v_result public.band_invitations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_inviter_profile_id IS NULL THEN
    RAISE EXCEPTION 'Select an active player character before sending invitations.' USING ERRCODE = '42501';
  END IF;
  IF v_target_profile_id IS NULL OR v_target_band_id IS NULL
     OR v_instrument IS NULL OR char_length(v_instrument) > 50 THEN
    RAISE EXCEPTION 'Choose a valid band, player and performance role.' USING ERRCODE = '22023';
  END IF;
  IF v_vocal = 'None' THEN v_vocal := NULL; END IF;
  IF v_vocal IS NOT NULL AND char_length(v_vocal) > 50 THEN
    RAISE EXCEPTION 'Vocal roles must be 50 characters or fewer.' USING ERRCODE = '22023';
  END IF;
  IF v_message IS NOT NULL AND char_length(v_message) > 280 THEN
    RAISE EXCEPTION 'Band invitation messages must be 280 characters or fewer.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_band
  FROM public.bands b
  WHERE b.id = v_target_band_id
  FOR UPDATE;

  IF v_band.id IS NULL THEN
    RAISE EXCEPTION 'That band could not be found.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_manage_band_invitations(v_band.id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not allowed to invite players to this band.' USING ERRCODE = '42501';
  END IF;
  IF v_band.status <> 'active'::public.band_status THEN
    RAISE EXCEPTION 'This band is not currently active.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_band.is_solo_artist, false) THEN
    RAISE EXCEPTION 'Solo artists cannot invite regular band members.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_target
  FROM public.profiles p
  WHERE p.id = v_target_profile_id
  FOR UPDATE;

  IF v_target.id IS NULL
     OR NOT COALESCE(v_target.is_active, false)
     OR v_target.deleted_at IS NOT NULL
     OR v_target.died_at IS NOT NULL THEN
    RAISE EXCEPTION 'That player does not have an active character available.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_receive_band_invitation(v_inviter_profile_id, v_target.id) THEN
    RAISE EXCEPTION 'This player is not available for band invitations.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = v_band.id
      AND bm.profile_id = v_target.id
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND NOT COALESCE(bm.is_touring_member, false)
  ) THEN
    RAISE EXCEPTION 'That player already belongs to this band.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.band_members bm
    JOIN public.bands other_band ON other_band.id = bm.band_id
    WHERE bm.profile_id = v_target.id
      AND other_band.status = 'active'::public.band_status
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND NOT COALESCE(bm.is_touring_member, false)
  ) THEN
    RAISE EXCEPTION 'That player already belongs to another active band.' USING ERRCODE = '23505';
  END IF;

  IF (
    SELECT count(*) FROM public.band_members bm
    WHERE bm.band_id = v_band.id
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND NOT COALESCE(bm.is_touring_member, false)
  ) >= COALESCE(v_band.max_members, 4) THEN
    RAISE EXCEPTION 'This band has no open member slots.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_existing
  FROM public.band_invitations bi
  WHERE bi.band_id = v_band.id
    AND bi.invited_user_id = v_target.user_id
    AND bi.status = 'pending'
  ORDER BY bi.created_at DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.invited_profile_id IS NOT NULL
       AND v_existing.invited_profile_id <> v_target.id THEN
      RAISE EXCEPTION 'That account already has a pending invitation for another character.' USING ERRCODE = '23505';
    END IF;
    RETURN v_existing;
  END IF;

  INSERT INTO public.band_invitations (
    band_id, inviter_user_id, invited_user_id, invited_profile_id,
    instrument_role, vocal_role, message, status
  ) VALUES (
    v_band.id, auth.uid(), v_target.user_id, v_target.id,
    v_instrument, v_vocal, v_message, 'pending'
  )
  RETURNING * INTO v_result;

  INSERT INTO public.notifications (
    user_id, profile_id, category, type, title, message, action_path, metadata
  ) VALUES (
    v_target.user_id,
    v_target.id,
    'band',
    'band_request',
    'New band invitation',
    'You have been invited to join ' || v_band.name || '.',
    '/band/members',
    jsonb_build_object(
      'band_invitation_id', v_result.id,
      'band_id', v_band.id,
      'inviter_profile_id', v_inviter_profile_id,
      'invited_profile_id', v_target.id,
      'actionable', true
    )
  );

  RETURN v_result;
END;
$function$

UPDATE public.notifications
SET action_path = '/band/members'
WHERE action_path = '/band-manager'
  AND metadata ? 'band_invitation_id';

COMMIT;

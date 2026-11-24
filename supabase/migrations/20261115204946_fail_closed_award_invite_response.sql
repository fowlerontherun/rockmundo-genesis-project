-- Ensure a band-only invitation cannot be read or answered by a non-recipient
-- through the SECURITY DEFINER response RPC.
CREATE OR REPLACE FUNCTION public.award_show_respond_invite(
  p_invite_id uuid, p_response text
)
RETURNS public.award_show_invites
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_invite public.award_show_invites%ROWTYPE;
  v_show_status text;
  v_slot text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to respond to invitations' USING ERRCODE='42501';
  END IF;
  IF p_response IS NULL OR p_response NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'Invalid invitation response' USING ERRCODE='22023';
  END IF;

  -- Only lock a row the caller can respond to. A NULL account target
  -- cannot authorise anyone, and missing and inaccessible IDs look alike.
  SELECT i.* INTO v_invite
  FROM public.award_show_invites i
  WHERE i.id=p_invite_id
    AND (
      i.invitee_user_id=auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id=i.invitee_user_id AND p.user_id=auth.uid()
      )
      OR (
        i.invitee_band_id IS NOT NULL
        AND public.caller_can_act_for_band(i.invitee_band_id)
      )
    )
  FOR UPDATE OF i;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation is unavailable to this account' USING ERRCODE='42501';
  END IF;

  v_slot := coalesce(nullif(btrim(v_invite.slot_label),''), 'Invited Performance');
  IF v_invite.response_status = p_response THEN
    IF p_response='accepted' AND v_invite.invite_type='performer'
       AND v_invite.invitee_band_id IS NOT NULL
       AND NOT EXISTS (
          SELECT 1 FROM public.award_performance_bookings b
          WHERE b.award_show_id=v_invite.award_show_id
            AND b.band_id=v_invite.invitee_band_id
            AND b.slot_label=v_slot
            AND b.status <> 'cancelled'
       ) THEN
      RAISE EXCEPTION 'Accepted performer invitation has no active booking; contact support'
        USING ERRCODE='23514';
    END IF;
    RETURN v_invite; -- Exact retry is a no-op; never book or charge twice.
  END IF;
  IF v_invite.response_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Invitation has already been answered'
      USING ERRCODE='23514';
  END IF;

  SELECT status INTO v_show_status FROM public.award_shows
    WHERE id=v_invite.award_show_id FOR SHARE;
  IF NOT FOUND OR v_show_status='completed' THEN
    RAISE EXCEPTION 'Award show is closed to invitation responses'
      USING ERRCODE='23514';
  END IF;

  IF p_response='accepted' AND v_invite.invite_type='performer'
     AND v_invite.invitee_band_id IS NOT NULL THEN
    IF v_show_status NOT IN ('upcoming','nominations_open','voting_open') THEN
      RAISE EXCEPTION 'Performance booking has closed for this award show'
        USING ERRCODE='23514';
    END IF;

    -- UNIQUE(show, slot_label) rejects competing bands. The booking and
    -- response update are within one transaction, so conflicts roll back.
    INSERT INTO public.award_performance_bookings (
      award_show_id, band_id, user_id, slot_label, stage, song_ids, status
    ) VALUES (
      v_invite.award_show_id, v_invite.invitee_band_id, auth.uid(),
      v_slot, coalesce(nullif(btrim(v_invite.stage),''),'Main Stage'),
      ARRAY[]::uuid[], 'confirmed'
    );
  END IF;

  UPDATE public.award_show_invites
    SET response_status=p_response,responded_at=now(),updated_at=now()
  WHERE id=p_invite_id RETURNING * INTO v_invite;
  RETURN v_invite;
END;
$$;

REVOKE ALL ON FUNCTION public.award_show_respond_invite(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_show_respond_invite(uuid,text)
  TO authenticated, service_role;

-- Forward-only awards invitation settlement and function-grant correction.
-- Existing invitations/bookings are not reprocessed or modified by this migration.

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

  -- Serialize retries and competing responses for the same invitation.
  SELECT * INTO v_invite FROM public.award_show_invites
   WHERE id=p_invite_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE='P0002';
  END IF;
  IF NOT (
    v_invite.invitee_user_id = auth.uid()
    OR EXISTS(
      SELECT 1 FROM public.profiles p
      WHERE p.id=v_invite.invitee_user_id AND p.user_id=auth.uid()
    )
    OR (
      v_invite.invitee_band_id IS NOT NULL
      AND public.caller_can_act_for_band(v_invite.invitee_band_id)
    )
  ) THEN
    RAISE EXCEPTION 'You cannot respond to this invitation'
      USING ERRCODE='42501';
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

-- An admin may revise a pending offer, but an accepted/declined invitation
-- cannot be silently reopened through the invitation upsert.
CREATE OR REPLACE FUNCTION public.award_show_invite_band(
  p_award_show_id uuid,
  p_band_id uuid,
  p_invite_type text DEFAULT 'performer',
  p_slot_label text DEFAULT NULL,
  p_stage text DEFAULT NULL,
  p_performance_fee integer DEFAULT 0,
  p_category_name text DEFAULT NULL,
  p_message text DEFAULT NULL
)
RETURNS public.award_show_invites
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_invite public.award_show_invites%ROWTYPE;
  v_show_status text;
BEGIN
  IF auth.uid() IS NULL
     OR NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN
    RAISE EXCEPTION 'Only award administrators can send invitations'
      USING ERRCODE='42501';
  END IF;
  IF p_invite_type IS NULL OR p_invite_type NOT IN ('performer','presenter','attendee','nominee')
     OR p_band_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation type or band' USING ERRCODE='22023';
  END IF;
  SELECT status INTO v_show_status FROM public.award_shows
    WHERE id=p_award_show_id FOR SHARE;
  IF NOT FOUND OR v_show_status='completed'
     OR (p_invite_type='performer' AND v_show_status NOT IN ('upcoming','nominations_open','voting_open')) THEN
    RAISE EXCEPTION 'Award show is not accepting this invitation'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO public.award_show_invites (
    award_show_id, invitee_band_id, invite_type, slot_label, stage,
    performance_fee, category_name, message, invited_by
  ) VALUES (
    p_award_show_id, p_band_id, p_invite_type, p_slot_label, p_stage,
    greatest(0, coalesce(p_performance_fee,0)), p_category_name,p_message,auth.uid()
  )
  ON CONFLICT (award_show_id, invitee_band_id, invite_type, coalesce(slot_label,''))
    WHERE invitee_band_id IS NOT NULL
  DO UPDATE SET
    stage=EXCLUDED.stage,
    performance_fee=EXCLUDED.performance_fee,
    category_name=EXCLUDED.category_name,
    message=EXCLUDED.message,
    updated_at=now()
  WHERE public.award_show_invites.response_status='pending'
  RETURNING * INTO v_invite;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Already answered; create an explicit new invitation process'
      USING ERRCODE='23514';
  END IF;
  RETURN v_invite;
END;
$$;

-- Supabase installations can give direct grants even after a PUBLIC revoke.
-- Keep executable functions available to intended authenticated callers only.
REVOKE ALL ON FUNCTION public.award_show_respond_invite(uuid,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.award_show_invite_band(uuid,uuid,text,text,text,integer,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.award_show_respond_invite(uuid,text)
  TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.award_show_invite_band(uuid,uuid,text,text,text,integer,text,text)
  TO authenticated,service_role;

-- These are trigger helpers, not client RPCs. Trigger execution is unaffected.
REVOKE ALL ON FUNCTION public.guard_award_nomination_submission()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.award_votes_sync_count()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.update_nomination_vote_count()
  FROM PUBLIC,anon,authenticated;

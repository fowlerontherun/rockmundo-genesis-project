CREATE OR REPLACE FUNCTION public.withdraw_festival_artist_invitation(
  p_invitation_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  invitation public.festival_artist_invitations%ROWTYPE;
  company_id uuid;
  organiser boolean;
  request public.festival_artist_plan_requests%ROWTYPE;
  previous_status text;
BEGIN
  IF actor IS NULL OR p_idempotency_key IS NULL OR p_expected_version IS NULL THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden';
  END IF;
  SELECT * INTO invitation FROM public.festival_artist_invitations
    WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_INVITATION_NOT_FOUND'; END IF;
  company_id := public._festival_artist_programme_company(invitation.festival_artist_programme_id);
  organiser := public._festival_company_manager_authorized(company_id, actor);
  IF NOT (coalesce(organiser, false) OR
    (invitation.artist_type = 'band' AND invitation.band_id IS NOT NULL
      AND public.caller_can_act_for_band(invitation.band_id))) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden';
  END IF;
  request := public._festival_artist_begin(company_id, 'withdraw_invitation', 'invitation', invitation.id,
    p_idempotency_key, jsonb_build_object('version', p_expected_version));
  IF request.status = 'succeeded' THEN RETURN request.result; END IF;
  IF invitation.version <> p_expected_version THEN RAISE EXCEPTION 'festival_artist_offer_stale'; END IF;
  IF invitation.status NOT IN ('draft', 'sent', 'viewed', 'interested')
    OR (NOT coalesce(organiser, false) AND invitation.status = 'draft') THEN
    RAISE EXCEPTION 'festival_artist_invitation_invalid_transition';
  END IF;
  IF EXISTS (SELECT 1 FROM public.festival_artist_offers WHERE invitation_id = invitation.id
    AND status IN ('draft', 'sent', 'countered', 'accepted')) THEN
    RAISE EXCEPTION 'festival_artist_invitation_invalid_transition';
  END IF;
  previous_status := invitation.status;
  UPDATE public.festival_artist_invitations SET status = 'cancelled', responded_at = now(), version = version + 1
    WHERE id = invitation.id RETURNING * INTO invitation;
  PERFORM public._festival_artist_audit(company_id, actor, 'invitation', invitation.id,
    CASE WHEN organiser THEN 'invitation_withdrawn' ELSE 'artist_interest_withdrawn' END,
    previous_status, 'cancelled', invitation.version);
  RETURN public._festival_artist_finish(request.id, jsonb_build_object('kind', 'invitation', 'invitation', to_jsonb(invitation)));
END;
$$;
REVOKE ALL ON FUNCTION public.withdraw_festival_artist_invitation(uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_festival_artist_invitation(uuid, integer, uuid) TO authenticated;

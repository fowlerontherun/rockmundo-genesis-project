-- Let Festival organisers withdraw pending invitations/offers from the exact annual
-- edition workflow. Response deadlines already live on invitations/offers; the UI
-- now exposes those deadlines and these transitions free an act for a replacement.

CREATE OR REPLACE FUNCTION public.withdraw_festival_edition_artist_invitation(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_invitation_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  programme public.festival_artist_programmes%ROWTYPE;
  invitation public.festival_artist_invitations%ROWTYPE;
  request public.festival_artist_plan_requests%ROWTYPE;
  previous_status text;
BEGIN
  IF actor IS NULL
    OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor)
  THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO programme
  FROM public.festival_artist_programmes
  WHERE festival_company_id = p_festival_company_id
    AND festival_edition_id = p_festival_edition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_artist_programme_incomplete' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO invitation
  FROM public.festival_artist_invitations
  WHERE id = p_invitation_id
    AND festival_artist_programme_id = programme.id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_artist_invitation_invalid' USING ERRCODE = 'P0001';
  END IF;

  request := public._festival_artist_begin(
    p_festival_company_id,
    'withdraw_edition_invitation',
    'invitation',
    invitation.id,
    p_idempotency_key,
    jsonb_build_object(
      'edition', p_festival_edition_id,
      'version', p_expected_version
    )
  );
  IF request.status = 'succeeded' THEN
    RETURN request.result;
  END IF;

  IF invitation.version <> p_expected_version THEN
    RAISE EXCEPTION 'festival_artist_invitation_stale' USING ERRCODE = 'P0001';
  END IF;
  IF invitation.status NOT IN ('draft', 'sent', 'viewed', 'interested') THEN
    RAISE EXCEPTION 'festival_artist_invitation_invalid_transition' USING ERRCODE = 'P0001';
  END IF;

  previous_status := invitation.status;
  UPDATE public.festival_artist_invitations
  SET status = 'cancelled',
      responded_at = coalesce(responded_at, now()),
      version = version + 1
  WHERE id = invitation.id
  RETURNING * INTO invitation;

  PERFORM public._festival_artist_audit(
    p_festival_company_id,
    actor,
    'invitation',
    invitation.id,
    'invitation_withdrawn',
    previous_status,
    'cancelled',
    invitation.version
  );

  RETURN public._festival_artist_finish(
    request.id,
    jsonb_build_object(
      'kind', 'invitation',
      'invitation', to_jsonb(invitation)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_festival_edition_artist_offer(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_offer_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  programme public.festival_artist_programmes%ROWTYPE;
  offer public.festival_artist_offers%ROWTYPE;
  request public.festival_artist_plan_requests%ROWTYPE;
  previous_status text;
BEGIN
  IF actor IS NULL
    OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor)
  THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO programme
  FROM public.festival_artist_programmes
  WHERE festival_company_id = p_festival_company_id
    AND festival_edition_id = p_festival_edition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_artist_programme_incomplete' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO offer
  FROM public.festival_artist_offers
  WHERE id = p_offer_id
    AND festival_artist_programme_id = programme.id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_artist_offer_invalid' USING ERRCODE = 'P0001';
  END IF;

  request := public._festival_artist_begin(
    p_festival_company_id,
    'withdraw_edition_offer',
    'offer',
    offer.id,
    p_idempotency_key,
    jsonb_build_object(
      'edition', p_festival_edition_id,
      'version', p_expected_version
    )
  );
  IF request.status = 'succeeded' THEN
    RETURN request.result;
  END IF;

  IF offer.offer_version <> p_expected_version THEN
    RAISE EXCEPTION 'festival_artist_offer_stale' USING ERRCODE = 'P0001';
  END IF;
  IF offer.status NOT IN ('draft', 'sent', 'countered') THEN
    RAISE EXCEPTION 'festival_artist_offer_invalid_transition' USING ERRCODE = 'P0001';
  END IF;

  previous_status := offer.status;
  UPDATE public.festival_artist_offers
  SET status = 'withdrawn',
      cancelled_at = now(),
      updated_at = now()
  WHERE id = offer.id
  RETURNING * INTO offer;

  PERFORM public._festival_artist_audit(
    p_festival_company_id,
    actor,
    'offer',
    offer.id,
    'offer_withdrawn',
    previous_status,
    'withdrawn',
    offer.offer_version
  );

  RETURN public._festival_artist_finish(
    request.id,
    jsonb_build_object(
      'kind', 'offer',
      'offer', to_jsonb(offer)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_festival_edition_artist_invitation(
  uuid, uuid, uuid, integer, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_festival_edition_artist_offer(
  uuid, uuid, uuid, integer, uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.withdraw_festival_edition_artist_invitation(
  uuid, uuid, uuid, integer, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_festival_edition_artist_offer(
  uuid, uuid, uuid, integer, uuid
) TO authenticated;

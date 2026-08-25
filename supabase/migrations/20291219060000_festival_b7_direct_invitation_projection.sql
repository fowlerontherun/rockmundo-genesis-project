-- Backlog B7 phase 1: expose direct festival invitations through a narrow,
-- permission-checked player projection and an edition-scoped response boundary.
-- This reuses the existing festival_artist_invitations authority rather than
-- creating a parallel booking/invitation model.

CREATE OR REPLACE FUNCTION public.list_my_festival_artist_invitations(
  p_band_id uuid DEFAULT NULL
)
RETURNS TABLE (
  invitation_id uuid,
  festival_company_id uuid,
  festival_edition_id uuid,
  artist_type text,
  artist_profile_id uuid,
  band_id uuid,
  status text,
  version integer,
  message text,
  suggested_fee_minor bigint,
  suggested_set_minutes integer,
  suggested_dates date[],
  suggested_stage_types text[],
  expires_at timestamptz,
  created_at timestamptz,
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
  IF actor IS NULL THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    invitation.id,
    programme.festival_company_id,
    programme.festival_edition_id,
    invitation.artist_type,
    invitation.artist_profile_id,
    invitation.band_id,
    CASE
      WHEN invitation.status IN ('sent', 'viewed', 'interested')
        AND invitation.expires_at IS NOT NULL
        AND invitation.expires_at <= now()
      THEN 'expired'
      ELSE invitation.status
    END,
    invitation.version,
    invitation.message,
    invitation.suggested_fee_minor,
    invitation.suggested_set_minutes,
    coalesce(invitation.suggested_dates, '{}'::date[]),
    coalesce(invitation.suggested_stage_types, '{}'::text[]),
    invitation.expires_at,
    invitation.created_at,
    public._festival_artist_authorised(
      actor,
      invitation.artist_type,
      invitation.artist_profile_id,
      invitation.band_id
    )
  FROM public.festival_artist_invitations invitation
  JOIN public.festival_artist_programmes programme
    ON programme.id = invitation.festival_artist_programme_id
  WHERE programme.festival_edition_id IS NOT NULL
    AND (
      (
        p_band_id IS NULL
        AND invitation.artist_type = 'solo'
        AND invitation.artist_profile_id = actor
      )
      OR (
        invitation.artist_type = 'band'
        AND (p_band_id IS NULL OR invitation.band_id = p_band_id)
        AND EXISTS (
          SELECT 1
          FROM public.band_members member
          WHERE member.band_id = invitation.band_id
            AND member.profile_id = actor
            AND coalesce(member.member_status, 'active') = 'active'
        )
      )
    )
  ORDER BY invitation.created_at DESC, invitation.id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_festival_artist_invitations(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_festival_artist_invitations(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.list_my_festival_artist_invitations(uuid) IS
  'B7 player projection for direct festival invitations. Returns only invitations addressed to the caller or their active bands and projects response authority server-side.';

CREATE OR REPLACE FUNCTION public.respond_to_festival_edition_artist_invitation(
  p_invitation_id uuid,
  p_expected_version integer,
  p_response text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invitation public.festival_artist_invitations%ROWTYPE;
  programme public.festival_artist_programmes%ROWTYPE;
BEGIN
  SELECT * INTO invitation
  FROM public.festival_artist_invitations
  WHERE id = p_invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_artist_invitation_invalid' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO programme
  FROM public.festival_artist_programmes
  WHERE id = invitation.festival_artist_programme_id;

  IF NOT FOUND OR programme.festival_edition_id IS NULL THEN
    RAISE EXCEPTION 'festival_artist_invitation_invalid' USING ERRCODE = 'P0001';
  END IF;

  RETURN public.respond_to_festival_artist_invitation(
    p_invitation_id,
    p_expected_version,
    p_response,
    p_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_festival_edition_artist_invitation(uuid, integer, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_festival_edition_artist_invitation(uuid, integer, text, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.respond_to_festival_edition_artist_invitation(uuid, integer, text, uuid) IS
  'B7 edition-scoped response boundary for direct artist invitations. Delegates to the existing idempotent invitation authority after verifying edition ownership.';

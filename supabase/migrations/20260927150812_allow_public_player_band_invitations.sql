-- Allow band leaders to invite any publicly discoverable active player, not just friends.
-- Preserve blocked-account, same-account and explicit invite privacy safeguards.
-- The authenticated send_band_invitation RPC still validates officer authority,
-- available places, existing membership and duplicate invitations.
BEGIN;

CREATE OR REPLACE FUNCTION public.can_receive_band_invitation(
  inviter_profile_id uuid,
  target_profile_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inviter_user_id uuid;
  v_target_user_id uuid;
  v_allows_invites boolean := true;
  v_is_friend boolean;
  v_visibility text := 'public';
BEGIN
  SELECT p.user_id INTO v_inviter_user_id
  FROM public.profiles p
  WHERE p.id = inviter_profile_id
    AND COALESCE(p.is_active, false)
    AND p.deleted_at IS NULL
    AND p.died_at IS NULL;

  SELECT p.user_id INTO v_target_user_id
  FROM public.profiles p
  WHERE p.id = target_profile_id
    AND COALESCE(p.is_active, false)
    AND p.deleted_at IS NULL
    AND p.died_at IS NULL;

  IF v_inviter_user_id IS NULL
     OR v_target_user_id IS NULL
     OR v_inviter_user_id = v_target_user_id
     OR inviter_profile_id = target_profile_id THEN
    RETURN false;
  END IF;

  IF public.are_profiles_blocked(inviter_profile_id, target_profile_id) THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status::text = 'accepted'
      AND (
        (f.requestor_id = inviter_profile_id AND f.addressee_id = target_profile_id)
        OR (f.requestor_id = target_profile_id AND f.addressee_id = inviter_profile_id)
      )
  ) INTO v_is_friend;

  -- Some installations have the optional privacy table and some do not.
  IF to_regclass('public.profile_privacy_settings') IS NOT NULL THEN
    EXECUTE
      'SELECT COALESCE((SELECT allow_band_invites FROM public.profile_privacy_settings WHERE profile_id = $1), true),
              COALESCE((SELECT profile_visibility::text FROM public.profile_privacy_settings WHERE profile_id = $1), ''public'')'
      INTO v_allows_invites, v_visibility
      USING target_profile_id;
  END IF;

  -- Non-friends may invite only publicly visible players who allow band invites.
  -- Existing accepted friends retain invitation access regardless of visibility.
  RETURN COALESCE(v_allows_invites, true)
    AND (v_is_friend OR v_visibility = 'public');
END;
$$;

REVOKE ALL ON FUNCTION public.can_receive_band_invitation(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_receive_band_invitation(uuid, uuid) FROM anon, authenticated;

COMMIT;

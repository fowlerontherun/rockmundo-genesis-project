-- Top of the Pops: secure studio call-sheet/readiness view for invited bands.
-- Read-only: this does not change invitation status, travel state, eligibility, rewards or running order.

CREATE OR REPLACE FUNCTION public.totp_studio_readiness(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.totp_invitations%ROWTYPE;
  v_episode public.totp_episodes%ROWTYPE;
  v_is_member boolean := false;
  v_members jsonb := '[]'::jsonb;
  v_required_count integer := 0;
  v_present_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_inv
  FROM public.totp_invitations
  WHERE id = p_invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top of the Pops invitation not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.band_members bm
    WHERE bm.band_id = v_inv.band_id
      AND bm.user_id = auth.uid()
      AND coalesce(bm.member_status, 'active') = 'active'
  ) INTO v_is_member;

  IF NOT v_is_member AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only band members can view this studio call sheet';
  END IF;

  SELECT * INTO v_episode
  FROM public.totp_episodes
  WHERE id = v_inv.episode_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top of the Pops episode not found';
  END IF;

  WITH required_members AS (
    SELECT
      p.id AS profile_id,
      coalesce(p.display_name, p.username, 'Band member') AS display_name,
      p.current_city_id = v_episode.city_id AS is_in_london,
      coalesce(p.is_traveling, false) AS is_traveling
    FROM public.band_members bm
    JOIN public.profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = v_inv.band_id
      AND bm.profile_id IS NOT NULL
      AND bm.user_id IS NOT NULL
      AND coalesce(bm.member_status, 'active') = 'active'
      AND coalesce(bm.is_touring_member, false) = false
  ), summary AS (
    SELECT
      count(*)::integer AS required_count,
      count(*) FILTER (WHERE is_in_london AND NOT is_traveling)::integer AS present_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'profile_id', profile_id,
            'display_name', display_name,
            'is_in_london', is_in_london,
            'is_traveling', is_traveling,
            'ready', is_in_london AND NOT is_traveling
          )
          ORDER BY display_name
        ),
        '[]'::jsonb
      ) AS members
    FROM required_members
  )
  SELECT required_count, present_count, members
  INTO v_required_count, v_present_count, v_members
  FROM summary;

  RETURN jsonb_build_object(
    'invitation_id', v_inv.id,
    'status', v_inv.status,
    'response_deadline', v_inv.response_deadline,
    'check_in_at', v_episode.check_in_at,
    'check_in_opens_at', v_episode.check_in_at - interval '2 hours',
    'check_in_closes_at', v_episode.check_in_at + interval '45 minutes',
    'broadcast_at', v_episode.broadcast_at,
    'members_required', v_required_count,
    'members_present', v_present_count,
    'all_ready', v_required_count > 0 AND v_present_count = v_required_count,
    'members', v_members
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_studio_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.totp_studio_readiness(uuid) TO authenticated;

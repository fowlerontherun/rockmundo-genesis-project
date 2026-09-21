-- Top of the Pops: fix accept/decline notifications for the current notifications contract.
-- The notifications table requires category/title and the player feed is profile-scoped.

CREATE OR REPLACE FUNCTION public.totp_respond_to_invitation(
  p_invitation_id uuid,
  p_response text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.totp_invitations%ROWTYPE;
  v_episode public.totp_episodes%ROWTYPE;
  v_leader_profile uuid;
  v_band_name text;
  v_song_title text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Response must be accepted or declined';
  END IF;

  SELECT * INTO v_inv
  FROM public.totp_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top of the Pops invitation not found';
  END IF;

  SELECT p.id
  INTO v_leader_profile
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND p.id = (SELECT leader_id FROM public.bands WHERE id = v_inv.band_id)
  LIMIT 1;

  IF v_leader_profile IS NULL THEN
    RAISE EXCEPTION 'Only the band leader can respond to this invitation';
  END IF;

  IF v_inv.status <> 'invited' THEN
    RAISE EXCEPTION 'This invitation has already been responded to';
  END IF;

  IF now() > v_inv.response_deadline THEN
    UPDATE public.totp_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = p_invitation_id;
    RETURN 'expired';
  END IF;

  UPDATE public.totp_invitations
  SET status = p_response,
      responded_at = now(),
      updated_at = now()
  WHERE id = p_invitation_id;

  SELECT * INTO v_episode
  FROM public.totp_episodes
  WHERE id = v_inv.episode_id;

  SELECT b.name::text, s.title::text
  INTO v_band_name, v_song_title
  FROM public.bands b
  JOIN public.songs s ON s.id = v_inv.song_id
  WHERE b.id = v_inv.band_id;

  WITH recipients AS (
    SELECT DISTINCT
      coalesce(bm.user_id, p.user_id) AS user_id,
      coalesce(bm.profile_id, p.id) AS profile_id
    FROM public.band_members bm
    LEFT JOIN public.profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = v_inv.band_id
      AND coalesce(bm.member_status, 'active') = 'active'
      AND coalesce(bm.is_touring_member, false) = false
  )
  INSERT INTO public.notifications(
    user_id,
    profile_id,
    category,
    type,
    title,
    message,
    action_path,
    metadata
  )
  SELECT
    r.user_id,
    r.profile_id,
    'career',
    CASE WHEN p_response = 'accepted' THEN 'success' ELSE 'info' END,
    CASE
      WHEN p_response = 'accepted' THEN format('Top of the Pops #%s — booking confirmed', v_episode.episode_number)
      ELSE format('Top of the Pops #%s — invitation declined', v_episode.episode_number)
    END,
    CASE
      WHEN p_response = 'accepted' THEN format(
        '%s accepted Top of the Pops. %s is booked for the broadcast on %s. Studio call is %s; every active band member must be in the studio city and not travelling for check-in.',
        v_band_name,
        v_song_title,
        to_char(v_episode.broadcast_at AT TIME ZONE 'Europe/London', 'Dy DD Mon YYYY, HH24:MI'),
        to_char(v_episode.check_in_at AT TIME ZONE 'Europe/London', 'Dy DD Mon YYYY, HH24:MI')
      )
      ELSE format('%s declined its Top of the Pops invitation for %s.', v_band_name, v_song_title)
    END,
    '/top-of-the-pops#invitations',
    jsonb_build_object(
      'episode_id', v_inv.episode_id,
      'episode_number', v_episode.episode_number,
      'invitation_id', v_inv.id,
      'band_id', v_inv.band_id,
      'song_id', v_inv.song_id,
      'response', p_response,
      'broadcast_at', v_episode.broadcast_at,
      'check_in_at', v_episode.check_in_at
    )
  FROM recipients r
  WHERE r.user_id IS NOT NULL
    AND r.profile_id IS NOT NULL;

  RETURN p_response;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_respond_to_invitation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.totp_respond_to_invitation(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

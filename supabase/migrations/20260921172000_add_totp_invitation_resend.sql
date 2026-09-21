-- Top of the Pops: resend existing pending invitations and backfill corrected notifications.
-- This is intentionally a new migration because the base player-invitation fix may already be deployed.

-- Central delivery helper used by both the insert trigger and the admin resend action.
CREATE OR REPLACE FUNCTION public.totp_deliver_invitation_notification(
  p_invitation_id uuid,
  p_force boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.totp_invitations%ROWTYPE;
  v_episode public.totp_episodes%ROWTYPE;
  v_band_name text;
  v_song_title text;
  v_city_name text;
  v_leader_profile uuid;
  v_message text;
  v_inserted integer := 0;
BEGIN
  SELECT * INTO v_inv
  FROM public.totp_invitations
  WHERE id = p_invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top of the Pops invitation not found';
  END IF;

  SELECT * INTO v_episode
  FROM public.totp_episodes
  WHERE id = v_inv.episode_id;

  SELECT b.name::text, b.leader_id
  INTO v_band_name, v_leader_profile
  FROM public.bands b
  WHERE b.id = v_inv.band_id;

  SELECT s.title::text
  INTO v_song_title
  FROM public.songs s
  WHERE s.id = v_inv.song_id;

  SELECT c.name::text
  INTO v_city_name
  FROM public.cities c
  WHERE c.id = v_episode.city_id;

  v_message := format(
    '%s has been invited to Top of the Pops to perform %s (UK chart #%s). Broadcast: %s. Studio call: %s in %s. Reply by: %s. All active band members must be in the studio city for check-in; only the band leader can accept or decline.',
    coalesce(v_band_name, 'Your band'),
    coalesce(v_song_title, 'the qualifying song'),
    v_inv.qualifying_rank,
    to_char(v_episode.broadcast_at AT TIME ZONE 'Europe/London', 'Dy DD Mon YYYY, HH24:MI'),
    to_char(v_episode.check_in_at AT TIME ZONE 'Europe/London', 'Dy DD Mon YYYY, HH24:MI'),
    coalesce(v_city_name, 'London'),
    to_char(v_inv.response_deadline AT TIME ZONE 'Europe/London', 'Dy DD Mon YYYY, HH24:MI')
  );

  WITH recipients AS (
    SELECT DISTINCT
      coalesce(bm.user_id, p.user_id) AS user_id,
      coalesce(bm.profile_id, p.id) AS profile_id
    FROM public.band_members bm
    LEFT JOIN public.profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = v_inv.band_id
      AND coalesce(bm.member_status, 'active') = 'active'
      AND coalesce(bm.is_touring_member, false) = false

    UNION

    SELECT p.user_id, p.id
    FROM public.profiles p
    WHERE p.id = v_leader_profile
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
    'info',
    CASE
      WHEN r.profile_id = v_leader_profile THEN 'Top of the Pops invitation — response needed'
      ELSE 'Your band has a Top of the Pops invitation'
    END,
    v_message,
    '/top-of-the-pops#invitations',
    jsonb_build_object(
      'episode_id', v_inv.episode_id,
      'invitation_id', v_inv.id,
      'band_id', v_inv.band_id,
      'song_id', v_inv.song_id,
      'qualifying_rank', v_inv.qualifying_rank,
      'episode_date', v_episode.episode_date,
      'broadcast_at', v_episode.broadcast_at,
      'check_in_at', v_episode.check_in_at,
      'response_deadline', v_inv.response_deadline,
      'city_id', v_episode.city_id,
      'city_name', v_city_name,
      'leader_action_required', r.profile_id = v_leader_profile,
      'resent', p_force
    )
  FROM recipients r
  WHERE r.user_id IS NOT NULL
    AND r.profile_id IS NOT NULL
    AND (
      p_force
      OR NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.profile_id = r.profile_id
          AND n.metadata->>'invitation_id' = v_inv.id::text
          AND n.action_path = '/top-of-the-pops#invitations'
      )
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_deliver_invitation_notification(uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.totp_notify_new_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.totp_deliver_invitation_notification(NEW.id, false);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_notify_new_invitation() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.totp_admin_resend_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.totp_invitations%ROWTYPE;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_inv
  FROM public.totp_invitations
  WHERE id = p_invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top of the Pops invitation not found';
  END IF;

  IF v_inv.status <> 'invited' THEN
    RAISE EXCEPTION 'Only pending Top of the Pops invitations can be resent';
  END IF;

  IF now() > v_inv.response_deadline THEN
    RAISE EXCEPTION 'This invitation has expired and can no longer be resent';
  END IF;

  v_count := public.totp_deliver_invitation_notification(p_invitation_id, true);

  RETURN jsonb_build_object(
    'status', 'resent',
    'invitation_id', p_invitation_id,
    'recipients', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_resend_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.totp_admin_resend_invitation(uuid) TO authenticated;

COMMENT ON FUNCTION public.totp_admin_resend_invitation(uuid) IS
  'Admin-only resend of an existing pending TOTP invitation. Does not create a duplicate booking.';

-- Backfill any currently outstanding invitations that were created before profile-scoped
-- TOTP notifications existed. The helper deduplicates invitations already delivered correctly.
DO $$
DECLARE
  v_invitation_id uuid;
BEGIN
  FOR v_invitation_id IN
    SELECT i.id
    FROM public.totp_invitations i
    WHERE i.status = 'invited'
      AND i.response_deadline >= now()
  LOOP
    PERFORM public.totp_deliver_invitation_notification(v_invitation_id, false);
  END LOOP;
END;
$$;

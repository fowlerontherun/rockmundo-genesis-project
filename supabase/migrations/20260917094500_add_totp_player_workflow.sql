-- Top of the Pops phase 2: player workflow, attendance enforcement and admin running order.

CREATE OR REPLACE FUNCTION public.totp_my_invitations()
RETURNS TABLE (
  invitation_id uuid,
  episode_id uuid,
  episode_date date,
  check_in_at timestamptz,
  broadcast_at timestamptz,
  band_id uuid,
  band_name text,
  song_id uuid,
  song_title text,
  qualifying_rank integer,
  status text,
  response_deadline timestamptz,
  london_city_id uuid,
  london_city_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    e.id,
    e.episode_date,
    e.check_in_at,
    e.broadcast_at,
    b.id,
    b.name::text,
    s.id,
    s.title,
    i.qualifying_rank,
    i.status,
    i.response_deadline,
    c.id,
    c.name::text
  FROM public.totp_invitations i
  JOIN public.totp_episodes e ON e.id = i.episode_id
  JOIN public.bands b ON b.id = i.band_id
  JOIN public.songs s ON s.id = i.song_id
  JOIN public.cities c ON c.id = e.city_id
  WHERE EXISTS (
    SELECT 1
    FROM public.band_members bm
    WHERE bm.band_id = i.band_id
      AND bm.user_id = auth.uid()
      AND coalesce(bm.member_status, 'active') = 'active'
      AND coalesce(bm.is_touring_member, false) = false
  )
  ORDER BY e.episode_date DESC, i.qualifying_rank ASC;
$$;

REVOKE ALL ON FUNCTION public.totp_my_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.totp_my_invitations() TO authenticated;

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

  SELECT p.id INTO v_leader_profile
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
    RAISE EXCEPTION 'This invitation has expired';
  END IF;

  UPDATE public.totp_invitations
  SET status = p_response,
      responded_at = now(),
      updated_at = now()
  WHERE id = p_invitation_id;

  SELECT b.name::text, s.title
  INTO v_band_name, v_song_title
  FROM public.bands b
  JOIN public.songs s ON s.id = v_inv.song_id
  WHERE b.id = v_inv.band_id;

  INSERT INTO public.notifications (user_id, type, message)
  SELECT DISTINCT bm.user_id,
         'system',
         CASE
           WHEN p_response = 'accepted' THEN
             format('%s accepted Top of the Pops: %s will be performed in London. All active band members must attend studio check-in.', v_band_name, v_song_title)
           ELSE
             format('%s declined its Top of the Pops invitation for %s.', v_band_name, v_song_title)
         END
  FROM public.band_members bm
  WHERE bm.band_id = v_inv.band_id
    AND bm.user_id IS NOT NULL
    AND coalesce(bm.member_status, 'active') = 'active'
    AND coalesce(bm.is_touring_member, false) = false;

  RETURN p_response;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_respond_to_invitation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.totp_respond_to_invitation(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_check_in(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.totp_invitations%ROWTYPE;
  v_episode public.totp_episodes%ROWTYPE;
  v_leader_profile uuid;
  v_required_count integer := 0;
  v_present_count integer := 0;
  v_missing_names text[] := '{}';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_inv
  FROM public.totp_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top of the Pops invitation not found';
  END IF;

  SELECT * INTO v_episode
  FROM public.totp_episodes
  WHERE id = v_inv.episode_id;

  SELECT p.id INTO v_leader_profile
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND p.id = (SELECT leader_id FROM public.bands WHERE id = v_inv.band_id)
  LIMIT 1;

  IF v_leader_profile IS NULL THEN
    RAISE EXCEPTION 'Only the band leader can check the band into the studio';
  END IF;

  IF v_inv.status NOT IN ('accepted', 'checked_in') THEN
    RAISE EXCEPTION 'The invitation must be accepted before studio check-in';
  END IF;

  IF v_inv.status = 'checked_in' THEN
    RETURN jsonb_build_object('status', 'checked_in', 'already_checked_in', true);
  END IF;

  IF now() < (v_episode.check_in_at - interval '2 hours') THEN
    RAISE EXCEPTION 'Studio check-in has not opened yet';
  END IF;

  IF now() > (v_episode.check_in_at + interval '45 minutes') THEN
    RAISE EXCEPTION 'Studio check-in has closed';
  END IF;

  WITH required_members AS (
    SELECT p.id, coalesce(p.display_name, p.username, 'Band member') AS display_name,
           p.current_city_id, coalesce(p.is_traveling, false) AS is_traveling
    FROM public.band_members bm
    JOIN public.profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = v_inv.band_id
      AND bm.profile_id IS NOT NULL
      AND bm.user_id IS NOT NULL
      AND coalesce(bm.member_status, 'active') = 'active'
      AND coalesce(bm.is_touring_member, false) = false
  )
  SELECT
    count(*),
    count(*) FILTER (WHERE current_city_id = v_episode.city_id AND is_traveling = false),
    coalesce(array_agg(display_name) FILTER (WHERE current_city_id IS DISTINCT FROM v_episode.city_id OR is_traveling = true), '{}')
  INTO v_required_count, v_present_count, v_missing_names
  FROM required_members;

  IF v_required_count = 0 THEN
    RAISE EXCEPTION 'No active player-controlled band members were found';
  END IF;

  IF v_present_count <> v_required_count THEN
    RAISE EXCEPTION 'All active band members must be in London and not travelling. Missing: %', array_to_string(v_missing_names, ', ');
  END IF;

  UPDATE public.totp_invitations
  SET status = 'checked_in',
      checked_in_at = now(),
      updated_at = now()
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object(
    'status', 'checked_in',
    'members_required', v_required_count,
    'members_present', v_present_count,
    'checked_in_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_check_in(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.totp_check_in(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_public_episode(p_episode_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode public.totp_episodes%ROWTYPE;
  v_performances jsonb;
BEGIN
  IF p_episode_id IS NULL THEN
    SELECT * INTO v_episode
    FROM public.totp_episodes
    WHERE status <> 'cancelled'
    ORDER BY
      CASE WHEN broadcast_at >= now() THEN 0 ELSE 1 END,
      CASE WHEN broadcast_at >= now() THEN broadcast_at END ASC,
      broadcast_at DESC
    LIMIT 1;
  ELSE
    SELECT * INTO v_episode
    FROM public.totp_episodes
    WHERE id = p_episode_id
      AND status <> 'cancelled';
  END IF;

  IF v_episode.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'running_order', tp.running_order,
      'band_id', tp.band_id,
      'band_name', b.name,
      'song_id', tp.song_id,
      'song_title', s.title,
      'stage_key', tp.stage_key,
      'presenter_intro', tp.presenter_intro,
      'qualifying_rank', i.qualifying_rank
    ) ORDER BY tp.running_order), '[]'::jsonb)
  INTO v_performances
  FROM public.totp_performances tp
  JOIN public.bands b ON b.id = tp.band_id
  JOIN public.songs s ON s.id = tp.song_id
  JOIN public.totp_invitations i ON i.id = tp.invitation_id
  WHERE tp.episode_id = v_episode.id;

  RETURN jsonb_build_object(
    'id', v_episode.id,
    'episode_number', v_episode.episode_number,
    'episode_date', v_episode.episode_date,
    'status', v_episode.status,
    'check_in_at', v_episode.check_in_at,
    'broadcast_at', v_episode.broadcast_at,
    'presenter_key', v_episode.presenter_key,
    'broadcast_profile', v_episode.broadcast_profile,
    'performances', v_performances
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_public_episode(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_public_episode(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.totp_admin_lock_running_order(p_episode_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode public.totp_episodes%ROWTYPE;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_episode
  FROM public.totp_episodes
  WHERE id = p_episode_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top of the Pops episode not found';
  END IF;

  IF v_episode.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'This episode can no longer be changed';
  END IF;

  DELETE FROM public.totp_performances
  WHERE episode_id = p_episode_id
    AND completed_at IS NULL;

  WITH eligible AS (
    SELECT
      i.id AS invitation_id,
      i.band_id,
      i.song_id,
      i.qualifying_rank,
      s.genre,
      row_number() OVER (
        ORDER BY md5(p_episode_id::text || ':' || i.band_id::text || ':' || i.song_id::text)
      ) AS running_order
    FROM public.totp_invitations i
    JOIN public.songs s ON s.id = i.song_id
    WHERE i.episode_id = p_episode_id
      AND i.status = 'checked_in'
  )
  INSERT INTO public.totp_performances (
    episode_id,
    invitation_id,
    band_id,
    song_id,
    running_order,
    stage_key,
    camera_profile,
    presenter_intro
  )
  SELECT
    p_episode_id,
    e.invitation_id,
    e.band_id,
    e.song_id,
    e.running_order,
    CASE
      WHEN lower(coalesce(e.genre, '')) ~ '(rock|metal|punk|grunge|hardcore)' THEN 'rock_stage'
      WHEN e.qualifying_rank <= 5 THEN 'main_stage'
      WHEN mod(e.running_order, 3) = 0 THEN 'studio_floor'
      ELSE 'secondary_stage'
    END,
    'totp_classic',
    format(
      'At number %s this week, please welcome %s performing %s!',
      e.qualifying_rank,
      b.name,
      s.title
    )
  FROM eligible e
  JOIN public.bands b ON b.id = e.band_id
  JOIN public.songs s ON s.id = e.song_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.totp_episodes
  SET status = 'locked', updated_at = now()
  WHERE id = p_episode_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_lock_running_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_lock_running_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_notify_new_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leader_user uuid;
  v_band_name text;
  v_song_title text;
  v_episode_date date;
BEGIN
  SELECT p.user_id, b.name::text
  INTO v_leader_user, v_band_name
  FROM public.bands b
  JOIN public.profiles p ON p.id = b.leader_id
  WHERE b.id = NEW.band_id;

  SELECT title INTO v_song_title FROM public.songs WHERE id = NEW.song_id;
  SELECT episode_date INTO v_episode_date FROM public.totp_episodes WHERE id = NEW.episode_id;

  IF v_leader_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, message)
    VALUES (
      v_leader_user,
      'system',
      format('Top of the Pops invitation! %s is invited to London on %s to perform %s, currently #%s in the qualifying UK chart.', v_band_name, v_episode_date, v_song_title, NEW.qualifying_rank)
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_notify_new_invitation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS totp_notify_new_invitation ON public.totp_invitations;
CREATE TRIGGER totp_notify_new_invitation
AFTER INSERT ON public.totp_invitations
FOR EACH ROW
EXECUTE FUNCTION public.totp_notify_new_invitation();

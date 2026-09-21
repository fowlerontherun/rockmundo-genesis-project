-- Keep Top of the Pops presenter voice copy independent of song-title pronunciation.
-- Song titles remain visual in lower thirds, chart graphics and running-order UI.
-- The signature is unchanged for backwards compatibility; p_song_title is deliberately unused.

CREATE OR REPLACE FUNCTION public.totp_presenter_intro(
  p_presenter_key text,
  p_show_variant text,
  p_rank integer,
  p_band_name text,
  p_song_title text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_show_variant = 'christmas' THEN
    RETURN format('It is Christmas on Top of the Pops — at number %s, welcome %s!', p_rank, p_band_name);
  END IF;

  IF p_show_variant = 'anniversary' THEN
    RETURN format('It is our Top of the Pops anniversary show — at number %s, welcome %s!', p_rank, p_band_name);
  END IF;

  IF p_show_variant = 'milestone' THEN
    RETURN format('A milestone night on Top of the Pops — at number %s, make some noise for %s!', p_rank, p_band_name);
  END IF;

  RETURN CASE p_presenter_key
    WHEN 'maya_stone' THEN format('Chart watchers, this is Maya Stone. At number %s, give it up for %s!', p_rank, p_band_name)
    WHEN 'jack_mercer' THEN format('London, make some noise. At number %s this week, here is another chart hit from %s!', p_rank, p_band_name)
    WHEN 'nia_vale' THEN format('Tonight on RockMundo Television, number %s belongs to %s. Here they are!', p_rank, p_band_name)
    ELSE format('At number %s this week, please welcome %s!', p_rank, p_band_name)
  END;
END;
$$;

COMMENT ON FUNCTION public.totp_presenter_intro(text,text,integer,text,text) IS
  'Builds band-led presenter introductions without speaking song titles; song titles remain visual-only in the broadcast package.';


-- Make the existing admin schedule page a safe rescheduler as well as a creator.
CREATE OR REPLACE FUNCTION public.totp_admin_upsert_episode(
  p_episode_id uuid,
  p_episode_date date,
  p_broadcast_at timestamptz,
  p_check_in_at timestamptz,
  p_chart_snapshot_date date,
  p_city_id uuid,
  p_presenter_key text,
  p_show_variant text,
  p_max_performances integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_number bigint;
  v_today date := (now() AT TIME ZONE 'Europe/London')::date;
  v_existing public.totp_episodes%ROWTYPE;
  v_timing_changed boolean := false;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can plan Top of the Pops episodes';
  END IF;

  IF p_episode_date IS NULL THEN
    RAISE EXCEPTION 'An air date is required';
  END IF;

  IF p_episode_date < v_today THEN
    RAISE EXCEPTION 'Top of the Pops episodes cannot be scheduled or moved into the past';
  END IF;

  IF NOT public.totp_is_episode_date(p_episode_date) THEN
    RAISE EXCEPTION 'Top of the Pops broadcasts must use the fortnightly Thursday schedule';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.totp_episodes e
    WHERE e.episode_date = p_episode_date
      AND (p_episode_id IS NULL OR e.id <> p_episode_id)
  ) THEN
    RAISE EXCEPTION 'An episode is already scheduled for %', p_episode_date;
  END IF;

  IF p_episode_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.totp_episodes
    WHERE id = p_episode_id
    FOR UPDATE;

    IF v_existing.id IS NULL THEN
      RAISE EXCEPTION 'Episode not found';
    END IF;

    IF v_existing.status IN ('broadcast', 'completed') THEN
      RAISE EXCEPTION 'Episodes that have already aired cannot be changed';
    END IF;

    v_timing_changed :=
      v_existing.episode_date IS DISTINCT FROM p_episode_date
      OR (p_broadcast_at IS NOT NULL AND v_existing.broadcast_at IS DISTINCT FROM p_broadcast_at)
      OR (p_check_in_at IS NOT NULL AND v_existing.check_in_at IS DISTINCT FROM p_check_in_at);

    IF v_timing_changed AND EXISTS (
      SELECT 1 FROM public.totp_invitations i WHERE i.episode_id = p_episode_id
    ) THEN
      RAISE EXCEPTION 'This episode has already sent invitations. Cancel it and create a new broadcast slot before changing the date or times.';
    END IF;

    UPDATE public.totp_episodes
    SET episode_date = p_episode_date,
        broadcast_at = COALESCE(p_broadcast_at, broadcast_at),
        check_in_at = COALESCE(p_check_in_at, check_in_at),
        chart_snapshot_date = COALESCE(p_chart_snapshot_date, chart_snapshot_date),
        city_id = COALESCE(p_city_id, city_id),
        presenter_key = COALESCE(NULLIF(p_presenter_key, ''), presenter_key),
        show_variant = COALESCE(NULLIF(p_show_variant, ''), show_variant),
        max_performances = COALESCE(p_max_performances, max_performances),
        status = CASE WHEN status = 'cancelled' THEN 'scheduled' ELSE status END,
        updated_at = now()
    WHERE id = p_episode_id
    RETURNING id INTO v_id;

    RETURN v_id;
  END IF;

  IF p_city_id IS NULL THEN
    RAISE EXCEPTION 'A host city is required';
  END IF;

  SELECT COALESCE(max(episode_number), 0) + 1
  INTO v_number
  FROM public.totp_episodes;

  INSERT INTO public.totp_episodes (
    episode_date, episode_number, status, chart_snapshot_date, city_id,
    check_in_at, broadcast_at, max_performances, presenter_key, show_variant
  ) VALUES (
    p_episode_date,
    v_number,
    'scheduled',
    COALESCE(p_chart_snapshot_date, p_episode_date - 1),
    p_city_id,
    COALESCE(p_check_in_at, (p_episode_date::timestamp + interval '18 hours') AT TIME ZONE 'Europe/London'),
    COALESCE(p_broadcast_at, (p_episode_date::timestamp + interval '19 hours 30 minutes') AT TIME ZONE 'Europe/London'),
    COALESCE(p_max_performances, 10),
    COALESCE(NULLIF(p_presenter_key, ''), 'alex_rayne'),
    COALESCE(NULLIF(p_show_variant, ''), 'regular')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_upsert_episode(uuid, date, timestamptz, timestamptz, date, uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.totp_admin_upsert_episode(uuid, date, timestamptz, timestamptz, date, uuid, text, text, integer) TO authenticated;

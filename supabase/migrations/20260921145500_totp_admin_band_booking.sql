-- Top of the Pops: admin booking workspace.
-- Manual scheduling can create an episode before its configured chart snapshot exists.
-- The catalogue therefore previews the latest complete UK snapshot; the first booking
-- freezes that real snapshot onto the episode so all later bookings use one immutable pool.

CREATE OR REPLACE FUNCTION public.totp_admin_booking_catalog(p_episode_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_episode public.totp_episodes%ROWTYPE;
  v_source_snapshot date;
  v_previous_episode_id uuid;
  v_booked_slots integer := 0;
  v_candidates jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_episode
  FROM public.totp_episodes e
  WHERE e.id = p_episode_id;

  IF v_episode.id IS NULL THEN
    RAISE EXCEPTION 'Top of the Pops episode not found';
  END IF;

  IF (
    SELECT count(DISTINCT ce.chart_type) = 2
    FROM public.chart_entries ce
    WHERE ce.chart_date = v_episode.chart_snapshot_date
      AND ce.country = 'United Kingdom'
      AND ce.entry_type = 'song'
      AND ce.chart_type IN ('streaming','digital_sales')
      AND ce.rank BETWEEN 1 AND 40
  ) THEN
    v_source_snapshot := v_episode.chart_snapshot_date;
  ELSE
    SELECT ce.chart_date
    INTO v_source_snapshot
    FROM public.chart_entries ce
    WHERE ce.country = 'United Kingdom'
      AND ce.entry_type = 'song'
      AND ce.chart_type IN ('streaming','digital_sales')
      AND ce.rank BETWEEN 1 AND 40
      AND ce.chart_date <= current_date
    GROUP BY ce.chart_date
    HAVING count(*) FILTER (WHERE ce.chart_type = 'streaming') > 0
       AND count(*) FILTER (WHERE ce.chart_type = 'digital_sales') > 0
    ORDER BY ce.chart_date DESC
    LIMIT 1;
  END IF;

  SELECT e.id
  INTO v_previous_episode_id
  FROM public.totp_episodes e
  WHERE e.episode_date < v_episode.episode_date
    AND e.status <> 'cancelled'
  ORDER BY e.episode_date DESC
  LIMIT 1;

  SELECT count(*)
  INTO v_booked_slots
  FROM public.totp_invitations i
  WHERE i.episode_id = p_episode_id
    AND i.status IN ('invited','accepted','checked_in','performed');

  IF v_source_snapshot IS NOT NULL THEN
    WITH source_rows AS (
      SELECT ce.song_id, ce.chart_type, ce.rank, s.band_id, s.title::text AS song_title
      FROM public.chart_entries ce
      JOIN public.songs s ON s.id = ce.song_id
      WHERE ce.chart_date = v_source_snapshot
        AND ce.country = 'United Kingdom'
        AND ce.entry_type = 'song'
        AND ce.chart_type IN ('streaming','digital_sales')
        AND ce.rank BETWEEN 1 AND 40
        AND s.band_id IS NOT NULL
        AND coalesce(s.archived,false) = false
    ),
    song_pool AS (
      SELECT
        sr.band_id,
        sr.song_id,
        min(sr.rank)::integer AS qualifying_rank,
        CASE
          WHEN count(DISTINCT sr.chart_type) = 2 THEN 'both'
          WHEN bool_or(sr.chart_type = 'streaming') THEN 'streaming'
          ELSE 'digital_sales'
        END AS qualifying_chart,
        max(sr.song_title) AS song_title
      FROM source_rows sr
      GROUP BY sr.band_id, sr.song_id
    ),
    band_pool AS (
      SELECT
        b.id AS band_id,
        b.name::text AS band_name,
        coalesce(nullif(b.primary_genre,''), nullif(b.genre,''), 'Unknown')::text AS genre,
        EXISTS (
          SELECT 1
          FROM public.totp_performances tp
          WHERE tp.episode_id = v_previous_episode_id
            AND tp.band_id = b.id
            AND tp.completed_at IS NOT NULL
        ) AS previous_episode_performer,
        (
          SELECT jsonb_build_object(
            'invitation_id', i.id,
            'status', i.status,
            'song_id', i.song_id,
            'qualifying_rank', i.qualifying_rank,
            'response_deadline', i.response_deadline
          )
          FROM public.totp_invitations i
          WHERE i.episode_id = p_episode_id
            AND i.band_id = b.id
          LIMIT 1
        ) AS invitation,
        jsonb_agg(
          jsonb_build_object(
            'song_id', sp.song_id,
            'song_title', sp.song_title,
            'qualifying_rank', sp.qualifying_rank,
            'qualifying_chart', sp.qualifying_chart
          )
          ORDER BY sp.qualifying_rank, sp.song_title
        ) AS songs,
        min(sp.qualifying_rank)::integer AS best_rank
      FROM song_pool sp
      JOIN public.bands b ON b.id = sp.band_id
      WHERE b.status = 'active'::public.band_status
      GROUP BY b.id, b.name, b.primary_genre, b.genre
    )
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'band_id', bp.band_id,
          'band_name', bp.band_name,
          'genre', bp.genre,
          'best_rank', bp.best_rank,
          'previous_episode_performer', bp.previous_episode_performer,
          'eligible', NOT bp.previous_episode_performer,
          'ineligible_reason', CASE WHEN bp.previous_episode_performer THEN 'previous_episode_performer' ELSE NULL END,
          'invitation', bp.invitation,
          'songs', bp.songs
        )
        ORDER BY bp.best_rank, lower(bp.band_name), bp.band_id
      ),
      '[]'::jsonb
    )
    INTO v_candidates
    FROM band_pool bp;
  END IF;

  RETURN jsonb_build_object(
    'episode_id', v_episode.id,
    'episode_number', v_episode.episode_number,
    'episode_date', v_episode.episode_date,
    'episode_status', v_episode.status,
    'configured_snapshot_date', v_episode.chart_snapshot_date,
    'source_snapshot_date', v_source_snapshot,
    'provisional_snapshot', v_source_snapshot IS DISTINCT FROM v_episode.chart_snapshot_date,
    'max_performances', v_episode.max_performances,
    'booked_slots', v_booked_slots,
    'available_slots', greatest(0, v_episode.max_performances - v_booked_slots),
    'candidates', v_candidates
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_admin_book_band(
  p_episode_id uuid,
  p_band_id uuid,
  p_song_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_episode public.totp_episodes%ROWTYPE;
  v_source_snapshot date;
  v_previous_episode_id uuid;
  v_rank integer;
  v_chart text;
  v_candidate_id uuid;
  v_invitation public.totp_invitations%ROWTYPE;
  v_booked_slots integer;
  v_deadline timestamptz;
  v_band_name text;
  v_song_title text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_episode
  FROM public.totp_episodes e
  WHERE e.id = p_episode_id
  FOR UPDATE;

  IF v_episode.id IS NULL THEN
    RAISE EXCEPTION 'Top of the Pops episode not found';
  END IF;

  IF v_episode.status NOT IN ('scheduled','inviting') THEN
    RAISE EXCEPTION 'Bands can only be booked before the running order is locked';
  END IF;

  IF now() >= v_episode.check_in_at THEN
    RAISE EXCEPTION 'Studio check-in has already started for this episode';
  END IF;

  IF (
    SELECT count(DISTINCT ce.chart_type) = 2
    FROM public.chart_entries ce
    WHERE ce.chart_date = v_episode.chart_snapshot_date
      AND ce.country = 'United Kingdom'
      AND ce.entry_type = 'song'
      AND ce.chart_type IN ('streaming','digital_sales')
      AND ce.rank BETWEEN 1 AND 40
  ) THEN
    v_source_snapshot := v_episode.chart_snapshot_date;
  ELSE
    SELECT ce.chart_date
    INTO v_source_snapshot
    FROM public.chart_entries ce
    WHERE ce.country = 'United Kingdom'
      AND ce.entry_type = 'song'
      AND ce.chart_type IN ('streaming','digital_sales')
      AND ce.rank BETWEEN 1 AND 40
      AND ce.chart_date <= current_date
    GROUP BY ce.chart_date
    HAVING count(*) FILTER (WHERE ce.chart_type = 'streaming') > 0
       AND count(*) FILTER (WHERE ce.chart_type = 'digital_sales') > 0
    ORDER BY ce.chart_date DESC
    LIMIT 1;
  END IF;

  IF v_source_snapshot IS NULL THEN
    RAISE EXCEPTION 'No complete UK Streaming and Digital Sales chart snapshot is available';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.bands b
    WHERE b.id = p_band_id
      AND b.status = 'active'::public.band_status
  ) THEN
    RAISE EXCEPTION 'Only active bands can be booked';
  END IF;

  SELECT
    min(ce.rank)::integer,
    CASE
      WHEN count(DISTINCT ce.chart_type) = 2 THEN 'both'
      WHEN bool_or(ce.chart_type = 'streaming') THEN 'streaming'
      ELSE 'digital_sales'
    END
  INTO v_rank, v_chart
  FROM public.chart_entries ce
  JOIN public.songs s ON s.id = ce.song_id
  WHERE ce.chart_date = v_source_snapshot
    AND ce.country = 'United Kingdom'
    AND ce.entry_type = 'song'
    AND ce.chart_type IN ('streaming','digital_sales')
    AND ce.rank BETWEEN 1 AND 40
    AND ce.song_id = p_song_id
    AND s.band_id = p_band_id
    AND coalesce(s.archived,false) = false;

  IF v_rank IS NULL THEN
    RAISE EXCEPTION 'That song is not in the eligible UK Top 40 snapshot';
  END IF;

  SELECT e.id
  INTO v_previous_episode_id
  FROM public.totp_episodes e
  WHERE e.episode_date < v_episode.episode_date
    AND e.status <> 'cancelled'
  ORDER BY e.episode_date DESC
  LIMIT 1;

  IF EXISTS (
    SELECT 1
    FROM public.totp_performances tp
    WHERE tp.episode_id = v_previous_episode_id
      AND tp.band_id = p_band_id
      AND tp.completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This band performed on the previous Top of the Pops and cannot appear two shows in a row';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.totp_invitations i
    WHERE i.episode_id = p_episode_id
      AND i.band_id = p_band_id
  ) THEN
    SELECT * INTO v_invitation
    FROM public.totp_invitations i
    WHERE i.episode_id = p_episode_id
      AND i.band_id = p_band_id
    LIMIT 1;

    RETURN jsonb_build_object(
      'status', 'already_booked',
      'invitation_id', v_invitation.id,
      'invitation_status', v_invitation.status,
      'band_id', v_invitation.band_id,
      'song_id', v_invitation.song_id,
      'qualifying_rank', v_invitation.qualifying_rank
    );
  END IF;

  SELECT count(*)
  INTO v_booked_slots
  FROM public.totp_invitations i
  WHERE i.episode_id = p_episode_id
    AND i.status IN ('invited','accepted','checked_in','performed');

  IF v_booked_slots >= v_episode.max_performances THEN
    RAISE EXCEPTION 'This Top of the Pops episode has no booking slots left';
  END IF;

  -- The first manual booking freezes the real chart snapshot used by the booking pool.
  IF v_episode.chart_snapshot_date IS DISTINCT FROM v_source_snapshot
     AND NOT EXISTS (SELECT 1 FROM public.totp_invitations i WHERE i.episode_id = p_episode_id) THEN
    UPDATE public.totp_episodes
    SET chart_snapshot_date = v_source_snapshot,
        updated_at = now()
    WHERE id = p_episode_id;
    v_episode.chart_snapshot_date := v_source_snapshot;
  END IF;

  INSERT INTO public.totp_candidates (
    episode_id, band_id, song_id, chart_rank, qualifying_chart,
    chart_snapshot_date, selection_bucket, selected, ineligible_reason
  )
  VALUES (
    p_episode_id, p_band_id, p_song_id, v_rank, v_chart,
    v_source_snapshot,
    CASE WHEN v_rank <= 10 THEN 'top10' WHEN v_rank <= 20 THEN '11_20' ELSE '21_40' END,
    true, NULL
  )
  ON CONFLICT (episode_id, band_id)
  DO UPDATE SET
    song_id = excluded.song_id,
    chart_rank = excluded.chart_rank,
    qualifying_chart = excluded.qualifying_chart,
    chart_snapshot_date = excluded.chart_snapshot_date,
    selection_bucket = excluded.selection_bucket,
    selected = true,
    ineligible_reason = NULL
  RETURNING id INTO v_candidate_id;

  v_deadline := LEAST(
    v_episode.check_in_at - interval '4 hours',
    v_episode.broadcast_at - interval '24 hours'
  );

  IF v_deadline <= now() THEN
    RAISE EXCEPTION 'The response deadline has already passed for this episode';
  END IF;

  INSERT INTO public.totp_invitations (
    episode_id, candidate_id, band_id, song_id, qualifying_rank, response_deadline
  )
  VALUES (
    p_episode_id, v_candidate_id, p_band_id, p_song_id, v_rank, v_deadline
  )
  RETURNING * INTO v_invitation;

  UPDATE public.totp_episodes
  SET status = CASE WHEN status = 'scheduled' THEN 'inviting' ELSE status END,
      updated_at = now()
  WHERE id = p_episode_id;

  SELECT b.name::text INTO v_band_name FROM public.bands b WHERE b.id = p_band_id;
  SELECT s.title::text INTO v_song_title FROM public.songs s WHERE s.id = p_song_id;

  RETURN jsonb_build_object(
    'status', 'booked',
    'invitation_id', v_invitation.id,
    'invitation_status', v_invitation.status,
    'band_id', p_band_id,
    'band_name', v_band_name,
    'song_id', p_song_id,
    'song_title', v_song_title,
    'qualifying_rank', v_rank,
    'qualifying_chart', v_chart,
    'response_deadline', v_deadline,
    'chart_snapshot_date', v_source_snapshot
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_booking_catalog(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totp_admin_book_band(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_booking_catalog(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_book_band(uuid,uuid,uuid) TO authenticated;

COMMENT ON FUNCTION public.totp_admin_booking_catalog(uuid) IS
  'Admin-only TOTP booking catalogue from the episode chart snapshot, or the latest complete UK snapshot when a manually scheduled future snapshot does not exist yet.';
COMMENT ON FUNCTION public.totp_admin_book_band(uuid,uuid,uuid) IS
  'Admin-only booking action that enforces UK Top 40 eligibility, previous-show cooldown, active-band status and episode capacity.';

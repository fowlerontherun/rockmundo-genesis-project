-- Restore reusable player-created setlists as the authoritative gig selection.
-- gig_setlists remains an internal preparation mirror only; it must never become
-- a player-visible setlist or replace gigs.setlist_id.

CREATE OR REPLACE FUNCTION public.ensure_gig_preparation_from_booked_setlist(p_gig_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_gig record;
  v_gig_setlist_id uuid;
  v_total integer := 0;
BEGIN
  SELECT g.id, g.band_id, g.setlist_id, s.name AS setlist_name
    INTO v_gig
  FROM public.gigs g
  LEFT JOIN public.setlists s ON s.id = g.setlist_id
  WHERE g.id = p_gig_id;

  IF NOT FOUND OR v_gig.setlist_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.setlists s
    WHERE s.id = v_gig.setlist_id
      AND s.band_id = v_gig.band_id
      AND COALESCE(s.is_active, true)
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.gig_setlists (gig_id, name, status)
  VALUES (p_gig_id, COALESCE(NULLIF(v_gig.setlist_name, ''), 'Booked setlist'), 'ready')
  ON CONFLICT (gig_id) DO UPDATE
    SET name = EXCLUDED.name,
        status = 'ready',
        updated_at = now()
  RETURNING id INTO v_gig_setlist_id;

  DELETE FROM public.gig_setlist_items
  WHERE setlist_id = v_gig_setlist_id;

  INSERT INTO public.gig_setlist_items (setlist_id, song_id, position, is_encore)
  SELECT
    v_gig_setlist_id,
    ss.song_id,
    row_number() OVER (ORDER BY ss.position, ss.created_at, ss.id)::integer,
    COALESCE(ss.is_encore, false)
  FROM public.setlist_songs ss
  WHERE ss.setlist_id = v_gig.setlist_id
    AND ss.song_id IS NOT NULL
  ORDER BY ss.position, ss.created_at, ss.id;

  SELECT COALESCE(SUM(COALESCE(s.duration_seconds, 180)), 0)::integer
    INTO v_total
  FROM public.gig_setlist_items i
  LEFT JOIN public.songs s ON s.id = i.song_id
  WHERE i.setlist_id = v_gig_setlist_id;

  UPDATE public.gig_setlists
  SET total_duration_seconds = v_total,
      status = CASE WHEN v_total > 0 THEN 'ready' ELSE 'draft' END,
      updated_at = now()
  WHERE id = v_gig_setlist_id;

  RETURN v_gig_setlist_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_gig_preparation_from_booked_setlist(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_gig_preparation_from_booked_setlist(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.select_gig_setlist(p_gig_id uuid, p_setlist_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_band_id uuid;
  v_status text;
  v_setlist_name text;
  v_song_count integer := 0;
  v_total integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'gig_setlist_unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.caller_in_gig_band(p_gig_id) THEN
    RAISE EXCEPTION 'gig_setlist_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT g.band_id, g.status::text
    INTO v_band_id, v_status
  FROM public.gigs g
  WHERE g.id = p_gig_id
  FOR UPDATE;

  IF v_band_id IS NULL THEN
    RAISE EXCEPTION 'gig_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_status IN ('completed', 'cancelled', 'in_progress', 'ready_for_completion', 'processing_outcome', 'live', 'failed') THEN
    RAISE EXCEPTION 'gig_setlist_locked:%', v_status USING ERRCODE = 'P0001';
  END IF;

  SELECT
    s.name,
    COUNT(ss.song_id)::integer,
    COALESCE(SUM(COALESCE(song.duration_seconds, 180)), 0)::integer
  INTO v_setlist_name, v_song_count, v_total
  FROM public.setlists s
  LEFT JOIN public.setlist_songs ss
    ON ss.setlist_id = s.id
   AND ss.song_id IS NOT NULL
  LEFT JOIN public.songs song ON song.id = ss.song_id
  WHERE s.id = p_setlist_id
    AND s.band_id = v_band_id
    AND COALESCE(s.is_active, true)
  GROUP BY s.id, s.name;

  IF v_setlist_name IS NULL THEN
    RAISE EXCEPTION 'gig_setlist_invalid' USING ERRCODE = '23503';
  END IF;

  IF v_song_count < 6 OR v_total <= 0 THEN
    RAISE EXCEPTION 'gig_setlist_invalid' USING ERRCODE = '23514';
  END IF;

  UPDATE public.gigs
  SET setlist_id = p_setlist_id,
      setlist_duration_minutes = GREATEST(1, CEIL(v_total / 60.0))::integer,
      updated_at = now()
  WHERE id = p_gig_id;

  PERFORM public.ensure_gig_preparation_from_booked_setlist(p_gig_id);

  RETURN jsonb_build_object(
    'gigId', p_gig_id,
    'setlistId', p_setlist_id,
    'setlistName', v_setlist_name,
    'songCount', v_song_count,
    'totalDurationSeconds', v_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.select_gig_setlist(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.select_gig_setlist(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_gig_setlist(p_gig_id uuid, p_name text, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_band_id uuid;
  v_setlist_id uuid;
  v_requested text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'gig_setlist_unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.caller_in_gig_band(p_gig_id) THEN
    RAISE EXCEPTION 'gig_setlist_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT g.band_id
    INTO v_band_id
  FROM public.gigs g
  WHERE g.id = p_gig_id;

  IF v_band_id IS NULL THEN
    RAISE EXCEPTION 'gig_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(
    array_agg((item->>'song_id') || ':' || COALESCE(item->>'is_encore', 'false') ORDER BY ordinality),
    ARRAY[]::text[]
  )
  INTO v_requested
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) WITH ORDINALITY AS t(item, ordinality)
  WHERE NULLIF(item->>'song_id', '') IS NOT NULL;

  SELECT s.id
    INTO v_setlist_id
  FROM public.setlists s
  WHERE s.band_id = v_band_id
    AND COALESCE(s.is_active, true)
    AND COALESCE((
      SELECT array_agg(ss.song_id::text || ':' || COALESCE(ss.is_encore, false)::text ORDER BY ss.position)
      FILTER (WHERE ss.song_id IS NOT NULL)
      FROM public.setlist_songs ss
      WHERE ss.setlist_id = s.id
    ), ARRAY[]::text[]) = v_requested
  ORDER BY CASE WHEN s.name = p_name THEN 0 ELSE 1 END, s.updated_at DESC
  LIMIT 1;

  IF v_setlist_id IS NULL THEN
    RAISE EXCEPTION 'gig_setlist_must_use_saved_setlist' USING ERRCODE = '23514';
  END IF;

  RETURN public.select_gig_setlist(p_gig_id, v_setlist_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.save_gig_setlist(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_gig_setlist(uuid, text, jsonb) TO authenticated, service_role;

DO $repair$
DECLARE
  r record;
  v_total integer;
BEGIN
  FOR r IN
    WITH snapshots AS (
      SELECT
        g.id AS gig_id,
        g.band_id,
        g.setlist_id AS snapshot_id,
        COALESCE(
          array_agg(ss.song_id::text || ':' || COALESCE(ss.is_encore, false)::text ORDER BY ss.position)
          FILTER (WHERE ss.song_id IS NOT NULL),
          ARRAY[]::text[]
        ) AS items
      FROM public.gigs g
      JOIN public.setlists snapshot ON snapshot.id = g.setlist_id
      LEFT JOIN public.setlist_songs ss ON ss.setlist_id = snapshot.id
      WHERE snapshot.is_active = false
        AND snapshot.description = 'Gig-specific execution snapshot'
        AND g.status::text NOT IN ('completed', 'cancelled', 'failed')
      GROUP BY g.id, g.band_id, g.setlist_id
    ), matches AS (
      SELECT
        sn.gig_id,
        sn.snapshot_id,
        candidate.id AS candidate_id,
        COUNT(*) OVER (PARTITION BY sn.gig_id) AS match_count
      FROM snapshots sn
      JOIN public.setlists candidate
        ON candidate.band_id = sn.band_id
       AND COALESCE(candidate.is_active, true)
      WHERE COALESCE((
        SELECT array_agg(ss.song_id::text || ':' || COALESCE(ss.is_encore, false)::text ORDER BY ss.position)
        FILTER (WHERE ss.song_id IS NOT NULL)
        FROM public.setlist_songs ss
        WHERE ss.setlist_id = candidate.id
      ), ARRAY[]::text[]) = sn.items
    )
    SELECT gig_id, snapshot_id, candidate_id
    FROM matches
    WHERE match_count = 1
  LOOP
    SELECT COALESCE(SUM(COALESCE(song.duration_seconds, 180)), 0)::integer
      INTO v_total
    FROM public.setlist_songs ss
    LEFT JOIN public.songs song ON song.id = ss.song_id
    WHERE ss.setlist_id = r.candidate_id
      AND ss.song_id IS NOT NULL;

    UPDATE public.gigs
    SET setlist_id = r.candidate_id,
        setlist_duration_minutes = GREATEST(1, CEIL(v_total / 60.0))::integer,
        updated_at = now()
    WHERE id = r.gig_id
      AND setlist_id = r.snapshot_id;

    DELETE FROM public.setlists
    WHERE id = r.snapshot_id
      AND is_active = false
      AND description = 'Gig-specific execution snapshot';
  END LOOP;
END;
$repair$;

COMMENT ON FUNCTION public.select_gig_setlist(uuid, uuid) IS
  'Assigns an existing active band setlist to an upcoming gig and refreshes the internal preparation mirror without creating a new setlist.';

COMMENT ON FUNCTION public.save_gig_setlist(uuid, text, jsonb) IS
  'Compatibility wrapper: resolves old gig-preparation payloads to an existing saved setlist and never creates a gig-specific player-visible setlist.';

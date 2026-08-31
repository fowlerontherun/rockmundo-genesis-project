-- Keep the newer per-gig preparation model and the legacy/live execution model in sync.
-- The live gig engine still resolves gigs.setlist_id, so each prepared gig receives an
-- inactive, gig-specific execution snapshot rather than mutating the band's reusable setlist.

CREATE OR REPLACE FUNCTION public.save_gig_setlist(p_gig_id uuid, p_name text, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_setlist_id uuid;
  v_total integer := 0;
  v_band_id uuid;
  v_status text;
BEGIN
  IF NOT public.caller_in_gig_band(p_gig_id) THEN
    RAISE EXCEPTION 'not_authorised';
  END IF;

  SELECT g.band_id, g.status::text
    INTO v_band_id, v_status
  FROM public.gigs g
  WHERE g.id = p_gig_id;

  IF v_band_id IS NULL THEN
    RAISE EXCEPTION 'gig_not_found';
  END IF;

  IF v_status IN ('completed', 'cancelled', 'in_progress', 'ready_for_completion', 'processing_outcome', 'live') THEN
    RAISE EXCEPTION 'gig_setlist_locked:%', v_status;
  END IF;

  INSERT INTO public.gig_setlists (gig_id, name)
  VALUES (p_gig_id, COALESCE(NULLIF(p_name, ''), 'Gig setlist'))
  ON CONFLICT (gig_id) DO UPDATE
    SET name = EXCLUDED.name,
        updated_at = now()
  RETURNING id INTO v_setlist_id;

  DELETE FROM public.gig_setlist_items
  WHERE setlist_id = v_setlist_id;

  INSERT INTO public.gig_setlist_items (setlist_id, song_id, position, is_encore)
  SELECT
    v_setlist_id,
    (item->>'song_id')::uuid,
    row_number() OVER (ORDER BY ordinality)::integer,
    COALESCE((item->>'is_encore')::boolean, false)
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) WITH ORDINALITY AS t(item, ordinality)
  WHERE NULLIF(item->>'song_id', '') IS NOT NULL;

  SELECT COALESCE(SUM(COALESCE(s.duration_seconds, 180)), 0)::integer
    INTO v_total
  FROM public.gig_setlist_items i
  LEFT JOIN public.songs s ON s.id = i.song_id
  WHERE i.setlist_id = v_setlist_id;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'gig_setlist_empty';
  END IF;

  UPDATE public.gig_setlists
  SET total_duration_seconds = v_total,
      updated_at = now()
  WHERE id = v_setlist_id;

  INSERT INTO public.setlists (id, band_id, name, description, setlist_type, is_active)
  VALUES (
    v_setlist_id,
    v_band_id,
    COALESCE(NULLIF(p_name, ''), 'Gig setlist'),
    'Gig-specific execution snapshot',
    'custom',
    false
  )
  ON CONFLICT (id) DO UPDATE
    SET band_id = EXCLUDED.band_id,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        is_active = false,
        updated_at = now();

  DELETE FROM public.setlist_songs
  WHERE setlist_id = v_setlist_id;

  INSERT INTO public.setlist_songs (setlist_id, song_id, position, is_encore, item_type, section)
  SELECT
    v_setlist_id,
    i.song_id,
    i.position,
    COALESCE(i.is_encore, false),
    'song',
    CASE WHEN COALESCE(i.is_encore, false) THEN 'encore' ELSE 'main' END
  FROM public.gig_setlist_items i
  WHERE i.setlist_id = v_setlist_id
  ORDER BY i.position;

  UPDATE public.gigs
  SET setlist_id = v_setlist_id,
      setlist_duration_minutes = GREATEST(1, CEIL(v_total / 60.0))::integer,
      updated_at = now()
  WHERE id = p_gig_id;

  RETURN jsonb_build_object(
    'setlistId', v_setlist_id,
    'executionSetlistId', v_setlist_id,
    'totalDurationSeconds', v_total
  );
END;
$function$;

-- Backfill already-prepared upcoming gigs.
INSERT INTO public.setlists (id, band_id, name, description, setlist_type, is_active)
SELECT
  gs.id,
  g.band_id,
  COALESCE(NULLIF(gs.name, ''), 'Gig setlist'),
  'Gig-specific execution snapshot',
  'custom',
  false
FROM public.gigs g
JOIN public.gig_setlists gs ON gs.gig_id = g.id
WHERE g.status IN ('scheduled', 'confirmed', 'requested')
  AND g.scheduled_date >= now()
  AND EXISTS (
    SELECT 1 FROM public.gig_setlist_items i WHERE i.setlist_id = gs.id
  )
ON CONFLICT (id) DO UPDATE
  SET band_id = EXCLUDED.band_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active = false,
      updated_at = now();

DELETE FROM public.setlist_songs ss
WHERE ss.setlist_id IN (
  SELECT gs.id
  FROM public.gigs g
  JOIN public.gig_setlists gs ON gs.gig_id = g.id
  WHERE g.status IN ('scheduled', 'confirmed', 'requested')
    AND g.scheduled_date >= now()
    AND EXISTS (
      SELECT 1 FROM public.gig_setlist_items i WHERE i.setlist_id = gs.id
    )
);

INSERT INTO public.setlist_songs (setlist_id, song_id, position, is_encore, item_type, section)
SELECT
  gs.id,
  i.song_id,
  i.position,
  COALESCE(i.is_encore, false),
  'song',
  CASE WHEN COALESCE(i.is_encore, false) THEN 'encore' ELSE 'main' END
FROM public.gigs g
JOIN public.gig_setlists gs ON gs.gig_id = g.id
JOIN public.gig_setlist_items i ON i.setlist_id = gs.id
WHERE g.status IN ('scheduled', 'confirmed', 'requested')
  AND g.scheduled_date >= now()
ORDER BY gs.id, i.position;

WITH totals AS (
  SELECT
    gs.gig_id,
    gs.id AS setlist_id,
    COALESCE(SUM(COALESCE(s.duration_seconds, 180)), 0)::integer AS total_seconds
  FROM public.gig_setlists gs
  JOIN public.gigs g ON g.id = gs.gig_id
  JOIN public.gig_setlist_items i ON i.setlist_id = gs.id
  LEFT JOIN public.songs s ON s.id = i.song_id
  WHERE g.status IN ('scheduled', 'confirmed', 'requested')
    AND g.scheduled_date >= now()
  GROUP BY gs.gig_id, gs.id
)
UPDATE public.gig_setlists gs
SET total_duration_seconds = t.total_seconds,
    updated_at = now()
FROM totals t
WHERE gs.id = t.setlist_id;

WITH totals AS (
  SELECT
    gs.gig_id,
    gs.id AS setlist_id,
    COALESCE(SUM(COALESCE(s.duration_seconds, 180)), 0)::integer AS total_seconds
  FROM public.gig_setlists gs
  JOIN public.gigs g ON g.id = gs.gig_id
  JOIN public.gig_setlist_items i ON i.setlist_id = gs.id
  LEFT JOIN public.songs s ON s.id = i.song_id
  WHERE g.status IN ('scheduled', 'confirmed', 'requested')
    AND g.scheduled_date >= now()
  GROUP BY gs.gig_id, gs.id
)
UPDATE public.gigs g
SET setlist_id = t.setlist_id,
    setlist_duration_minutes = GREATEST(1, CEIL(t.total_seconds / 60.0))::integer,
    updated_at = now()
FROM totals t
WHERE g.id = t.gig_id;

REVOKE ALL ON FUNCTION public.save_gig_setlist(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_gig_setlist(uuid, text, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.save_gig_setlist(uuid, text, jsonb) IS
  'Saves a gig-specific prepared setlist and synchronizes it to the authoritative execution setlist used by live gig and completion processing.';

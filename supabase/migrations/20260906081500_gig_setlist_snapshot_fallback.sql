-- Ensure per-gig preparation snapshots can safely backstop legacy/live execution
-- when a gig's reusable setlist link is missing, without overriding a valid
-- active reusable setlist selection.

ALTER TABLE public.gig_setlists
  ADD COLUMN IF NOT EXISTS legacy_setlist_id uuid
  REFERENCES public.setlists(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.sync_gig_snapshot_legacy_setlist(p_gig_setlist_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_gs public.gig_setlists%ROWTYPE;
  v_gig public.gigs%ROWTYPE;
  v_legacy_id uuid;
  v_has_valid_selected_setlist boolean := false;
BEGIN
  SELECT * INTO v_gs
  FROM public.gig_setlists
  WHERE id = p_gig_setlist_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = v_gs.gig_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.setlists s
    WHERE s.id = v_gig.setlist_id
      AND s.band_id = v_gig.band_id
      AND COALESCE(s.is_active, true)
  )
  INTO v_has_valid_selected_setlist;

  v_legacy_id := v_gs.legacy_setlist_id;

  IF v_legacy_id IS NULL THEN
    INSERT INTO public.setlists (
      band_id,
      name,
      description,
      setlist_type,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      v_gig.band_id,
      '__gig_snapshot_' || v_gig.id::text,
      'Internal compatibility mirror of the booked gig setlist snapshot.',
      'gig_snapshot',
      false,
      COALESCE(v_gs.created_at, now()),
      now()
    )
    RETURNING id INTO v_legacy_id;

    UPDATE public.gig_setlists
    SET legacy_setlist_id = v_legacy_id
    WHERE id = v_gs.id;
  END IF;

  UPDATE public.setlists
  SET band_id = v_gig.band_id,
      name = '__gig_snapshot_' || v_gig.id::text,
      description = 'Internal compatibility mirror of the booked gig setlist snapshot.',
      setlist_type = 'gig_snapshot',
      is_active = false,
      updated_at = now()
  WHERE id = v_legacy_id;

  DELETE FROM public.setlist_songs
  WHERE setlist_id = v_legacy_id;

  INSERT INTO public.setlist_songs (
    setlist_id,
    song_id,
    position,
    is_encore,
    item_type,
    section
  )
  SELECT
    v_legacy_id,
    i.song_id,
    i.position,
    COALESCE(i.is_encore, false),
    'song',
    CASE WHEN COALESCE(i.is_encore, false) THEN 'encore' ELSE 'main' END
  FROM public.gig_setlist_items i
  WHERE i.setlist_id = v_gs.id
    AND i.song_id IS NOT NULL
  ORDER BY i.position;

  -- Existing active reusable setlists remain authoritative. The internal mirror
  -- is only a compatibility fallback for legacy/orphaned gigs.
  IF NOT v_has_valid_selected_setlist THEN
    UPDATE public.gigs
    SET setlist_id = v_legacy_id,
        updated_at = now()
    WHERE id = v_gig.id
      AND setlist_id IS DISTINCT FROM v_legacy_id;
  END IF;

  RETURN v_legacy_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_gig_snapshot_legacy_setlist(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_gig_snapshot_legacy_setlist(uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.trg_sync_gig_snapshot_legacy_setlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'gig_setlists' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;

    PERFORM public.sync_gig_snapshot_legacy_setlist(NEW.id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_gig_snapshot_legacy_setlist(OLD.setlist_id);
    RETURN OLD;
  END IF;

  PERFORM public.sync_gig_snapshot_legacy_setlist(NEW.setlist_id);

  IF TG_OP = 'UPDATE' AND OLD.setlist_id IS DISTINCT FROM NEW.setlist_id THEN
    PERFORM public.sync_gig_snapshot_legacy_setlist(OLD.setlist_id);
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.trg_sync_gig_snapshot_legacy_setlist()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_gig_setlists_sync_legacy ON public.gig_setlists;
CREATE TRIGGER trg_gig_setlists_sync_legacy
AFTER INSERT OR UPDATE OF name, total_duration_seconds, status
ON public.gig_setlists
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_gig_snapshot_legacy_setlist();

DROP TRIGGER IF EXISTS trg_gig_setlist_items_sync_legacy ON public.gig_setlist_items;
CREATE TRIGGER trg_gig_setlist_items_sync_legacy
AFTER INSERT OR UPDATE OR DELETE
ON public.gig_setlist_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_gig_snapshot_legacy_setlist();

-- Backfill all prepared gigs so legacy completion code can immediately resolve
-- a setlist even for rows created before reusable-setlist selection was enforced.
DO $backfill$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.gig_setlists LOOP
    PERFORM public.sync_gig_snapshot_legacy_setlist(r.id);
  END LOOP;
END;
$backfill$;

-- If a snapshot exactly matches one active reusable setlist, restore that reusable
-- setlist as the authoritative selected setlist rather than leaving the fallback.
DO $restore$
DECLARE
  r record;
BEGIN
  FOR r IN
    WITH snapshot_items AS (
      SELECT
        gs.gig_id,
        gs.legacy_setlist_id,
        COALESCE(
          array_agg(i.song_id::text || ':' || COALESCE(i.is_encore, false)::text ORDER BY i.position)
          FILTER (WHERE i.song_id IS NOT NULL),
          ARRAY[]::text[]
        ) AS items
      FROM public.gig_setlists gs
      LEFT JOIN public.gig_setlist_items i ON i.setlist_id = gs.id
      GROUP BY gs.gig_id, gs.legacy_setlist_id
    ), candidate_items AS (
      SELECT
        s.band_id,
        s.id,
        COALESCE(
          array_agg(ss.song_id::text || ':' || COALESCE(ss.is_encore, false)::text ORDER BY ss.position)
          FILTER (WHERE ss.song_id IS NOT NULL),
          ARRAY[]::text[]
        ) AS items
      FROM public.setlists s
      LEFT JOIN public.setlist_songs ss ON ss.setlist_id = s.id
      WHERE COALESCE(s.is_active, true)
      GROUP BY s.band_id, s.id
    ), matches AS (
      SELECT
        si.gig_id,
        si.legacy_setlist_id,
        ci.id AS candidate_id,
        COUNT(*) OVER (PARTITION BY si.gig_id) AS match_count
      FROM snapshot_items si
      JOIN public.gigs g ON g.id = si.gig_id
      JOIN candidate_items ci
        ON ci.band_id = g.band_id
       AND ci.items = si.items
    )
    SELECT gig_id, legacy_setlist_id, candidate_id
    FROM matches
    WHERE match_count = 1
  LOOP
    UPDATE public.gigs g
    SET setlist_id = r.candidate_id,
        updated_at = now()
    WHERE g.id = r.gig_id
      AND (
        g.setlist_id IS NULL
        OR g.setlist_id = r.legacy_setlist_id
        OR EXISTS (
          SELECT 1
          FROM public.setlists s
          WHERE s.id = g.setlist_id
            AND NOT COALESCE(s.is_active, true)
        )
      );
  END LOOP;
END;
$restore$;

COMMENT ON FUNCTION public.sync_gig_snapshot_legacy_setlist(uuid) IS
  'Maintains an inactive execution fallback from gig_setlists/gig_setlist_items and only assigns it when no valid active reusable setlist is selected.';

-- Batched live-performance summaries for the Band Repertoire.
-- Production links song-performance rows to gig_outcomes, which then identify
-- the canonical gig. Duplicate retry rows are collapsed per gig/song.

CREATE OR REPLACE FUNCTION public.get_band_song_live_stats(p_band_id uuid)
RETURNS TABLE (
  song_id uuid,
  live_play_count bigint,
  last_played_at timestamptz,
  covering_band_count bigint,
  cover_live_play_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $function$
  WITH target_songs AS (
    SELECT s.id AS song_id
    FROM public.songs s
    WHERE s.band_id = p_band_id
  ),
  completed AS (
    SELECT DISTINCT ON (go.gig_id, gsp.song_id)
      gsp.song_id,
      go.gig_id,
      COALESCE(go.band_id, g.band_id) AS performing_band_id,
      COALESCE(gsp.completed_at, go.completed_at, g.completed_at, g.scheduled_date, go.created_at) AS played_at
    FROM public.gig_song_performances gsp
    JOIN target_songs ts ON ts.song_id = gsp.song_id
    JOIN public.gig_outcomes go ON go.id = gsp.gig_outcome_id
    JOIN public.gigs g ON g.id = go.gig_id
    ORDER BY go.gig_id, gsp.song_id, gsp.created_at DESC
  )
  SELECT
    ts.song_id,
    COUNT(c.*) FILTER (WHERE c.performing_band_id = p_band_id)::bigint AS live_play_count,
    MAX(c.played_at) FILTER (WHERE c.performing_band_id = p_band_id) AS last_played_at,
    COUNT(DISTINCT c.performing_band_id) FILTER (
      WHERE c.performing_band_id IS NOT NULL
        AND c.performing_band_id IS DISTINCT FROM p_band_id
    )::bigint AS covering_band_count,
    COUNT(c.*) FILTER (
      WHERE c.performing_band_id IS NOT NULL
        AND c.performing_band_id IS DISTINCT FROM p_band_id
    )::bigint AS cover_live_play_count
  FROM target_songs ts
  LEFT JOIN completed c ON c.song_id = ts.song_id
  GROUP BY ts.song_id
  ORDER BY ts.song_id;
$function$;

REVOKE ALL ON FUNCTION public.get_band_song_live_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_band_song_live_stats(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_band_song_live_stats(uuid) IS
  'Returns one canonical completed-live-performance summary row per song owned by the requested band for repertoire list rendering, using gig_outcome-linked performance rows.';

NOTIFY pgrst, 'reload schema';

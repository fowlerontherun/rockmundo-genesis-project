-- Reconcile the song-detail live/cover RPC with the deployed authoritative
-- performance shape. gig_song_performances points to gig_outcomes, not gigs.

CREATE INDEX IF NOT EXISTS idx_gig_song_performances_song_outcome
  ON public.gig_song_performances (song_id, gig_outcome_id)
  WHERE song_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_song_live_cover_stats(p_song_id uuid)
RETURNS TABLE (
  song_id uuid,
  owner_band_id uuid,
  live_play_count bigint,
  last_played_at timestamptz,
  covering_band_count bigint,
  cover_live_play_count bigint,
  covers jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $function$
  WITH target AS (
    SELECT s.id, s.band_id
    FROM public.songs s
    WHERE s.id = p_song_id
  ),
  completed AS (
    SELECT DISTINCT ON (go.gig_id, gsp.song_id)
      gsp.song_id,
      go.gig_id,
      COALESCE(go.band_id, g.band_id) AS performing_band_id,
      COALESCE(gsp.completed_at, go.completed_at, g.completed_at, g.scheduled_date, go.created_at) AS played_at
    FROM public.gig_song_performances gsp
    JOIN public.gig_outcomes go ON go.id = gsp.gig_outcome_id
    JOIN public.gigs g ON g.id = go.gig_id
    WHERE gsp.song_id = p_song_id
    ORDER BY go.gig_id, gsp.song_id, gsp.created_at DESC
  ),
  own_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE c.performing_band_id = t.band_id)::bigint AS live_play_count,
      MAX(c.played_at) FILTER (WHERE c.performing_band_id = t.band_id) AS last_played_at
    FROM target t
    LEFT JOIN completed c ON c.song_id = t.id
    GROUP BY t.id, t.band_id
  ),
  cover_rows AS (
    SELECT
      c.performing_band_id,
      b.name AS band_name,
      COUNT(*)::bigint AS live_play_count,
      MAX(c.played_at) AS last_played_at
    FROM target t
    JOIN completed c ON c.song_id = t.id
    LEFT JOIN public.bands b ON b.id = c.performing_band_id
    WHERE c.performing_band_id IS DISTINCT FROM t.band_id
      AND c.performing_band_id IS NOT NULL
    GROUP BY c.performing_band_id, b.name
  ),
  cover_stats AS (
    SELECT
      COUNT(*)::bigint AS covering_band_count,
      COALESCE(SUM(cr.live_play_count), 0)::bigint AS cover_live_play_count,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'band_id', cr.performing_band_id,
            'band_name', COALESCE(cr.band_name, 'Unknown band'),
            'live_play_count', cr.live_play_count,
            'last_played_at', cr.last_played_at
          )
          ORDER BY cr.live_play_count DESC, cr.last_played_at DESC NULLS LAST, cr.band_name
        ),
        '[]'::jsonb
      ) AS covers
    FROM cover_rows cr
  )
  SELECT
    t.id AS song_id,
    t.band_id AS owner_band_id,
    COALESCE(os.live_play_count, 0)::bigint AS live_play_count,
    os.last_played_at,
    COALESCE(cs.covering_band_count, 0)::bigint AS covering_band_count,
    COALESCE(cs.cover_live_play_count, 0)::bigint AS cover_live_play_count,
    COALESCE(cs.covers, '[]'::jsonb) AS covers
  FROM target t
  LEFT JOIN own_stats os ON TRUE
  LEFT JOIN cover_stats cs ON TRUE;
$function$;

REVOKE ALL ON FUNCTION public.get_song_live_cover_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_song_live_cover_stats(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_song_live_cover_stats(uuid) IS
  'Returns canonical completed live-play totals for the song owner plus distinct covering bands, using gig_outcome-linked performance rows.';

NOTIFY pgrst, 'reload schema';

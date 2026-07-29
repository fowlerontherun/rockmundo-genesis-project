-- Ensure the chart entry relationship exists without recreating an established
-- foreign key from the base chart schema.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chart_entries_song_id_fkey'
      AND conrelid = 'public.chart_entries'::regclass
  ) THEN
    ALTER TABLE public.chart_entries
      ADD CONSTRAINT chart_entries_song_id_fkey
      FOREIGN KEY (song_id)
      REFERENCES public.songs(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DROP VIEW IF EXISTS public.chart_singles;
CREATE VIEW public.chart_singles AS
SELECT
  s.id AS song_id,
  s.title,
  s.genre,
  b.name AS band_name,
  sr.country,
  sp.platform_name,
  SUM(COALESCE(sr.total_streams, 0)) AS total_streams,
  SUM(COALESCE(sr.total_revenue, 0)) AS streaming_revenue,
  COUNT(DISTINCT sr.id) AS platform_count
FROM public.songs s
LEFT JOIN public.bands b ON s.band_id = b.id
LEFT JOIN public.song_releases sr ON s.id = sr.song_id
LEFT JOIN public.streaming_platforms sp ON sr.platform_id = sp.id
WHERE sr.release_type = 'streaming'
  AND sr.is_active = true
GROUP BY s.id, s.title, s.genre, b.name, sr.country, sp.platform_name;

DROP VIEW IF EXISTS public.chart_albums;
CREATE VIEW public.chart_albums AS
SELECT
  r.id AS release_id,
  r.title,
  b.name AS band_name,
  r.country,
  r.format_type,
  r.digital_sales,
  r.cd_sales,
  r.vinyl_sales,
  r.cassette_sales,
  r.total_units_sold,
  r.total_revenue,
  r.release_status,
  r.created_at
FROM public.releases r
LEFT JOIN public.bands b ON r.band_id = b.id
WHERE r.release_status = 'released';

COMMENT ON VIEW public.chart_singles IS
  'Aggregated view of single songs across streaming platforms by country';
COMMENT ON VIEW public.chart_albums IS
  'Aggregated view of album/release sales by format and country';

NOTIFY pgrst, 'reload schema';

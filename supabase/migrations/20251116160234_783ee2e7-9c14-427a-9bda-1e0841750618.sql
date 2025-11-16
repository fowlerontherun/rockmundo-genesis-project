-- Add missing foreign key relationship between chart_entries and songs
ALTER TABLE chart_entries
ADD CONSTRAINT chart_entries_song_id_fkey 
FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE;

-- Update chart_singles view to ensure proper song relationship
DROP VIEW IF EXISTS chart_singles;

CREATE OR REPLACE VIEW chart_singles AS
SELECT 
  s.id as song_id,
  s.title,
  s.genre,
  b.name as band_name,
  sr.country,
  sp.platform_name,
  SUM(COALESCE(sr.total_streams, 0)) as total_streams,
  SUM(COALESCE(sr.total_revenue, 0)) as streaming_revenue,
  COUNT(DISTINCT sr.id) as platform_count
FROM songs s
LEFT JOIN bands b ON s.band_id = b.id
LEFT JOIN song_releases sr ON s.id = sr.song_id
LEFT JOIN streaming_platforms sp ON sr.platform_id = sp.id
WHERE sr.release_type = 'streaming' AND sr.is_active = true
GROUP BY s.id, s.title, s.genre, b.name, sr.country, sp.platform_name;

-- Update chart_albums view to use proper relationships
DROP VIEW IF EXISTS chart_albums;

CREATE OR REPLACE VIEW chart_albums AS
SELECT 
  r.id as release_id,
  r.title,
  b.name as band_name,
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
FROM releases r
LEFT JOIN bands b ON r.band_id = b.id
WHERE r.release_status = 'released';

COMMENT ON VIEW chart_singles IS 'Aggregated view of single songs across streaming platforms by country';
COMMENT ON VIEW chart_albums IS 'Aggregated view of album/release sales by format and country';
-- Fix chart_entries unique constraint to allow album entries with null song_id
-- and seed playlists and manufacturing costs

-- First, drop the existing unique constraint on chart_entries
ALTER TABLE chart_entries DROP CONSTRAINT IF EXISTS chart_entries_song_id_chart_type_chart_date_key;

-- Create partial unique indexes to handle different cases
-- Index for song entries (song_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS chart_entries_song_unique 
ON chart_entries (song_id, chart_type, chart_date) 
WHERE song_id IS NOT NULL;

-- Index for album entries (song_id is null, use release_id)
CREATE UNIQUE INDEX IF NOT EXISTS chart_entries_album_unique 
ON chart_entries (release_id, chart_type, chart_date) 
WHERE release_id IS NOT NULL AND song_id IS NULL;

-- Seed playlists table if empty
INSERT INTO playlists (platform_id, playlist_name, curator_type, follower_count, submission_cost, acceptance_criteria, boost_multiplier)
SELECT 
  sp.id,
  playlist_data.name,
  playlist_data.curator,
  playlist_data.followers,
  playlist_data.cost,
  jsonb_build_object('min_quality', playlist_data.min_quality),
  playlist_data.boost
FROM streaming_platforms sp
CROSS JOIN LATERAL (
  VALUES
    ('Indie Discoveries', 'editorial', 150000, 50, 60, 1.5),
    ('Rising Stars', 'algorithmic', 85000, 40, 55, 1.3),
    ('Fresh Releases', 'editorial', 200000, 60, 65, 1.8),
    ('Pop Radar', 'editorial', 300000, 75, 70, 2.0),
    ('Underground Gems', 'user', 50000, 25, 45, 1.2)
) AS playlist_data(name, curator, followers, cost, min_quality, boost)
WHERE sp.is_active = true
ON CONFLICT DO NOTHING;

-- Seed manufacturing_costs table if empty
INSERT INTO manufacturing_costs (format_type, min_quantity, max_quantity, cost_per_unit)
SELECT * FROM (
  VALUES
    ('cd', 1, 99, 20),
    ('cd', 100, 499, 15),
    ('cd', 500, NULL::INTEGER, 10),
    ('vinyl', 1, 99, 80),
    ('vinyl', 100, 499, 60),
    ('vinyl', 500, NULL::INTEGER, 40),
    ('cassette', 1, 99, 15),
    ('cassette', 100, 499, 10),
    ('cassette', 500, NULL::INTEGER, 8)
) AS costs(format_type, min_quantity, max_quantity, cost_per_unit)
WHERE NOT EXISTS (SELECT 1 FROM manufacturing_costs LIMIT 1)
ON CONFLICT DO NOTHING;
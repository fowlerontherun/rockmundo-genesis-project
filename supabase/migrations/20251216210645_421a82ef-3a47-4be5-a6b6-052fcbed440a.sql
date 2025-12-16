-- Clean up ALL release-related data for fresh testing

-- 1. Delete streaming analytics
DELETE FROM streaming_analytics_daily;

-- 2. Delete release sales
DELETE FROM release_sales;

-- 3. Delete song releases (streaming distribution records)
DELETE FROM song_releases;

-- 4. Delete release formats
DELETE FROM release_formats;

-- 5. Delete release songs
DELETE FROM release_songs;

-- 6. Delete releases
DELETE FROM releases;

-- 7. Delete chart entries
DELETE FROM chart_entries;

-- 8. Delete radio plays
DELETE FROM radio_plays;

-- 9. Delete radio playlists (songs in rotation)
DELETE FROM radio_playlists;

-- 10. Reset song hype back to base level
UPDATE songs SET hype = 0 WHERE hype > 0;
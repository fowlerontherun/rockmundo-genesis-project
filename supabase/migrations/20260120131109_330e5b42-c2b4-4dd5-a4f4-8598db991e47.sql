-- Backfill radio_playlists from accepted submissions
INSERT INTO radio_playlists (show_id, song_id, week_start_date, is_active)
SELECT DISTINCT ON (rs.id)
  rsh.id as show_id,
  rs.song_id,
  date_trunc('week', CURRENT_DATE)::date as week_start_date,
  true as is_active
FROM radio_submissions rs
JOIN radio_shows rsh ON rs.station_id = rsh.station_id AND rsh.is_active = true
WHERE rs.status = 'accepted'
  AND rs.song_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM radio_playlists rp WHERE rp.song_id = rs.song_id AND rp.show_id = rsh.id
  )
ORDER BY rs.id, rsh.id;
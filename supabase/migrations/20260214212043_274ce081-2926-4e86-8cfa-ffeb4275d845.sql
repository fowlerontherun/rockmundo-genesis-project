-- Fix: Allow 'cover' as a valid song version
ALTER TABLE songs DROP CONSTRAINT songs_version_check;
ALTER TABLE songs ADD CONSTRAINT songs_version_check CHECK (version = ANY (ARRAY['standard', 'remix', 'acoustic', 'cover']));

-- Insert the missing cover song for "Blue" by Mr. Blue
INSERT INTO songs (
  title, genre, quality_score, duration_seconds, lyrics,
  band_id, user_id, parent_song_id, ownership_type, version, status,
  added_to_repertoire_at, added_to_repertoire_by
) VALUES (
  'Blue (Cover)', 'Rock', 153, 315,
  (SELECT lyrics FROM songs WHERE id = '032912b6-a066-4da7-a2c6-e5ddfe809e4d'),
  '110e9f19-d3f4-431a-88bc-b02d4636a984',
  'eddd663a-ab81-4c39-bc03-4ac3a347095e',
  '032912b6-a066-4da7-a2c6-e5ddfe809e4d',
  'cover', 'cover', 'recorded',
  now(), 'eddd663a-ab81-4c39-bc03-4ac3a347095e'
);
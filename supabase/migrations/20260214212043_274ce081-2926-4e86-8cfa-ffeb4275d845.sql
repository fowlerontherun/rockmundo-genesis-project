-- Fix: Allow 'cover' as a valid song version
ALTER TABLE songs DROP CONSTRAINT songs_version_check;
ALTER TABLE songs ADD CONSTRAINT songs_version_check CHECK (version = ANY (ARRAY['standard', 'remix', 'acoustic', 'cover']));

-- Insert the missing cover song for "Blue" by Mr. Blue only on databases
-- that contain the original production records. Fresh/reset databases do not
-- seed these fixture-specific UUIDs, so the historical repair must be a no-op.
INSERT INTO songs (
  title, genre, quality_score, duration_seconds, lyrics,
  band_id, artist_id, parent_song_id, ownership_type, version, status,
  added_to_repertoire_at, added_to_repertoire_by
)
SELECT
  'Blue (Cover)', 'Rock', 153, 315,
  parent.lyrics,
  '110e9f19-d3f4-431a-88bc-b02d4636a984'::uuid,
  'eddd663a-ab81-4c39-bc03-4ac3a347095e'::uuid,
  parent.id,
  'cover', 'cover', 'recorded',
  now(), 'eddd663a-ab81-4c39-bc03-4ac3a347095e'::uuid
FROM songs parent
WHERE parent.id = '032912b6-a066-4da7-a2c6-e5ddfe809e4d'::uuid
  AND EXISTS (
    SELECT 1 FROM bands
    WHERE id = '110e9f19-d3f4-431a-88bc-b02d4636a984'::uuid
  )
  AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = 'eddd663a-ab81-4c39-bc03-4ac3a347095e'::uuid
  )
  AND NOT EXISTS (
    SELECT 1 FROM songs existing
    WHERE existing.parent_song_id = parent.id
      AND existing.band_id = '110e9f19-d3f4-431a-88bc-b02d4636a984'::uuid
      AND existing.version = 'cover'
  );
-- Drop the old unique constraint that only used release_id and song_id
ALTER TABLE release_songs DROP CONSTRAINT IF EXISTS release_songs_release_id_song_id_key;

-- Add new unique constraint that includes recording_version
-- This allows the same song to appear multiple times with different versions (Standard, Remix, Acoustic, etc.)
ALTER TABLE release_songs ADD CONSTRAINT release_songs_release_id_song_id_version_key 
  UNIQUE (release_id, song_id, recording_version);
-- Add release_id tracking to music_videos and radio_submissions
ALTER TABLE music_videos 
ADD COLUMN IF NOT EXISTS release_id UUID REFERENCES releases(id) ON DELETE SET NULL;

ALTER TABLE radio_submissions 
ADD COLUMN IF NOT EXISTS release_id UUID REFERENCES releases(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_music_videos_release_id ON music_videos(release_id);
CREATE INDEX IF NOT EXISTS idx_radio_submissions_release_id ON radio_submissions(release_id);

-- Update song_releases to properly track release_id if not already set
CREATE INDEX IF NOT EXISTS idx_song_releases_release_id ON song_releases(release_id);

-- Create a view for easily getting released songs
CREATE OR REPLACE VIEW released_songs AS
SELECT DISTINCT s.*, r.id as release_id, r.title as release_title, r.release_status
FROM songs s
INNER JOIN release_songs rs ON s.id = rs.song_id
INNER JOIN releases r ON rs.release_id = r.id
WHERE r.release_status = 'released'
  AND s.status IN ('recorded', 'completed');
-- Create or replace function to sync familiarity to song_rehearsals
CREATE OR REPLACE FUNCTION sync_familiarity_to_rehearsals()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update song_rehearsals based on familiarity
  INSERT INTO song_rehearsals (
    band_id,
    song_id,
    rehearsal_level,
    last_rehearsed
  )
  VALUES (
    NEW.band_id,
    NEW.song_id,
    LEAST(10, GREATEST(0, ROUND((NEW.familiarity_percentage / 100.0) * 10))),
    NEW.last_rehearsed_at
  )
  ON CONFLICT (band_id, song_id)
  DO UPDATE SET
    rehearsal_level = LEAST(10, GREATEST(
      song_rehearsals.rehearsal_level,
      ROUND((NEW.familiarity_percentage / 100.0) * 10)
    )),
    last_rehearsed = COALESCE(NEW.last_rehearsed_at, song_rehearsals.last_rehearsed);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-sync
DROP TRIGGER IF EXISTS trigger_sync_familiarity_to_rehearsals ON band_song_familiarity;
CREATE TRIGGER trigger_sync_familiarity_to_rehearsals
  AFTER INSERT OR UPDATE ON band_song_familiarity
  FOR EACH ROW
  EXECUTE FUNCTION sync_familiarity_to_rehearsals();

-- Backfill existing familiarity data to song_rehearsals
INSERT INTO song_rehearsals (band_id, song_id, rehearsal_level, last_rehearsed)
SELECT 
  band_id,
  song_id,
  LEAST(10, GREATEST(0, ROUND((familiarity_percentage / 100.0) * 10))),
  last_rehearsed_at
FROM band_song_familiarity
ON CONFLICT (band_id, song_id) DO UPDATE SET
  rehearsal_level = GREATEST(
    song_rehearsals.rehearsal_level,
    LEAST(10, ROUND((EXCLUDED.rehearsal_level)))
  );

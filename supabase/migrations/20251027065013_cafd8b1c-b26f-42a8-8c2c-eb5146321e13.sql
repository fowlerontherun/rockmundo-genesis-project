-- Add venue information to gig_outcomes for better reporting
ALTER TABLE gig_outcomes
ADD COLUMN IF NOT EXISTS venue_name TEXT,
ADD COLUMN IF NOT EXISTS venue_capacity INTEGER;

-- Add song title to gig_song_performances for easier display
ALTER TABLE gig_song_performances
ADD COLUMN IF NOT EXISTS song_title TEXT;

-- Add manufacturing completion date and scheduled release date to releases
ALTER TABLE releases
ADD COLUMN IF NOT EXISTS manufacturing_complete_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scheduled_release_date DATE;

-- Create edge function to auto-transition releases from manufacturing to released
CREATE OR REPLACE FUNCTION auto_complete_manufacturing()
RETURNS TABLE(completed_releases integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_completed INTEGER := 0;
  v_release RECORD;
BEGIN
  -- Find releases that completed manufacturing
  FOR v_release IN
    SELECT id, band_id, user_id, title
    FROM releases
    WHERE release_status = 'manufacturing'
      AND manufacturing_complete_at IS NOT NULL
      AND manufacturing_complete_at <= NOW()
      AND (scheduled_release_date IS NULL OR scheduled_release_date <= CURRENT_DATE)
  LOOP
    -- Transition to released
    UPDATE releases
    SET 
      release_status = 'released',
      updated_at = NOW()
    WHERE id = v_release.id;
    
    v_completed := v_completed + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_completed;
END;
$$;

-- Create function to validate song has recording before release
CREATE OR REPLACE FUNCTION check_song_has_recording()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_recording BOOLEAN;
BEGIN
  -- Check if song has at least one completed recording
  SELECT EXISTS(
    SELECT 1
    FROM recording_sessions
    WHERE song_id = NEW.song_id
      AND status = 'completed'
  ) INTO v_has_recording;
  
  IF NOT v_has_recording THEN
    RAISE EXCEPTION 'Song must have a completed recording before being added to a release';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce recording validation
DROP TRIGGER IF EXISTS validate_song_recording ON release_songs;
CREATE TRIGGER validate_song_recording
  BEFORE INSERT ON release_songs
  FOR EACH ROW
  EXECUTE FUNCTION check_song_has_recording();
-- Update recording validation to allow sessions with completed timestamps
CREATE OR REPLACE FUNCTION check_song_has_recording()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_recording BOOLEAN;
BEGIN
  -- Check if song has at least one completed recording session
  SELECT EXISTS(
    SELECT 1
    FROM recording_sessions
    WHERE song_id = NEW.song_id
      AND (status = 'completed' OR completed_at IS NOT NULL)
  ) INTO v_has_recording;

  IF NOT v_has_recording THEN
    RAISE EXCEPTION 'Song must have a completed recording before being added to a release';
  END IF;

  RETURN NEW;
END;
$$;

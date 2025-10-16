-- Add auto_completed field to songwriting_sessions
ALTER TABLE songwriting_sessions 
ADD COLUMN IF NOT EXISTS auto_completed BOOLEAN DEFAULT false;

-- Create function to auto-complete expired sessions and convert finished projects
CREATE OR REPLACE FUNCTION auto_complete_songwriting_sessions()
RETURNS TABLE (
  completed_sessions INTEGER,
  converted_projects INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_completed_sessions INTEGER := 0;
  v_converted_projects INTEGER := 0;
  v_session RECORD;
  v_project RECORD;
  v_music_gain INTEGER;
  v_lyrics_gain INTEGER;
  v_xp_earned INTEGER;
BEGIN
  -- Auto-complete expired sessions (locked_until has passed)
  FOR v_session IN 
    SELECT 
      s.id as session_id,
      s.project_id,
      p.id as proj_id,
      p.music_progress,
      p.lyrics_progress,
      p.total_sessions,
      p.sessions_completed,
      p.user_id
    FROM songwriting_sessions s
    JOIN songwriting_projects p ON p.id = s.project_id
    WHERE s.session_end IS NULL
      AND p.is_locked = true
      AND p.locked_until < NOW()
  LOOP
    -- Calculate progress gains (500-700 points each)
    v_music_gain := 500 + FLOOR(RANDOM() * 200);
    v_lyrics_gain := 500 + FLOOR(RANDOM() * 200);
    v_xp_earned := FLOOR((v_music_gain + v_lyrics_gain) / 10);
    
    -- Complete the session
    UPDATE songwriting_sessions
    SET 
      session_end = NOW(),
      completed_at = NOW(),
      music_progress_gained = v_music_gain,
      lyrics_progress_gained = v_lyrics_gain,
      xp_earned = v_xp_earned,
      auto_completed = true,
      notes = 'Auto-completed after 3 hours'
    WHERE id = v_session.session_id;
    
    -- Update project progress
    UPDATE songwriting_projects
    SET 
      music_progress = LEAST(2000, COALESCE(music_progress, 0) + v_music_gain),
      lyrics_progress = LEAST(2000, COALESCE(lyrics_progress, 0) + v_lyrics_gain),
      total_sessions = COALESCE(total_sessions, 0) + 1,
      sessions_completed = COALESCE(sessions_completed, 0) + 1,
      is_locked = false,
      locked_until = NULL,
      updated_at = NOW()
    WHERE id = v_session.project_id;
    
    v_completed_sessions := v_completed_sessions + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_completed_sessions, v_converted_projects;
END;
$$;
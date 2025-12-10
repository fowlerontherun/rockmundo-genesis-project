-- Fix auto_complete_songwriting_sessions function to use correct tables
CREATE OR REPLACE FUNCTION public.auto_complete_songwriting_sessions()
RETURNS TABLE(completed_sessions integer, converted_projects integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_project RECORD;
  v_session_hours numeric;
  v_songwriting_skill numeric;
  v_creativity_skill numeric;
  v_creative_attr numeric;
  v_musical_attr numeric;
  v_technical_attr numeric;
  v_time_bonus numeric;
  v_base_quality numeric;
  v_variance numeric;
  v_session_quality integer;
  v_new_project_quality integer;
  v_completed_count integer := 0;
  v_converted_count integer := 0;
BEGIN
  -- Complete expired in-progress sessions (where completed_at is NULL and locked_until has passed)
  FOR v_session IN
    SELECT 
      s.*,
      p.user_id,
      p.quality_score as project_quality,
      p.sessions_completed
    FROM songwriting_sessions s
    JOIN songwriting_projects p ON s.project_id = p.id
    WHERE s.completed_at IS NULL
      AND s.locked_until IS NOT NULL
      AND s.locked_until < NOW()
  LOOP
    -- Get user skills from player_skills table
    SELECT 
      COALESCE(songwriting, 0),
      COALESCE(creativity, 0)
    INTO v_songwriting_skill, v_creativity_skill
    FROM player_skills
    WHERE user_id = v_session.user_id;
    
    -- Get user attributes from player_attributes table
    SELECT 
      COALESCE(creative_insight, 50),
      COALESCE(musical_ability, 50),
      COALESCE(technical_mastery, 50)
    INTO v_creative_attr, v_musical_attr, v_technical_attr
    FROM player_attributes
    WHERE user_id = v_session.user_id;
    
    -- Default values if no records found
    v_songwriting_skill := COALESCE(v_songwriting_skill, 0);
    v_creativity_skill := COALESCE(v_creativity_skill, 0);
    v_creative_attr := COALESCE(v_creative_attr, 50);
    v_musical_attr := COALESCE(v_musical_attr, 50);
    v_technical_attr := COALESCE(v_technical_attr, 50);
    
    -- Calculate session hours (3 hours fixed)
    v_session_hours := 3.0;
    
    -- Attribute bonuses (0-25 scale each)
    -- Time bonus
    v_time_bonus := LEAST(20, v_session_hours * 2);
    
    -- Calculate base quality (weighted average of skills and attributes)
    v_base_quality := (
      v_songwriting_skill * 0.35 +
      v_creativity_skill * 0.25 +
      v_creative_attr * 0.15 +
      v_musical_attr * 0.15 +
      v_technical_attr * 0.10 +
      v_time_bonus
    );
    
    -- Ensure minimum quality
    v_base_quality := GREATEST(v_base_quality, 30);
    
    -- Add variance (±15%)
    v_variance := (random() - 0.5) * 0.30;
    v_session_quality := GREATEST(20, LEAST(100, ROUND((v_base_quality * (1 + v_variance))::numeric)));
    
    -- Update session with completed_at and session_end timestamps
    UPDATE songwriting_sessions
    SET 
      completed_at = NOW(),
      session_end = v_session.locked_until,
      xp_earned = FLOOR(10 + v_session_quality * 0.5)::integer,
      auto_completed = true,
      music_progress_gained = FLOOR(v_session_quality * 5)::integer,
      lyrics_progress_gained = FLOOR(v_session_quality * 5)::integer
    WHERE id = v_session.id;
    
    -- Update project quality and progress
    v_new_project_quality := ROUND(
      (COALESCE(v_session.project_quality, 0) * COALESCE(v_session.sessions_completed, 0) + v_session_quality) / 
      (COALESCE(v_session.sessions_completed, 0) + 1)
    )::integer;
    
    -- Get current project progress
    SELECT music_progress, lyrics_progress INTO v_project
    FROM songwriting_projects WHERE id = v_session.project_id;
    
    UPDATE songwriting_projects
    SET 
      quality_score = v_new_project_quality,
      sessions_completed = COALESCE(sessions_completed, 0) + 1,
      music_progress = LEAST(2000, COALESCE(v_project.music_progress, 0) + FLOOR(v_session_quality * 5)::integer),
      lyrics_progress = LEAST(2000, COALESCE(v_project.lyrics_progress, 0) + FLOOR(v_session_quality * 5)::integer),
      updated_at = NOW()
    WHERE id = v_session.project_id;
    
    v_completed_count := v_completed_count + 1;
  END LOOP;

  -- Convert completed projects to songs (progress >= 2000 for both music and lyrics)
  FOR v_project IN
    SELECT * FROM songwriting_projects
    WHERE status = 'in_progress'
      AND music_progress >= 2000
      AND lyrics_progress >= 2000
  LOOP
    UPDATE songwriting_projects
    SET status = 'completed', updated_at = NOW()
    WHERE id = v_project.id;
    
    v_converted_count := v_converted_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_completed_count, v_converted_count;
END;
$$;
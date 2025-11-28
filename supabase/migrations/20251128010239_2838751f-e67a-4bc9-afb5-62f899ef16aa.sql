-- Drop and recreate the auto_complete_songwriting_sessions function with skill-based quality calculation

CREATE OR REPLACE FUNCTION auto_complete_songwriting_sessions()
RETURNS TABLE (
  completed_sessions integer,
  converted_projects integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_project RECORD;
  v_skills jsonb;
  v_attributes jsonb;
  v_session_hours numeric;
  v_composing_skill numeric;
  v_lyrics_skill numeric;
  v_production_skill numeric;
  v_creative_bonus numeric;
  v_musical_bonus numeric;
  v_technical_bonus numeric;
  v_time_bonus numeric;
  v_base_quality numeric;
  v_variance numeric;
  v_session_quality integer;
  v_new_project_quality integer;
  v_completed_count integer := 0;
  v_converted_count integer := 0;
BEGIN
  -- Complete expired in-progress sessions
  FOR v_session IN
    SELECT 
      s.*,
      p.user_id,
      p.quality_score as project_quality,
      p.sessions_completed
    FROM songwriting_sessions s
    JOIN songwriting_projects p ON s.project_id = p.id
    WHERE s.status = 'in_progress'
      AND s.scheduled_end < NOW()
  LOOP
    -- Get user skills and attributes
    SELECT 
      COALESCE(skill_levels, '{}'::jsonb),
      COALESCE(attributes, '{"creative_insight": 50, "musical_ability": 50, "technical_mastery": 50}'::jsonb)
    INTO v_skills, v_attributes
    FROM profiles
    WHERE user_id = v_session.user_id;
    
    -- Calculate session hours
    v_session_hours := EXTRACT(EPOCH FROM (v_session.scheduled_end - v_session.scheduled_start)) / 3600.0;
    
    -- Calculate skill contributions (0-100 scale each)
    v_composing_skill := LEAST(100, 
      COALESCE((v_skills->>'songwriting_basic_composing')::numeric, 0) * 0.5 +
      COALESCE((v_skills->>'songwriting_professional_composing')::numeric, 0) * 0.75 +
      COALESCE((v_skills->>'songwriting_mastery_composing_anthems')::numeric, 0) * 1.0
    );
    
    v_lyrics_skill := LEAST(100,
      COALESCE((v_skills->>'songwriting_basic_lyrics')::numeric, 0) * 0.5 +
      COALESCE((v_skills->>'songwriting_professional_lyrics')::numeric, 0) * 0.75 +
      COALESCE((v_skills->>'songwriting_mastery_lyrics')::numeric, 0) * 1.0
    );
    
    v_production_skill := LEAST(100,
      COALESCE((v_skills->>'songwriting_basic_record_production')::numeric, 0) * 0.5 +
      COALESCE((v_skills->>'songwriting_professional_record_production')::numeric, 0) * 0.75 +
      COALESCE((v_skills->>'songwriting_mastery_record_production')::numeric, 0) * 1.0
    );
    
    -- Attribute bonuses (0-25 scale each)
    v_creative_bonus := LEAST(25, COALESCE((v_attributes->>'creative_insight')::numeric, 50) * 0.25);
    v_musical_bonus := LEAST(25, COALESCE((v_attributes->>'musical_ability')::numeric, 50) * 0.25);
    v_technical_bonus := LEAST(25, COALESCE((v_attributes->>'technical_mastery')::numeric, 50) * 0.25);
    
    -- Time bonus
    v_time_bonus := LEAST(20, v_session_hours * 2);
    
    -- Calculate base quality (weighted average)
    v_base_quality := (
      v_composing_skill * 0.30 +
      v_lyrics_skill * 0.25 +
      v_production_skill * 0.25 +
      v_creative_bonus * 0.7 +
      v_musical_bonus * 0.7 +
      v_technical_bonus * 0.6 +
      v_time_bonus
    );
    
    -- Add variance (±15%)
    v_variance := (random() - 0.5) * 0.30;
    v_session_quality := GREATEST(20, LEAST(100, ROUND((v_base_quality * (1 + v_variance))::numeric)));
    
    -- Update session
    UPDATE songwriting_sessions
    SET 
      status = 'completed',
      completed_at = NOW(),
      quality_contribution = v_session_quality,
      xp_earned = FLOOR(10 + v_session_quality * 0.5)::integer,
      auto_completed = true
    WHERE id = v_session.id;
    
    -- Update project quality (cumulative average)
    v_new_project_quality := ROUND(
      (COALESCE(v_session.project_quality, 0) * COALESCE(v_session.sessions_completed, 0) + v_session_quality) / 
      (COALESCE(v_session.sessions_completed, 0) + 1)
    )::integer;
    
    UPDATE songwriting_projects
    SET 
      quality_score = v_new_project_quality,
      sessions_completed = COALESCE(sessions_completed, 0) + 1,
      updated_at = NOW()
    WHERE id = v_session.project_id;
    
    v_completed_count := v_completed_count + 1;
  END LOOP;

  -- Auto-convert completed projects to songs (100% progress)
  FOR v_project IN
    SELECT p.*, prof.id as profile_id
    FROM songwriting_projects p
    JOIN profiles prof ON p.user_id = prof.user_id
    WHERE p.status IN ('draft', 'in_progress')
      AND COALESCE(p.music_progress, 0) >= 100
      AND COALESCE(p.lyrics_progress, 0) >= 100
      AND NOT EXISTS (
        SELECT 1 FROM songs s WHERE s.songwriting_project_id = p.id
      )
  LOOP
    -- Create song with calculated quality
    INSERT INTO songs (
      user_id,
      title,
      genre,
      lyrics,
      quality_score,
      song_rating,
      duration_seconds,
      status,
      completed_at,
      songwriting_project_id,
      catalog_status,
      streams,
      revenue
    ) VALUES (
      v_project.user_id,
      v_project.title,
      COALESCE(v_project.genres->>0, 'Rock'),
      COALESCE(v_project.initial_lyrics, ''),
      GREATEST(30, COALESCE(v_project.quality_score, 50)),
      COALESCE(v_project.song_rating, 1),
      FLOOR(140 + random() * 280)::integer, -- 2:20 to 7:00
      'draft',
      NOW(),
      v_project.id,
      'private',
      0,
      0
    );
    
    -- Mark project as completed
    UPDATE songwriting_projects
    SET status = 'completed', updated_at = NOW()
    WHERE id = v_project.id;
    
    v_converted_count := v_converted_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_completed_count, v_converted_count;
END;
$$;
-- Update the auto_complete_songwriting_sessions function to use 1-hour sessions
CREATE OR REPLACE FUNCTION public.auto_complete_songwriting_sessions()
RETURNS TABLE(completed_sessions integer, converted_projects integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_session RECORD;
    v_skills jsonb;
    v_attributes jsonb;
    v_composing_skill numeric;
    v_lyrics_skill numeric;
    v_creative_attr numeric;
    v_musical_attr numeric;
    v_technical_attr numeric;
    v_music_gain integer;
    v_lyrics_gain integer;
    v_xp_earned integer;
    v_session_hours numeric;
    v_time_bonus numeric;
    v_skill_bonus numeric;
    v_attr_bonus numeric;
    v_completed_count integer := 0;
    v_converted_count integer := 0;
    v_new_music_progress integer;
    v_new_lyrics_progress integer;
    v_is_complete boolean;
BEGIN
    -- Find sessions where the lock has expired but session_end is null
    FOR v_session IN
        SELECT 
            ss.id as session_id,
            ss.project_id,
            ss.user_id,
            ss.locked_until
        FROM songwriting_sessions ss
        JOIN songwriting_projects sp ON sp.id = ss.project_id
        WHERE ss.session_end IS NULL
        AND ss.locked_until IS NOT NULL
        AND ss.locked_until <= NOW()
    LOOP
        -- Get user skills and attributes
        SELECT 
            COALESCE(skills, '{}'::jsonb),
            COALESCE(attributes, '{}'::jsonb)
        INTO v_skills, v_attributes
        FROM profiles
        WHERE user_id = v_session.user_id;
        
        -- Calculate session hours (1 hour fixed)
        v_session_hours := 1.0;
        
        -- Calculate skill contributions (0-100 scale each)
        v_composing_skill := LEAST(100, 
            COALESCE((v_skills->>'songwriting_basic_composing')::numeric, 0) * 0.5 +
            COALESCE((v_skills->>'songwriting_advanced_composing')::numeric, 0) * 0.3 +
            COALESCE((v_skills->>'music_theory')::numeric, 0) * 0.2
        );
        
        v_lyrics_skill := LEAST(100, 
            COALESCE((v_skills->>'songwriting_basic_lyrics')::numeric, 0) * 0.5 +
            COALESCE((v_skills->>'songwriting_advanced_lyrics')::numeric, 0) * 0.3 +
            COALESCE((v_skills->>'creative_writing')::numeric, 0) * 0.2
        );
        
        -- Get attributes (0-100 scale)
        v_creative_attr := COALESCE((v_attributes->>'creative_insight')::numeric, 50);
        v_musical_attr := COALESCE((v_attributes->>'musical_ability')::numeric, 50);
        v_technical_attr := COALESCE((v_attributes->>'technical_mastery')::numeric, 50);
        
        -- Ensure defaults
        v_creative_attr := COALESCE(v_creative_attr, 50);
        v_musical_attr := COALESCE(v_musical_attr, 50);
        v_technical_attr := COALESCE(v_technical_attr, 50);
        
        -- Calculate session hours (1 hour fixed)
        v_session_hours := 1.0;
        
        -- Attribute bonuses (0-25 scale each)
        -- Time bonus
        v_time_bonus := LEAST(20, v_session_hours * 2);
        
        -- Skill bonus (0-40 based on skill levels)
        v_skill_bonus := (v_composing_skill + v_lyrics_skill) / 5;
        
        -- Attribute bonus (0-30 based on attributes)
        v_attr_bonus := (v_creative_attr + v_musical_attr + v_technical_attr) / 10;
        
        -- Calculate gains: base 500 + bonuses (still 500-700 range for 1-hour sessions)
        v_music_gain := 500 + FLOOR(v_time_bonus + v_skill_bonus * 0.6 + v_attr_bonus * 0.6 + RANDOM() * 50)::integer;
        v_lyrics_gain := 500 + FLOOR(v_time_bonus + v_skill_bonus * 0.6 + v_attr_bonus * 0.6 + RANDOM() * 50)::integer;
        
        -- Cap at 700
        v_music_gain := LEAST(700, v_music_gain);
        v_lyrics_gain := LEAST(700, v_lyrics_gain);
        
        -- XP is progress divided by 10
        v_xp_earned := (v_music_gain + v_lyrics_gain) / 10;
        
        -- Update the session
        UPDATE songwriting_sessions
        SET 
            session_end = NOW(),
            completed_at = NOW(),
            music_progress_gained = v_music_gain,
            lyrics_progress_gained = v_lyrics_gain,
            xp_earned = v_xp_earned,
            auto_completed = true,
            notes = 'Auto-completed after 1 hour'
        WHERE id = v_session.session_id;
        
        -- Update project progress
        UPDATE songwriting_projects
        SET 
            music_progress = LEAST(2000, music_progress + v_music_gain),
            lyrics_progress = LEAST(2000, lyrics_progress + v_lyrics_gain),
            sessions_completed = sessions_completed + 1,
            total_sessions = total_sessions + 1,
            is_locked = false,
            locked_until = NULL,
            updated_at = NOW()
        WHERE id = v_session.project_id
        RETURNING music_progress, lyrics_progress INTO v_new_music_progress, v_new_lyrics_progress;
        
        -- Check if project is now complete
        v_is_complete := v_new_music_progress >= 2000 AND v_new_lyrics_progress >= 2000;
        
        IF v_is_complete THEN
            UPDATE songwriting_projects
            SET status = 'completed'
            WHERE id = v_session.project_id
            AND status != 'completed';
            
            v_converted_count := v_converted_count + 1;
        END IF;
        
        v_completed_count := v_completed_count + 1;
    END LOOP;
    
    RETURN QUERY SELECT v_completed_count, v_converted_count;
END;
$$;
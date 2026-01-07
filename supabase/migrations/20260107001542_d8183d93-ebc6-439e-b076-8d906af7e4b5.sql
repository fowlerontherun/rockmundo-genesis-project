-- Fix auto_complete_songwriting_sessions to calculate quality_score
-- This addresses the bug where all songs have quality 1

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
    v_skill_bonus numeric;
    v_attr_bonus numeric;
    v_random_variance integer;
    v_completed_count integer := 0;
    v_converted_count integer := 0;
    v_new_music_progress integer;
    v_new_lyrics_progress integer;
    v_is_complete boolean;
    v_quality_score integer;
    v_current_quality integer;
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
        
        -- Skill bonus (0-40 based on skill levels)
        v_skill_bonus := (v_composing_skill + v_lyrics_skill) / 5;
        
        -- Attribute bonus (0-30 based on attributes)
        v_attr_bonus := (v_creative_attr + v_musical_attr + v_technical_attr) / 10;
        
        -- Random variance: -50 to +100 for more unpredictability
        v_random_variance := FLOOR(RANDOM() * 150 - 50)::integer;
        
        -- Calculate gains: base 500 + skill/attr bonuses + random variance
        -- This gives a range of roughly 400-700 depending on skills and luck
        v_music_gain := 500 + FLOOR(v_skill_bonus * 0.8 + v_attr_bonus * 0.6)::integer + v_random_variance;
        v_lyrics_gain := 500 + FLOOR(v_skill_bonus * 0.8 + v_attr_bonus * 0.6)::integer + FLOOR(RANDOM() * 150 - 50)::integer;
        
        -- Clamp between 400 and 700
        v_music_gain := GREATEST(400, LEAST(700, v_music_gain));
        v_lyrics_gain := GREATEST(400, LEAST(700, v_lyrics_gain));
        
        -- Calculate quality score for this session (30-100 range)
        -- Base 30 + up to 40 from skills + up to 20 from attributes + up to 10 random
        v_quality_score := 30 + 
            FLOOR(v_skill_bonus * 1.0)::integer +                    -- 0-40 from skills
            FLOOR(v_attr_bonus * 0.67)::integer +                    -- 0-20 from attributes  
            FLOOR(RANDOM() * 10)::integer;                           -- 0-10 random
        v_quality_score := GREATEST(30, LEAST(100, v_quality_score));
        
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
            notes = 'Auto-completed after 1 hour session'
        WHERE id = v_session.session_id;
        
        -- Get current project quality to keep the max
        SELECT COALESCE(quality_score, 0) INTO v_current_quality
        FROM songwriting_projects WHERE id = v_session.project_id;
        
        -- Update project progress and quality (keep highest quality achieved)
        UPDATE songwriting_projects
        SET 
            music_progress = LEAST(2000, music_progress + v_music_gain),
            lyrics_progress = LEAST(2000, lyrics_progress + v_lyrics_gain),
            quality_score = GREATEST(COALESCE(quality_score, 0), v_quality_score),
            sessions_completed = sessions_completed + 1,
            locked_until = NULL,
            updated_at = NOW()
        WHERE id = v_session.project_id
        RETURNING music_progress, lyrics_progress INTO v_new_music_progress, v_new_lyrics_progress;
        
        v_completed_count := v_completed_count + 1;
        
        -- Check if project is complete (both at 2000)
        v_is_complete := v_new_music_progress >= 2000 AND v_new_lyrics_progress >= 2000;
        
        IF v_is_complete THEN
            UPDATE songwriting_projects
            SET status = 'completed'
            WHERE id = v_session.project_id;
            
            v_converted_count := v_converted_count + 1;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_completed_count, v_converted_count;
END;
$$;
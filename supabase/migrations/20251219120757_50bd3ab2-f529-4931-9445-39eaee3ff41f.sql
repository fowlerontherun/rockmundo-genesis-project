-- Fix auto_complete_songwriting_sessions to use correct tables for skills/attributes
CREATE OR REPLACE FUNCTION public.auto_complete_songwriting_sessions()
 RETURNS TABLE(completed_sessions integer, converted_projects integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_session RECORD;
    v_profile_id uuid;
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
        -- Get profile_id for this user
        SELECT id INTO v_profile_id FROM profiles WHERE user_id = v_session.user_id;
        
        -- Calculate skill contributions from player_skills table (0-100 scale each)
        SELECT LEAST(100, 
            COALESCE(SUM(CASE WHEN skill_id LIKE '%composing%' OR skill_id LIKE '%music_theory%' THEN current_level * 10 ELSE 0 END), 0)
        ) INTO v_composing_skill
        FROM player_skills
        WHERE profile_id = v_profile_id;
        
        SELECT LEAST(100, 
            COALESCE(SUM(CASE WHEN skill_id LIKE '%lyrics%' OR skill_id LIKE '%creative_writing%' THEN current_level * 10 ELSE 0 END), 0)
        ) INTO v_lyrics_skill
        FROM player_skills
        WHERE profile_id = v_profile_id;
        
        -- Get attributes from player_attributes table (0-100 scale)
        SELECT COALESCE(value, 50) INTO v_creative_attr
        FROM player_attributes
        WHERE profile_id = v_profile_id AND attribute_name = 'creative_insight';
        
        SELECT COALESCE(value, 50) INTO v_musical_attr
        FROM player_attributes
        WHERE profile_id = v_profile_id AND attribute_name = 'musical_ability';
        
        SELECT COALESCE(value, 50) INTO v_technical_attr
        FROM player_attributes
        WHERE profile_id = v_profile_id AND attribute_name = 'technical_mastery';
        
        -- Default values if null
        v_composing_skill := COALESCE(v_composing_skill, 0);
        v_lyrics_skill := COALESCE(v_lyrics_skill, 0);
        v_creative_attr := COALESCE(v_creative_attr, 50);
        v_musical_attr := COALESCE(v_musical_attr, 50);
        v_technical_attr := COALESCE(v_technical_attr, 50);
        
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
        
        -- Update project progress
        UPDATE songwriting_projects
        SET 
            music_progress = LEAST(2000, music_progress + v_music_gain),
            lyrics_progress = LEAST(2000, lyrics_progress + v_lyrics_gain),
            sessions_completed = sessions_completed + 1,
            locked_until = NULL,
            updated_at = NOW()
        WHERE id = v_session.project_id
        RETURNING music_progress, lyrics_progress INTO v_new_music_progress, v_new_lyrics_progress;
        
        v_completed_count := v_completed_count + 1;
        
        -- Check if project is now complete (both at 2000)
        v_is_complete := (v_new_music_progress >= 2000 AND v_new_lyrics_progress >= 2000);
        
        IF v_is_complete THEN
            -- Mark project as completed
            UPDATE songwriting_projects
            SET 
                status = 'completed',
                completed_at = NOW()
            WHERE id = v_session.project_id;
            
            v_converted_count := v_converted_count + 1;
        END IF;
    END LOOP;
    
    completed_sessions := v_completed_count;
    converted_projects := v_converted_count;
    RETURN NEXT;
END;
$function$;
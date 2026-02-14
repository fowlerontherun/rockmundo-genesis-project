
-- Add instruments column to songwriting_projects
ALTER TABLE public.songwriting_projects 
ADD COLUMN IF NOT EXISTS instruments text[] DEFAULT '{}';

-- Update auto_complete_songwriting_sessions to use 0-1000 scale and factor in instruments
CREATE OR REPLACE FUNCTION public.auto_complete_songwriting_sessions()
RETURNS TABLE(completed_sessions integer, converted_projects integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_session RECORD;
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
    v_profile_id uuid;
    v_breakthrough_roll numeric;
    v_breakthrough_threshold numeric;
    v_breakthrough_multiplier numeric;
    v_songs_written integer;
    v_experience_bonus numeric;
    v_instrument_bonus numeric;
    v_instrument_slug text;
    v_instrument_level numeric;
    v_instrument_count integer;
    v_project_instruments text[];
BEGIN
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
        SELECT id INTO v_profile_id
        FROM profiles
        WHERE user_id = v_session.user_id
        LIMIT 1;
        
        SELECT COALESCE(current_level, 0) INTO v_composing_skill
        FROM skill_progress
        WHERE profile_id = v_profile_id AND skill_slug = 'songwriting';
        v_composing_skill := COALESCE(v_composing_skill, 0);
        
        SELECT COALESCE(current_level, 0) INTO v_lyrics_skill
        FROM skill_progress
        WHERE profile_id = v_profile_id AND skill_slug = 'vocals';
        v_lyrics_skill := COALESCE(v_lyrics_skill, 0);
        
        SELECT 
            COALESCE(creative_insight, 50),
            COALESCE(musical_ability, 50),
            COALESCE(technical_mastery, 50)
        INTO v_creative_attr, v_musical_attr, v_technical_attr
        FROM player_attributes
        WHERE profile_id = v_profile_id;
        
        v_creative_attr := COALESCE(v_creative_attr, 50);
        v_musical_attr := COALESCE(v_musical_attr, 50);
        v_technical_attr := COALESCE(v_technical_attr, 50);
        
        SELECT COUNT(*) INTO v_songs_written
        FROM songs
        WHERE user_id = v_session.user_id
        AND status IN ('completed', 'recorded', 'released');
        v_songs_written := COALESCE(v_songs_written, 0);
        
        v_experience_bonus := LEAST(30, SQRT(v_songs_written) * 6);
        
        -- Get instruments from the project
        SELECT COALESCE(instruments, '{}') INTO v_project_instruments
        FROM songwriting_projects WHERE id = v_session.project_id;
        
        -- Calculate instrument skill bonus (sum skill levels of selected instruments)
        v_instrument_bonus := 0;
        v_instrument_count := 0;
        IF array_length(v_project_instruments, 1) IS NOT NULL THEN
            FOREACH v_instrument_slug IN ARRAY v_project_instruments
            LOOP
                SELECT COALESCE(current_level, 0) INTO v_instrument_level
                FROM skill_progress
                WHERE profile_id = v_profile_id AND skill_slug = v_instrument_slug;
                v_instrument_level := COALESCE(v_instrument_level, 0);
                
                v_instrument_count := v_instrument_count + 1;
                -- Each instrument contributes up to 30 points, with diminishing returns after 4
                IF v_instrument_count <= 4 THEN
                    v_instrument_bonus := v_instrument_bonus + LEAST(30, v_instrument_level * 1.5);
                ELSE
                    v_instrument_bonus := v_instrument_bonus + LEAST(15, v_instrument_level * 0.75);
                END IF;
            END LOOP;
        END IF;
        
        v_skill_bonus := LEAST(50, (v_composing_skill + v_lyrics_skill) * 2.5);
        v_attr_bonus := (v_creative_attr + v_musical_attr + v_technical_attr) / 10;
        
        v_breakthrough_threshold := 0.15 + (v_composing_skill + v_lyrics_skill) * 0.005;
        v_breakthrough_roll := RANDOM();
        
        IF v_breakthrough_roll < v_breakthrough_threshold THEN
            v_breakthrough_multiplier := 1.8 + RANDOM() * 0.7;
        ELSIF v_breakthrough_roll > 0.92 THEN
            v_breakthrough_multiplier := 0.4 + RANDOM() * 0.2;
        ELSE
            v_breakthrough_multiplier := 0.85 + RANDOM() * 0.30;
        END IF;
        
        v_random_variance := FLOOR(RANDOM() * 230 - 80)::integer;
        
        v_music_gain := FLOOR((400 + v_skill_bonus * 1.2 + v_attr_bonus * 0.8 + v_experience_bonus + v_random_variance) * v_breakthrough_multiplier)::integer;
        v_lyrics_gain := FLOOR((400 + v_skill_bonus * 1.2 + v_attr_bonus * 0.8 + v_experience_bonus + FLOOR(RANDOM() * 230 - 80)::integer) * v_breakthrough_multiplier)::integer;
        
        v_music_gain := GREATEST(200, LEAST(1200, v_music_gain));
        v_lyrics_gain := GREATEST(200, LEAST(1200, v_lyrics_gain));
        
        -- Quality score now on 0-1000 scale
        -- Base: 100, Skills: 0-300, Attributes: 0-180, Instruments: 0-200, Experience: 0-120, Random: -40 to +140
        v_quality_score := 100 + 
            FLOOR(v_skill_bonus * 6)::integer +                        -- 0-300 from skills
            FLOOR(v_attr_bonus * 6)::integer +                         -- 0-180 from attributes
            FLOOR(v_instrument_bonus)::integer +                       -- 0-200 from instruments
            FLOOR(RANDOM() * 180 - 40)::integer +                      -- -40 to +140 random
            FLOOR(LEAST(120, SQRT(v_songs_written) * 20))::integer;    -- 0-120 experience bonus
        v_quality_score := GREATEST(50, LEAST(1000, v_quality_score));
        
        v_xp_earned := (v_music_gain + v_lyrics_gain) / 10;
        
        UPDATE songwriting_sessions
        SET 
            session_end = NOW(),
            completed_at = NOW(),
            music_progress_gained = v_music_gain,
            lyrics_progress_gained = v_lyrics_gain,
            xp_earned = v_xp_earned,
            auto_completed = true,
            notes = CASE 
                WHEN v_breakthrough_multiplier >= 1.8 THEN 'Breakthrough session! Creative lightning struck!'
                WHEN v_breakthrough_multiplier <= 0.6 THEN 'Creative block - struggled through the session'
                ELSE 'Auto-completed after session'
            END
        WHERE id = v_session.session_id;
        
        SELECT COALESCE(quality_score, 0) INTO v_current_quality
        FROM songwriting_projects WHERE id = v_session.project_id;
        
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

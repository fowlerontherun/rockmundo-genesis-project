DROP FUNCTION IF EXISTS auto_complete_songwriting_sessions();
DROP FUNCTION IF EXISTS auto_complete_songwriting_sessions(OUT integer, OUT integer);

CREATE OR REPLACE FUNCTION auto_complete_songwriting_sessions()
RETURNS TABLE(completed integer, converted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    v_raw_quality numeric;
    v_diminishing_quality numeric;
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
        
        v_experience_bonus := LEAST(50, SQRT(v_songs_written) * 4);
        
        SELECT COALESCE(instruments, '{}') INTO v_project_instruments
        FROM songwriting_projects WHERE id = v_session.project_id;
        
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
                IF v_instrument_count <= 3 THEN
                    v_instrument_bonus := v_instrument_bonus + LEAST(20, v_instrument_level * 1.0);
                ELSE
                    v_instrument_bonus := v_instrument_bonus + LEAST(10, v_instrument_level * 0.5);
                END IF;
            END LOOP;
        END IF;
        
        -- Skills: max 40 * 4 = 160
        v_skill_bonus := LEAST(40, (v_composing_skill + v_lyrics_skill) * 2.0);
        -- Attributes: max ~25 * 3 = 75
        v_attr_bonus := (v_creative_attr + v_musical_attr + v_technical_attr) / 12;
        
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
        
        -- QUALITY on 0-1000 with SOFT CAP above 500
        -- Max linear raw ≈ 585 for fully maxed player with perfect luck
        -- Average maxed ≈ 520
        -- Soft cap: above 500, diminishing returns via hyperbolic curve
        -- raw 520 → ~510, raw 600 → ~550, raw 700 → ~600, raw 1000 → ~750
        -- 1000 is virtually unreachable from songwriting alone
        v_raw_quality := 80 + 
            (v_skill_bonus * 4)::numeric +
            (v_attr_bonus * 3)::numeric +
            v_instrument_bonus +
            (RANDOM() * 130 - 30)::numeric +
            LEAST(50, SQRT(v_songs_written) * 4)::numeric;
        
        IF v_raw_quality <= 500 THEN
            v_diminishing_quality := v_raw_quality;
        ELSE
            v_diminishing_quality := 500 + ((v_raw_quality - 500) * 500) / (v_raw_quality - 500 + 500);
        END IF;
        
        v_quality_score := GREATEST(50, LEAST(1000, FLOOR(v_diminishing_quality)::integer));
        
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
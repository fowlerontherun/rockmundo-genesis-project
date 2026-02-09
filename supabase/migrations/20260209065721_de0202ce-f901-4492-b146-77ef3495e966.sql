-- Enhanced auto_complete_songwriting_sessions with:
-- 1. Wider progress range (250-900 instead of 400-700) for more variable session counts
-- 2. "Breakthrough" chance where a session gives massive progress (skill-based)
-- 3. Higher skill players get bigger base gains = fewer sessions needed
-- 4. Experience bonus: count of previous completed songs boosts quality
-- 5. More random variance in quality calculation

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
        SELECT id INTO v_profile_id
        FROM profiles
        WHERE user_id = v_session.user_id
        LIMIT 1;
        
        -- Get skill levels from skill_progress table (default 0 if not found)
        SELECT COALESCE(current_level, 0) INTO v_composing_skill
        FROM skill_progress
        WHERE profile_id = v_profile_id AND skill_slug = 'songwriting';
        v_composing_skill := COALESCE(v_composing_skill, 0);
        
        SELECT COALESCE(current_level, 0) INTO v_lyrics_skill
        FROM skill_progress
        WHERE profile_id = v_profile_id AND skill_slug = 'vocals';
        v_lyrics_skill := COALESCE(v_lyrics_skill, 0);
        
        -- Get attributes from player_attributes table (default 50 if not found)
        SELECT 
            COALESCE(creative_insight, 50),
            COALESCE(musical_ability, 50),
            COALESCE(technical_mastery, 50)
        INTO v_creative_attr, v_musical_attr, v_technical_attr
        FROM player_attributes
        WHERE profile_id = v_profile_id;
        
        -- Default values if no player_attributes row exists
        v_creative_attr := COALESCE(v_creative_attr, 50);
        v_musical_attr := COALESCE(v_musical_attr, 50);
        v_technical_attr := COALESCE(v_technical_attr, 50);
        
        -- Count previously completed songs for experience bonus
        SELECT COUNT(*) INTO v_songs_written
        FROM songs
        WHERE user_id = v_session.user_id
        AND status IN ('completed', 'recorded', 'released');
        v_songs_written := COALESCE(v_songs_written, 0);
        
        -- Experience bonus: sqrt curve, caps at 30 extra progress
        v_experience_bonus := LEAST(30, SQRT(v_songs_written) * 6);
        
        -- Skill bonus (0-50 based on skill levels, max level 20 each)
        v_skill_bonus := LEAST(50, (v_composing_skill + v_lyrics_skill) * 2.5);
        
        -- Attribute bonus (0-30 based on attributes, each is 0-100)
        v_attr_bonus := (v_creative_attr + v_musical_attr + v_technical_attr) / 10;
        
        -- === BREAKTHROUGH MECHANIC ===
        -- Higher skills = higher chance of breakthrough session (15% base, up to 35%)
        v_breakthrough_threshold := 0.15 + (v_composing_skill + v_lyrics_skill) * 0.005;
        v_breakthrough_roll := RANDOM();
        
        IF v_breakthrough_roll < v_breakthrough_threshold THEN
            -- Breakthrough! Session gives 1.8-2.5x progress
            v_breakthrough_multiplier := 1.8 + RANDOM() * 0.7;
        ELSIF v_breakthrough_roll > 0.92 THEN
            -- 8% chance of creative block: session gives 0.4-0.6x progress
            v_breakthrough_multiplier := 0.4 + RANDOM() * 0.2;
        ELSE
            -- Normal session: 0.85-1.15x variance
            v_breakthrough_multiplier := 0.85 + RANDOM() * 0.30;
        END IF;
        
        -- Random variance: wider range -80 to +150
        v_random_variance := FLOOR(RANDOM() * 230 - 80)::integer;
        
        -- Calculate gains: base 400 + skill/attr/experience bonuses + random variance
        -- Then multiply by breakthrough factor
        -- This gives a much wider range: ~200-1000+ depending on luck and skills
        v_music_gain := FLOOR((400 + v_skill_bonus * 1.2 + v_attr_bonus * 0.8 + v_experience_bonus + v_random_variance) * v_breakthrough_multiplier)::integer;
        v_lyrics_gain := FLOOR((400 + v_skill_bonus * 1.2 + v_attr_bonus * 0.8 + v_experience_bonus + FLOOR(RANDOM() * 230 - 80)::integer) * v_breakthrough_multiplier)::integer;
        
        -- Clamp between 200 and 1200 (wider range for more variable session counts)
        v_music_gain := GREATEST(200, LEAST(1200, v_music_gain));
        v_lyrics_gain := GREATEST(200, LEAST(1200, v_lyrics_gain));
        
        -- Calculate quality score for this session (25-100 range, wider variance)
        -- More songs written = better quality floor
        v_quality_score := 25 + 
            FLOOR(v_skill_bonus * 0.9)::integer +                     -- 0-45 from skills
            FLOOR(v_attr_bonus * 0.6)::integer +                      -- 0-18 from attributes  
            FLOOR(RANDOM() * 18 - 4)::integer +                       -- -4 to +14 random (wider swing)
            FLOOR(LEAST(15, SQRT(v_songs_written) * 3))::integer;     -- 0-15 experience bonus
        v_quality_score := GREATEST(20, LEAST(100, v_quality_score));
        
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
            notes = CASE 
                WHEN v_breakthrough_multiplier >= 1.8 THEN 'Breakthrough session! Creative lightning struck!'
                WHEN v_breakthrough_multiplier <= 0.6 THEN 'Creative block - struggled through the session'
                ELSE 'Auto-completed after session'
            END
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
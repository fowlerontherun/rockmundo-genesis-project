-- Fix stuck songwriting sessions that have locked_until in the past but were never completed
-- This will complete those sessions and update project progress

DO $$
DECLARE
    v_session RECORD;
    v_music_gain integer;
    v_lyrics_gain integer;
    v_xp_earned integer;
    v_fixed_count integer := 0;
    v_new_music_progress integer;
    v_new_lyrics_progress integer;
BEGIN
    -- Find all stuck sessions (locked_until passed but session_end is null)
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
        AND ss.locked_until < NOW() - INTERVAL '1 minute'
    LOOP
        -- Calculate random but reasonable gains
        v_music_gain := 450 + FLOOR(RANDOM() * 150)::integer;
        v_lyrics_gain := 450 + FLOOR(RANDOM() * 150)::integer;
        v_xp_earned := (v_music_gain + v_lyrics_gain) / 10;
        
        -- Complete the session
        UPDATE songwriting_sessions
        SET 
            session_end = v_session.locked_until,
            completed_at = v_session.locked_until,
            music_progress_gained = v_music_gain,
            lyrics_progress_gained = v_lyrics_gain,
            xp_earned = v_xp_earned,
            auto_completed = true,
            notes = 'Auto-completed by migration fix'
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
        
        -- If project is now complete, mark it
        IF v_new_music_progress >= 2000 AND v_new_lyrics_progress >= 2000 THEN
            UPDATE songwriting_projects
            SET status = 'ready_for_completion'
            WHERE id = v_session.project_id
            AND status != 'completed';
        END IF;
        
        v_fixed_count := v_fixed_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Fixed % stuck songwriting sessions', v_fixed_count;
END $$;
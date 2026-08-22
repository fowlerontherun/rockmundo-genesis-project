-- Fix stuck songwriting sessions that have locked_until in the past but were never completed.
-- This was a one-off repair for a legacy songwriting schema. Fresh databases can have
-- the canonical songwriting tables without all of these historical repair columns, so
-- only execute the repair when that exact legacy shape is present.

DO $$
DECLARE
    v_session_columns integer;
    v_project_columns integer;
BEGIN
    IF to_regclass('public.songwriting_sessions') IS NULL
       OR to_regclass('public.songwriting_projects') IS NULL THEN
        RAISE NOTICE 'Skipping legacy stuck-songwriting repair; expected legacy tables are not present';
        RETURN;
    END IF;

    SELECT count(*)
    INTO v_session_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'songwriting_sessions'
      AND column_name = ANY (ARRAY[
          'id',
          'project_id',
          'locked_until',
          'session_end',
          'completed_at',
          'music_progress_gained',
          'lyrics_progress_gained',
          'xp_earned',
          'auto_completed',
          'notes'
      ]);

    SELECT count(*)
    INTO v_project_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'songwriting_projects'
      AND column_name = ANY (ARRAY[
          'id',
          'music_progress',
          'lyrics_progress',
          'sessions_completed',
          'locked_until',
          'updated_at',
          'status'
      ]);

    IF v_session_columns <> 10 OR v_project_columns <> 7 THEN
        RAISE NOTICE 'Skipping legacy stuck-songwriting repair; expected legacy columns are not present';
        RETURN;
    END IF;

    -- Keep the legacy statements behind dynamic SQL so PostgreSQL does not resolve
    -- removed columns while parsing this migration on a fresh canonical database.
    EXECUTE $repair$
        DO $legacy_repair$
        DECLARE
            v_session RECORD;
            v_music_gain integer;
            v_lyrics_gain integer;
            v_xp_earned integer;
            v_fixed_count integer := 0;
            v_new_music_progress integer;
            v_new_lyrics_progress integer;
        BEGIN
            FOR v_session IN
                SELECT
                    ss.id AS session_id,
                    ss.project_id,
                    ss.locked_until
                FROM public.songwriting_sessions ss
                JOIN public.songwriting_projects sp ON sp.id = ss.project_id
                WHERE ss.session_end IS NULL
                  AND ss.locked_until IS NOT NULL
                  AND ss.locked_until < NOW() - INTERVAL '1 minute'
            LOOP
                v_music_gain := 450 + FLOOR(RANDOM() * 150)::integer;
                v_lyrics_gain := 450 + FLOOR(RANDOM() * 150)::integer;
                v_xp_earned := (v_music_gain + v_lyrics_gain) / 10;

                UPDATE public.songwriting_sessions
                SET
                    session_end = v_session.locked_until,
                    completed_at = v_session.locked_until,
                    music_progress_gained = v_music_gain,
                    lyrics_progress_gained = v_lyrics_gain,
                    xp_earned = v_xp_earned,
                    auto_completed = true,
                    notes = 'Auto-completed by migration fix'
                WHERE id = v_session.session_id;

                UPDATE public.songwriting_projects
                SET
                    music_progress = LEAST(2000, music_progress + v_music_gain),
                    lyrics_progress = LEAST(2000, lyrics_progress + v_lyrics_gain),
                    sessions_completed = sessions_completed + 1,
                    locked_until = NULL,
                    updated_at = NOW()
                WHERE id = v_session.project_id
                RETURNING music_progress, lyrics_progress
                INTO v_new_music_progress, v_new_lyrics_progress;

                IF v_new_music_progress >= 2000 AND v_new_lyrics_progress >= 2000 THEN
                    UPDATE public.songwriting_projects
                    SET status = 'ready_for_completion'
                    WHERE id = v_session.project_id
                      AND status != 'completed';
                END IF;

                v_fixed_count := v_fixed_count + 1;
            END LOOP;

            RAISE NOTICE 'Fixed % stuck songwriting sessions', v_fixed_count;
        END
        $legacy_repair$;
    $repair$;
END $$;
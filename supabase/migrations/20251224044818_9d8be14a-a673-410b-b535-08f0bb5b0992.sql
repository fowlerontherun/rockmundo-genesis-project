-- Make producer_id nullable to support self-produce option
ALTER TABLE recording_sessions ALTER COLUMN producer_id DROP NOT NULL;

-- Add comment explaining the null case
COMMENT ON COLUMN recording_sessions.producer_id IS 'NULL when self-producing (no external producer)';

-- This migration originally installed a songwriting-project -> song bridge for an
-- older schema where songs were owned through songs.user_id. The canonical schema
-- no longer has that shape. Keep the historical repair available only when every
-- legacy column it needs is present; otherwise leave the current songwriting system
-- untouched. The legacy SQL is dynamic so removed columns are not resolved by the
-- PostgreSQL parser on a fresh database.
DO $$
DECLARE
  v_song_columns integer;
  v_project_columns integer;
BEGIN
  IF to_regclass('public.songs') IS NULL
     OR to_regclass('public.songwriting_projects') IS NULL THEN
    RAISE NOTICE 'Skipping legacy completed-project song bridge; legacy tables are not present';
    RETURN;
  END IF;

  SELECT count(*)
  INTO v_song_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'songs'
    AND column_name = ANY (ARRAY[
      'id',
      'user_id',
      'title',
      'genre',
      'lyrics',
      'quality_score',
      'song_rating',
      'duration_seconds',
      'status',
      'completed_at',
      'songwriting_project_id',
      'catalog_status',
      'streams',
      'revenue'
    ]);

  SELECT count(*)
  INTO v_project_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'songwriting_projects'
    AND column_name = ANY (ARRAY[
      'id',
      'user_id',
      'status',
      'quality_score',
      'title',
      'genres',
      'initial_lyrics',
      'song_rating'
    ]);

  IF v_song_columns <> 14 OR v_project_columns <> 8 THEN
    RAISE NOTICE 'Skipping legacy completed-project song bridge; expected legacy columns are not present';
    RETURN;
  END IF;

  EXECUTE $legacy$
    CREATE OR REPLACE FUNCTION public.create_song_from_completed_project()
    RETURNS TRIGGER AS $function$
    DECLARE
      existing_song_id uuid;
      duration_seconds int;
      song_quality int;
    BEGIN
      -- Only trigger when status changes to 'completed'
      IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Check if song already exists for this project
        SELECT id INTO existing_song_id
        FROM public.songs
        WHERE songwriting_project_id = NEW.id;

        IF existing_song_id IS NULL THEN
          -- Generate random duration between 2:20 and 7:00 (140-420 seconds)
          duration_seconds := floor(random() * (420 - 140 + 1) + 140)::int;

          -- Use project quality_score with minimum threshold
          song_quality := GREATEST(30, COALESCE(NEW.quality_score, 50));

          -- Create new song from completed project
          INSERT INTO public.songs (
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
            NEW.user_id,
            NEW.title,
            COALESCE(NEW.genres[1], 'Rock'),
            COALESCE(NEW.initial_lyrics, ''),
            song_quality,
            COALESCE(NEW.song_rating, 1),
            duration_seconds,
            'draft',
            NOW(),
            NEW.id,
            'private',
            0,
            0
          );
        ELSE
          -- Update existing song to draft status
          UPDATE public.songs
          SET status = 'draft',
              completed_at = NOW()
          WHERE id = existing_song_id;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $function$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

    DROP TRIGGER IF EXISTS on_songwriting_project_complete ON public.songwriting_projects;
    CREATE TRIGGER on_songwriting_project_complete
      AFTER UPDATE ON public.songwriting_projects
      FOR EACH ROW
      EXECUTE FUNCTION public.create_song_from_completed_project();

    -- Backfill: Create songs for already-completed projects that don't have songs
    INSERT INTO public.songs (
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
    )
    SELECT
      sp.user_id,
      sp.title,
      COALESCE(sp.genres[1], 'Rock'),
      COALESCE(sp.initial_lyrics, ''),
      GREATEST(30, COALESCE(sp.quality_score, 50)),
      COALESCE(sp.song_rating, 1),
      floor(random() * (420 - 140 + 1) + 140)::int,
      'draft',
      NOW(),
      sp.id,
      'private',
      0,
      0
    FROM public.songwriting_projects sp
    LEFT JOIN public.songs s ON s.songwriting_project_id = sp.id
    WHERE sp.status = 'completed' AND s.id IS NULL;
  $legacy$;
END $$;
-- Fix the create_song_from_completed_project trigger function
-- Issue: It was using non-existent 'recording_project_id' column instead of 'songwriting_project_id'
-- Also missing user_id which is NOT NULL

CREATE OR REPLACE FUNCTION public.create_song_from_completed_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_song_id uuid;
  duration_seconds int;
  song_quality int;
  song_genre text;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Check if song already exists for this project (use correct column name)
    SELECT id INTO existing_song_id FROM public.songs WHERE songwriting_project_id = NEW.id;
    
    IF existing_song_id IS NULL THEN
      -- Calculate duration (3-5 minutes in seconds)
      duration_seconds := 180 + floor(random() * 120)::int;
      
      -- Calculate quality based on project metrics
      song_quality := LEAST(100, GREATEST(1, 
        COALESCE(NEW.overall_quality, 50) + 
        floor(random() * 10)::int - 5
      ));
      
      -- Extract genre from creative_brief JSONB first, fallback to genres array, then 'Rock'
      song_genre := COALESCE(
        NEW.creative_brief->>'genre',
        NEW.genres[1],
        'Rock'
      );
      
      -- Create the song with correct column name and include user_id
      INSERT INTO public.songs (
        user_id,
        band_id,
        title,
        genre,
        duration_seconds,
        quality,
        songwriting_project_id,
        is_recorded,
        status,
        lyrics,
        composition_data,
        created_at
      ) VALUES (
        NEW.user_id,
        NEW.band_id,
        NEW.song_title,
        song_genre,
        duration_seconds,
        song_quality,
        NEW.id,
        true,
        'recorded',
        NEW.creative_brief->>'lyrics',
        jsonb_build_object(
          'tempo', COALESCE((NEW.creative_brief->>'tempo')::int, 120),
          'key', COALESCE(NEW.creative_brief->>'key', 'C'),
          'mood', COALESCE(NEW.creative_brief->>'mood', 'energetic')
        ),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger to ensure it's properly attached
DROP TRIGGER IF EXISTS on_songwriting_project_completed ON public.songwriting_projects;

CREATE TRIGGER on_songwriting_project_completed
  AFTER UPDATE ON public.songwriting_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_song_from_completed_project();
-- Fix song genre extraction from creative_brief instead of genres array
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
    -- Check if song already exists for this project
    SELECT id INTO existing_song_id FROM public.songs WHERE recording_project_id = NEW.id;
    
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
      
      -- Create the song
      INSERT INTO public.songs (
        band_id,
        title,
        genre,
        duration_seconds,
        quality,
        recording_project_id,
        is_recorded,
        status,
        lyrics,
        composition_data,
        created_at
      ) VALUES (
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
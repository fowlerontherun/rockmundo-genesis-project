-- Fix the create_song_from_completed_project trigger function
-- Use 'draft' status as that's a valid value for songs table

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
  project_band_id uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Check if song already exists for this project
    SELECT id INTO existing_song_id FROM public.songs WHERE songwriting_project_id = NEW.id;
    
    IF existing_song_id IS NULL THEN
      -- Calculate duration (3-5 minutes in seconds)
      duration_seconds := 180 + floor(random() * 120)::int;
      
      -- Calculate quality based on project metrics
      song_quality := LEAST(100, GREATEST(1, 
        COALESCE(NEW.quality_score, 50) + 
        floor(random() * 10)::int - 5
      ));
      
      -- Extract genre from creative_brief JSONB first, fallback to genres array, then 'Rock'
      song_genre := COALESCE(
        NEW.creative_brief->>'genre',
        NEW.genres[1],
        'Rock'
      );
      
      -- Get band_id from the user's active band
      SELECT b.id INTO project_band_id
      FROM public.bands b
      JOIN public.band_members bm ON bm.band_id = b.id
      WHERE bm.user_id = NEW.user_id 
        AND bm.role = 'leader'
        AND b.status = 'active'
      LIMIT 1;
      
      -- Create the song with 'draft' status (valid values: draft, recorded, released)
      INSERT INTO public.songs (
        user_id,
        band_id,
        title,
        genre,
        duration_seconds,
        quality_score,
        songwriting_project_id,
        status,
        lyrics,
        created_at
      ) VALUES (
        NEW.user_id,
        project_band_id,
        NEW.title,
        song_genre,
        duration_seconds,
        song_quality,
        NEW.id,
        'draft',
        COALESCE(NEW.lyrics, NEW.creative_brief->>'lyrics'),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
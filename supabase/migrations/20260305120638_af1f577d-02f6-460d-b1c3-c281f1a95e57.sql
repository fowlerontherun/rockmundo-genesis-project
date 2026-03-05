-- Backfill songs with null band_id where the user has an active band membership
UPDATE songs s
SET band_id = (
  SELECT bm.band_id
  FROM band_members bm
  JOIN bands b ON b.id = bm.band_id AND b.status = 'active'
  WHERE bm.user_id = s.user_id
  AND bm.member_status = 'active'
  ORDER BY bm.joined_at ASC
  LIMIT 1
)
WHERE s.band_id IS NULL
AND s.status IN ('recorded', 'released', 'draft', 'completed', 'mastered')
AND EXISTS (
  SELECT 1 FROM band_members bm 
  JOIN bands b ON b.id = bm.band_id AND b.status = 'active'
  WHERE bm.user_id = s.user_id 
  AND bm.member_status = 'active'
);

-- Fix the create_song_from_completed_project trigger to also check for 'Founder' role
CREATE OR REPLACE FUNCTION public.create_song_from_completed_project()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_song_id uuid;
  duration_seconds int;
  song_quality int;
  song_genre text;
  project_band_id uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT id INTO existing_song_id FROM public.songs WHERE songwriting_project_id = NEW.id;
    
    IF existing_song_id IS NULL THEN
      duration_seconds := 180 + floor(random() * 120)::int;
      
      song_quality := LEAST(1000, GREATEST(50, 
        COALESCE(NEW.quality_score, 50) + 
        floor(random() * 50)::int - 25
      ));
      
      song_genre := COALESCE(
        NEW.creative_brief->>'genre',
        NEW.genres[1],
        'Rock'
      );
      
      -- Check for leader OR Founder role
      SELECT b.id INTO project_band_id
      FROM public.bands b
      JOIN public.band_members bm ON bm.band_id = b.id
      WHERE bm.user_id = NEW.user_id 
        AND bm.role IN ('leader', 'Founder')
        AND b.status = 'active'
      LIMIT 1;
      
      -- Fallback: any active band membership
      IF project_band_id IS NULL THEN
        SELECT b.id INTO project_band_id
        FROM public.bands b
        JOIN public.band_members bm ON bm.band_id = b.id
        WHERE bm.user_id = NEW.user_id 
          AND bm.member_status = 'active'
          AND b.status = 'active'
        ORDER BY bm.joined_at ASC
        LIMIT 1;
      END IF;
      
      INSERT INTO public.songs (
        user_id, band_id, title, genre, duration_seconds,
        quality_score, songwriting_project_id, status, lyrics, created_at
      ) VALUES (
        NEW.user_id, project_band_id, NEW.title, song_genre, duration_seconds,
        song_quality, NEW.id, 'draft',
        COALESCE(NEW.lyrics, NEW.creative_brief->>'lyrics'), NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
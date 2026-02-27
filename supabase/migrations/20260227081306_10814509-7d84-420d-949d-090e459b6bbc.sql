-- Fix 1: Add UPDATE RLS policy on label_upgrades
CREATE POLICY "Users can update upgrades for labels they own"
ON label_upgrades
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM labels
    WHERE labels.id = label_upgrades.label_id
    AND labels.owner_id IN (
      SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM labels
    WHERE labels.id = label_upgrades.label_id
    AND labels.owner_id IN (
      SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
    )
  )
);

-- Fix 2: Drop duplicate trigger
DROP TRIGGER IF EXISTS on_songwriting_project_complete ON songwriting_projects;

-- Fix 3: Replace the function to use 0-1000 scale instead of capping at 100
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
      
      -- Use project quality_score directly (0-1000 scale) with small variance
      song_quality := LEAST(1000, GREATEST(50, 
        COALESCE(NEW.quality_score, 50) + 
        floor(random() * 50)::int - 25
      ));
      
      song_genre := COALESCE(
        NEW.creative_brief->>'genre',
        NEW.genres[1],
        'Rock'
      );
      
      SELECT b.id INTO project_band_id
      FROM public.bands b
      JOIN public.band_members bm ON bm.band_id = b.id
      WHERE bm.user_id = NEW.user_id 
        AND bm.role = 'leader'
        AND b.status = 'active'
      LIMIT 1;
      
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

-- Fix 4: Retroactively fix songs that were capped at 100
UPDATE songs s
SET quality_score = LEAST(1000, GREATEST(50, 
  COALESCE(sp.quality_score, 50) + floor(random() * 50)::int - 25
))
FROM songwriting_projects sp
WHERE s.songwriting_project_id = sp.id
AND s.quality_score <= 100
AND sp.quality_score > 100;
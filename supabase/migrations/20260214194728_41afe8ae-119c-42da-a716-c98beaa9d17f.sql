-- Re-value all song quality_scores with variance based on band member skill levels
-- Step 1: Create a temporary function to calculate new quality with variance
CREATE OR REPLACE FUNCTION public.revalue_song_quality()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  song_rec RECORD;
  band_skill_level NUMERIC;
  base_quality NUMERIC;
  variance_pct NUMERIC;
  new_quality INTEGER;
BEGIN
  FOR song_rec IN 
    SELECT s.id, s.band_id, s.quality_score
    FROM songs s
  LOOP
    -- Get highest songwriting skill from band members
    SELECT COALESCE(MAX(sp.current_level), 0) INTO band_skill_level
    FROM band_members bm
    JOIN profiles p ON p.user_id = bm.user_id
    LEFT JOIN skill_progress sp ON sp.profile_id = p.id AND sp.skill_slug = 'songwriting'
    WHERE bm.band_id = song_rec.band_id
      AND bm.user_id IS NOT NULL;

    -- Base quality: scale by skill. Level 0 = 150-350 range, level 4 = 350-600 range
    -- Formula: base = 150 + (band_skill_level * 50) + random offset
    base_quality := 150 + (band_skill_level * 50);
    
    -- Add random variance: ±30% spread to create variety
    variance_pct := (random() * 0.6) - 0.3; -- -30% to +30%
    new_quality := GREATEST(50, LEAST(850, 
      ROUND(base_quality + (base_quality * variance_pct) + (random() * 47) - 23)
    ));
    
    -- Update the song
    UPDATE songs SET quality_score = new_quality WHERE id = song_rec.id;
  END LOOP;
END;
$$;

-- Execute the revaluation
SELECT revalue_song_quality();

-- Clean up the function
DROP FUNCTION public.revalue_song_quality();
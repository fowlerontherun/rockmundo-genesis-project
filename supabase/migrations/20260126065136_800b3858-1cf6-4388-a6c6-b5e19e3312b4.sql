-- Backfill missing familiarity records from completed rehearsals (past 14 days)
-- This fixes rehearsals that failed to update due to invalid rehearsal_stage values

DO $$
DECLARE
  r RECORD;
  song_record RECORD;
  current_minutes INTEGER;
  new_minutes INTEGER;
  minutes_per_song INTEGER;
  song_count INTEGER;
  calc_stage TEXT;
  processed_count INTEGER := 0;
BEGIN
  -- Process single-song rehearsals with missing familiarity
  FOR r IN 
    SELECT DISTINCT br.id, br.band_id, br.selected_song_id, br.duration_hours, br.scheduled_end
    FROM band_rehearsals br
    LEFT JOIN band_song_familiarity bsf ON bsf.song_id = br.selected_song_id AND bsf.band_id = br.band_id
    WHERE br.status = 'completed'
    AND br.scheduled_end > NOW() - INTERVAL '14 days'
    AND br.selected_song_id IS NOT NULL
    AND bsf.id IS NULL
  LOOP
    minutes_per_song := FLOOR(r.duration_hours * 60);
    
    -- Calculate correct stage
    IF minutes_per_song >= 1800 THEN calc_stage := 'perfected';
    ELSIF minutes_per_song >= 900 THEN calc_stage := 'well_rehearsed';
    ELSIF minutes_per_song >= 300 THEN calc_stage := 'familiar';
    ELSIF minutes_per_song >= 60 THEN calc_stage := 'learning';
    ELSE calc_stage := 'unlearned';
    END IF;
    
    INSERT INTO band_song_familiarity (band_id, song_id, familiarity_minutes, rehearsal_stage, last_rehearsed_at, updated_at)
    VALUES (r.band_id, r.selected_song_id, minutes_per_song, calc_stage, r.scheduled_end, NOW())
    ON CONFLICT (band_id, song_id) DO UPDATE SET
      familiarity_minutes = band_song_familiarity.familiarity_minutes + EXCLUDED.familiarity_minutes,
      rehearsal_stage = CASE
        WHEN band_song_familiarity.familiarity_minutes + EXCLUDED.familiarity_minutes >= 1800 THEN 'perfected'
        WHEN band_song_familiarity.familiarity_minutes + EXCLUDED.familiarity_minutes >= 900 THEN 'well_rehearsed'
        WHEN band_song_familiarity.familiarity_minutes + EXCLUDED.familiarity_minutes >= 300 THEN 'familiar'
        WHEN band_song_familiarity.familiarity_minutes + EXCLUDED.familiarity_minutes >= 60 THEN 'learning'
        ELSE 'unlearned'
      END,
      last_rehearsed_at = GREATEST(band_song_familiarity.last_rehearsed_at, EXCLUDED.last_rehearsed_at),
      updated_at = NOW();
    
    processed_count := processed_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Processed % single-song rehearsals', processed_count;
  
  -- Reset counter for setlist rehearsals
  processed_count := 0;
  
  -- Process setlist rehearsals
  FOR r IN 
    SELECT DISTINCT br.id, br.band_id, br.setlist_id, br.duration_hours, br.scheduled_end
    FROM band_rehearsals br
    WHERE br.status = 'completed'
    AND br.scheduled_end > NOW() - INTERVAL '14 days'
    AND br.setlist_id IS NOT NULL
  LOOP
    -- Get song count for this setlist
    SELECT COUNT(*) INTO song_count FROM setlist_songs WHERE setlist_id = r.setlist_id AND song_id IS NOT NULL;
    
    IF song_count > 0 THEN
      minutes_per_song := FLOOR((r.duration_hours * 60) / song_count);
      
      -- Process each song in the setlist
      FOR song_record IN 
        SELECT song_id FROM setlist_songs WHERE setlist_id = r.setlist_id AND song_id IS NOT NULL
      LOOP
        -- Get current familiarity
        SELECT COALESCE(familiarity_minutes, 0) INTO current_minutes 
        FROM band_song_familiarity 
        WHERE band_id = r.band_id AND song_id = song_record.song_id;
        
        IF current_minutes IS NULL THEN current_minutes := 0; END IF;
        new_minutes := current_minutes + minutes_per_song;
        
        -- Calculate correct stage
        IF new_minutes >= 1800 THEN calc_stage := 'perfected';
        ELSIF new_minutes >= 900 THEN calc_stage := 'well_rehearsed';
        ELSIF new_minutes >= 300 THEN calc_stage := 'familiar';
        ELSIF new_minutes >= 60 THEN calc_stage := 'learning';
        ELSE calc_stage := 'unlearned';
        END IF;
        
        INSERT INTO band_song_familiarity (band_id, song_id, familiarity_minutes, rehearsal_stage, last_rehearsed_at, updated_at)
        VALUES (r.band_id, song_record.song_id, new_minutes, calc_stage, r.scheduled_end, NOW())
        ON CONFLICT (band_id, song_id) DO UPDATE SET
          familiarity_minutes = EXCLUDED.familiarity_minutes,
          rehearsal_stage = EXCLUDED.rehearsal_stage,
          last_rehearsed_at = GREATEST(band_song_familiarity.last_rehearsed_at, EXCLUDED.last_rehearsed_at),
          updated_at = NOW();
      END LOOP;
      
      processed_count := processed_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Processed % setlist rehearsals', processed_count;
END $$;
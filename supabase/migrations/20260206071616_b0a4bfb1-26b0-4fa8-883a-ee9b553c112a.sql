-- Create database trigger to automatically update band_song_familiarity on rehearsal completion
-- This is a SECURITY DEFINER function that bypasses RLS

CREATE OR REPLACE FUNCTION update_song_familiarity_on_rehearsal_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_duration_minutes INTEGER;
  v_setlist_song RECORD;
  v_song_count INTEGER;
  v_minutes_per_song INTEGER;
  v_current_minutes INTEGER;
  v_new_minutes INTEGER;
  v_stage TEXT;
BEGIN
  -- Only run when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    
    -- Calculate duration in minutes from scheduled times
    v_duration_minutes := GREATEST(
      COALESCE(NEW.familiarity_gained, 0),
      EXTRACT(EPOCH FROM (NEW.scheduled_end - NEW.scheduled_start)) / 60
    );
    
    -- Ensure we have at least some duration
    IF v_duration_minutes <= 0 THEN
      v_duration_minutes := 60; -- Default to 1 hour if calculation fails
    END IF;
    
    RAISE NOTICE '[RehearsalTrigger] Processing rehearsal %, duration: % mins', NEW.id, v_duration_minutes;
    
    -- Handle single song rehearsal
    IF NEW.selected_song_id IS NOT NULL THEN
      -- Get current familiarity
      SELECT familiarity_minutes INTO v_current_minutes
      FROM band_song_familiarity
      WHERE band_id = NEW.band_id AND song_id = NEW.selected_song_id;
      
      v_current_minutes := COALESCE(v_current_minutes, 0);
      v_new_minutes := v_current_minutes + v_duration_minutes;
      
      -- Calculate stage (aligned with 6h = Perfected)
      v_stage := CASE 
        WHEN v_new_minutes >= 360 THEN 'perfected'
        WHEN v_new_minutes >= 300 THEN 'well_rehearsed'
        WHEN v_new_minutes >= 180 THEN 'familiar'
        WHEN v_new_minutes >= 60 THEN 'learning'
        ELSE 'unlearned'
      END;
      
      RAISE NOTICE '[RehearsalTrigger] Single song %: % -> % mins (%)', 
        NEW.selected_song_id, v_current_minutes, v_new_minutes, v_stage;
      
      -- Upsert familiarity
      INSERT INTO band_song_familiarity (band_id, song_id, familiarity_minutes, rehearsal_stage, last_rehearsed_at, updated_at)
      VALUES (NEW.band_id, NEW.selected_song_id, v_new_minutes, v_stage, NOW(), NOW())
      ON CONFLICT (band_id, song_id) DO UPDATE SET
        familiarity_minutes = EXCLUDED.familiarity_minutes,
        rehearsal_stage = EXCLUDED.rehearsal_stage,
        last_rehearsed_at = EXCLUDED.last_rehearsed_at,
        updated_at = EXCLUDED.updated_at;
        
    -- Handle setlist rehearsal
    ELSIF NEW.setlist_id IS NOT NULL THEN
      -- Count songs in setlist
      SELECT COUNT(*) INTO v_song_count
      FROM setlist_songs 
      WHERE setlist_id = NEW.setlist_id AND song_id IS NOT NULL;
      
      IF v_song_count > 0 THEN
        v_minutes_per_song := v_duration_minutes / v_song_count;
        
        RAISE NOTICE '[RehearsalTrigger] Setlist % with % songs, % mins each', 
          NEW.setlist_id, v_song_count, v_minutes_per_song;
        
        FOR v_setlist_song IN 
          SELECT song_id FROM setlist_songs 
          WHERE setlist_id = NEW.setlist_id AND song_id IS NOT NULL
        LOOP
          -- Get current familiarity for this song
          SELECT familiarity_minutes INTO v_current_minutes
          FROM band_song_familiarity
          WHERE band_id = NEW.band_id AND song_id = v_setlist_song.song_id;
          
          v_current_minutes := COALESCE(v_current_minutes, 0);
          v_new_minutes := v_current_minutes + v_minutes_per_song;
          
          -- Calculate stage
          v_stage := CASE 
            WHEN v_new_minutes >= 360 THEN 'perfected'
            WHEN v_new_minutes >= 300 THEN 'well_rehearsed'
            WHEN v_new_minutes >= 180 THEN 'familiar'
            WHEN v_new_minutes >= 60 THEN 'learning'
            ELSE 'unlearned'
          END;
          
          -- Upsert familiarity
          INSERT INTO band_song_familiarity (band_id, song_id, familiarity_minutes, rehearsal_stage, last_rehearsed_at, updated_at)
          VALUES (NEW.band_id, v_setlist_song.song_id, v_new_minutes, v_stage, NOW(), NOW())
          ON CONFLICT (band_id, song_id) DO UPDATE SET
            familiarity_minutes = EXCLUDED.familiarity_minutes,
            rehearsal_stage = EXCLUDED.rehearsal_stage,
            last_rehearsed_at = EXCLUDED.last_rehearsed_at,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if present, then create
DROP TRIGGER IF EXISTS trg_update_familiarity_on_rehearsal_complete ON band_rehearsals;

CREATE TRIGGER trg_update_familiarity_on_rehearsal_complete
  AFTER UPDATE ON band_rehearsals
  FOR EACH ROW
  EXECUTE FUNCTION update_song_familiarity_on_rehearsal_complete();

-- Also handle INSERT for cases where rehearsals are created already completed
CREATE TRIGGER trg_update_familiarity_on_rehearsal_insert
  AFTER INSERT ON band_rehearsals
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION update_song_familiarity_on_rehearsal_complete();

-- Backfill: Update familiarity for all recent completed rehearsals that may have been missed
-- This processes rehearsals from the last 14 days
DO $$
DECLARE
  v_rehearsal RECORD;
  v_duration_minutes INTEGER;
  v_setlist_song RECORD;
  v_song_count INTEGER;
  v_minutes_per_song INTEGER;
  v_current_minutes INTEGER;
  v_new_minutes INTEGER;
  v_stage TEXT;
  v_processed INTEGER := 0;
BEGIN
  FOR v_rehearsal IN 
    SELECT * FROM band_rehearsals 
    WHERE status = 'completed' 
      AND completed_at >= NOW() - INTERVAL '14 days'
    ORDER BY completed_at ASC
  LOOP
    v_duration_minutes := GREATEST(
      COALESCE(v_rehearsal.familiarity_gained, 0),
      EXTRACT(EPOCH FROM (v_rehearsal.scheduled_end - v_rehearsal.scheduled_start)) / 60
    );
    
    IF v_duration_minutes <= 0 THEN
      v_duration_minutes := 60;
    END IF;
    
    -- Process single song
    IF v_rehearsal.selected_song_id IS NOT NULL THEN
      SELECT familiarity_minutes INTO v_current_minutes
      FROM band_song_familiarity
      WHERE band_id = v_rehearsal.band_id AND song_id = v_rehearsal.selected_song_id;
      
      -- Only update if not already updated (familiarity is less than expected)
      v_current_minutes := COALESCE(v_current_minutes, 0);
      v_new_minutes := v_current_minutes + v_duration_minutes;
      
      v_stage := CASE 
        WHEN v_new_minutes >= 360 THEN 'perfected'
        WHEN v_new_minutes >= 300 THEN 'well_rehearsed'
        WHEN v_new_minutes >= 180 THEN 'familiar'
        WHEN v_new_minutes >= 60 THEN 'learning'
        ELSE 'unlearned'
      END;
      
      INSERT INTO band_song_familiarity (band_id, song_id, familiarity_minutes, rehearsal_stage, last_rehearsed_at, updated_at)
      VALUES (v_rehearsal.band_id, v_rehearsal.selected_song_id, v_new_minutes, v_stage, COALESCE(v_rehearsal.completed_at, NOW()), NOW())
      ON CONFLICT (band_id, song_id) DO UPDATE SET
        familiarity_minutes = GREATEST(band_song_familiarity.familiarity_minutes, EXCLUDED.familiarity_minutes),
        rehearsal_stage = EXCLUDED.rehearsal_stage,
        last_rehearsed_at = GREATEST(band_song_familiarity.last_rehearsed_at, EXCLUDED.last_rehearsed_at),
        updated_at = NOW();
      
      v_processed := v_processed + 1;
      
    -- Process setlist
    ELSIF v_rehearsal.setlist_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_song_count
      FROM setlist_songs 
      WHERE setlist_id = v_rehearsal.setlist_id AND song_id IS NOT NULL;
      
      IF v_song_count > 0 THEN
        v_minutes_per_song := v_duration_minutes / v_song_count;
        
        FOR v_setlist_song IN 
          SELECT song_id FROM setlist_songs 
          WHERE setlist_id = v_rehearsal.setlist_id AND song_id IS NOT NULL
        LOOP
          SELECT familiarity_minutes INTO v_current_minutes
          FROM band_song_familiarity
          WHERE band_id = v_rehearsal.band_id AND song_id = v_setlist_song.song_id;
          
          v_current_minutes := COALESCE(v_current_minutes, 0);
          v_new_minutes := v_current_minutes + v_minutes_per_song;
          
          v_stage := CASE 
            WHEN v_new_minutes >= 360 THEN 'perfected'
            WHEN v_new_minutes >= 300 THEN 'well_rehearsed'
            WHEN v_new_minutes >= 180 THEN 'familiar'
            WHEN v_new_minutes >= 60 THEN 'learning'
            ELSE 'unlearned'
          END;
          
          INSERT INTO band_song_familiarity (band_id, song_id, familiarity_minutes, rehearsal_stage, last_rehearsed_at, updated_at)
          VALUES (v_rehearsal.band_id, v_setlist_song.song_id, v_new_minutes, v_stage, COALESCE(v_rehearsal.completed_at, NOW()), NOW())
          ON CONFLICT (band_id, song_id) DO UPDATE SET
            familiarity_minutes = GREATEST(band_song_familiarity.familiarity_minutes, EXCLUDED.familiarity_minutes),
            rehearsal_stage = EXCLUDED.rehearsal_stage,
            last_rehearsed_at = GREATEST(band_song_familiarity.last_rehearsed_at, EXCLUDED.last_rehearsed_at),
            updated_at = NOW();
        END LOOP;
        
        v_processed := v_processed + 1;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Backfilled % rehearsals', v_processed;
END $$;

-- Backfill: Create missing schedule entries for existing tour gigs
INSERT INTO player_scheduled_activities (
  user_id, profile_id, activity_type, scheduled_start, scheduled_end,
  title, linked_gig_id, status, metadata
)
SELECT DISTINCT
  bm.user_id,
  p.id as profile_id,
  'gig',
  g.scheduled_date,
  g.scheduled_date + INTERVAL '4 hours',
  COALESCE('Tour: ' || t.name || ' - ' || v.name, 'Tour Gig'),
  g.id,
  CASE WHEN g.status = 'completed' THEN 'completed' ELSE 'scheduled' END,
  jsonb_build_object('tourId', t.id, 'isTourGig', true, 'band_id', g.band_id, 'venueId', v.id)
FROM gigs g
JOIN tours t ON t.id = g.tour_id
JOIN venues v ON v.id = g.venue_id
JOIN band_members bm ON bm.band_id = g.band_id 
  AND COALESCE(bm.member_status, 'active') = 'active' 
  AND COALESCE(bm.is_touring_member, false) = false
  AND bm.user_id IS NOT NULL
JOIN profiles p ON p.user_id = bm.user_id
WHERE g.tour_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM player_scheduled_activities psa 
    WHERE psa.linked_gig_id = g.id AND psa.user_id = bm.user_id
  );
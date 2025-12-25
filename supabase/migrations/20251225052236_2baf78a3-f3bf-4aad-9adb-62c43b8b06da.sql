-- Make user_id nullable in song_releases since band releases may not have a user_id directly
ALTER TABLE public.song_releases ALTER COLUMN user_id DROP NOT NULL;

-- Manually distribute songs from released albums that have pending streaming platforms
DO $$
DECLARE
  r RECORD;
  p_id uuid;
  rs RECORD;
  platform_name text;
  dist_count integer := 0;
  owner_user_id uuid;
BEGIN
  -- Loop through releases that have streaming platforms set
  FOR r IN 
    SELECT id, user_id, band_id, streaming_platforms
    FROM releases 
    WHERE release_status = 'released' 
    AND streaming_platforms IS NOT NULL 
    AND array_length(streaming_platforms, 1) > 0
  LOOP
    -- Get user_id - either from release or from band leader
    owner_user_id := r.user_id;
    IF owner_user_id IS NULL AND r.band_id IS NOT NULL THEN
      SELECT leader_id INTO owner_user_id FROM bands WHERE id = r.band_id;
    END IF;
    
    -- For each platform
    FOREACH p_id IN ARRAY r.streaming_platforms
    LOOP
      -- Get platform name
      SELECT sp.platform_name INTO platform_name
      FROM streaming_platforms sp WHERE sp.id = p_id;
      
      -- For each song in the release
      FOR rs IN 
        SELECT song_id FROM release_songs WHERE release_id = r.id
      LOOP
        -- Check if not already distributed
        IF NOT EXISTS (
          SELECT 1 FROM song_releases 
          WHERE song_id = rs.song_id AND platform_id = p_id
        ) THEN
          -- Insert the song release
          INSERT INTO song_releases (
            song_id, platform_id, platform_name, release_id, 
            user_id, band_id, release_date, release_type, 
            is_active, total_streams, total_revenue
          ) VALUES (
            rs.song_id, p_id, platform_name, r.id,
            owner_user_id, r.band_id, now(), 'streaming',
            true, 0, 0
          );
          dist_count := dist_count + 1;
        END IF;
      END LOOP;
    END LOOP;
    
    -- Clear streaming_platforms after distribution
    UPDATE releases SET streaming_platforms = '{}' WHERE id = r.id;
  END LOOP;
  
  RAISE NOTICE 'Distributed % songs to streaming platforms', dist_count;
END;
$$;
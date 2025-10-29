-- Add timing columns to gigs table for real-time tracking
ALTER TABLE gigs
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_song_position INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS setlist_duration_minutes INTEGER;

-- Add realtime tracking to gig_song_performances
ALTER TABLE gig_song_performances
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Create function to calculate setlist duration based on songs
CREATE OR REPLACE FUNCTION calculate_setlist_duration(p_setlist_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total_seconds INTEGER;
BEGIN
  SELECT COALESCE(SUM(COALESCE(ss.duration_seconds, s.duration_seconds, 180)), 0)
  INTO v_total_seconds
  FROM setlist_songs ss
  INNER JOIN songs s ON s.id = ss.song_id
  WHERE ss.setlist_id = p_setlist_id;
  
  -- Convert to minutes and round up
  RETURN CEIL(v_total_seconds / 60.0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to auto-start gigs at scheduled time
CREATE OR REPLACE FUNCTION auto_start_scheduled_gigs()
RETURNS void AS $$
DECLARE
  v_gig RECORD;
  v_duration INTEGER;
BEGIN
  -- Find gigs that should start now
  FOR v_gig IN 
    SELECT g.id, g.setlist_id, g.scheduled_date, g.slot_start_time
    FROM gigs g
    WHERE g.status = 'scheduled'
      AND g.started_at IS NULL
      AND g.setlist_id IS NOT NULL
      -- Gig should have started (scheduled time has passed)
      AND g.scheduled_date <= NOW()
  LOOP
    -- Calculate setlist duration
    v_duration := calculate_setlist_duration(v_gig.setlist_id);
    
    -- Start the gig
    UPDATE gigs
    SET 
      status = 'in_progress',
      started_at = NOW(),
      current_song_position = 0,
      setlist_duration_minutes = v_duration
    WHERE id = v_gig.id;
    
    RAISE NOTICE 'Started gig % at %', v_gig.id, NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to advance to next song in gig
CREATE OR REPLACE FUNCTION advance_gig_song(p_gig_id UUID)
RETURNS void AS $$
DECLARE
  v_gig RECORD;
  v_next_song RECORD;
  v_total_songs INTEGER;
BEGIN
  -- Get current gig state
  SELECT id, band_id, setlist_id, current_song_position, started_at, setlist_duration_minutes
  INTO v_gig
  FROM gigs
  WHERE id = p_gig_id AND status = 'in_progress';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found or not in progress';
  END IF;
  
  -- Get total songs in setlist
  SELECT COUNT(*) INTO v_total_songs
  FROM setlist_songs
  WHERE setlist_id = v_gig.setlist_id;
  
  -- Check if we've finished all songs
  IF v_gig.current_song_position >= v_total_songs THEN
    -- Complete the gig
    UPDATE gigs
    SET 
      status = 'ready_for_completion',
      completed_at = NOW()
    WHERE id = p_gig_id;
    
    RETURN;
  END IF;
  
  -- Advance to next song
  UPDATE gigs
  SET current_song_position = current_song_position + 1
  WHERE id = p_gig_id;
  
  RAISE NOTICE 'Advanced gig % to song %', p_gig_id, v_gig.current_song_position + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable realtime for gigs table
ALTER TABLE gigs REPLICA IDENTITY FULL;

-- Enable realtime for gig_song_performances
ALTER TABLE gig_song_performances REPLICA IDENTITY FULL;
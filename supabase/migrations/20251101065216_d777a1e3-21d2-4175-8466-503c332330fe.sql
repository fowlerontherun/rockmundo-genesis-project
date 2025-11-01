-- Create function to auto-start scheduled gigs
CREATE OR REPLACE FUNCTION auto_start_scheduled_gigs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update gigs that are scheduled and past their start time
  UPDATE gigs
  SET 
    status = 'in_progress',
    started_at = NOW()
  WHERE 
    status = 'scheduled'
    AND scheduled_date <= NOW()
    AND started_at IS NULL;
END;
$$;

-- Create function to advance to next song in a gig
CREATE OR REPLACE FUNCTION advance_gig_song(p_gig_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE gigs
  SET current_song_position = COALESCE(current_song_position, 0) + 1
  WHERE id = p_gig_id;
END;
$$;
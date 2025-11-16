-- Add scheduled departure time to player_travel_history
ALTER TABLE player_travel_history 
ADD COLUMN IF NOT EXISTS scheduled_departure_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled'));

-- Create function to check if user is currently traveling
CREATE OR REPLACE FUNCTION is_user_traveling(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM player_travel_history
    WHERE user_id = p_user_id
    AND status = 'in_progress'
    AND arrival_time > now()
  );
END;
$$;

-- Create function to block actions while traveling
CREATE OR REPLACE FUNCTION check_not_traveling()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_user_traveling(auth.uid()) THEN
    RAISE EXCEPTION 'Cannot perform this action while traveling';
  END IF;
  RETURN NEW;
END;
$$;

-- Apply triggers to block critical actions while traveling
-- Gigs
DROP TRIGGER IF EXISTS prevent_gig_booking_while_traveling ON gigs;
CREATE TRIGGER prevent_gig_booking_while_traveling
  BEFORE INSERT ON gigs
  FOR EACH ROW
  EXECUTE FUNCTION check_not_traveling();

-- Rehearsals
DROP TRIGGER IF EXISTS prevent_rehearsal_while_traveling ON band_rehearsals;
CREATE TRIGGER prevent_rehearsal_while_traveling
  BEFORE INSERT ON band_rehearsals
  FOR EACH ROW
  EXECUTE FUNCTION check_not_traveling();

-- Song releases
DROP TRIGGER IF EXISTS prevent_release_while_traveling ON song_releases;
CREATE TRIGGER prevent_release_while_traveling
  BEFORE INSERT ON song_releases
  FOR EACH ROW
  EXECUTE FUNCTION check_not_traveling();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_travel_status_user ON player_travel_history(user_id, status, arrival_time) WHERE status = 'in_progress';
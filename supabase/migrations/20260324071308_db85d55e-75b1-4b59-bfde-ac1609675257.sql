-- Fix: Allow scheduling future activities while currently traveling
-- Only block if the activity's scheduled time overlaps with travel

CREATE OR REPLACE FUNCTION check_not_traveling()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_start TIMESTAMPTZ;
BEGIN
  -- Try to get the scheduled start time from the new row
  -- Different tables use different column names
  IF TG_TABLE_NAME = 'band_rehearsals' THEN
    v_activity_start := NEW.scheduled_start;
  ELSIF TG_TABLE_NAME = 'gigs' THEN
    v_activity_start := NEW.scheduled_start;
  ELSE
    -- For tables without a scheduled_start, check if currently traveling
    IF is_user_traveling(auth.uid()) THEN
      RAISE EXCEPTION 'Cannot perform this action while traveling';
    END IF;
    RETURN NEW;
  END IF;

  -- If the activity is scheduled for a time when the user will still be traveling, block it
  IF EXISTS (
    SELECT 1 FROM player_travel_history
    WHERE user_id = auth.uid()
    AND status = 'in_progress'
    AND arrival_time > v_activity_start
  ) THEN
    RAISE EXCEPTION 'Cannot schedule this activity during travel. You will still be traveling at that time.';
  END IF;

  RETURN NEW;
END;
$$;
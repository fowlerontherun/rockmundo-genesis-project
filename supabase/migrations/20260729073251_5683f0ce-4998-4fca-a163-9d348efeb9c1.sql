CREATE OR REPLACE FUNCTION public.check_not_traveling()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_activity_start TIMESTAMPTZ;
BEGIN
  IF TG_TABLE_NAME = 'band_rehearsals' THEN
    v_activity_start := NEW.scheduled_start;
  ELSIF TG_TABLE_NAME = 'gigs' THEN
    v_activity_start := NEW.scheduled_date;
  ELSE
    IF is_user_traveling(auth.uid()) THEN
      RAISE EXCEPTION 'Cannot perform this action while traveling';
    END IF;
    RETURN NEW;
  END IF;

  IF v_activity_start IS NOT NULL AND EXISTS (
    SELECT 1 FROM player_travel_history
    WHERE user_id = auth.uid()
      AND status = 'in_progress'
      AND arrival_time > v_activity_start
  ) THEN
    RAISE EXCEPTION 'Cannot schedule this activity during travel. You will still be traveling at that time.';
  END IF;

  RETURN NEW;
END;
$function$;
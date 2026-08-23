-- Prevent direct/client schedule writes from bypassing an active Festival Mode
-- reservation. Matching Festival performance rows are the only permitted overlap.

CREATE OR REPLACE FUNCTION public._enforce_festival_attendance_schedule_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_festival_edition_id uuid;
BEGIN
  IF NEW.status NOT IN ('scheduled', 'in_progress')
     OR NEW.activity_type = 'festival_attendance' THEN
    RETURN NEW;
  END IF;

  SELECT (lock.metadata->>'festival_edition_id')::uuid
    INTO v_festival_edition_id
  FROM public.player_scheduled_activities lock
  WHERE lock.profile_id = NEW.profile_id
    AND lock.activity_type = 'festival_attendance'
    AND lock.status = 'in_progress'
    AND lock.id IS DISTINCT FROM NEW.id
    AND lock.scheduled_start < NEW.scheduled_end
    AND lock.scheduled_end > NEW.scheduled_start
  ORDER BY lock.scheduled_start
  LIMIT 1;

  IF v_festival_edition_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.activity_type IN ('festival_performance', 'gig')
     AND (
       NEW.metadata->>'festival_edition_id' = v_festival_edition_id::text
       OR NEW.metadata->>'canonical_edition_id' = v_festival_edition_id::text
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'festival_attendance_schedule_locked' USING ERRCODE = 'P0001';
END;
$function$;

REVOKE ALL ON FUNCTION public._enforce_festival_attendance_schedule_reservation()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._enforce_festival_attendance_schedule_reservation()
  TO service_role;

DROP TRIGGER IF EXISTS enforce_festival_attendance_schedule_reservation
  ON public.player_scheduled_activities;
CREATE TRIGGER enforce_festival_attendance_schedule_reservation
BEFORE INSERT OR UPDATE OF profile_id, activity_type, scheduled_start, scheduled_end, status, metadata
ON public.player_scheduled_activities
FOR EACH ROW
EXECUTE FUNCTION public._enforce_festival_attendance_schedule_reservation();

COMMENT ON FUNCTION public._enforce_festival_attendance_schedule_reservation() IS
  'Rejects overlapping normal schedule rows while Festival Mode owns the character schedule; matching Festival performances are permitted.';

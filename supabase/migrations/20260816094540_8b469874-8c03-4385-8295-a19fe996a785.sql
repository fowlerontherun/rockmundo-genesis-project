CREATE OR REPLACE FUNCTION public.festival_enforce_stage_slot_timetable_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tz text;
  v_local_start time;
  v_local_end time;
  v_minutes integer;
BEGIN
  IF COALESCE(NEW.slot_type, 'performance') NOT IN ('performance', 'headline', 'band') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.status, '') IN ('cancelled', 'withdrawn') THEN
    RETURN NEW;
  END IF;

  IF NEW.start_time IS NULL OR NEW.end_time IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.timezone INTO v_tz
  FROM public.festival_editions e
  WHERE e.id = NEW.edition_id;

  v_tz := COALESCE(NULLIF(v_tz, ''), 'UTC');
  v_local_start := (NEW.start_time AT TIME ZONE v_tz)::time;
  v_local_end := (NEW.end_time AT TIME ZONE v_tz)::time;
  v_minutes := (EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60)::integer;

  IF v_local_start < time '13:00' THEN
    RAISE EXCEPTION 'FESTIVAL_TIMETABLE_WINDOW: performance slots cannot start before 13:00 local time (got %)', v_local_start
      USING ERRCODE = '23514';
  END IF;

  IF v_local_end > time '22:00' THEN
    RAISE EXCEPTION 'FESTIVAL_TIMETABLE_WINDOW: performance slots cannot end after 22:00 local time (got %)', v_local_end
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(NEW.headline_eligible, false) THEN
    IF v_minutes < 60 OR v_minutes > 90 THEN
      RAISE EXCEPTION 'FESTIVAL_TIMETABLE_DURATION: headline performance slots must be 60-90 minutes (got %)', v_minutes
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF v_minutes < 40 OR v_minutes > 50 THEN
      RAISE EXCEPTION 'FESTIVAL_TIMETABLE_DURATION: performance slots must be 40-50 minutes (got %)', v_minutes
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS festival_stage_slots_timetable_rules ON public.festival_stage_slots;
CREATE TRIGGER festival_stage_slots_timetable_rules
BEFORE INSERT OR UPDATE OF slot_type, start_time, end_time, headline_eligible, status, edition_id
ON public.festival_stage_slots
FOR EACH ROW EXECUTE FUNCTION public.festival_enforce_stage_slot_timetable_rules();
-- Phase 4: fail-closed local DJ operating-hours guard for internal bookings.
-- Free-text windows are not universally valid; ambiguous or missing hours
-- are ineligible until explicitly normalized by a club administrator.
-- This leaves all existing bookings and legacy DJ actions untouched.

CREATE OR REPLACE FUNCTION public.dj_clock_minutes(p_clock text)
RETURNS integer
LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token text := lower(btrim(p_clock));
  v_hour integer;
  v_meridiem text;
BEGIN
  IF v_token = 'midnight' THEN RETURN 0; END IF;
  IF v_token = 'noon' THEN RETURN 720; END IF;
  IF v_token !~ '^(0?[1-9]|1[0-2])(am|pm)$' THEN RETURN NULL; END IF;
  v_hour := (substring(v_token FROM '^[0-9]+'))::integer;
  v_meridiem := right(v_token,2);
  IF v_hour=12 THEN v_hour:=0; END IF;
  RETURN (v_hour + CASE WHEN v_meridiem='pm' THEN 12 ELSE 0 END)*60;
END;
$$;

CREATE OR REPLACE FUNCTION public.dj_booking_inside_club_hours(
  p_club_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_schedule text;
  v_zone text;
  v_tokens text[];
  v_open integer;
  v_close integer;
  v_span integer;
  v_local_start timestamp;
  v_local_end timestamp;
  v_open_at timestamp;
  v_close_at timestamp;
  v_day_offset integer;
BEGIN
  IF p_club_id IS NULL OR p_starts_at IS NULL OR p_ends_at IS NULL
    OR p_ends_at <= p_starts_at
  THEN RETURN false; END IF;

  SELECT lower(regexp_replace(coalesce(n.dj_slot_config->>'schedule',''),
     '[[:space:]]+','','g')), c.timezone
    INTO v_schedule,v_zone
  FROM public.city_night_clubs n
  JOIN public.cities c ON c.id=n.city_id
  WHERE n.id=p_club_id;
  IF v_schedule IS NULL OR v_zone IS NULL OR btrim(v_zone)='' THEN RETURN false; END IF;

  v_tokens := regexp_split_to_array(v_schedule,'-');
  IF array_length(v_tokens,1)<>2 THEN RETURN false; END IF;

  v_open := public.dj_clock_minutes(v_tokens[1]);
  v_close := public.dj_clock_minutes(v_tokens[2]);
  IF v_open IS NULL OR v_close IS NULL THEN RETURN false; END IF;

  v_span := mod(v_close-v_open+1440,1440);
  -- Equal endpoints imply an unspecified 24h venue, not a verified slot.
  -- Windows longer than 12h require a structured override, not a guessed span.
  IF v_span=0 OR v_span>720 THEN RETURN false; END IF;

  v_local_start := p_starts_at AT TIME ZONE v_zone;
  v_local_end := p_ends_at AT TIME ZONE v_zone;

  -- Overnight 22:00–04:00 must recognize a 01:00 gig as part of the
  -- *previous* local day's opening window. Compare wall-clock dates
  -- after converting both instants using the venue's IANA timezone.
  FOR v_day_offset IN 0..1 LOOP
    v_open_at := date_trunc('day',v_local_start)
      - make_interval(days=>v_day_offset) + make_interval(mins=>v_open);
    v_close_at := v_open_at + make_interval(mins=>v_span);
    IF v_local_start >= v_open_at AND v_local_end <= v_close_at THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
EXCEPTION WHEN invalid_parameter_value THEN
  -- Invalid/missing timezones are never interpreted as UTC by accident.
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_dj_booking_club_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.dj_booking_inside_club_hours(
    NEW.club_id,NEW.starts_at,NEW.ends_at
  ) THEN
    RAISE EXCEPTION 'DJ booking outside valid venue local DJ operating hours'
      USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_dj_booking_club_hours() FROM PUBLIC;
DROP TRIGGER IF EXISTS enforce_dj_booking_club_hours_on_write
  ON public.dj_bookings;
CREATE TRIGGER enforce_dj_booking_club_hours_on_write
  BEFORE INSERT OR UPDATE OF club_id,starts_at,ends_at
  ON public.dj_bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_dj_booking_club_hours();

COMMENT ON FUNCTION public.dj_booking_inside_club_hours(uuid,timestamptz,timestamptz)
 IS 'Internal DJ booking gate: verify entire set within local venue hours; reject missing, ambiguous or >12h free-text windows.';

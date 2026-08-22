-- Make the remaining City Hall concert restrictions authoritative at the gigs table.
-- This deliberately sits below the booking RPC so every insert/reschedule path,
-- including future admin/tour tooling, must obey the same city law.

CREATE OR REPLACE FUNCTION public.enforce_gig_city_performance_laws()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_city_id uuid;
  v_timezone text := 'UTC';
  v_city_law_id uuid;
  v_noise_curfew_hour integer;
  v_prohibited_genres text[] := '{}'::text[];
  v_primary_genre text;
  v_blocked_genre text;
  v_local_show_date date;
  v_curfew_at timestamptz;
  v_effective_end timestamptz;
  v_local_start_time time;
  v_local_end_time time;
BEGIN
  IF NEW.venue_id IS NULL OR NEW.band_id IS NULL OR NEW.scheduled_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT v.city_id, COALESCE(c.timezone, 'UTC')
  INTO v_city_id, v_timezone
  FROM public.venues v
  LEFT JOIN public.cities c ON c.id = v.city_id
  WHERE v.id = NEW.venue_id;

  IF v_city_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    cl.id,
    cl.noise_curfew_hour,
    COALESCE(cl.prohibited_genres, '{}'::text[])
  INTO
    v_city_law_id,
    v_noise_curfew_hour,
    v_prohibited_genres
  FROM public.city_laws cl
  WHERE cl.city_id = v_city_id
    AND cl.effective_from <= NEW.scheduled_date
    AND (cl.effective_until IS NULL OR cl.effective_until > NEW.scheduled_date)
  ORDER BY cl.effective_from DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Snapshot the exact City Hall policy row used by this insert/reschedule. This
  -- also covers direct gig writers that do not call book_gig().
  NEW.booking_city_law_id := v_city_law_id;

  -- Resolve the most accurate available finish time. Canonical bookings always
  -- set scheduled_end; the slot fallback protects older/direct insert paths.
  v_effective_end := NEW.scheduled_end;
  IF v_effective_end IS NULL AND NEW.slot_end_time IS NOT NULL THEN
    v_local_show_date := (NEW.scheduled_date AT TIME ZONE v_timezone)::date;
    v_local_start_time := COALESCE(
      NEW.slot_start_time,
      (NEW.scheduled_date AT TIME ZONE v_timezone)::time
    );
    v_local_end_time := NEW.slot_end_time;

    v_effective_end := (
      v_local_show_date::timestamp
      + v_local_end_time
      + CASE
          WHEN v_local_end_time <= v_local_start_time THEN interval '1 day'
          ELSE interval '0 day'
        END
    ) AT TIME ZONE v_timezone;
  END IF;

  -- A missing end on a non-canonical writer is treated conservatively rather
  -- than allowing a curfew bypass.
  IF v_effective_end IS NULL THEN
    v_effective_end := NEW.scheduled_date + interval '3 hours';
  END IF;

  IF v_noise_curfew_hour IS NOT NULL THEN
    v_local_show_date := (NEW.scheduled_date AT TIME ZONE v_timezone)::date;
    v_curfew_at := (
      v_local_show_date::timestamp
      + make_interval(hours => v_noise_curfew_hour)
    ) AT TIME ZONE v_timezone;

    -- Ending exactly at curfew is legal; only overruns are rejected.
    IF v_effective_end > v_curfew_at THEN
      RAISE EXCEPTION 'gig_city_noise_curfew_violation'
        USING ERRCODE = '23514',
              DETAIL = format(
                'City Hall curfew is %s:00 local; gig ends at %s local',
                v_noise_curfew_hour,
                to_char(v_effective_end AT TIME ZONE v_timezone, 'YYYY-MM-DD HH24:MI')
              );
    END IF;
  END IF;

  IF COALESCE(array_length(v_prohibited_genres, 1), 0) > 0 THEN
    SELECT COALESCE(NULLIF(trim(b.primary_genre), ''), NULLIF(trim(b.genre), ''))
    INTO v_primary_genre
    FROM public.bands b
    WHERE b.id = NEW.band_id;

    IF v_primary_genre IS NOT NULL THEN
      SELECT prohibited.genre
      INTO v_blocked_genre
      FROM unnest(v_prohibited_genres) AS prohibited(genre)
      WHERE lower(trim(prohibited.genre)) = lower(trim(v_primary_genre))
      LIMIT 1;
    END IF;

    -- Enforce what the band is actually planning to play as well as its declared
    -- primary genre. This prevents a banned genre being smuggled through a mixed
    -- setlist while leaving unrelated secondary band tags alone.
    IF v_blocked_genre IS NULL AND NEW.setlist_id IS NOT NULL THEN
      SELECT s.genre
      INTO v_blocked_genre
      FROM public.setlist_songs ss
      JOIN public.songs s ON s.id = ss.song_id
      JOIN LATERAL unnest(v_prohibited_genres) AS prohibited(genre)
        ON lower(trim(prohibited.genre)) = lower(trim(s.genre))
      WHERE ss.setlist_id = NEW.setlist_id
        AND NULLIF(trim(s.genre), '') IS NOT NULL
      LIMIT 1;
    END IF;

    IF v_blocked_genre IS NOT NULL THEN
      RAISE EXCEPTION 'gig_city_prohibited_genre'
        USING ERRCODE = '23514',
              DETAIL = format(
                'City Hall prohibits genre "%s" for this gig date',
                v_blocked_genre
              );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_gig_city_performance_laws() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS enforce_gig_city_performance_laws_trigger ON public.gigs;
CREATE TRIGGER enforce_gig_city_performance_laws_trigger
BEFORE INSERT OR UPDATE OF venue_id, band_id, setlist_id, scheduled_date, scheduled_end, slot_start_time, slot_end_time
ON public.gigs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_gig_city_performance_laws();

COMMENT ON FUNCTION public.enforce_gig_city_performance_laws() IS
  'Server-authoritative City Hall curfew and prohibited-genre enforcement for gig booking and rescheduling.';

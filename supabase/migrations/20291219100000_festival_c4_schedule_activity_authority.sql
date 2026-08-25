-- Festival attendee C4: scheduling locks and activity authority.
--
-- C2 made check-in/leave authoritative and the earlier Festival Mode migration
-- reserved the active attendee schedule after check-in. C4 closes the remaining
-- authority gap: a valid ticket commitment must also prevent NEW incompatible
-- bookings before check-in, while commitments that existed before the admission
-- remain visible and predictably block check-in instead of being silently removed.
--
-- The guards below sit at authoritative domain boundaries so rehearsal/recording
-- charges, gig booking and travel cannot commit if any participating character is
-- already committed to an overlapping festival. Matching canonical Festival
-- performance rows remain the only normal schedule overlap allowed.

CREATE OR REPLACE FUNCTION public._festival_band_active_profiles(p_band_id uuid)
RETURNS TABLE(profile_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT DISTINCT resolved.profile_id
  FROM (
    SELECT coalesce(member.profile_id, profile.id) AS profile_id
    FROM public.band_members member
    LEFT JOIN public.profiles profile
      ON profile.user_id = member.user_id
    WHERE member.band_id = p_band_id
      AND coalesce(member.member_status, 'active') = 'active'
      AND coalesce(member.is_touring_member, false) = false

    UNION ALL

    SELECT profile.id
    FROM public.bands band
    JOIN public.profiles profile
      ON profile.id = band.leader_id
      OR profile.user_id = band.leader_id
    WHERE band.id = p_band_id
  ) resolved
  WHERE resolved.profile_id IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public._festival_band_active_profiles(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_band_active_profiles(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public._festival_activity_allowed_for_edition(
  p_activity_type text,
  p_metadata jsonb,
  p_festival_edition_id uuid
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_activity_type = 'festival_attendance' THEN true
    WHEN p_activity_type IN ('festival_performance', 'gig') THEN
      coalesce(p_metadata, '{}'::jsonb)->>'festival_edition_id' = p_festival_edition_id::text
      OR coalesce(p_metadata, '{}'::jsonb)->>'canonical_edition_id' = p_festival_edition_id::text
    ELSE false
  END;
$function$;

REVOKE ALL ON FUNCTION public._festival_activity_allowed_for_edition(text, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_activity_allowed_for_edition(text, jsonb, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public._festival_profile_commitment_conflict(
  p_profile_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_activity_type text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT attendance.festival_edition_id
  FROM public.festival_player_attendance attendance
  JOIN public.festival_editions_v2 edition
    ON edition.id = attendance.festival_edition_id
  LEFT JOIN public.cities city
    ON city.id = edition.city_id
  WHERE attendance.profile_id = p_profile_id
    AND attendance.status IN ('ticketed', 'ready_to_check_in', 'attending')
    AND edition.starts_on IS NOT NULL
    AND edition.ends_on IS NOT NULL
    AND p_window_start IS NOT NULL
    AND p_window_end IS NOT NULL
    AND p_window_start < p_window_end
    AND (edition.starts_on::timestamp AT TIME ZONE coalesce(nullif(city.timezone, ''), 'UTC')) < p_window_end
    AND ((edition.ends_on + 1)::timestamp AT TIME ZONE coalesce(nullif(city.timezone, ''), 'UTC')) > p_window_start
    AND NOT public._festival_activity_allowed_for_edition(
      p_activity_type,
      p_metadata,
      attendance.festival_edition_id
    )
  ORDER BY edition.starts_on, attendance.id
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public._festival_profile_commitment_conflict(uuid, timestamptz, timestamptz, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_profile_commitment_conflict(uuid, timestamptz, timestamptz, text, jsonb)
  TO service_role;

-- Check-in must consider authoritative domain bookings even if an older client
-- failed to project one of them into player_scheduled_activities. This preserves
-- existing commitments and blocks check-in rather than deleting or rewriting them.
CREATE OR REPLACE FUNCTION public._festival_attendee_has_schedule_conflict(
  p_profile_id uuid,
  p_festival_edition_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.player_scheduled_activities activity
      WHERE activity.profile_id = p_profile_id
        AND activity.status IN ('scheduled', 'in_progress')
        AND activity.scheduled_start < p_window_end
        AND activity.scheduled_end > p_window_start
        AND activity.activity_type <> 'festival_attendance'
        AND NOT public._festival_activity_allowed_for_edition(
          activity.activity_type,
          activity.metadata,
          p_festival_edition_id
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.band_rehearsals rehearsal
      WHERE rehearsal.status IN ('scheduled', 'in_progress')
        AND rehearsal.scheduled_start < p_window_end
        AND rehearsal.scheduled_end > p_window_start
        AND EXISTS (
          SELECT 1
          FROM public._festival_band_active_profiles(rehearsal.band_id) member
          WHERE member.profile_id = p_profile_id
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.recording_sessions session
      WHERE session.status IN ('scheduled', 'in_progress')
        AND session.scheduled_start < p_window_end
        AND session.scheduled_end > p_window_start
        AND (
          session.profile_id = p_profile_id
          OR (
            session.band_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public._festival_band_active_profiles(session.band_id) member
              WHERE member.profile_id = p_profile_id
            )
          )
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.gigs gig
      WHERE gig.status IN ('scheduled', 'confirmed', 'in_progress', 'ready_for_completion')
        AND gig.scheduled_date < p_window_end
        AND coalesce(gig.scheduled_end, gig.scheduled_date + interval '3 hours') > p_window_start
        AND EXISTS (
          SELECT 1
          FROM public._festival_band_active_profiles(gig.band_id) member
          WHERE member.profile_id = p_profile_id
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.player_travel_history travel
      WHERE travel.profile_id = p_profile_id
        AND travel.status IN ('scheduled', 'in_progress')
        AND coalesce(travel.scheduled_departure_time, travel.departure_time) < p_window_end
        AND coalesce(
          travel.arrival_time,
          coalesce(travel.scheduled_departure_time, travel.departure_time)
            + make_interval(hours => greatest(coalesce(travel.travel_duration_hours, 1), 1))
        ) > p_window_start
    );
$function$;

REVOKE ALL ON FUNCTION public._festival_attendee_has_schedule_conflict(uuid, uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_attendee_has_schedule_conflict(uuid, uuid, timestamptz, timestamptz)
  TO service_role;

-- Upgrade the existing generic schedule boundary. It now checks admission-backed
-- commitment state (ticketed / ready / attending), not only the schedule row that
-- exists after check-in. Existing rows are not retroactively cancelled: they are
-- left in place and the C2 readiness authority reports schedule_conflict.
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

  v_festival_edition_id := public._festival_profile_commitment_conflict(
    NEW.profile_id,
    NEW.scheduled_start,
    NEW.scheduled_end,
    NEW.activity_type,
    NEW.metadata
  );

  IF v_festival_edition_id IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'festival_attendance_schedule_locked'
    USING ERRCODE = 'P0001',
          DETAIL = format(
            'profile_id=%s; activity_type=%s; festival_edition_id=%s',
            NEW.profile_id,
            NEW.activity_type,
            v_festival_edition_id
          );
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

-- Rehearsal and recording payment RPCs debit before inserting their authoritative
-- booking row. These BEFORE triggers therefore make a Festival conflict abort the
-- same transaction and roll the debit back instead of leaving a paid orphan.
CREATE OR REPLACE FUNCTION public._festival_guard_rehearsal_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid;
  v_festival_edition_id uuid;
BEGIN
  IF NEW.status NOT IN ('scheduled', 'in_progress') THEN
    RETURN NEW;
  END IF;

  FOR v_profile_id IN
    SELECT member.profile_id
    FROM public._festival_band_active_profiles(NEW.band_id) member
  LOOP
    v_festival_edition_id := public._festival_profile_commitment_conflict(
      v_profile_id,
      NEW.scheduled_start,
      NEW.scheduled_end,
      'rehearsal',
      '{}'::jsonb
    );

    IF v_festival_edition_id IS NOT NULL THEN
      RAISE EXCEPTION 'festival_attendance_schedule_locked'
        USING ERRCODE = 'P0001',
              DETAIL = format(
                'profile_id=%s; activity_type=rehearsal; festival_edition_id=%s',
                v_profile_id,
                v_festival_edition_id
              );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_guard_rehearsal_booking()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_guard_rehearsal_booking()
  TO service_role;

DROP TRIGGER IF EXISTS enforce_festival_rehearsal_commitment
  ON public.band_rehearsals;
CREATE TRIGGER enforce_festival_rehearsal_commitment
BEFORE INSERT OR UPDATE OF band_id, scheduled_start, scheduled_end, status
ON public.band_rehearsals
FOR EACH ROW
EXECUTE FUNCTION public._festival_guard_rehearsal_booking();

CREATE OR REPLACE FUNCTION public._festival_guard_recording_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid;
  v_festival_edition_id uuid;
BEGIN
  IF NEW.status NOT IN ('scheduled', 'in_progress') THEN
    RETURN NEW;
  END IF;

  IF NEW.band_id IS NOT NULL THEN
    FOR v_profile_id IN
      SELECT member.profile_id
      FROM public._festival_band_active_profiles(NEW.band_id) member
    LOOP
      v_festival_edition_id := public._festival_profile_commitment_conflict(
        v_profile_id,
        NEW.scheduled_start,
        NEW.scheduled_end,
        'recording',
        '{}'::jsonb
      );

      IF v_festival_edition_id IS NOT NULL THEN
        RAISE EXCEPTION 'festival_attendance_schedule_locked'
          USING ERRCODE = 'P0001',
                DETAIL = format(
                  'profile_id=%s; activity_type=recording; festival_edition_id=%s',
                  v_profile_id,
                  v_festival_edition_id
                );
      END IF;
    END LOOP;
  ELSE
    v_profile_id := NEW.profile_id;
    IF v_profile_id IS NULL AND NEW.user_id IS NOT NULL THEN
      SELECT profile.id
        INTO v_profile_id
      FROM public.profiles profile
      WHERE profile.user_id = NEW.user_id
        AND coalesce(profile.is_active, true) = true
      ORDER BY profile.created_at DESC
      LIMIT 1;
    END IF;

    IF v_profile_id IS NOT NULL THEN
      v_festival_edition_id := public._festival_profile_commitment_conflict(
        v_profile_id,
        NEW.scheduled_start,
        NEW.scheduled_end,
        'recording',
        '{}'::jsonb
      );

      IF v_festival_edition_id IS NOT NULL THEN
        RAISE EXCEPTION 'festival_attendance_schedule_locked'
          USING ERRCODE = 'P0001',
                DETAIL = format(
                  'profile_id=%s; activity_type=recording; festival_edition_id=%s',
                  v_profile_id,
                  v_festival_edition_id
                );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_guard_recording_booking()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_guard_recording_booking()
  TO service_role;

DROP TRIGGER IF EXISTS enforce_festival_recording_commitment
  ON public.recording_sessions;
CREATE TRIGGER enforce_festival_recording_commitment
BEFORE INSERT OR UPDATE OF band_id, profile_id, user_id, scheduled_start, scheduled_end, status
ON public.recording_sessions
FOR EACH ROW
EXECUTE FUNCTION public._festival_guard_recording_booking();

CREATE OR REPLACE FUNCTION public._festival_guard_gig_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid;
  v_festival_edition_id uuid;
  v_scheduled_end timestamptz;
BEGIN
  IF NEW.status NOT IN ('scheduled', 'confirmed', 'in_progress', 'ready_for_completion') THEN
    RETURN NEW;
  END IF;

  v_scheduled_end := coalesce(NEW.scheduled_end, NEW.scheduled_date + interval '3 hours');

  FOR v_profile_id IN
    SELECT member.profile_id
    FROM public._festival_band_active_profiles(NEW.band_id) member
  LOOP
    v_festival_edition_id := public._festival_profile_commitment_conflict(
      v_profile_id,
      NEW.scheduled_date,
      v_scheduled_end,
      'gig',
      '{}'::jsonb
    );

    IF v_festival_edition_id IS NOT NULL THEN
      RAISE EXCEPTION 'festival_attendance_schedule_locked'
        USING ERRCODE = 'P0001',
              DETAIL = format(
                'profile_id=%s; activity_type=gig; festival_edition_id=%s',
                v_profile_id,
                v_festival_edition_id
              );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_guard_gig_booking()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_guard_gig_booking()
  TO service_role;

DROP TRIGGER IF EXISTS enforce_festival_gig_commitment
  ON public.gigs;
CREATE TRIGGER enforce_festival_gig_commitment
BEFORE INSERT OR UPDATE OF band_id, scheduled_date, scheduled_end, status
ON public.gigs
FOR EACH ROW
EXECUTE FUNCTION public._festival_guard_gig_booking();

CREATE OR REPLACE FUNCTION public._festival_guard_travel_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid;
  v_festival_edition_id uuid;
  v_departure timestamptz;
  v_arrival timestamptz;
BEGIN
  IF NEW.status NOT IN ('scheduled', 'in_progress') THEN
    RETURN NEW;
  END IF;

  v_profile_id := NEW.profile_id;
  IF v_profile_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT profile.id
      INTO v_profile_id
    FROM public.profiles profile
    WHERE profile.user_id = NEW.user_id
      AND coalesce(profile.is_active, true) = true
    ORDER BY profile.created_at DESC
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_departure := coalesce(NEW.scheduled_departure_time, NEW.departure_time);
  v_arrival := coalesce(
    NEW.arrival_time,
    v_departure + make_interval(hours => greatest(coalesce(NEW.travel_duration_hours, 1), 1))
  );

  v_festival_edition_id := public._festival_profile_commitment_conflict(
    v_profile_id,
    v_departure,
    v_arrival,
    'travel',
    '{}'::jsonb
  );

  IF v_festival_edition_id IS NOT NULL THEN
    RAISE EXCEPTION 'festival_attendance_schedule_locked'
      USING ERRCODE = 'P0001',
            DETAIL = format(
              'profile_id=%s; activity_type=travel; festival_edition_id=%s',
              v_profile_id,
              v_festival_edition_id
            );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_guard_travel_booking()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_guard_travel_booking()
  TO service_role;

DROP TRIGGER IF EXISTS enforce_festival_travel_commitment
  ON public.player_travel_history;
CREATE TRIGGER enforce_festival_travel_commitment
BEFORE INSERT OR UPDATE OF profile_id, user_id, scheduled_departure_time, departure_time, arrival_time, travel_duration_hours, status
ON public.player_travel_history
FOR EACH ROW
EXECUTE FUNCTION public._festival_guard_travel_booking();

COMMENT ON FUNCTION public._festival_profile_commitment_conflict(uuid, timestamptz, timestamptz, text, jsonb) IS
  'Returns the overlapping admission-backed Festival commitment for a profile. Only matching Festival attendance/performance activity is allowed to overlap.';
COMMENT ON FUNCTION public._festival_attendee_has_schedule_conflict(uuid, uuid, timestamptz, timestamptz) IS
  'Checks projected schedule plus authoritative rehearsal, recording, gig and travel commitments before Festival check-in.';

NOTIFY pgrst, 'reload schema';

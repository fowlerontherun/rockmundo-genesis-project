-- Festival attendee C2: readiness, check-in lifecycle and terminal-state authority.
--
-- C1 established the canonical admission-backed attendee and wristband. Earlier
-- migrations already provide server-authoritative check-in, early leave,
-- schedule locking and expiry completion. C2 closes the remaining lifecycle
-- gaps by persisting readiness, propagating refund/cancellation state, and
-- recording every authoritative status transition in an immutable audit stream.

ALTER TABLE public.festival_player_attendance
  ADD COLUMN IF NOT EXISTS lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_transition_source text NOT NULL DEFAULT 'admission_issued',
  ADD COLUMN IF NOT EXISTS last_transition_reason text,
  ADD COLUMN IF NOT EXISTS last_transition_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.festival_player_attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.festival_player_attendance(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  festival_launch_id uuid NOT NULL REFERENCES public.festival_launches(id) ON DELETE RESTRICT,
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id) ON DELETE RESTRICT,
  admission_ticket_id uuid NOT NULL REFERENCES public.festival_issued_tickets(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL,
  lifecycle_version bigint NOT NULL,
  transition_source text NOT NULL,
  transition_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attendance_id, lifecycle_version)
);

CREATE INDEX IF NOT EXISTS festival_player_attendance_events_profile_created_idx
  ON public.festival_player_attendance_events(profile_id, created_at DESC);

ALTER TABLE public.festival_player_attendance_events ENABLE ROW LEVEL SECURITY;

-- Lifecycle state and its audit trail remain server-owned. Browser clients may
-- only mutate state through the SECURITY DEFINER command functions.
REVOKE INSERT, UPDATE, DELETE ON public.festival_player_attendance
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.festival_player_attendance_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.festival_player_attendance_events TO service_role;

CREATE OR REPLACE FUNCTION public._festival_prepare_attendance_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.lifecycle_version := OLD.lifecycle_version + 1;
    NEW.last_transition_at := now();

    IF NEW.last_transition_source IS NULL
       OR btrim(NEW.last_transition_source) = ''
       OR NEW.last_transition_source IS NOT DISTINCT FROM OLD.last_transition_source THEN
      NEW.last_transition_source := CASE NEW.status
        WHEN 'ready_to_check_in' THEN 'readiness_reconcile'
        WHEN 'ticketed' THEN 'readiness_reconcile'
        WHEN 'attending' THEN 'check_in_to_festival'
        WHEN 'left_early' THEN 'leave_festival_early'
        WHEN 'completed' THEN 'festival_completion'
        WHEN 'cancelled' THEN 'festival_cancellation'
        WHEN 'refunded' THEN 'ticket_refund'
        ELSE 'festival_lifecycle'
      END;
    END IF;

    IF NEW.last_transition_reason IS NOT DISTINCT FROM OLD.last_transition_reason THEN
      NEW.last_transition_reason := CASE NEW.status
        WHEN 'ready_to_check_in' THEN 'eligibility_passed'
        WHEN 'ticketed' THEN 'eligibility_not_currently_satisfied'
        WHEN 'attending' THEN 'server_authoritative_check_in'
        WHEN 'left_early' THEN 'player_left_festival_early'
        WHEN 'completed' THEN 'festival_window_elapsed'
        WHEN 'cancelled' THEN 'festival_or_admission_cancelled'
        WHEN 'refunded' THEN 'admission_refunded'
        ELSE 'festival_lifecycle_transition'
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_prepare_attendance_transition()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_prepare_attendance_transition()
  TO service_role;

DROP TRIGGER IF EXISTS festival_attendance_prepare_transition
  ON public.festival_player_attendance;
CREATE TRIGGER festival_attendance_prepare_transition
BEFORE UPDATE OF status ON public.festival_player_attendance
FOR EACH ROW
EXECUTE FUNCTION public._festival_prepare_attendance_transition();

-- Establish one immutable baseline event for attendee rows that predate C2.
INSERT INTO public.festival_player_attendance_events (
  attendance_id,
  profile_id,
  festival_launch_id,
  festival_edition_id,
  admission_ticket_id,
  from_status,
  to_status,
  lifecycle_version,
  transition_source,
  transition_reason,
  created_at
)
SELECT
  attendance.id,
  attendance.profile_id,
  attendance.festival_launch_id,
  attendance.festival_edition_id,
  attendance.admission_ticket_id,
  NULL,
  attendance.status,
  attendance.lifecycle_version,
  'c2_baseline',
  'state_observed_when_c2_lifecycle_audit_was_enabled',
  coalesce(attendance.created_at, now())
FROM public.festival_player_attendance attendance
ON CONFLICT (attendance_id, lifecycle_version) DO NOTHING;

CREATE OR REPLACE FUNCTION public._festival_audit_attendance_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_from_status text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
      RETURN NEW;
    END IF;
    v_from_status := OLD.status;
  ELSE
    v_from_status := NULL;
  END IF;

  INSERT INTO public.festival_player_attendance_events (
    attendance_id,
    profile_id,
    festival_launch_id,
    festival_edition_id,
    admission_ticket_id,
    from_status,
    to_status,
    lifecycle_version,
    transition_source,
    transition_reason,
    created_at
  ) VALUES (
    NEW.id,
    NEW.profile_id,
    NEW.festival_launch_id,
    NEW.festival_edition_id,
    NEW.admission_ticket_id,
    v_from_status,
    NEW.status,
    NEW.lifecycle_version,
    NEW.last_transition_source,
    NEW.last_transition_reason,
    coalesce(NEW.last_transition_at, now())
  )
  ON CONFLICT (attendance_id, lifecycle_version) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_audit_attendance_transition()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_audit_attendance_transition()
  TO service_role;

DROP TRIGGER IF EXISTS festival_attendance_audit_insert
  ON public.festival_player_attendance;
CREATE TRIGGER festival_attendance_audit_insert
AFTER INSERT ON public.festival_player_attendance
FOR EACH ROW
EXECUTE FUNCTION public._festival_audit_attendance_transition();

DROP TRIGGER IF EXISTS festival_attendance_audit_status
  ON public.festival_player_attendance;
CREATE TRIGGER festival_attendance_audit_status
AFTER UPDATE OF status ON public.festival_player_attendance
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public._festival_audit_attendance_transition();

CREATE OR REPLACE FUNCTION public._festival_close_attendance_schedule_lock(
  p_attendance_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.player_scheduled_activities activity
  SET status = 'cancelled',
      metadata = coalesce(activity.metadata, '{}'::jsonb) || jsonb_build_object(
        'festival_lifecycle_closed', true,
        'festival_lifecycle_close_reason', p_reason,
        'festival_lifecycle_closed_at', now()
      ),
      updated_at = now()
  WHERE activity.activity_type = 'festival_attendance'
    AND activity.status IN ('scheduled', 'in_progress')
    AND EXISTS (
      SELECT 1
      FROM public.festival_player_attendance attendance
      WHERE attendance.id = p_attendance_id
        AND (
          activity.id = attendance.schedule_activity_id
          OR activity.metadata->>'festival_attendance_id' = attendance.id::text
        )
    );
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_close_attendance_schedule_lock(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_close_attendance_schedule_lock(uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public._festival_sync_attendance_lifecycle(
  p_attendance_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_ticket_status text;
  v_ticket_holder_profile_id uuid;
  v_ticket_launch_id uuid;
  v_product_class text;
  v_product_edition_id uuid;
  v_launch_status text;
  v_edition_status text;
  v_starts_on date;
  v_ends_on date;
  v_city_id uuid;
  v_timezone text := 'UTC';
  v_current_city_id uuid;
  v_is_traveling boolean := false;
  v_local_date date;
  v_lock_end timestamptz;
  v_block_reason text;
  v_target_status text;
  v_cancel_reason text;
BEGIN
  SELECT attendance.*
    INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = p_attendance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  -- Historical attendance outcomes are immutable. A post-event accounting refund
  -- must not rewrite the fact that a character already left or completed.
  IF v_attendance.status IN ('left_early', 'completed', 'cancelled', 'refunded') THEN
    RETURN v_attendance.status;
  END IF;

  SELECT ticket.status,
         ticket.holder_profile_id,
         ticket.festival_launch_id,
         product.product_class,
         plan.festival_edition_id
    INTO v_ticket_status,
         v_ticket_holder_profile_id,
         v_ticket_launch_id,
         v_product_class,
         v_product_edition_id
  FROM public.festival_issued_tickets ticket
  LEFT JOIN public.festival_ticket_products product
    ON product.id = ticket.festival_ticket_product_id
  LEFT JOIN public.festival_ticket_plans plan
    ON plan.id = product.festival_ticket_plan_id
  WHERE ticket.id = v_attendance.admission_ticket_id;

  IF NOT FOUND THEN
    v_cancel_reason := 'admission_ticket_missing';
  ELSIF v_ticket_status = 'refunded' THEN
    PERFORM public._festival_close_attendance_schedule_lock(v_attendance.id, 'admission_refunded');
    UPDATE public.festival_player_attendance
    SET status = 'refunded',
        left_at = CASE WHEN status = 'attending' THEN coalesce(left_at, now()) ELSE left_at END,
        last_transition_source = 'ticket_lifecycle',
        last_transition_reason = 'admission_refunded',
        updated_at = now()
    WHERE id = v_attendance.id
      AND status NOT IN ('left_early', 'completed', 'cancelled', 'refunded');
    RETURN 'refunded';
  ELSIF v_ticket_status IN ('cancelled', 'transferred') THEN
    v_cancel_reason := 'admission_' || v_ticket_status;
  ELSIF v_ticket_holder_profile_id IS DISTINCT FROM v_attendance.profile_id THEN
    v_cancel_reason := 'admission_holder_mismatch';
  ELSIF v_ticket_launch_id IS DISTINCT FROM v_attendance.festival_launch_id THEN
    v_cancel_reason := 'admission_launch_mismatch';
  ELSIF v_product_class IS DISTINCT FROM 'admission' THEN
    v_cancel_reason := 'admission_product_mismatch';
  ELSIF v_product_edition_id IS DISTINCT FROM v_attendance.festival_edition_id THEN
    v_cancel_reason := 'admission_edition_mismatch';
  END IF;

  SELECT edition.status,
         edition.starts_on,
         edition.ends_on,
         edition.city_id,
         coalesce(nullif(city.timezone, ''), 'UTC')
    INTO v_edition_status,
         v_starts_on,
         v_ends_on,
         v_city_id,
         v_timezone
  FROM public.festival_editions_v2 edition
  LEFT JOIN public.cities city
    ON city.id = edition.city_id
  WHERE edition.id = v_attendance.festival_edition_id;

  IF NOT FOUND THEN
    v_cancel_reason := coalesce(v_cancel_reason, 'festival_edition_missing');
  END IF;

  SELECT launch.launch_status
    INTO v_launch_status
  FROM public.festival_launches launch
  WHERE launch.id = v_attendance.festival_launch_id;

  IF NOT FOUND THEN
    v_cancel_reason := coalesce(v_cancel_reason, 'festival_launch_missing');
  ELSIF v_launch_status = 'cancelled_before_event' OR v_edition_status = 'cancelled' THEN
    v_cancel_reason := coalesce(v_cancel_reason, 'festival_cancelled');
  END IF;

  IF v_cancel_reason IS NOT NULL THEN
    PERFORM public._festival_close_attendance_schedule_lock(v_attendance.id, v_cancel_reason);
    UPDATE public.festival_player_attendance
    SET status = 'cancelled',
        left_at = CASE WHEN status = 'attending' THEN coalesce(left_at, now()) ELSE left_at END,
        last_transition_source = 'festival_lifecycle_sync',
        last_transition_reason = v_cancel_reason,
        updated_at = now()
    WHERE id = v_attendance.id
      AND status NOT IN ('left_early', 'completed', 'cancelled', 'refunded');
    RETURN 'cancelled';
  END IF;

  -- An active attendee has already passed the check-in authority boundary. C2
  -- leaves completion to the existing Festival-local expiry authority.
  IF v_attendance.status = 'attending' THEN
    RETURN 'attending';
  END IF;

  IF v_attendance.status NOT IN ('ticketed', 'ready_to_check_in') THEN
    RETURN v_attendance.status;
  END IF;

  SELECT profile.current_city_id, coalesce(profile.is_traveling, false)
    INTO v_current_city_id, v_is_traveling
  FROM public.profiles profile
  WHERE profile.id = v_attendance.profile_id;

  IF v_ticket_status <> 'valid' THEN
    v_block_reason := 'ticket_invalid';
  ELSIF v_starts_on IS NULL OR v_ends_on IS NULL THEN
    v_block_reason := 'festival_dates_unavailable';
  ELSIF v_city_id IS NULL THEN
    v_block_reason := 'festival_city_unavailable';
  ELSE
    v_local_date := (now() AT TIME ZONE v_timezone)::date;
    v_lock_end := ((v_ends_on + 1)::timestamp AT TIME ZONE v_timezone);

    IF v_local_date < v_starts_on THEN
      v_block_reason := 'festival_not_started';
    ELSIF v_local_date > v_ends_on THEN
      v_block_reason := 'festival_finished';
    ELSIF v_is_traveling THEN
      v_block_reason := 'character_traveling';
    ELSIF v_current_city_id IS DISTINCT FROM v_city_id THEN
      v_block_reason := 'wrong_city';
    ELSIF public._festival_attendee_has_schedule_conflict(
      v_attendance.profile_id,
      v_attendance.festival_edition_id,
      now(),
      v_lock_end
    ) THEN
      v_block_reason := 'schedule_conflict';
    END IF;
  END IF;

  v_target_status := CASE WHEN v_block_reason IS NULL
    THEN 'ready_to_check_in'
    ELSE 'ticketed'
  END;

  IF v_attendance.status IS DISTINCT FROM v_target_status THEN
    UPDATE public.festival_player_attendance
    SET status = v_target_status,
        last_transition_source = 'readiness_reconcile',
        last_transition_reason = coalesce(v_block_reason, 'eligibility_passed'),
        updated_at = now()
    WHERE id = v_attendance.id;
  END IF;

  RETURN CASE WHEN v_block_reason IS NULL
    THEN 'ready_to_check_in'
    ELSE 'ticketed:' || v_block_reason
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_sync_attendance_lifecycle(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_sync_attendance_lifecycle(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.sync_my_festival_attendance_lifecycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid := public.current_profile_id();
  v_attendance_id uuid;
  v_before_status text;
  v_after_status text;
  v_result text;
  v_examined integer := 0;
  v_changed integer := 0;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'festival_profile_required' USING ERRCODE = 'P0001';
  END IF;

  FOR v_attendance_id, v_before_status IN
    SELECT attendance.id, attendance.status
    FROM public.festival_player_attendance attendance
    WHERE attendance.profile_id = v_profile_id
      AND attendance.status IN ('ticketed', 'ready_to_check_in', 'attending')
    ORDER BY attendance.created_at, attendance.id
  LOOP
    v_examined := v_examined + 1;
    v_result := public._festival_sync_attendance_lifecycle(v_attendance_id);

    SELECT attendance.status
      INTO v_after_status
    FROM public.festival_player_attendance attendance
    WHERE attendance.id = v_attendance_id;

    IF v_before_status IS DISTINCT FROM v_after_status THEN
      v_changed := v_changed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'examined', v_examined,
    'changed', v_changed,
    'ranAt', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_my_festival_attendance_lifecycle()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_my_festival_attendance_lifecycle()
  TO authenticated, service_role;

-- Refund/cancellation changes are pushed into attendee state immediately; normal
-- valid -> used check-in consumption deliberately does not invoke this trigger.
CREATE OR REPLACE FUNCTION public._festival_sync_attendance_from_ticket_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_attendance_id uuid;
BEGIN
  IF NEW.status IN ('refunded', 'cancelled', 'transferred')
     OR NEW.holder_profile_id IS DISTINCT FROM OLD.holder_profile_id THEN
    SELECT attendance.id
      INTO v_attendance_id
    FROM public.festival_player_attendance attendance
    WHERE attendance.admission_ticket_id = NEW.id;

    IF FOUND THEN
      PERFORM public._festival_sync_attendance_lifecycle(v_attendance_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_sync_attendance_from_ticket_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_sync_attendance_from_ticket_change()
  TO service_role;

DROP TRIGGER IF EXISTS festival_attendance_sync_ticket_lifecycle
  ON public.festival_issued_tickets;
CREATE TRIGGER festival_attendance_sync_ticket_lifecycle
AFTER UPDATE OF status, holder_profile_id ON public.festival_issued_tickets
FOR EACH ROW
EXECUTE FUNCTION public._festival_sync_attendance_from_ticket_change();

CREATE OR REPLACE FUNCTION public._festival_sync_attendance_from_launch_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_attendance_id uuid;
BEGIN
  IF NEW.launch_status = 'cancelled_before_event'
     AND NEW.launch_status IS DISTINCT FROM OLD.launch_status THEN
    FOR v_attendance_id IN
      SELECT attendance.id
      FROM public.festival_player_attendance attendance
      WHERE attendance.festival_launch_id = NEW.id
        AND attendance.status IN ('ticketed', 'ready_to_check_in', 'attending')
    LOOP
      PERFORM public._festival_sync_attendance_lifecycle(v_attendance_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_sync_attendance_from_launch_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_sync_attendance_from_launch_change()
  TO service_role;

DROP TRIGGER IF EXISTS festival_attendance_sync_launch_lifecycle
  ON public.festival_launches;
CREATE TRIGGER festival_attendance_sync_launch_lifecycle
AFTER UPDATE OF launch_status ON public.festival_launches
FOR EACH ROW
EXECUTE FUNCTION public._festival_sync_attendance_from_launch_change();

CREATE OR REPLACE FUNCTION public._festival_sync_attendance_from_edition_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_attendance_id uuid;
BEGIN
  IF NEW.status = 'cancelled'
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    FOR v_attendance_id IN
      SELECT attendance.id
      FROM public.festival_player_attendance attendance
      WHERE attendance.festival_edition_id = NEW.id
        AND attendance.status IN ('ticketed', 'ready_to_check_in', 'attending')
    LOOP
      PERFORM public._festival_sync_attendance_lifecycle(v_attendance_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_sync_attendance_from_edition_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_sync_attendance_from_edition_change()
  TO service_role;

DROP TRIGGER IF EXISTS festival_attendance_sync_edition_lifecycle
  ON public.festival_editions_v2;
CREATE TRIGGER festival_attendance_sync_edition_lifecycle
AFTER UPDATE OF status ON public.festival_editions_v2
FOR EACH ROW
EXECUTE FUNCTION public._festival_sync_attendance_from_edition_change();

COMMENT ON TABLE public.festival_player_attendance_events IS
  'Immutable C2 audit stream for every authoritative Festival attendee status transition.';
COMMENT ON FUNCTION public._festival_sync_attendance_lifecycle(uuid) IS
  'Idempotently persists check-in readiness and propagates refund/cancellation state from canonical ticket, edition, launch, time, location and schedule authorities.';
COMMENT ON FUNCTION public.sync_my_festival_attendance_lifecycle() IS
  'Refreshes the active character attendee lifecycle through server authority before attendance or check-in projections are returned.';

NOTIFY pgrst, 'reload schema';

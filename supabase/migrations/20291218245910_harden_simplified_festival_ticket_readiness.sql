-- Preserve the hidden ticket foundation needed by Line-up, while separately
-- tracking whether the owner actually confirmed Tickets & budget before Run Festival.

ALTER TABLE public.festival_ticket_plans
  ADD COLUMN IF NOT EXISTS owner_confirmed_at timestamptz;

CREATE OR REPLACE FUNCTION public._festival_capture_ticket_owner_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- save_festival_edition_ticket_plan increments planning_version for every save,
  -- but only p_complete=true also writes a fresh completed_at. Hidden annual-plan
  -- materialisation may refresh completed_at without incrementing planning_version,
  -- so requiring both changes keeps this marker owner-action specific.
  IF NEW.projection_source = 'annual_plan'
     AND NEW.planning_version > OLD.planning_version
     AND NEW.completed_at IS NOT NULL
     AND NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    NEW.owner_confirmed_at := NEW.completed_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS festival_capture_ticket_owner_confirmation
  ON public.festival_ticket_plans;
CREATE TRIGGER festival_capture_ticket_owner_confirmation
BEFORE UPDATE OF planning_version, completed_at
ON public.festival_ticket_plans
FOR EACH ROW
EXECUTE FUNCTION public._festival_capture_ticket_owner_confirmation();

-- Best-effort compatibility for annual ticket plans already edited before this
-- marker existed. New confirmations are captured precisely by the trigger above.
UPDATE public.festival_ticket_plans ticket
SET owner_confirmed_at = ticket.completed_at
WHERE ticket.projection_source = 'annual_plan'
  AND ticket.owner_confirmed_at IS NULL
  AND ticket.planning_version > 1
  AND ticket.completed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public._simplified_festival_run_readiness(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edition public.festival_editions_v2%ROWTYPE;
  site public.festival_site_plans%ROWTYPE;
  ticket public.festival_ticket_plans%ROWTYPE;
  programme public.festival_artist_programmes%ROWTYPE;
  blockers jsonb := '[]'::jsonb;
  stage_count integer := 0;
  booking_count integer := 0;
  active_licence jsonb;
  max_acts_per_day integer := 0;
  physical_slots integer := 0;
  already_run boolean := false;
  is_admin boolean := coalesce(public.is_admin(auth.uid()), false);
BEGIN
  SELECT * INTO edition
  FROM public.festival_editions_v2
  WHERE id = p_festival_edition_id
    AND festival_company_id = p_festival_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FESTIVAL_RUNTIME_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO site
  FROM public.festival_site_plans
  WHERE festival_edition_id = edition.id;
  SELECT * INTO ticket
  FROM public.festival_ticket_plans
  WHERE festival_edition_id = edition.id;
  SELECT * INTO programme
  FROM public.festival_artist_programmes
  WHERE festival_edition_id = edition.id;

  IF site.id IS NOT NULL THEN
    SELECT count(*) INTO stage_count
    FROM public.festival_site_plan_stages stage
    WHERE stage.festival_site_plan_id = site.id
      AND stage.status = 'ready';
  END IF;

  IF programme.id IS NOT NULL THEN
    SELECT count(*) INTO booking_count
    FROM public.festival_artist_bookings booking
    WHERE booking.festival_artist_programme_id = programme.id
      AND booking.status NOT IN ('cancelled', 'artist_withdrawn', 'festival_cancelled');
  END IF;

  SELECT public._festival_licence_progress_result(p_festival_company_id, now())
  INTO active_licence;
  max_acts_per_day := coalesce((active_licence #>> '{current,maxActsPerDay}')::integer, 0);
  physical_slots := greatest(
    0,
    stage_count * greatest(1, coalesce(edition.duration_days, 1)) * 4
  );
  already_run := EXISTS (
    SELECT 1
    FROM public.festival_edition_runtimes runtime
    WHERE runtime.edition_id = edition.id
  );

  IF edition.status = 'cancelled' THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_cancelled',
      'message', 'This annual Festival was cancelled and cannot be run.'
    ));
  ELSIF edition.status = 'completed' AND NOT already_run THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_already_completed',
      'message', 'This annual Festival is already completed.'
    ));
  END IF;

  IF edition.planning_status <> 'ready' OR edition.readiness_score < 100 THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_plan_not_ready',
      'message', 'Finish the annual Plan before running the Festival.'
    ));
  END IF;

  IF site.id IS NULL OR site.status <> 'ready_for_ticketing' OR stage_count = 0 THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_generated_site_not_ready',
      'message', 'The automatic site and stage projection is not ready. Re-save the annual Plan.'
    ));
  END IF;

  IF ticket.id IS NULL OR ticket.status <> 'ready_for_artist_planning' THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_tickets_not_ready',
      'message', 'Finish Tickets & budget before running the Festival.'
    ));
  ELSIF ticket.owner_confirmed_at IS NULL THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_tickets_confirmation_required',
      'message', 'Open Tickets & budget and choose Confirm ticket plan before running the Festival.'
    ));
  END IF;

  IF programme.id IS NULL OR booking_count = 0 THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_lineup_required',
      'message', 'Confirm at least one player band or solo artist before running the Festival. The game will fill remaining slots with NPC acts.'
    ));
  END IF;

  IF coalesce((active_licence #>> '{current,active}')::boolean, false) IS NOT TRUE THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_licence_required',
      'message', 'An active Festival licence is required.'
    ));
  END IF;

  IF booking_count > physical_slots AND physical_slots > 0 THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_lineup_over_capacity',
      'message', 'There are more confirmed acts than the generated stages can schedule. Reduce the confirmed line-up or increase Festival scale.'
    ));
  END IF;

  IF max_acts_per_day > 0
     AND booking_count > max_acts_per_day * greatest(1, coalesce(edition.duration_days, 1)) THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_licence_act_limit_exceeded',
      'message', 'The confirmed line-up exceeds the active licence act limit.'
    ));
  END IF;

  IF edition.starts_on IS NULL OR edition.ends_on IS NULL THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_dates_required',
      'message', 'Festival dates are required.'
    ));
  ELSIF NOT is_admin AND current_date < edition.starts_on THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_not_started_yet',
      'message', 'This Festival can be run from ' || to_char(edition.starts_on, 'DD Mon YYYY') || '.'
    ));
  END IF;

  RETURN jsonb_build_object(
    'festivalCompanyId', p_festival_company_id,
    'festivalEditionId', edition.id,
    'editionVersion', edition.version,
    'editionStatus', edition.status,
    'planningStatus', edition.planning_status,
    'readinessScore', edition.readiness_score,
    'scheduledFor', edition.starts_on,
    'stageCount', stage_count,
    'confirmedActs', booking_count,
    'ticketsConfirmed', ticket.owner_confirmed_at IS NOT NULL,
    'npcFillEnabled', true,
    'activeLicence', active_licence->'current',
    'alreadyRun', already_run,
    'canRun', already_run OR jsonb_array_length(blockers) = 0,
    'blockers', CASE WHEN already_run THEN '[]'::jsonb ELSE blockers END
  );
END;
$$;

COMMENT ON COLUMN public.festival_ticket_plans.owner_confirmed_at IS
  'Owner confirmation boundary for simplified Run Festival. Hidden annual-plan ticket defaults do not set this field.';

NOTIFY pgrst, 'reload schema';

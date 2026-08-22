-- The hidden annual-plan projection must not count as a player-confirmed ticket plan.
-- Keep generated defaults editable/in-progress until the owner saves Tickets & budget.

CREATE OR REPLACE FUNCTION public._festival_generated_ticket_requires_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.projection_source = 'annual_plan'
     AND NEW.planning_version <= 1
     AND NEW.status = 'ready_for_artist_planning' THEN
    NEW.status := 'in_progress';
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS festival_generated_ticket_requires_confirmation
  ON public.festival_ticket_plans;
CREATE TRIGGER festival_generated_ticket_requires_confirmation
BEFORE INSERT OR UPDATE OF status, planning_version, projection_source
ON public.festival_ticket_plans
FOR EACH ROW
EXECUTE FUNCTION public._festival_generated_ticket_requires_confirmation();

UPDATE public.festival_ticket_plans ticket
SET status = 'in_progress',
    completed_at = NULL,
    updated_at = now()
WHERE ticket.projection_source = 'annual_plan'
  AND ticket.planning_version <= 1
  AND ticket.status = 'ready_for_artist_planning'
  AND NOT EXISTS (
    SELECT 1
    FROM public.festival_edition_runtimes runtime
    WHERE runtime.edition_id = ticket.festival_edition_id
  );

COMMENT ON FUNCTION public._festival_generated_ticket_requires_confirmation() IS
  'Prevents hidden annual-plan ticket defaults from satisfying Run Festival before the owner saves Tickets & budget.';

NOTIFY pgrst, 'reload schema';

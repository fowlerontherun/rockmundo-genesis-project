-- A band member may directly write their own rehearsal rows through legacy RLS.
-- Learning XP must require the server worker and a real paid booking record;
-- merely changing a rehearsal's status or cost must never mint XP.
CREATE OR REPLACE FUNCTION public.is_verified_rehearsal_learning_completion(p_rehearsal_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT (SELECT auth.role()) = 'service_role'
    AND EXISTS (
      SELECT 1 FROM public.booking_payments bp
      WHERE bp.booking_id = p_rehearsal_id
        AND bp.booking_type = 'rehearsal'
        AND bp.amount_minor > 0
    );
$$;

REVOKE ALL ON FUNCTION public.is_verified_rehearsal_learning_completion(uuid) FROM PUBLIC, anon;
-- The role that invokes the status update evaluates the trigger WHEN clause.
GRANT EXECUTE ON FUNCTION public.is_verified_rehearsal_learning_completion(uuid)
  TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_award_rehearsal_learning ON public.band_rehearsals;
CREATE TRIGGER trg_award_rehearsal_learning
  AFTER UPDATE OF status ON public.band_rehearsals
  FOR EACH ROW
  WHEN (
    NEW.status = 'completed'
    AND OLD.status IS DISTINCT FROM 'completed'
    AND NEW.scheduled_start >= NEW.created_at - interval '5 minutes'
    AND public.is_verified_rehearsal_learning_completion(NEW.id)
  )
  EXECUTE FUNCTION public.award_rehearsal_learning_on_completion();

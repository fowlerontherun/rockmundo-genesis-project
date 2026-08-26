-- Keep the simplified annual Festival lifecycle aligned with planning readiness.
-- Production is updated directly; this reconciliation file preserves parity for rebuilds.

CREATE OR REPLACE FUNCTION public._festival_ready_lifecycle_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'draft'
     AND NEW.planning_status = 'ready'
     AND NEW.readiness_score = 100
     AND NEW.locked_at IS NULL THEN
    NEW.status := 'configuring';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS festival_ready_lifecycle_sync ON public.festival_editions_v2;
CREATE TRIGGER festival_ready_lifecycle_sync
BEFORE INSERT OR UPDATE OF planning_status, readiness_score
ON public.festival_editions_v2
FOR EACH ROW
EXECUTE FUNCTION public._festival_ready_lifecycle_sync();

-- Lifecycle-only changes must not rematerialise generated site/stage/ticket foundations.
DROP TRIGGER IF EXISTS festival_edition_foundation_projection ON public.festival_editions_v2;
CREATE TRIGGER festival_edition_foundation_projection
AFTER INSERT OR UPDATE OF starts_on, ends_on, city_id, site_type, festival_scale,
  expected_capacity, estimated_operating_cost_minor, planning_effects
ON public.festival_editions_v2
FOR EACH ROW
EXECUTE FUNCTION public._festival_edition_foundation_trigger();

-- Repair any editions that reached canonical annual-plan readiness while the legacy
-- lifecycle field remained in draft. No generated IDs are hard-coded.
WITH repaired AS (
  UPDATE public.festival_editions_v2 e
  SET status = 'configuring',
      version = e.version + 1,
      updated_at = now()
  WHERE e.status = 'draft'
    AND e.planning_status = 'ready'
    AND e.readiness_score = 100
    AND e.locked_at IS NULL
  RETURNING e.*
)
INSERT INTO public.festival_edition_audit(
  festival_company_id,
  festival_edition_id,
  actor_profile_id,
  event_type,
  previous_version,
  new_version,
  metadata
)
SELECT
  r.festival_company_id,
  r.id,
  NULL,
  'ready_lifecycle_repaired',
  r.version - 1,
  r.version,
  jsonb_build_object(
    'reason', 'Planning ready at 100 percent while lifecycle remained draft',
    'status', r.status,
    'planningStatus', r.planning_status,
    'readinessScore', r.readiness_score
  )
FROM repaired r
WHERE NOT EXISTS (
  SELECT 1
  FROM public.festival_edition_audit a
  WHERE a.festival_edition_id = r.id
    AND a.event_type = 'ready_lifecycle_repaired'
);

NOTIFY pgrst, 'reload schema';

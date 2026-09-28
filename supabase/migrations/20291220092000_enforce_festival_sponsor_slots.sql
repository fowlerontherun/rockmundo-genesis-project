-- Per-plan sponsor slots. Historical contracts remain unassigned until reviewed.
-- New contracts inherit a role from their package; explicit main assignment is
-- only permitted for title packages. No legacy contract is silently rewritten.
ALTER TABLE public.festival_sponsor_contracts
  ADD COLUMN IF NOT EXISTS festival_sponsor_role text
  CHECK (festival_sponsor_role IN ('main', 'support'));

CREATE OR REPLACE FUNCTION public.festival_enforce_sponsor_slots()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  package_tier text;
  main_count integer;
  support_count integer;
BEGIN
  -- Serialise competing contract assignments for the same festival plan.
  PERFORM 1 FROM public.festival_sponsorship_plans
    WHERE id = NEW.festival_sponsorship_plan_id FOR UPDATE;

  SELECT tier INTO package_tier
    FROM public.festival_sponsorship_packages
    WHERE id = NEW.package_id
      AND festival_sponsorship_plan_id = NEW.festival_sponsorship_plan_id;
  IF package_tier IS NULL THEN
    RAISE EXCEPTION 'festival_sponsor_package_plan_mismatch' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.festival_sponsor_role IS NULL THEN
    NEW.festival_sponsor_role :=
      CASE WHEN package_tier = 'title' THEN 'main' ELSE 'support' END;
  END IF;
  IF NEW.festival_sponsor_role = 'main' AND package_tier <> 'title' THEN
    RAISE EXCEPTION 'festival_main_sponsor_requires_title_package' USING ERRCODE = '23514';
  END IF;

  IF NEW.status NOT IN ('cancelled', 'sponsor_defaulted', 'festival_cancelled')
     AND NEW.festival_sponsor_role IS NOT NULL THEN
    SELECT
      count(*) FILTER (WHERE festival_sponsor_role = 'main'),
      count(*) FILTER (WHERE festival_sponsor_role = 'support')
    INTO main_count, support_count
    FROM public.festival_sponsor_contracts
    WHERE festival_sponsorship_plan_id = NEW.festival_sponsorship_plan_id
      AND status NOT IN ('cancelled', 'sponsor_defaulted', 'festival_cancelled')
      AND id IS DISTINCT FROM NEW.id;

    IF NEW.festival_sponsor_role = 'main' AND main_count >= 1 THEN
      RAISE EXCEPTION 'festival_main_sponsor_slot_taken' USING ERRCODE = '23514';
    END IF;
    IF NEW.festival_sponsor_role = 'support' AND support_count >= 4 THEN
      RAISE EXCEPTION 'festival_support_sponsor_slots_full' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS festival_enforce_sponsor_slots_trigger
  ON public.festival_sponsor_contracts;
CREATE TRIGGER festival_enforce_sponsor_slots_trigger
BEFORE INSERT OR UPDATE OF festival_sponsor_role, package_id, status, festival_sponsorship_plan_id
ON public.festival_sponsor_contracts
FOR EACH ROW EXECUTE FUNCTION public.festival_enforce_sponsor_slots();

COMMENT ON COLUMN public.festival_sponsor_contracts.festival_sponsor_role
IS 'One main and at most four supporting active sponsors per plan. NULL denotes unreviewed historical contracts.';

-- The simplified festival flow budgets automatic sponsorship without creating
-- explicit sponsor contracts. Do not block those launches until the canonical
-- main-sponsor fallback is implemented and exercised end to end.
--
-- Explicit sponsorship plans that contain contracts remain subject to the
-- slot-readiness rule. A plan with no contracts uses the automatic budget path.
CREATE OR REPLACE FUNCTION public.festival_require_main_sponsor_at_launch()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_plan_id uuid;
  v_has_contracts boolean;
  v_ready boolean;
BEGIN
  IF NEW.launch_status IN ('launched', 'tickets_on_sale')
     AND (
       TG_OP = 'INSERT'
       OR OLD.launch_status NOT IN ('launched','tickets_on_sale','sales_paused','sales_closed')
     ) THEN
    SELECT p.id INTO v_plan_id
    FROM public.festival_sponsorship_plans p
    WHERE p.festival_company_id = NEW.festival_company_id
    FOR UPDATE;

    IF v_plan_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.festival_sponsor_contracts c
      WHERE c.festival_sponsorship_plan_id = v_plan_id
        AND c.status NOT IN ('cancelled','sponsor_defaulted','festival_cancelled')
    ) INTO v_has_contracts;

    -- No active explicit contracts: the existing automatic sponsorship model
    -- remains authoritative, with no fabricated contract or double-counted cash.
    IF NOT v_has_contracts THEN
      RETURN NEW;
    END IF;

    SELECT r.sponsor_slots_ready INTO v_ready
    FROM public.festival_sponsor_slot_readiness r
    WHERE r.sponsorship_plan_id = v_plan_id;

    IF NOT coalesce(v_ready, false) THEN
      RAISE EXCEPTION 'festival_sponsor_slots_not_ready_for_launch'
        USING ERRCODE = '23514',
              DETAIL = 'Explicit sponsor contracts require exactly one main sponsor, no more than four support sponsors, and reconciliation of active historical contracts.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.festival_require_main_sponsor_at_launch()
IS 'Checks explicit sponsorship slots at first launch; preserves the simplified automatic-sponsorship launch path when no active explicit contracts exist. Does not create a fallback sponsor or revenue.';

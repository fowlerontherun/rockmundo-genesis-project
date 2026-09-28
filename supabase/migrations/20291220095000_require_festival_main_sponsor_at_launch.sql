-- Guard the actual launch transition, not merely the organiser-facing readiness UI.
-- Runs inside launch_festival's transaction; a failure rolls back its snapshots.
CREATE OR REPLACE FUNCTION public.festival_require_main_sponsor_at_launch()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  ready boolean;
BEGIN
  IF NEW.launch_status IN ('launched', 'tickets_on_sale')
     AND (
       TG_OP = 'INSERT'
       OR OLD.launch_status NOT IN ('launched','tickets_on_sale','sales_paused','sales_closed')
     ) THEN
    SELECT r.sponsor_slots_ready INTO ready
    FROM public.festival_sponsor_slot_readiness r
    WHERE r.festival_company_id = NEW.festival_company_id;
    IF NOT coalesce(ready, false) THEN
      RAISE EXCEPTION 'festival_main_sponsor_required_for_launch'
        USING ERRCODE = '23514',
              DETAIL = 'A festival needs exactly one main sponsor, no more than four support sponsors, and no unassigned active historical sponsor contracts before launch.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS festival_require_main_sponsor_at_launch_trigger
  ON public.festival_launches;
CREATE TRIGGER festival_require_main_sponsor_at_launch_trigger
BEFORE INSERT OR UPDATE OF launch_status ON public.festival_launches
FOR EACH ROW EXECUTE FUNCTION public.festival_require_main_sponsor_at_launch();

COMMENT ON FUNCTION public.festival_require_main_sponsor_at_launch()
IS 'Enforces sponsor-slot readiness transactionally at first public launch; does not retroactively cancel already launched festivals.';

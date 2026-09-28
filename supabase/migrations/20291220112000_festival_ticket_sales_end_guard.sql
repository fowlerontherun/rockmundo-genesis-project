-- Block new ticket purchases after the festival end even if the launch status is stale.
-- Existing purchases and idempotent purchase retries remain untouched.
CREATE OR REPLACE FUNCTION public._festival_reject_late_ticket_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_end timestamptz; v_status text;
BEGIN
  SELECT (l.snapshot->>'endsAt')::timestamptz,l.launch_status INTO v_end,v_status
  FROM public.festival_launches l WHERE l.id=NEW.festival_launch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_ticket_product_unavailable'; END IF;
  IF v_status <> 'tickets_on_sale' THEN RAISE EXCEPTION 'festival_ticket_sales_not_open'; END IF;
  IF v_end IS NULL OR now() >= v_end THEN RAISE EXCEPTION 'festival_ticket_sales_closed'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._festival_reject_late_ticket_sale() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS festival_reject_late_ticket_sale ON public.festival_ticket_sales;
CREATE TRIGGER festival_reject_late_ticket_sale BEFORE INSERT ON public.festival_ticket_sales
FOR EACH ROW EXECUTE FUNCTION public._festival_reject_late_ticket_sale();

-- Automatically close festival ticket sales after the launch snapshot's end time.
-- Do not modify paid orders, issued tickets or settled festival records.
CREATE OR REPLACE FUNCTION public.close_expired_festival_ticket_sales()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_closed integer;
BEGIN
 UPDATE public.festival_launches l
 SET launch_status='sales_closed',updated_at=now()
 WHERE l.launch_status IN ('tickets_on_sale','sales_paused')
 AND l.snapshot ? 'endsAt'
 AND (l.snapshot->>'endsAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
 AND (l.snapshot->>'endsAt')::timestamptz <= now();
 GET DIAGNOSTICS v_closed = ROW_COUNT;
 RETURN v_closed;
END $$;
REVOKE ALL ON FUNCTION public.close_expired_festival_ticket_sales() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.close_expired_festival_ticket_sales() TO service_role;
SELECT cron.schedule('festival-close-expired-ticket-sales','*/5 * * * *','SELECT public.close_expired_festival_ticket_sales();');

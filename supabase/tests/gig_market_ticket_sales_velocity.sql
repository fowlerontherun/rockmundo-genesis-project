-- Run against a database with the market-led migration applied.
-- All assertions use the live functions, with no persistent test data.
BEGIN;
DO $$
DECLARE
  v_booked timestamptz := '2026-10-17 10:00+00'::timestamptz;
  v_show timestamptz := '2026-11-17 10:00+00'::timestamptz;
BEGIN
  -- A true 100k draw immediately fills a 2k club.
  IF public.gig_ticket_sales_goal(100000,2000,v_booked,v_booked,v_show) <> 2000
  THEN RAISE EXCEPTION '2k instant sellout failed'; END IF;

  -- 20k sells most of its tickets immediately and finishes within 24h.
  IF public.gig_ticket_sales_goal(100000,20000,v_booked,v_booked,v_show) < 10000
  THEN RAISE EXCEPTION '20k opening rush failed'; END IF;
  IF public.gig_ticket_sales_goal(100000,20000,v_booked + interval '25 hours',
    v_booked + interval '25 hours',v_show) <= 0
  THEN
    RAISE EXCEPTION 'booking-time baseline failed';
  END IF;
  IF public.gig_ticket_sales_goal(100000,20000,v_booked,
    v_booked + interval '25 hours',v_show) <> 20000
  THEN RAISE EXCEPTION '20k fast sellout failed'; END IF;

  -- 100k is not instant, but reaches its qualified demand within a week.
  IF public.gig_ticket_sales_goal(100000,100000,v_booked,v_booked,v_show) >= 100000
  THEN RAISE EXCEPTION '100k stadium incorrectly instant'; END IF;
  IF public.gig_ticket_sales_goal(100000,100000,v_booked,
    v_booked + interval '8 days',v_show) <> 100000
  THEN RAISE EXCEPTION '100k stadium delayed past one week'; END IF;

  -- Weak market demand never gets manufactured into a sellout.
  IF public.gig_ticket_sales_goal(350,2000,v_booked,
    v_booked + interval '20 days',v_show) > 350
  THEN RAISE EXCEPTION 'low-demand show oversold'; END IF;

  IF public.gig_ticket_sales_goal(100000,2000,v_booked,v_booked,v_show) <>
     public.gig_ticket_sales_goal(100000,2000,v_booked,v_booked,v_show)
  THEN RAISE EXCEPTION 'non-deterministic curve'; END IF;
END
$$;
-- Assert trigger order/cron and server-authoritative function existence.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.gigs'::regclass AND tgname='zz_seed_initial_gig_ticket_sales'
      AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'missing booking rush trigger'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname='advance-gig-ticket-sales-hourly' AND active
      AND schedule='15 * * * *'
  ) THEN RAISE EXCEPTION 'hourly ticket sales job missing'; END IF;
  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname='advance-gig-ticket-sales-daily' AND active
  ) THEN RAISE EXCEPTION 'duplicate legacy daily job'; END IF;
END
$$;
ROLLBACK;

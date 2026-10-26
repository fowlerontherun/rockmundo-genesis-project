-- Limit each daily record-sales edge execution to one release.
-- A durable receipt prevents duplicate payouts when pg_net retries.
CREATE TABLE IF NOT EXISTS public.daily_release_sales_claims (
  sale_date date NOT NULL,
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed','recovered')),
  error text,
  PRIMARY KEY (sale_date,release_id)
);
ALTER TABLE public.daily_release_sales_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_release_sales_claims FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.daily_release_sales_claims TO service_role;

CREATE OR REPLACE FUNCTION public.claim_next_daily_release_sale(p_sale_date date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_release_id uuid;
BEGIN
 IF p_sale_date IS NULL OR p_sale_date <> (now() AT TIME ZONE 'UTC')::date THEN
  RAISE EXCEPTION 'daily_sales_date_must_be_today_utc';
 END IF;
 SELECT r.id INTO v_release_id FROM public.releases r
 WHERE r.release_status='released'
   AND NOT EXISTS (
      SELECT 1 FROM public.daily_release_sales_claims c
      WHERE c.sale_date=p_sale_date AND c.release_id=r.id
   )
 ORDER BY r.id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF v_release_id IS NULL THEN RETURN NULL; END IF;
 INSERT INTO public.daily_release_sales_claims(sale_date,release_id)
 VALUES(p_sale_date,v_release_id) ON CONFLICT DO NOTHING
 RETURNING release_id INTO v_release_id;
 RETURN v_release_id;
END $fn$;
CREATE OR REPLACE FUNCTION public.finish_daily_release_sale(
 p_sale_date date,p_release_id uuid,p_status text,p_error text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_status NOT IN ('completed','failed') THEN RAISE EXCEPTION 'invalid_daily_sale_status'; END IF;
 UPDATE public.daily_release_sales_claims
 SET status=p_status, finished_at=now(), error=left(p_error,500)
 WHERE sale_date=p_sale_date AND release_id=p_release_id AND status='processing';
 RETURN FOUND;
END $fn$;
REVOKE ALL ON FUNCTION public.claim_next_daily_release_sale(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_daily_release_sale(date) TO service_role;
REVOKE ALL ON FUNCTION public.finish_daily_release_sale(date,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_daily_release_sale(date,uuid,text,text) TO service_role;

-- Each cron invocation processes one previously-unclaimed release.
-- 10-minute cadence accommodates all existing releases per UTC day.
DO $cron$ DECLARE v_job_id bigint; BEGIN
 SELECT jobid INTO STRICT v_job_id FROM cron.job WHERE jobname='generate-daily-sales';
 PERFORM cron.alter_job(v_job_id, schedule := '*/10 * * * *');
END $cron$;

-- Each UTC day of video simulation is allowed one worker, even under retries.
-- Failed runs stay claimed until finance-safe reconciliation; never blindly replay
-- after some video views and wallet credits may already have committed.
CREATE TABLE IF NOT EXISTS public.video_simulation_day_claims(
  run_date date PRIMARY KEY,
  status text NOT NULL DEFAULT 'started' CHECK(status IN('started','completed','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  last_error text
);
ALTER TABLE public.video_simulation_day_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.video_simulation_day_claims FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_video_simulation_day(p_day date)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_day IS NULL OR p_day > CURRENT_DATE + 1 THEN RAISE EXCEPTION 'Invalid simulation day'; END IF;
 INSERT INTO public.video_simulation_day_claims(run_date) VALUES(p_day)
 ON CONFLICT DO NOTHING;
 RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.claim_video_simulation_day(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_video_simulation_day(date) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_video_simulation_day(p_day date,p_success boolean,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.video_simulation_day_claims SET
   status=CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
   finished_at=now(),last_error=LEFT(p_error,500)
 WHERE run_date=p_day AND status='started';
 IF NOT FOUND THEN RAISE EXCEPTION 'No active simulation day claim'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.finish_video_simulation_day(date,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_video_simulation_day(date,boolean,text) TO service_role;

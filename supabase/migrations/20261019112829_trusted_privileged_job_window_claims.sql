-- Production receipt 20261019112829. Six scheduler-only window claims.
CREATE TABLE IF NOT EXISTS public.privileged_job_window_claims (
 job_name text NOT NULL,
 window_started_at timestamptz NOT NULL,
 claimed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (job_name,window_started_at),
 CONSTRAINT privileged_job_window_allowed CHECK (job_name IN
 ('generate-gig-offers','generate-pr-offers','generate-radio-invitations',
 'complete-release-manufacturing','process-tour-travel','auto-complete-gigs'))
);
ALTER TABLE public.privileged_job_window_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.privileged_job_window_claims FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.privileged_job_window_claims TO service_role;
CREATE OR REPLACE FUNCTION public.claim_privileged_job_window(p_job_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $claim$
DECLARE v_minutes integer;v_window timestamptz;
BEGIN
 v_minutes:=CASE p_job_name
 WHEN 'generate-gig-offers' THEN 360
 WHEN 'generate-pr-offers' THEN 360
 WHEN 'generate-radio-invitations' THEN 360
 WHEN 'complete-release-manufacturing' THEN 2
 WHEN 'process-tour-travel' THEN 60
 WHEN 'auto-complete-gigs' THEN 15 ELSE NULL END;
 IF v_minutes IS NULL THEN RAISE EXCEPTION 'unknown_internal_job_window'; END IF;
 v_window:=to_timestamp(floor(extract(epoch from clock_timestamp())/(v_minutes*60))*(v_minutes*60));
 INSERT INTO public.privileged_job_window_claims(job_name,window_started_at)
 VALUES(p_job_name,v_window) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('claimed',FOUND,'job_name',p_job_name,'window_started_at',v_window);
END $claim$;
REVOKE ALL ON FUNCTION public.claim_privileged_job_window(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_privileged_job_window(text) TO service_role;
